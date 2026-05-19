import { useMemo, useRef, useState } from "react";
import { Button } from "../../../../components/ui/Button.jsx";
import { Card } from "../../../../components/ui/Card.jsx";
import { apiFetch, ApiError } from "../../../../api/client.js";
import { BugHunterStage } from "./BugHunterStage.jsx";
import { DialogStage } from "./DialogStage.jsx";
import { pickBugHunterScenario } from "./bugHunter.js";
import { buildDialogRun } from "./dialog.js";

/**
 * Solo "Собеседование" — two fundamentally different mini-games behind a
 * single mode entry. At session start we coin-flip:
 *
 *   - Bug Hunter:  one buggy file, multi-select, timer. Find all bugs.
 *   - HR Dialog:   6-turn branching conversation with a live mood gauge.
 *
 * Both surfaces feed the same {correct, total} into
 * POST /matchmaking/interview/complete so the backend's verdict /
 * daily-PTS-cap logic stays untouched.
 */

const GRADES = [
  {
    id: "junior",
    title: "Junior",
    blurb: "Мягкий таймер, без PTS. Для разогрева.",
    bugHunterSeconds: 120,
    rewardPts: 0,
  },
  {
    id: "middle",
    title: "Middle",
    blurb: "Стандартный темп. +15 PTS за Offer (раз в сутки).",
    bugHunterSeconds: 90,
    rewardPts: 15,
  },
  {
    id: "senior",
    title: "Senior",
    blurb: "Жёсткий темп. +30 PTS за Offer.",
    bugHunterSeconds: 60,
    rewardPts: 30,
  },
];

const LAST_VERDICT_KEY = "codearena:interview:last";

function pickGame(random = Math.random) {
  return random() < 0.5 ? "bug-hunter" : "dialog";
}

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
        <div className="text-5xl">💼</div>
        <h2 className="mt-3 text-3xl font-bold text-foreground">Собеседование</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Случайно выпадает либо <b className="text-foreground">Bug Hunter</b> (найти все баги в файле),
          либо <b className="text-foreground">диалог с HR</b> (6 ходов с гейджем настроения). Получи Offer —
          забираешь PTS (раз в сутки на грейд).
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {GRADES.map((grade) => (
          <GradeCard key={grade.id} grade={grade} selected={gradeId === grade.id} onSelect={setGradeId} />
        ))}
      </div>

      {lastVerdict ? (
        <div className="mx-auto mt-5 max-w-md rounded-btn border border-border bg-elevated/30 px-4 py-3 text-center text-xs text-muted">
          Прошлый раунд: <b className="text-foreground">{lastVerdict.verdict}</b> в режиме{" "}
          <b className="text-foreground">{lastVerdict.game === "bug-hunter" ? "Bug Hunter" : "Диалог"}</b>{" "}
          на грейде <b className="text-foreground">{lastVerdict.grade}</b> — {lastVerdict.correct}/
          {lastVerdict.total}
          {lastVerdict.reward_pts > 0 ? ` (+${lastVerdict.reward_pts} PTS)` : ""}
        </div>
      ) : null}

      <div className="mt-6 flex justify-center">
        <Button onClick={onStart} className="min-w-[240px]">
          ▶ Начать (режим вслепую)
        </Button>
      </div>

      <div className="mx-auto mt-6 max-w-md rounded-btn border border-border/60 bg-elevated/30 px-4 py-3 text-xs text-muted">
        <p className="mb-1 font-semibold uppercase tracking-wider text-accent">Как оценивается</p>
        <p>🏆 <b className="text-foreground">Offer</b> — ≥85% правильных</p>
        <p>🔁 <b className="text-foreground">Next round</b> — ≥65%</p>
        <p>❌ <b className="text-foreground">Rejected</b> — меньше 65%</p>
      </div>
    </Card>
  );
}

