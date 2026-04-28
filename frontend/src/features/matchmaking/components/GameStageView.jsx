import {
  ROUND_SECONDS,
} from "../questionBank.js";

function TimerRing({ timeLeft, total = ROUND_SECONDS }) {
  const pct = timeLeft / total;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const color = pct > 0.5 ? "#FFD600" : pct > 0.25 ? "#f97316" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 68, height: 68 }}>
      <svg width="68" height="68" style={{ transform: "rotate(-90deg)", position: "absolute" }}>
        <circle cx="34" cy="34" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle
          cx="34"
          cy="34"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }}
        />
      </svg>
      <span className="relative z-10 text-xl font-black" style={{ color }}>{timeLeft}</span>
    </div>
  );
}

export function ScoreBar({ myScore, opponentScore, totalRounds, myName, opponentName }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-[60px] text-right">
        <div className="truncate text-xs text-white/50">{myName}</div>
        <div className="text-2xl font-black text-[#FFD600]">{myScore}</div>
      </div>
      <div className="flex-1">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(myScore / totalRounds) * 100}%`,
              background: "linear-gradient(90deg, #b79000, #FFD600)",
            }}
          />
        </div>
        <div className="mt-1 flex justify-center">
          <span className="text-[10px] uppercase tracking-widest text-white/35">
            Раунд {Math.min(myScore + opponentScore + 1, totalRounds)} / {totalRounds}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="ml-auto h-full rounded-full transition-all duration-500"
            style={{
              width: `${(opponentScore / totalRounds) * 100}%`,
              background: "linear-gradient(270deg, #6366f1, #818cf8)",
            }}
          />
        </div>
      </div>
      <div className="min-w-[60px]">
        <div className="truncate text-xs text-white/50">{opponentName}</div>
        <div className="text-2xl font-black text-indigo-400">{opponentScore}</div>
      </div>
    </div>
  );
}

function RoundTypeBadge({ type }) {
  const map = {
    output: { label: "⚡ Угадай output", color: "#FFD600", bg: "rgba(255,214,0,0.12)" },
    bug: { label: "🐛 Найди баг", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
    quiz: { label: "🧠 Быстрый Quiz", color: "#818cf8", bg: "rgba(129,140,248,0.15)" },
  };
  const badge = map[type] ?? map.quiz;

  return (
    <span
      className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
      style={{ color: badge.color, background: badge.bg, border: `1px solid ${badge.color}44` }}
    >
      {badge.label}
    </span>
  );
}

function GameWaiting({ onStart, opponentName, totalRounds, canStartGame }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
      <div className="text-5xl">⚔️</div>
      <div>
        <p className="text-xl font-black text-white">Готовы к битве?</p>
        <p className="mt-1 text-sm text-white/55">
          {opponentName ? `Соперник: ${opponentName}` : "Ожидаем соперника..."}
        </p>
      </div>
      <div className="max-w-xs space-y-1.5 rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-left text-sm text-white/70">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#FFD600]">Как играть</p>
        <p>⚡ <b>Output</b> — угадай что выведет код</p>
        <p>🐛 <b>Баг</b> — найди строку с ошибкой</p>
        <p>🧠 <b>Quiz</b> — быстрый вопрос по разработке</p>
        <p className="pt-1 text-xs text-white/45">{totalRounds} раундов · {ROUND_SECONDS}с на ответ · кто быстрее и точнее</p>
      </div>
      <button
        type="button"
        onClick={onStart}
        disabled={!canStartGame}
        className="h-12 rounded-xl px-8 text-sm font-black tracking-wide transition-all hover:scale-105 active:scale-95"
        style={{ background: "#FFD600", color: "#111", boxShadow: "0 0 28px rgba(255,214,0,0.45)", opacity: canStartGame ? 1 : 0.55 }}
      >
        {canStartGame ? "🚀 Начать игру!" : "⏳ Соперник запускает"}
      </button>
    </div>
  );
}

function GameCountdown({ countdown }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-sm uppercase tracking-widest text-white/50">Приготовьтесь...</p>
      <div
        key={countdown}
        className="text-8xl font-black text-[#FFD600]"
        style={{
          animation: "countdownPop 0.8s ease-out",
          textShadow: "0 0 40px rgba(255,214,0,0.7)",
        }}
      >
        {countdown === 0 ? "GO!" : countdown}
      </div>
      <style>{`
        @keyframes countdownPop {
          0% { transform: scale(1.8); opacity: 0.4; }
          60% { transform: scale(0.95); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function GamePlaying({
  question,
  myAnswer,
  opponentAnswered,
  timeLeft,
  onAnswer,
}) {
  if (!question) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <RoundTypeBadge type={question.type} />
        <div className="flex items-center gap-3">
          {opponentAnswered && !myAnswer ? (
            <span className="animate-pulse text-xs text-indigo-400">⚡ Соперник ответил</span>
          ) : null}
          <TimerRing timeLeft={timeLeft} />
        </div>
      </div>

      {question.type === "output" ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-white/50">Что выведет в консоль?</p>
          <pre
            className="overflow-x-auto rounded-xl px-4 py-3 font-mono text-sm text-green-300"
            style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(74,222,128,0.2)" }}
          >
            {question.code}
          </pre>
        </div>
      ) : null}

      {question.type === "bug" ? (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-white/50">Задача: {question.description}</p>
          <p className="mb-2 text-xs text-orange-400">Найди строку с багом 👇</p>
          <pre
            className="overflow-x-auto rounded-xl px-4 py-3 font-mono text-sm text-orange-200"
            style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(249,115,22,0.2)" }}
          >
            {question.code}
          </pre>
        </div>
      ) : null}

      {question.type === "quiz" ? (
        <div>
          <p className="text-lg font-semibold leading-snug text-white">{question.question}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {question.options.map((option) => {
          const chosen = myAnswer === option;

          return (
            <button
              key={option}
              type="button"
              disabled={Boolean(myAnswer)}
              onClick={() => onAnswer(option)}
              className="rounded-xl px-3 py-3 text-left text-sm font-medium transition-all disabled:cursor-not-allowed"
              style={{
                border: chosen ? "1px solid #FFD600" : "1px solid rgba(255,255,255,0.1)",
                background: chosen ? "rgba(255,214,0,0.18)" : "rgba(255,255,255,0.03)",
                color: chosen ? "#FFD600" : "#e5e5e5",
                transform: chosen ? "scale(1.02)" : "scale(1)",
              }}
            >
              {option}
            </button>
          );
        })}
      </div>

      {myAnswer ? (
        <p className="animate-pulse text-center text-xs text-white/40">
          Ждём соперника...
        </p>
      ) : null}
    </div>
  );
}

function GameRoundResult({ result, question, roundIndex, totalRounds, onNext, canAdvanceRound }) {
  if (!result || !question) {
    return null;
  }

  const isLastRound = roundIndex + 1 >= totalRounds;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="mb-2 text-5xl">{result.myCorrect ? "✅" : "❌"}</div>
        <p className="text-xl font-black text-white">{result.myCorrect ? "Правильно!" : "Неверно"}</p>
        <p className="mt-1 text-sm text-white/55">
          {result.opponentCorrect ? "Соперник тоже ответил правильно" : "Соперник ошибся"}
        </p>
      </div>

      <div
        className="rounded-xl px-4 py-3 text-sm"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <p className="mb-1 text-[11px] uppercase tracking-wider text-white/40">Правильный ответ</p>
        <p className="font-semibold text-[#FFD600]">{result.correct_answer}</p>
        <p className="mt-2 text-xs leading-5 text-white/60">{result.explanation}</p>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canAdvanceRound}
        className="h-11 w-full rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
        style={{ background: "#FFD600", color: "#111", opacity: canAdvanceRound ? 1 : 0.55 }}
      >
        {canAdvanceRound
          ? isLastRound ? "🏁 Финальный результат" : "Следующий раунд →"
          : "⏳ Ждём соперника"}
      </button>
    </div>
  );
}

