import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../../components/ui/Button.jsx";
import { Card } from "../../../../components/ui/Card.jsx";
import { ROUND_QUESTIONS, ROUND_SECONDS } from "../../questionBank.js";

const TOTAL_QUESTIONS = 10;
const HIGH_SCORE_KEY = "codearena:practice:best";

/**
 * Solo practice mode.
 *
 * Pure frontend: shuffles the live question bank, lets the player tackle
 * questions back-to-back with a per-question timer, scores correct answers,
 * and persists a personal best in localStorage. Designed as the warm-up
 * companion to the real duel — same questions, no opponent, no PTS at stake.
 *
 * Intentionally has zero backend coupling so it works even when there's no
 * one online to match with, which used to be a dead-end on a fresh deploy.
 */

function shuffle(array) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function loadHighScore() {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.score === "number") return parsed;
  } catch {
    /* ignore corrupt entry */
  }
  return null;
}

function saveHighScore(entry) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(entry));
  } catch {
    /* localStorage may be disabled (private mode) — silently no-op */
  }
}

function RoundTypeBadge({ type }) {
  const map = {
    output: { label: "⚡ Output", classes: "border-accent/40 bg-accent/10 text-accent" },
    bug: { label: "🐛 Найди баг", classes: "border-orange-500/40 bg-orange-500/10 text-orange-300" },
    quiz: { label: "🧠 Quiz", classes: "border-indigo-400/40 bg-indigo-400/10 text-indigo-300" },
  };
  const badge = map[type] ?? map.quiz;
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.classes}`}>
      {badge.label}
    </span>
  );
}

function TimerRing({ timeLeft, total = ROUND_SECONDS }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, timeLeft / total));
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

function IntroScreen({ onStart, highScore }) {
  return (
    <Card className="p-8 text-center">
      <div className="text-5xl">🎯</div>
      <h2 className="mt-3 text-3xl font-bold text-foreground">Тренировка</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        {TOTAL_QUESTIONS} случайных вопросов из дуэльного банка. {ROUND_SECONDS} секунд на ответ.
        Соперника нет — играешь против самого себя.
      </p>

      <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3">
        <div className="rounded-btn border border-border bg-elevated/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted">Вопросов</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">{TOTAL_QUESTIONS}</p>
        </div>
        <div className="rounded-btn border border-accent/30 bg-accent/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted">Личный рекорд</p>
          <p className="mt-1 font-mono text-2xl font-bold text-accent">
            {highScore ? `${highScore.score}/${highScore.total}` : "—"}
          </p>
        </div>
      </div>

      <Button onClick={onStart} className="mt-6 min-w-[200px]">
        ▶ Начать
      </Button>

      <div className="mx-auto mt-6 max-w-md rounded-btn border border-border/60 bg-elevated/30 px-4 py-3 text-left text-xs text-muted">
        <p className="mb-1 font-semibold uppercase tracking-wider text-accent">3 типа вопросов</p>
        <p>⚡ <b className="text-foreground">Output</b> — что выведет код</p>
        <p>🐛 <b className="text-foreground">Bug</b> — где ошибка</p>
        <p>🧠 <b className="text-foreground">Quiz</b> — теория</p>
      </div>
    </Card>
  );
}

function PlayingScreen({ question, qIndex, score, timeLeft, onAnswer, chosen }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RoundTypeBadge type={question.type} />
          <span className="font-mono text-xs text-muted">
            {qIndex + 1}/{TOTAL_QUESTIONS}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted">Очки</p>
            <p className="font-mono text-lg font-bold text-accent">{score}</p>
          </div>
          <TimerRing timeLeft={timeLeft} />
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

      {question.type === "quiz" ? (
        <p className="mt-4 text-lg font-semibold leading-snug text-foreground">{question.question}</p>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
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

function ResultScreen({ score, total, isNewRecord, onRestart, onExit }) {
  const pct = Math.round((score / total) * 100);
  const verdict =
    pct >= 90 ? { emoji: "🏆", title: "Гениально", tone: "text-accent" }
    : pct >= 70 ? { emoji: "💪", title: "Сильно", tone: "text-accent" }
    : pct >= 50 ? { emoji: "👌", title: "Норм", tone: "text-foreground" }
    : { emoji: "💀", title: "Не сегодня", tone: "text-red-300" };

  return (
    <Card className="p-8 text-center">
      <div className="text-6xl">{verdict.emoji}</div>
      <h2 className={`mt-3 text-3xl font-bold ${verdict.tone}`}>{verdict.title}</h2>
      <p className="mt-1 font-mono text-2xl font-bold text-foreground">
        {score} <span className="text-muted">/</span> {total}
      </p>
      <p className="mt-1 text-sm text-muted">точность {pct}%</p>

      {isNewRecord ? (
        <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-4 py-1.5 text-sm font-bold text-accent">
          ⭐ Новый рекорд!
        </div>
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

export function PracticeMode() {
  const [phase, setPhase] = useState("intro"); // "intro" | "playing" | "done"
  const [queue, setQueue] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [highScore, setHighScore] = useState(loadHighScore);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const timerRef = useRef(null);
  const advanceTimerRef = useRef(null);

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

  // Cleanup any pending timers on unmount so nothing fires after we're gone.
  useEffect(() => clearTimers, []);

  function startSession() {
    clearTimers();
    const next = shuffle(ROUND_QUESTIONS).slice(0, TOTAL_QUESTIONS);
    setQueue(next);
    setQIndex(0);
    setScore(0);
    setChosen(null);
    setTimeLeft(ROUND_SECONDS);
    setIsNewRecord(false);
    setPhase("playing");
  }

  function finishSession(finalScore) {
    clearTimers();
    const newRecord = !highScore || finalScore > highScore.score;
    if (newRecord && finalScore > 0) {
      const entry = { score: finalScore, total: TOTAL_QUESTIONS, savedAt: Date.now() };
      saveHighScore(entry);
      setHighScore(entry);
      setIsNewRecord(true);
    }
    setPhase("done");
  }

  // Question countdown timer.
  useEffect(() => {
    if (phase !== "playing" || chosen != null) return undefined;
    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up — treat as wrong answer to keep the flow moving.
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
  }, [phase, chosen, qIndex]);

  // After an answer (or timeout) → wait briefly to show feedback, then advance.
  useEffect(() => {
    if (phase !== "playing" || chosen == null) return undefined;
    advanceTimerRef.current = window.setTimeout(() => {
      const correct = current?.answer === chosen;
      const nextScore = correct ? score + 1 : score;
      if (correct) setScore(nextScore);
      const nextIndex = qIndex + 1;
      if (nextIndex >= queue.length) {
        finishSession(nextScore);
      } else {
        setQIndex(nextIndex);
        setChosen(null);
        setTimeLeft(ROUND_SECONDS);
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

  const view = useMemo(() => {
    if (phase === "intro") {
      return <IntroScreen onStart={startSession} highScore={highScore} />;
    }
    if (phase === "playing" && current) {
      return (
        <PlayingScreen
          question={current}
          qIndex={qIndex}
          score={score}
          timeLeft={timeLeft}
          chosen={chosen}
          onAnswer={(opt) => setChosen(opt)}
        />
      );
    }
    if (phase === "done") {
      return (
        <ResultScreen
          score={score}
          total={TOTAL_QUESTIONS}
          isNewRecord={isNewRecord}
          onRestart={startSession}
          onExit={() => setPhase("intro")}
        />
      );
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- view is a derived render, deps tracked in components
  }, [phase, current, qIndex, score, timeLeft, chosen, highScore, isNewRecord]);

  return <div className="mx-auto max-w-3xl">{view}</div>;
}
