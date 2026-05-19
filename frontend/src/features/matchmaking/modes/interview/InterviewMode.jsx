import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../../components/ui/Button.jsx";
import { Card } from "../../../../components/ui/Card.jsx";
import { apiFetch, ApiError } from "../../../../api/client.js";
import { ROUND_QUESTIONS } from "../../questionBank.js";

/**
 * Solo "Собеседование" mode.
 *
 * Three-stage round (screening → algorithmic stand-in → behavioral) framed
 * as a fake job interview. Grade picks the difficulty band, count of
 * screening questions, per-question timer and the reward tier on Offer.
 *
 * Pure frontend except for the final POST to /matchmaking/interview/complete
 * which awards a daily-capped PTS bonus on Offer. Designed to ride on top of
 * the existing `questionBank` instead of growing new database tables — the
 * free-tier Neon/Render footprint stays unchanged.
 */

const GRADES = [
  {
    id: "junior",
    title: "Junior",
    blurb: "Базовая теория, лёгкие баги. Мягкий таймер, без PTS — для разогрева.",
    screening: 3,
    timer: 20,
    rewardPts: 0,
    prefers: ["quiz"],
  },
  {
    id: "middle",
    title: "Middle",
    blurb: "Смесь output / bug / quiz. 15 секунд на вопрос. +15 PTS за Offer.",
    screening: 4,
    timer: 15,
    rewardPts: 15,
    prefers: ["quiz", "output", "bug"],
  },
  {
    id: "senior",
    title: "Senior",
    blurb: "Преимущественно код. 12 секунд. +30 PTS за Offer (раз в сутки).",
    screening: 5,
    timer: 12,
    rewardPts: 30,
    prefers: ["output", "bug"],
  },
];

const BEHAVIORAL = {
  junior: [
    {
      question: "Тимлид на ревью указал, что твой код можно упростить. Что делаешь?",
      options: [
        "Поблагодарю, разберусь и перепишу",
        "Объясню, почему сделал именно так, и оставлю",
        "Скажу, что задача срочная — поправим позже",
        "Перепишу молча, чтобы не задавать глупых вопросов",
      ],
      answer: "Поблагодарю, разберусь и перепишу",
      explanation: "Junior учится на ревью; молчаливая переписка без понимания — антипаттерн.",
    },
    {
      question: "Застрял на задаче — потратил уже 2 часа. Какой следующий шаг?",
      options: [
        "Сформулирую вопрос и спрошу команду",
        "Продолжу разбираться сам — нельзя отвлекать",
        "Скопирую первое решение со Stack Overflow",
        "Скажу менеджеру, что задача невыполнима",
      ],
      answer: "Сформулирую вопрос и спрошу команду",
      explanation: "После ~1 часа тупика — спросить, иначе блокируешь себя и спринт.",
    },
    {
      question: "Не успеваешь к дедлайну. Лучшее действие?",
      options: [
        "Сообщить заранее с новой оценкой",
        "Поработать ночью и сдать вовремя любой ценой",
        "Сдать наполовину сделанное, заметив в PR",
        "Промолчать и надеяться, что не заметят",
      ],
      answer: "Сообщить заранее с новой оценкой",
      explanation: "Прозрачность важнее героизма: команде нужно успеть перепланировать.",
    },
  ],
  middle: [
    {
      question: "PR джуна работает, но написан плохо. Что напишешь в комментариях?",
      options: [
        "Покажу конкретные места и предложу альтернативы с объяснением",
        "Поставлю «requested changes» без деталей — пусть сам разберётся",
        "Одобрю — формально работает, доделает в следующем PR",
        "Перепишу за него и закоммичу в его ветку",
      ],
      answer: "Покажу конкретные места и предложу альтернативы с объяснением",
      explanation: "Ревью — это обучение. Конкретика и альтернативы важнее вердикта.",
    },
    {
      question: "Прод лежит, ты не знаешь причины. Первая реакция?",
      options: [
        "Откатить последний релиз и затем искать причину",
        "Лезть в код и искать баг — откат может потерять данные",
        "Написать постмортем и созвать митинг",
        "Подождать — может само поднимется",
      ],
      answer: "Откатить последний релиз и затем искать причину",
      explanation: "Стабилизация продакшена первична. Дебаг идёт после rollback.",
    },
    {
      question: "Продакт просит фичу, которая ломает архитектуру. Реакция?",
      options: [
        "Объясню риски и предложу альтернативу с теми же бизнес-выгодами",
        "Соглашусь — продакт лучше понимает приоритеты",
        "Откажу: фичи, которые ломают код, не обсуждаются",
        "Сделаю «как просили», а заодно отрефакторю всё подряд",
      ],
      answer: "Объясню риски и предложу альтернативу с теми же бизнес-выгодами",
      explanation: "Middle не блокирует и не подчиняется молча — обсуждает trade-off.",
    },
  ],
  senior: [
    {
      question: "Команда хочет переписать сервис с нуля на новой технологии. Твоя позиция?",
      options: [
        "Соберу метрики текущей боли и проверю, решит ли переписывание корень проблемы",
        "Поддержу: новый стек всегда даёт прирост",
        "Откажу: rewrite — это смерть продукта",
        "Передам решение CTO — это не моя зона ответственности",
      ],
      answer: "Соберу метрики текущей боли и проверю, решит ли переписывание корень проблемы",
      explanation: "Senior принимает решения на данных, а не эмоциях. Rewrite оправдан только при системной боли.",
    },
    {
      question: "Между двумя джунами в команде конфликт по код-стайлу. Что делаешь?",
      options: [
        "Введу автоматический линтер/форматтер, чтобы убрать предмет спора",
        "Назначу одного «правым» и закрою тему",
        "Проведу встречу и пусть решат сами",
        "Игнорирую — это их личные отношения",
      ],
      answer: "Введу автоматический линтер/форматтер, чтобы убрать предмет спора",
      explanation: "Senior устраняет источник конфликта системно, а не разбирает каждый случай.",
    },
    {
      question: "Junior реализовал критичную фичу за день — но без тестов. Что важно сделать?",
      options: [
        "Похвалить за скорость, но настоять на тестах до мержа — и объяснить, почему именно для этой фичи",
        "Отклонить PR — без тестов в прод нельзя",
        "Влить как есть — фича срочная, тесты допишет в следующем PR",
        "Сам дописать тесты — быстрее, чем учить",
      ],
      answer: "Похвалить за скорость, но настоять на тестах до мержа — и объяснить, почему именно для этой фичи",
      explanation: "Senior хвалит за результат, защищает качество, и учит — всё сразу.",
    },
  ],
};