function GameFinished({ myScore, opponentScore, totalRounds, onPlayAgain, onSurrender, canPlayAgain }) {
  const won = myScore > opponentScore;
  const tied = myScore === opponentScore;

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-8 text-center">
      <div className="text-6xl">{won ? "🏆" : tied ? "🤝" : "💀"}</div>
      <div>
        <p className="text-2xl font-black text-white">
          {won ? "Победа!" : tied ? "Ничья!" : "Поражение"}
        </p>
        <p className="mt-1 text-sm text-white/55">
          {myScore} : {opponentScore} из {totalRounds}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPlayAgain}
          disabled={!canPlayAgain}
          className="h-11 rounded-xl px-5 text-sm font-bold transition-all hover:scale-105"
          style={{ background: "#FFD600", color: "#111", opacity: canPlayAgain ? 1 : 0.55 }}
        >
          {canPlayAgain ? "🔄 Ещё раунд" : "⏳ Соперник выбирает"}
        </button>
        <button
          type="button"
          onClick={onSurrender}
          className="h-11 rounded-xl border px-5 text-sm text-white/70 transition-colors hover:text-white"
          style={{ borderColor: "rgba(255,214,0,0.2)", background: "transparent" }}
        >
          Выйти
        </button>
      </div>
    </div>
  );
}

export function GameStageView({
  gameState,
  currentQuestion,
  roundIndex,
  totalRounds,
  myAnswer,
  opponentAnswered,
  roundResult,
  timeLeft,
  countdown,
  myScore,
  opponentScore,
  opponentName,
  onStartGame,
  onAnswer,
  onNextRound,
  onPlayAgain,
  onSurrender,
  canStartGame,
  canAdvanceRound,
  canPlayAgain,
}) {
  switch (gameState) {
    case "waiting":
      return <GameWaiting onStart={onStartGame} opponentName={opponentName} totalRounds={totalRounds} canStartGame={canStartGame} />;
    case "countdown":
      return <GameCountdown countdown={countdown} />;
    case "playing":
      return (
        <GamePlaying
          question={currentQuestion}
          myAnswer={myAnswer}
          opponentAnswered={opponentAnswered}
          timeLeft={timeLeft}
          onAnswer={onAnswer}
        />
      );
    case "round_result":
      return (
        <GameRoundResult
          result={roundResult}
          question={currentQuestion}
          roundIndex={roundIndex}
          totalRounds={totalRounds}
          onNext={onNextRound}
          canAdvanceRound={canAdvanceRound}
        />
      );
    case "finished":
      return (
        <GameFinished
          myScore={myScore}
          opponentScore={opponentScore}
          totalRounds={totalRounds}
          onPlayAgain={onPlayAgain}
          onSurrender={onSurrender}
          canPlayAgain={canPlayAgain}
        />
      );
    default:
      return null;
  }
}