function ResultScreen({ result, error, game, onRestart, onExit }) {
  if (error) {
    return (
      <Card className="p-8 text-center">
        <div className="text-5xl">⚠️</div>
        <h2 className="mt-3 text-2xl font-bold text-red-300">Не удалось отправить результат</h2>
        <p className="mt-2 text-sm text-muted">{error}</p>
        <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2 sm:flex-row">
          <Button onClick={onRestart} className="flex-1">🔄 Ещё раз</Button>
          <Button variant="secondary" onClick={onExit} className="flex-1">К режимам</Button>
        </div>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="p-8 text-center">
        <div className="text-4xl">⏳</div>
        <p className="mt-3 text-sm text-muted">Отправляем результат на проверку…</p>
      </Card>
    );
  }

  const verdictMeta = {
    offer: { emoji: "🏆", title: "Offer!", tone: "text-accent" },
    next_round: { emoji: "🔁", title: "Next round", tone: "text-amber-300" },
    rejected: { emoji: "❌", title: "Rejected", tone: "text-red-300" },
  }[result.verdict] ?? { emoji: "❓", title: result.verdict, tone: "text-foreground" };

  const pct = Math.round((result.accuracy ?? 0) * 100);
  const gameLabel = game === "bug-hunter" ? "Bug Hunter" : "Диалог с HR";

  return (
    <Card className="p-8 text-center">
      <div className="text-6xl">{verdictMeta.emoji}</div>
      <h2 className={`mt-3 text-3xl font-bold ${verdictMeta.tone}`}>{verdictMeta.title}</h2>
      <p className="mt-1 font-mono text-2xl font-bold text-foreground">
        {result.correct} <span className="text-muted">/</span> {result.total}
      </p>
      <p className="mt-1 text-sm text-muted">
        точность {pct}% · {gameLabel} · грейд {result.grade}
      </p>

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

      <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2 sm:flex-row">
        <Button onClick={onRestart} className="flex-1">🔄 Ещё раз</Button>
        <Button variant="secondary" onClick={onExit} className="flex-1">К режимам</Button>
      </div>
    </Card>
  );
}

export function InterviewMode() {
  const [phase, setPhase] = useState("intro"); // "intro" | "playing" | "done"
  const [gradeId, setGradeId] = useState("middle");
  const [game, setGame] = useState(null); // "bug-hunter" | "dialog"
  const [bugScenario, setBugScenario] = useState(null);
  const [dialogSlots, setDialogSlots] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [lastVerdict, setLastVerdict] = useState(loadLastVerdict);
  const submitGuardRef = useRef(false);

  const grade = useMemo(() => GRADES.find((g) => g.id === gradeId) ?? GRADES[1], [gradeId]);

  function startSession() {
    submitGuardRef.current = false;
    setError(null);
    setResult(null);
    const nextGame = pickGame();
    setGame(nextGame);
    if (nextGame === "bug-hunter") {
      setBugScenario(pickBugHunterScenario());
      setDialogSlots(null);
    } else {
      setDialogSlots(buildDialogRun());
      setBugScenario(null);
    }
    setPhase("playing");
  }

  async function handleSubmit({ correct, total }) {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
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
        game,
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
    if (phase === "playing" && game === "bug-hunter" && bugScenario) {
      return (
        <BugHunterStage
          scenario={bugScenario}
          durationSeconds={grade.bugHunterSeconds}
          onSubmit={handleSubmit}
        />
      );
    }
    if (phase === "playing" && game === "dialog" && dialogSlots) {
      return <DialogStage slots={dialogSlots} onSubmit={handleSubmit} />;
    }
    if (phase === "done") {
      return (
        <ResultScreen
          result={result}
          error={error}
          game={game}
          onRestart={startSession}
          onExit={() => setPhase("intro")}
        />
      );
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- view is derived; handlers read latest state imperatively
  }, [phase, game, bugScenario, dialogSlots, gradeId, lastVerdict, result, error]);

  return <div className="mx-auto max-w-3xl">{view}</div>;
}