function shuffle(array) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildScreening(grade) {
  // Bias the sample toward question types preferred for this grade so the
  // run *feels* different at each grade even though it's the same bank.
  const preferred = ROUND_QUESTIONS.filter((q) => grade.prefers.includes(q.type));
  const pool = preferred.length >= grade.screening ? preferred : ROUND_QUESTIONS;
  return shuffle(pool).slice(0, grade.screening);
}

function buildBehavioral(gradeId) {
  return shuffle(BEHAVIORAL[gradeId] ?? BEHAVIORAL.junior);
}

function StageBadge({ stage }) {
  const map = {
    screening: { label: "📋 Скрининг", classes: "border-indigo-400/40 bg-indigo-400/10 text-indigo-300" },
    behavioral: { label: "🤝 Soft skills", classes: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
  };
  const badge = map[stage] ?? map.screening;
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.classes}`}>
      {badge.label}
    </span>
  );
}

function TimerRing({ timeLeft, total }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.max(0, Math.min(1, timeLeft / total)) : 0;
  const offset = circumference * (1 - pct);
  const color = pct > 0.5 ? "#FFD700" : pct > 0.25 ? "#f97316" : "#ef4444";
  return (
    <div className="relative flex h-14 w-14 items-center justify-center">
      <svg width="56" height="56" className="absolute" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }}
        />
      </svg>
      <span className="relative font-mono text-lg font-bold tabular-nums" style={{ color }}>
        {timeLeft}
      </span>
    </div>
  );
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
          Скрининг + soft skills в одном раунде. Получи Offer — забираешь PTS (раз в сутки на грейд).
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {GRADES.map((grade) => (
          <GradeCard key={grade.id} grade={grade} selected={gradeId === grade.id} onSelect={setGradeId} />
        ))}
      </div>

      {lastVerdict ? (
        <div className="mx-auto mt-5 max-w-md rounded-btn border border-border bg-elevated/30 px-4 py-3 text-center text-xs text-muted">
          Прошлый раунд: <b className="text-foreground">{lastVerdict.verdict}</b> на грейде{" "}
          <b className="text-foreground">{lastVerdict.grade}</b> — {lastVerdict.correct}/{lastVerdict.total}
          {lastVerdict.reward_pts > 0 ? ` (+${lastVerdict.reward_pts} PTS)` : ""}
        </div>
      ) : null}

      <div className="mt-6 flex justify-center">
        <Button onClick={onStart} className="min-w-[200px]">
          ▶ Начать интервью
        </Button>
      </div>

      <div className="mx-auto mt-6 max-w-md rounded-btn border border-border/60 bg-elevated/30 px-4 py-3 text-xs text-muted">
        <p className="mb-1 font-semibold uppercase tracking-wider text-accent">Как оценивается</p>
        <p>🏆 <b className="text-foreground">Offer</b> — ≥85% правильных ответов</p>
        <p>🔁 <b className="text-foreground">Next round</b> — ≥65% (приглашают на следующий этап)</p>
        <p>❌ <b className="text-foreground">Rejected</b> — меньше 65%</p>
      </div>
    </Card>
  );
}

function QuestionScreen({
  stage,
  question,
  qIndex,
  totalInStage,
  totalAll,
  globalIndex,
  score,
  timeLeft,
  timerTotal,
  chosen,
  onAnswer,
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StageBadge stage={stage} />
          <span className="font-mono text-xs text-muted">
            {globalIndex + 1}/{totalAll} · {qIndex + 1}/{totalInStage} в этапе
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted">Очки</p>
            <p className="font-mono text-lg font-bold text-accent">{score}</p>
          </div>
          <TimerRing timeLeft={timeLeft} total={timerTotal} />
        </div>
      </div>

      {question.type === "output" ? (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted">Что выведет в консоль?</p>
          <pre className="overflow-x-auto rounded-btn border border-emerald-400/20 bg-black/50 px-4 py-3 font-mono text-sm text-emerald-300">
            {question.code}
          </pre>
        </div>
      ) : null}

      {question.type === "bug" ? (
        <div className="mt-4">
          <p className="mb-1 text-xs uppercase tracking-wider text-muted">Задача: {question.description}</p>
          <p className="mb-2 text-xs text-orange-400">Найди строку с багом 👇</p>
          <pre className="overflow-x-auto rounded-btn border border-orange-500/20 bg-black/50 px-4 py-3 font-mono text-sm text-orange-200">
            {question.code}
          </pre>
        </div>
      ) : null}

      {question.type === "quiz" || question.type === "behavioral" ? (
        <p className="mt-4 text-lg font-semibold leading-snug text-foreground">{question.question}</p>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-2">
        {question.options.map((option) => {
          const isChosen = chosen === option;
          const isCorrect = isChosen && option === question.answer;
          const isWrong = isChosen && option !== question.answer;
          const className = isCorrect
            ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
            : isWrong
              ? "border-red-500/60 bg-red-500/15 text-red-300"
              : chosen && option === question.answer
                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                : "border-border bg-elevated/40 text-foreground hover:border-accent/40";
          return (
            <button
              key={option}
              type="button"
              onClick={() => onAnswer(option)}
              disabled={Boolean(chosen)}
              className={`rounded-btn border px-3 py-3 text-left text-sm font-medium transition-all disabled:cursor-not-allowed ${className}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {chosen ? (
        <div className="mt-4 rounded-btn border border-border bg-elevated/30 px-4 py-3 text-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted">Объяснение</p>
          <p className="mt-1 text-foreground">{question.explanation}</p>
        </div>
      ) : null}
    </Card>
  );
}

