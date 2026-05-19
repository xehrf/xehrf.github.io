import { useMemo, useRef, useState } from "react";
import { Button } from "../../../../components/ui/Button.jsx";
import { Card } from "../../../../components/ui/Card.jsx";
import { apiFetch, ApiError } from "../../../../api/client.js";
import { GlitchStage } from "./GlitchStage.jsx";
import { pickGlitchScenario } from "./glitch.js";

/**
 * Solo "Собеседование" — on-call incident response sim.
 *
 * Player gets one of several pre-baked incident scenarios, navigates a
 * production-like terminal with timed cooldowns on each action, and tries
 * to apply the correct fix before the timer runs out (or cascade fires).
 *
 * Gameplay is investigation + judgement under pressure — NOT
 * "find the right answer from a list". Each replay is a different
 * scenario, and the same scenario can be approached multiple ways.
 *
 * Backend coupling is a single POST to /matchmaking/interview/complete
 * with {correct, total}, same as before — the verdict and daily PTS cap
 * are unchanged.
 */

const GRADES = [
  {
    id: "junior",
    title: "Junior",
    blurb: "120 секунд на инцидент, кулдауны мягкие. Без PTS — для практики.",
    incidentSeconds: 120,
    rewardPts: 0,
  },
  {
    id: "middle",
    title: "Middle",
    blurb: "90 секунд. +15 PTS за Offer (раз в сутки).",
    incidentSeconds: 90,
    rewardPts: 15,
  },
  {
    id: "senior",
    title: "Senior",
    blurb: "60 секунд. Кулдауны жёсткие. +30 PTS за Offer.",
    incidentSeconds: 60,
    rewardPts: 30,
  },
];

const LAST_VERDICT_KEY = "codearena:interview:last";

function loadLastVerdict() {
  try {
    const raw = localStorage.getItem(LAST_VERDICT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveLastVerdict(entry) {
  try {
    localStorage.setItem(LAST_VERDICT_KEY, JSON.stringify(entry));
  } catch {
    /* private mode — silently no-op */
  }
}

function GradeCard({ grade, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(grade.id)}
      className={`flex flex-col gap-2 rounded-btn border p-4 text-left transition-all ${
        selected
          ? "border-accent bg-accent/10 text-foreground"
          : "border-border bg-elevated/40 text-foreground hover:border-accent/40"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-bold">{grade.title}</span>
        <span className="font-mono text-xs text-accent">
          {grade.rewardPts > 0 ? `+${grade.rewardPts} PTS` : "тренировка"}
        </span>
      </div>
      <p className="text-xs text-muted">{grade.blurb}</p>
    </button>
  );
}

function IntroScreen({ onStart, gradeId, setGradeId, lastVerdict }) {
  return (
    <Card className="p-8">
      <div className="text-center">
        <div className="text-5xl">🚨</div>
        <h2 className="mt-3 text-3xl font-bold text-foreground">Глитч в системе</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          Ты — дежурный SRE. Прилетит инцидент: 4 сервиса, шумные логи, метрики.
          У тебя <b className="text-foreground">6 команд</b>: tail logs, restart svc,
          check db locks, scale up, rollback, inspect metric. Investigation помогает
          строить гипотезу, fix может стабилизировать прод. У каждого действия свой кулдаун.
          Найди корневую причину и примени правильный фикс <b className="text-foreground">до того, как каскад сожрёт половину прода</b>.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {GRADES.map((grade) => (
          <GradeCard key={grade.id} grade={grade} selected={gradeId === grade.id} onSelect={setGradeId} />
        ))}
      </div>

      {lastVerdict ? (
        <div className="mx-auto mt-5 max-w-md rounded-btn border border-border bg-elevated/30 px-4 py-3 text-center text-xs text-muted">
          Прошлый инцидент:{" "}
          <b className="text-foreground">{lastVerdict.verdict}</b> на грейде{" "}
          <b className="text-foreground">{lastVerdict.grade}</b> — {lastVerdict.correct}/
          {lastVerdict.total}
          {lastVerdict.reward_pts > 0 ? ` (+${lastVerdict.reward_pts} PTS)` : ""}
        </div>
      ) : null}

      <div className="mt-6 flex justify-center">
        <Button onClick={onStart} className="min-w-[240px]">
          ▶ Принять смену
        </Button>
      </div>

      <div className="mx-auto mt-6 max-w-lg rounded-btn border border-border/60 bg-elevated/30 px-4 py-3 text-xs text-muted">
        <p className="mb-1 font-semibold uppercase tracking-wider text-accent">Как оценивается</p>
        <p>🏆 <b className="text-foreground">Offer</b> — правильный фикс + хотя бы 2 investigation шага, без ошибочных действий</p>
        <p>🔁 <b className="text-foreground">Next round</b> — фикс есть, но было ошибочное действие или нулевая разведка</p>
        <p>❌ <b className="text-foreground">Rejected</b> — фикс не применён или применён неправильный</p>
      </div>
    </Card>
  );
}

function OutcomeBadge({ outcome }) {
  const map = {
    fixed: { emoji: "✅", label: "Incident contained", tone: "text-emerald-300" },
    timeout: { emoji: "⏱", label: "Время вышло", tone: "text-orange-300" },
    cascaded: { emoji: "💥", label: "Каскадный отказ", tone: "text-red-300" },
  };
  const meta = map[outcome] ?? { emoji: "❓", label: outcome, tone: "text-foreground" };
  return (
    <p className={`text-xs font-bold ${meta.tone}`}>
      {meta.emoji} {meta.label}
    </p>
  );
}

function ResultScreen({ result, error, breakdown, outcome, scenario, onRestart, onExit }) {
  if (error) {
    return (
      <Card className="p-8 text-center">
        <div className="text-5xl">⚠️</div>
        <h2 className="mt-3 text-2xl font-bold text-red-300">Не удалось отправить результат</h2>
        <p className="mt-2 text-sm text-muted">{error}</p>
        <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2 sm:flex-row">
          <Button onClick={onRestart} className="flex-1">🔄 Ещё инцидент</Button>
          <Button variant="secondary" onClick={onExit} className="flex-1">К режимам</Button>
        </div>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="p-8 text-center">
        <div className="text-4xl">⏳</div>
        <p className="mt-3 text-sm text-muted">Отправляем результат…</p>
      </Card>
    );
  }

  const verdictMeta = {
    offer: { emoji: "🏆", title: "Offer!", tone: "text-accent" },
    next_round: { emoji: "🔁", title: "Next round", tone: "text-amber-300" },
    rejected: { emoji: "❌", title: "Rejected", tone: "text-red-300" },
  }[result.verdict] ?? { emoji: "❓", title: result.verdict, tone: "text-foreground" };

  const pct = Math.round((result.accuracy ?? 0) * 100);

  return (
    <Card className="p-6 sm:p-8">
      <div className="text-center">
        <div className="text-6xl">{verdictMeta.emoji}</div>
        <h2 className={`mt-3 text-3xl font-bold ${verdictMeta.tone}`}>{verdictMeta.title}</h2>
        <p className="mt-1 font-mono text-2xl font-bold text-foreground">
          {result.correct} <span className="text-muted">/</span> {result.total}
        </p>
        <p className="mt-1 text-sm text-muted">
          точность {pct}% · грейд {result.grade}
        </p>
        <div className="mt-2">
          <OutcomeBadge outcome={outcome} />
        </div>

        {result.reward_pts > 0 ? (
          <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-4 py-1.5 text-sm font-bold text-accent">
            +{result.reward_pts} PTS · теперь {result.updated_pts}
          </div>
        ) : null}

        {result.already_claimed_today ? (
          <p className="mx-auto mt-3 max-w-md text-xs text-muted">
            Награда за этот грейд уже получена сегодня. Попробуй другой грейд или возвращайся завтра.
          </p>
        ) : null}
      </div>

      {breakdown ? (
        <div className="mx-auto mt-6 max-w-lg rounded-btn border border-border bg-elevated/30 px-4 py-3 text-xs">
          <p className="mb-2 font-semibold uppercase tracking-wider text-muted">Разбор</p>
          <ul className="space-y-1">
            <li>
              {breakdown.correctFixApplied ? "✅" : "❌"} Правильный фикс{" "}
              <span className="text-muted">(+7)</span>
            </li>
            <li>
              📋 Investigation шагов: {breakdown.investigationCount}{" "}
              <span className="text-muted">(+{breakdown.investigationCount} из 3)</span>
            </li>
            <li>
              {breakdown.wrongFixCount === 0 ? "✅" : "⚠️"} Ошибочных действий:{" "}
              {breakdown.wrongFixCount}{" "}
              <span className="text-muted">(-{breakdown.wrongFixCount * 2})</span>
            </li>
          </ul>
          {scenario ? (
            <div className="mt-3 rounded border border-border/60 bg-black/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-accent">
                Корневая причина
              </p>
              <p className="mt-1 text-foreground">{scenario.explanation}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2 sm:flex-row">
        <Button onClick={onRestart} className="flex-1">🔄 Ещё инцидент</Button>
        <Button variant="secondary" onClick={onExit} className="flex-1">К режимам</Button>
      </div>
    </Card>
  );
}

export function InterviewMode() {
  const [phase, setPhase] = useState("intro"); // "intro" | "playing" | "done"
  const [gradeId, setGradeId] = useState("middle");
  const [scenario, setScenario] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [lastVerdict, setLastVerdict] = useState(loadLastVerdict);
  const submitGuardRef = useRef(false);

  const grade = useMemo(() => GRADES.find((g) => g.id === gradeId) ?? GRADES[1], [gradeId]);

  function startSession() {
    submitGuardRef.current = false;
    setError(null);
    setResult(null);
    setBreakdown(null);
    setOutcome(null);
    setScenario(pickGlitchScenario());
    setPhase("playing");
  }

  async function handleStageSubmit({ correct, total, outcome: stageOutcome, breakdown: stageBreakdown }) {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    setBreakdown(stageBreakdown);
    setOutcome(stageOutcome);
    setPhase("done");
    try {
      const data = await apiFetch("/matchmaking/interview/complete", {
        method: "POST",
        body: { grade: grade.id, correct, total },
      });
      setResult(data);
      const entry = {
        verdict: data.verdict,
        grade: data.grade,
        correct: data.correct,
        total: data.total,
        reward_pts: data.reward_pts,
      };
      saveLastVerdict(entry);
      setLastVerdict(entry);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Сеть недоступна. Попробуй ещё раз.";
      setError(message);
    }
  }

  const view = useMemo(() => {
    if (phase === "intro") {
      return (
        <IntroScreen
          onStart={startSession}
          gradeId={gradeId}
          setGradeId={setGradeId}
          lastVerdict={lastVerdict}
        />
      );
    }
    if (phase === "playing" && scenario) {
      return (
        <GlitchStage
          scenario={scenario}
          durationSeconds={grade.incidentSeconds}
          onSubmit={handleStageSubmit}
        />
      );
    }
    if (phase === "done") {
      return (
        <ResultScreen
          result={result}
          error={error}
          breakdown={breakdown}
          outcome={outcome}
          scenario={scenario}
          onRestart={startSession}
          onExit={() => setPhase("intro")}
        />
      );
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- view is derived
  }, [phase, scenario, gradeId, lastVerdict, result, error, breakdown, outcome]);

  return <div className="mx-auto max-w-5xl">{view}</div>;
}