function ResultScreen({ result, error, onRestart, onExit }) {
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

  return (
    <Card className="p-8 text-center">
      <div className="text-6xl">{verdictMeta.emoji}</div>
      <h2 className={`mt-3 text-3xl font-bold ${verdictMeta.tone}`}>{verdictMeta.title}</h2>
      <p className="mt-1 font-mono text-2xl font-bold text-foreground">
        {result.correct} <span className="text-muted">/</span> {result.total}
      </p>
      <p className="mt-1 text-sm text-muted">точность {pct}% · грейд {result.grade}</p>

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

      <p className="mx-auto mt-6 max-w-sm text-xs text-muted">
        Готов к настоящему бою? Переключись на «Дуэль 1v1» и ставь PTS на кон.
      </p>
    </Card>
  );
}

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

function saveLastVerdict(result) {
  try {
    localStorage.setItem(LAST_VERDICT_KEY, JSON.stringify(result));
  } catch {
    /* private mode — silently no-op */
  }
}

export function InterviewMode() {
  const [phase, setPhase] = useState("intro"); // "intro" | "playing" | "done"
  const [gradeId, setGradeId] = useState("middle");
  const [queue, setQueue] = useState([]); // [{stage, question, timer}]
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [lastVerdict, setLastVerdict] = useState(loadLastVerdict);

  const timerRef = useRef(null);
  const advanceTimerRef = useRef(null);
  const submitGuardRef = useRef(false);

  const grade = useMemo(() => GRADES.find((g) => g.id === gradeId) ?? GRADES[1], [gradeId]);
  const current = queue[qIndex] ?? null;

  function clearTimers() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  useEffect(() => clearTimers, []);

  function buildQueueFor(g) {
    const screening = buildScreening(g).map((q) => ({ stage: "screening", question: q, timer: g.timer }));
    const behavioral = buildBehavioral(g.id).map((q) => ({
      stage: "behavioral",
      // Behavioral questions don't carry a `type` — tag them so the
      // QuestionScreen renders the prose layout instead of code blocks.
      question: { ...q, type: "behavioral" },
      timer: 25,
    }));
    return [...screening, ...behavioral];
  }

  function startSession() {
    clearTimers();
    setError(null);
    setResult(null);
    submitGuardRef.current = false;
    const next = buildQueueFor(grade);
    setQueue(next);
    setQIndex(0);
    setScore(0);
    setChosen(null);
    setTimeLeft(next[0]?.timer ?? grade.timer);
    setPhase("playing");
  }

  async function submitResult(finalScore, totalCount) {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    try {
      const data = await apiFetch("/matchmaking/interview/complete", {
        method: "POST",
        body: { grade: grade.id, correct: finalScore, total: totalCount },
      });
      setResult(data);
      saveLastVerdict({
        verdict: data.verdict,
        grade: data.grade,
        correct: data.correct,
        total: data.total,
        reward_pts: data.reward_pts,
      });
      setLastVerdict({
        verdict: data.verdict,
        grade: data.grade,
        correct: data.correct,
        total: data.total,
        reward_pts: data.reward_pts,
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Сеть недоступна. Попробуй ещё раз.";
      setError(message);
    }
  }

  function finishSession(finalScore) {
    clearTimers();
    setPhase("done");
    void submitResult(finalScore, queue.length);
  }

  // Per-question countdown.
  useEffect(() => {
    if (phase !== "playing" || chosen != null || !current) return undefined;
    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
          setChosen("__timeout__");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, chosen, qIndex, current]);

  // After an answer / timeout — pause briefly to show feedback, then advance.
  useEffect(() => {
    if (phase !== "playing" || chosen == null || !current) return undefined;
    advanceTimerRef.current = window.setTimeout(() => {
      const correct = current.question.answer === chosen;
      const nextScore = correct ? score + 1 : score;
      if (correct) setScore(nextScore);
      const nextIndex = qIndex + 1;
      if (nextIndex >= queue.length) {
        finishSession(nextScore);
      } else {
        setQIndex(nextIndex);
        setChosen(null);
        setTimeLeft(queue[nextIndex]?.timer ?? grade.timer);
      }
    }, 1500);
    return () => {
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finishSession reads its inputs imperatively
  }, [chosen, phase]);

  const screeningCount = grade.screening;
  const totalAll = queue.length;
  const stageIndexInGroup = current
    ? current.stage === "screening"
      ? qIndex
      : qIndex - screeningCount
    : 0;
  const totalInStage = current
    ? current.stage === "screening"
      ? screeningCount
      : totalAll - screeningCount
    : 0;

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
    if (phase === "playing" && current) {
      return (
        <QuestionScreen
          stage={current.stage}
          question={current.question}
          qIndex={stageIndexInGroup}
          totalInStage={totalInStage}
          totalAll={totalAll}
          globalIndex={qIndex}
          score={score}
          timeLeft={timeLeft}
          timerTotal={current.timer}
          chosen={chosen}
          onAnswer={(opt) => setChosen(opt)}
        />
      );
    }
    if (phase === "done") {
      return (
        <ResultScreen
          result={result}
          error={error}
          onRestart={startSession}
          onExit={() => setPhase("intro")}
        />
      );
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- view is derived
  }, [phase, current, qIndex, score, timeLeft, chosen, gradeId, lastVerdict, result, error]);

  return <div className="mx-auto max-w-3xl">{view}</div>;
}
