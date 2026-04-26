import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { apiFetch, getWebSocketBaseUrl, resolveAssetUrl } from "../api/client";
import { LeaderboardContent } from "./LeaderboardPage.jsx";

const PARTY_SIZE = 2;

// ─── Game Data ────────────────────────────────────────────────────────────────

const ROUND_QUESTIONS = [
  // type: "output" — угадай что выведет код
  {
    type: "output",
    code: `console.log(typeof null);`,
    options: ['"object"', '"null"', '"undefined"', '"boolean"'],
    answer: '"object"',
    explanation: "typeof null — историческая ошибка JS, возвращает \"object\"",
  },
  {
    type: "output",
    code: `console.log(0.1 + 0.2 === 0.3);`,
    options: ["true", "false", "undefined", "NaN"],
    answer: "false",
    explanation: "Плавающая точка: 0.1+0.2 = 0.30000000000000004",
  },
  {
    type: "output",
    code: `console.log([] + []);`,
    options: ['""', '"[]"', "null", "undefined"],
    answer: '""',
    explanation: "Два массива складываются как пустые строки",
  },
  {
    type: "output",
    code: `console.log(+'3' + +'2');`,
    options: ["5", '"32"', "NaN", "undefined"],
    answer: "5",
    explanation: "Унарный + конвертирует строки в числа",
  },
  {
    type: "output",
    code: `const a = [1,2,3];\nconsole.log(a.length = 1, a);`,
    options: ["1, [1]", "3, [1,2,3]", "1, []", "Error"],
    answer: "1, [1]",
    explanation: "Установка length усекает массив",
  },
  {
    type: "output",
    code: `console.log(1 < 2 < 3);`,
    options: ["true", "false", "NaN", "Error"],
    answer: "true",
    explanation: "1<2 = true, true<3 = 1<3 = true",
  },
  {
    type: "output",
    code: `console.log(3 > 2 > 1);`,
    options: ["true", "false", "NaN", "Error"],
    answer: "false",
    explanation: "3>2 = true, true>1 = 1>1 = false",
  },
  {
    type: "output",
    code: `console.log(!!null + !!undefined);`,
    options: ["0", "NaN", "false", "2"],
    answer: "0",
    explanation: "!!null = false, !!undefined = false, false+false = 0",
  },
  // type: "bug" — найди строку с багом
  {
    type: "bug",
    description: "Функция должна вернуть сумму массива",
    code: `function sum(arr) {\n  let total = 0;\n  for (let i = 0; i <= arr.length; i++) {\n    total += arr[i];\n  }\n  return total;\n}`,
    options: ["let total = 0", "i <= arr.length", "total += arr[i]", "return total"],
    answer: "i <= arr.length",
    explanation: "Должно быть i < arr.length, иначе arr[length] = undefined",
  },
  {
    type: "bug",
    description: "Функция должна проверить, является ли число чётным",
    code: `function isEven(n) {\n  return n % 2 === 1;\n}`,
    options: ["return", "n % 2", "=== 1", "function isEven(n)"],
    answer: "=== 1",
    explanation: "Чётное число: n % 2 === 0, а не 1",
  },
  {
    type: "bug",
    description: "Функция должна перевернуть строку",
    code: `function reverse(str) {\n  return str.split('').reverse;\n}`,
    options: ["str.split('')", ".reverse", "return", "function reverse(str)"],
    answer: ".reverse",
    explanation: "Нужно вызвать .reverse() как метод, а не ссылку",
  },
  {
    type: "bug",
    description: "Функция должна найти максимум в массиве",
    code: `function findMax(arr) {\n  let max = 0;\n  for (const n of arr) {\n    if (n > max) max = n;\n  }\n  return max;\n}`,
    options: ["let max = 0", "for (const n of arr)", "if (n > max)", "return max"],
    answer: "let max = 0",
    explanation: "Начальное значение 0 не работает для массивов с отрицательными числами",
  },
  // type: "quiz" — быстрые вопросы
  {
    type: "quiz",
    question: "Что такое замыкание (closure)?",
    options: [
      "Функция с доступом к переменным внешней области",
      "Метод закрытия соединения с БД",
      "Способ объявить приватный класс",
      "Паттерн проектирования",
    ],
    answer: "Функция с доступом к переменным внешней области",
    explanation: "Closure — функция, сохраняющая ссылку на лексическое окружение",
  },
  {
    type: "quiz",
    question: "Какой HTTP метод идемпотентен?",
    options: ["POST", "PATCH", "PUT", "DELETE и PUT"],
    answer: "DELETE и PUT",
    explanation: "DELETE и PUT — идемпотентны. POST создаёт новый ресурс каждый раз",
  },
  {
    type: "quiz",
    question: "Что возвращает Promise.all() если один промис rejected?",
    options: [
      "Все успешные результаты",
      "Немедленно rejects с первой ошибкой",
      "undefined",
      "Массив с ошибками",
    ],
    answer: "Немедленно rejects с первой ошибкой",
    explanation: "Promise.all — fail-fast, первый rejected = весь промис rejected",
  },
  {
    type: "quiz",
    question: "Что такое Big O нотация O(1)?",
    options: [
      "Линейная сложность",
      "Квадратичная сложность",
      "Константное время выполнения",
      "Логарифмическая сложность",
    ],
    answer: "Константное время выполнения",
    explanation: "O(1) — время не зависит от размера входных данных",
  },
  {
    type: "quiz",
    question: "Что делает оператор '??=' ?",
    options: [
      "Присваивает если значение null или undefined",
      "Сравнивает строго",
      "Побитовое NOT",
      "Проверяет тип",
    ],
    answer: "Присваивает если значение null или undefined",
    explanation: "Nullish coalescing assignment: x ??= y означает x = x ?? y",
  },
];

const ROUND_SECONDS = 15;
const TOTAL_ROUNDS = 5;

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Game Engine ──────────────────────────────────────────────────────────────

function useGameEngine(wsRef, myUserId) {
  const [gameState, setGameState] = useState("waiting"); // waiting | countdown | playing | round_result | finished
  const [roundIndex, setRoundIndex] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [myAnswer, setMyAnswer] = useState(null);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [roundResult, setRoundResult] = useState(null); // { myCorrect, opponentCorrect, correct_answer, explanation, myMs, oppMs }
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [countdown, setCountdown] = useState(3);
  const timerRef = useRef(null);
  const roundStartRef = useRef(null);
  const isHostRef = useRef(false);

  // Инициализируем вопросы один раз
  useEffect(() => {
    setQuestions(shuffleArray(ROUND_QUESTIONS).slice(0, TOTAL_ROUNDS));
  }, []);

  const currentQuestion = questions[roundIndex] ?? null;

  // Слушаем WS события от соперника
  const handleGameEvent = useCallback((event, data) => {
    if (event === "game_start") {
      isHostRef.current = data.host === myUserId;
      setGameState("countdown");
      setCountdown(3);
      setMyScore(0);
      setOpponentScore(0);
      setRoundIndex(0);
      setMyAnswer(null);
      setOpponentAnswered(false);
    }
    if (event === "game_opponent_answered") {
      setOpponentAnswered(true);
    }
    if (event === "game_round_result") {
      clearInterval(timerRef.current);
      setRoundResult(data);
      setOpponentScore(s => s + (data.opponentCorrect ? 1 : 0));
      setGameState("round_result");
    }
    if (event === "game_next_round") {
      setRoundIndex(i => i + 1);
      setMyAnswer(null);
      setOpponentAnswered(false);
      setRoundResult(null);
      setTimeLeft(ROUND_SECONDS);
      roundStartRef.current = Date.now();
      setGameState("playing");
    }
    if (event === "game_finished") {
      setGameState("finished");
    }
  }, [myUserId]);

  // Обратный отсчёт перед игрой
  useEffect(() => {
    if (gameState !== "countdown") return;
    if (countdown <= 0) {
      setTimeLeft(ROUND_SECONDS);
      roundStartRef.current = Date.now();
      setGameState("playing");
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [gameState, countdown]);

  // Таймер раунда
  useEffect(() => {
    if (gameState !== "playing") return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          // Если не ответили — автоматически "нет ответа"
          if (!myAnswer) {
            submitAnswer(null, true);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameState, roundIndex]);

  function sendWS(event, data = {}) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ event: "chat", text: `__GAME__:${JSON.stringify({ event, data })}` }));
  }

  function startGame() {
    // Оба нажали — ведущий (кто нажал первым) отправляет start
    sendWS("game_start", { host: myUserId });
    isHostRef.current = true;
    setGameState("countdown");
    setCountdown(3);
    setMyScore(0);
    setOpponentScore(0);
    setRoundIndex(0);
    setMyAnswer(null);
    setOpponentAnswered(false);
  }

  function submitAnswer(answer, timedOut = false) {
    if (myAnswer !== null && !timedOut) return;
    const ms = Date.now() - (roundStartRef.current ?? Date.now());
    const q = currentQuestion;
    const correct = !timedOut && answer === q?.answer;
    setMyAnswer(answer ?? "__timeout__");
    if (correct) setMyScore(s => s + 1);

    sendWS("game_opponent_answered", {});

    // Ведущий считает результат когда оба ответили
    // (упрощение: считаем сразу, соперник получит через WS)
    const result = {
      myCorrect: correct,
      opponentCorrect: false, // узнаем от соперника
      correct_answer: q?.answer,
      explanation: q?.explanation,
      myMs: ms,
    };
    sendWS("game_round_result", { ...result, opponentCorrect: correct });
    clearInterval(timerRef.current);
    setRoundResult(result);
    setGameState("round_result");
  }

  function nextRound() {
    if (roundIndex + 1 >= TOTAL_ROUNDS) {
      sendWS("game_finished", {});
      setGameState("finished");
    } else {
      sendWS("game_next_round", {});
      setRoundIndex(i => i + 1);
      setMyAnswer(null);
      setOpponentAnswered(false);
      setRoundResult(null);
      setTimeLeft(ROUND_SECONDS);
      roundStartRef.current = Date.now();
      setGameState("playing");
    }
  }

  return {
    gameState,
    currentQuestion,
    roundIndex,
    myScore,
    opponentScore,
    myAnswer,
    opponentAnswered,
    roundResult,
    timeLeft,
    countdown,
    totalRounds: TOTAL_ROUNDS,
    startGame,
    submitAnswer,
    nextRound,
    handleGameEvent,
  };
}

// ─── Game UI Components ───────────────────────────────────────────────────────

function TimerRing({ timeLeft, total = ROUND_SECONDS }) {
  const pct = timeLeft / total;
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color = pct > 0.5 ? "#FFD600" : pct > 0.25 ? "#f97316" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 68, height: 68 }}>
      <svg width="68" height="68" style={{ transform: "rotate(-90deg)", position: "absolute" }}>
        <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle
          cx="34" cy="34" r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }}
        />
      </svg>
      <span className="relative z-10 text-xl font-black" style={{ color }}>{timeLeft}</span>
    </div>
  );
}

function ScoreBar({ myScore, opponentScore, totalRounds, myName, oppName }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-right min-w-[60px]">
        <div className="text-xs text-white/50 truncate">{myName}</div>
        <div className="text-2xl font-black text-[#FFD600]">{myScore}</div>
      </div>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(myScore / totalRounds) * 100}%`,
              background: "linear-gradient(90deg, #b79000, #FFD600)",
            }}
          />
        </div>
        <div className="mt-1 flex justify-center">
          <span className="text-[10px] text-white/35 uppercase tracking-widest">
            Раунд {Math.min(myScore + opponentScore + 1, totalRounds)} / {totalRounds}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-1">
          <div
            className="h-full rounded-full ml-auto transition-all duration-500"
            style={{
              width: `${(opponentScore / totalRounds) * 100}%`,
              background: "linear-gradient(270deg, #6366f1, #818cf8)",
            }}
          />
        </div>
      </div>
      <div className="min-w-[60px]">
        <div className="text-xs text-white/50 truncate">{oppName}</div>
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
  const s = map[type] ?? map.quiz;
  return (
    <span
      className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}44` }}
    >
      {s.label}
    </span>
  );
}

function GameWaiting({ onStart, opponentName }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
      <div className="text-5xl">⚔️</div>
      <div>
        <p className="text-xl font-black text-white">Готовы к битве?</p>
        <p className="mt-1 text-sm text-white/55">
          {opponentName ? `Соперник: ${opponentName}` : "Ожидаем соперника..."}
        </p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-sm text-white/70 max-w-xs text-left space-y-1.5">
        <p className="text-[#FFD600] font-semibold text-xs uppercase tracking-wider mb-2">Как играть</p>
        <p>⚡ <b>Output</b> — угадай что выведет код</p>
        <p>🐛 <b>Баг</b> — найди строку с ошибкой</p>
        <p>🧠 <b>Quiz</b> — быстрый вопрос по разработке</p>
        <p className="text-white/45 text-xs pt-1">{TOTAL_ROUNDS} раундов · {ROUND_SECONDS}с на ответ · кто быстрее и точнее</p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="h-12 rounded-xl px-8 text-sm font-black tracking-wide transition-all hover:scale-105 active:scale-95"
        style={{ background: "#FFD600", color: "#111", boxShadow: "0 0 28px rgba(255,214,0,0.45)" }}
      >
        🚀 Начать игру!
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

function GamePlaying({ question, roundIndex, totalRounds, myAnswer, opponentAnswered, timeLeft, onAnswer }) {
  if (!question) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <RoundTypeBadge type={question.type} />
        <div className="flex items-center gap-3">
          {opponentAnswered && !myAnswer && (
            <span className="text-xs text-indigo-400 animate-pulse">⚡ Соперник ответил</span>
          )}
          <TimerRing timeLeft={timeLeft} />
        </div>
      </div>

      {question.type === "output" && (
        <div>
          <p className="text-xs text-white/50 mb-2 uppercase tracking-wider">Что выведет в консоль?</p>
          <pre
            className="rounded-xl px-4 py-3 text-sm font-mono text-green-300 overflow-x-auto"
            style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(74,222,128,0.2)" }}
          >
            {question.code}
          </pre>
        </div>
      )}

      {question.type === "bug" && (
        <div>
          <p className="text-xs text-white/50 mb-1 uppercase tracking-wider">Задача: {question.description}</p>
          <p className="text-xs text-orange-400 mb-2">Найди строку с багом 👇</p>
          <pre
            className="rounded-xl px-4 py-3 text-sm font-mono text-orange-200 overflow-x-auto"
            style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(249,115,22,0.2)" }}
          >
            {question.code}
          </pre>
        </div>
      )}

      {question.type === "quiz" && (
        <div>
          <p className="text-lg font-semibold text-white leading-snug">{question.question}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {question.options.map((opt) => {
          const chosen = myAnswer === opt;
          return (
            <button
              key={opt}
              type="button"
              disabled={!!myAnswer}
              onClick={() => onAnswer(opt)}
              className="rounded-xl px-3 py-3 text-sm font-medium text-left transition-all disabled:cursor-not-allowed"
              style={{
                border: chosen
                  ? "1px solid #FFD600"
                  : "1px solid rgba(255,255,255,0.1)",
                background: chosen
                  ? "rgba(255,214,0,0.18)"
                  : "rgba(255,255,255,0.03)",
                color: chosen ? "#FFD600" : "#e5e5e5",
                transform: chosen ? "scale(1.02)" : "scale(1)",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {myAnswer && (
        <p className="text-center text-xs text-white/40 animate-pulse">
          Ждём соперника...
        </p>
      )}
    </div>
  );
}

function GameRoundResult({ result, question, roundIndex, totalRounds, onNext }) {
  if (!result || !question) return null;
  const isLast = roundIndex + 1 >= totalRounds;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-5xl mb-2">
          {result.myCorrect ? "✅" : "❌"}
        </div>
        <p className="text-xl font-black text-white">
          {result.myCorrect ? "Правильно!" : "Неверно"}
        </p>
        <p className="text-sm text-white/55 mt-1">
          {result.opponentCorrect ? "Соперник тоже ответил правильно" : "Соперник ошибся"}
        </p>
      </div>

      <div
        className="rounded-xl px-4 py-3 text-sm"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1">Правильный ответ</p>
        <p className="font-semibold text-[#FFD600]">{result.correct_answer}</p>
        <p className="mt-2 text-xs text-white/60 leading-5">{result.explanation}</p>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full h-11 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
        style={{ background: "#FFD600", color: "#111" }}
      >
        {isLast ? "🏁 Финальный результат" : `Следующий раунд →`}
      </button>
    </div>
  );
}

function GameFinished({ myScore, opponentScore, totalRounds, myName, onPlayAgain, onSurrender }) {
  const won = myScore > opponentScore;
  const tied = myScore === opponentScore;

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-8 text-center">
      <div className="text-6xl">
        {won ? "🏆" : tied ? "🤝" : "💀"}
      </div>
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
          className="h-11 rounded-xl px-5 text-sm font-bold transition-all hover:scale-105"
          style={{ background: "#FFD600", color: "#111" }}
        >
          🔄 Ещё раунд
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

// ─── MatchArena (полностью переписан) ─────────────────────────────────────────

function MatchArena({ activeMatch, myUserId, onNavigateTask, onSurrender, surrendering }) {
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [onlineIds, setOnlineIds] = useState([]);
  const [secondsRemaining, setSecondsRemaining] = useState(activeMatch?.seconds_remaining ?? null);
  const [showChat, setShowChat] = useState(false);
  const wsRef = useRef(null);

  const {
    gameState,
    currentQuestion,
    roundIndex,
    myScore,
    opponentScore,
    myAnswer,
    opponentAnswered,
    roundResult,
    timeLeft,
    countdown,
    totalRounds,
    startGame,
    submitAnswer,
    nextRound,
    handleGameEvent,
  } = useGameEngine(wsRef, myUserId);

  useEffect(() => {
    if (activeMatch?.seconds_remaining != null) {
      setSecondsRemaining(activeMatch.seconds_remaining);
      return;
    }
    if (!activeMatch?.ends_at) { setSecondsRemaining(null); return; }
    const deadline = new Date(activeMatch.ends_at).getTime();
    const tick = () => setSecondsRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeMatch?.ends_at, activeMatch?.seconds_remaining]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token || !activeMatch?.match_id) return;

    const ws = new WebSocket(getMatchRoomSocketUrl(activeMatch.match_id, token));
    wsRef.current = ws;

    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      const data = payload.data ?? {};
      if (payload.event === "room_state") {
        setParticipants(data.participants ?? []);
        setOnlineIds(data.online ?? []);
      }
      if (payload.event === "user_joined" || payload.event === "user_left") {
        setOnlineIds(data.online ?? []);
      }
      if (payload.event === "chat") {
        const text = String(data.text ?? "").trim();
        if (!text) return;
        // Перехватываем игровые события
        if (text.startsWith("__GAME__:")) {
          try {
            const { event: ge, data: gd } = JSON.parse(text.slice(9));
            // Только от соперника
            if (data.user_id !== myUserId) {
              handleGameEvent(ge, gd);
            }
          } catch {}
          return;
        }
        setMessages((prev) => [...prev, { ...data, text }]);
      }
    });

    return () => { ws.close(); wsRef.current = null; };
  }, [activeMatch?.match_id, myUserId, handleGameEvent]);

  const opponentFromParticipants = useMemo(
    () => getOpponentFromParticipants(participants, myUserId),
    [participants, myUserId]
  );

  // activeMatch?.opponent иногда содержит СВОЕГО юзера — фильтруем
  const opponentFromMatch = useMemo(() => {
    if (!activeMatch) return null;
    // Пробуем поле opponent
    if (activeMatch.opponent?.user_id && activeMatch.opponent.user_id !== myUserId) {
      return activeMatch.opponent;
    }
    // Пробуем поле participants если есть
    if (Array.isArray(activeMatch.participants)) {
      return activeMatch.participants.find(p => p.user_id !== myUserId) ?? null;
    }
    return null;
  }, [activeMatch, myUserId]);

  const opponent = opponentFromParticipants ?? opponentFromMatch ?? null;
  const opponentOnline = opponent ? onlineIds.includes(opponent.user_id) : false;
  const myName = participants.find(p => p.user_id === myUserId)?.nickname ?? "Вы";
  const oppName = opponent?.nickname ?? opponent?.display_name ?? "Соперник";

  function sendChatMessage(text) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ event: "chat", text }));
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div
        className="rounded-2xl border p-4"
        style={{ borderColor: "rgba(255,214,0,0.2)", background: "#111" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#FFD600]">⚔️ PvP Дуэль 1v1</h2>
            <p className="text-sm text-white/55">
              До конца матча:{" "}
              <span className="font-mono text-white">{formatCountdown(secondsRemaining)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowChat(v => !v)}
              className="rounded-xl border px-4 py-2 text-sm text-white/70 transition-colors hover:text-white"
              style={{ borderColor: "rgba(255,214,0,0.2)", background: "transparent" }}
            >
              {showChat ? "🎮 Игра" : "💬 Чат"}
            </button>
            <button
              type="button"
              onClick={() => onNavigateTask(activeMatch.task_id)}
              className="rounded-xl px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-85"
              style={{ background: "rgba(255,214,0,0.15)", color: "#FFD600", border: "1px solid rgba(255,214,0,0.3)" }}
            >
              Задача
            </button>
            <button
              type="button"
              onClick={onSurrender}
              disabled={surrendering}
              className="rounded-xl border px-4 py-2 text-sm text-white/50 transition-colors hover:text-white disabled:opacity-40"
              style={{ borderColor: "rgba(255,255,255,0.1)", background: "transparent" }}
            >
              Сдаться
            </button>
          </div>
        </div>

        {/* Score always visible */}
        {gameState !== "waiting" && (
          <div className="mt-4">
            <ScoreBar
              myScore={myScore}
              opponentScore={opponentScore}
              totalRounds={totalRounds}
              myName={myName}
              oppName={oppName}
            />
          </div>
        )}
      </div>

      {/* Main game area */}
      {showChat ? (
        <ChatPanel messages={messages} myUserId={myUserId} onSend={sendChatMessage} />
      ) : (
        <div
          className="rounded-2xl border p-5 min-h-[360px]"
          style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111" }}
        >
          {gameState === "waiting" && (
            <GameWaiting
              onStart={startGame}
              opponentName={oppName !== "Соперник" ? oppName : null}
            />
          )}
          {gameState === "countdown" && <GameCountdown countdown={countdown} />}
          {gameState === "playing" && (
            <GamePlaying
              question={currentQuestion}
              roundIndex={roundIndex}
              totalRounds={totalRounds}
              myAnswer={myAnswer}
              opponentAnswered={opponentAnswered}
              timeLeft={timeLeft}
              onAnswer={submitAnswer}
            />
          )}
          {gameState === "round_result" && (
            <GameRoundResult
              result={roundResult}
              question={currentQuestion}
              roundIndex={roundIndex}
              totalRounds={totalRounds}
              onNext={nextRound}
            />
          )}
          {gameState === "finished" && (
            <GameFinished
              myScore={myScore}
              opponentScore={opponentScore}
              totalRounds={totalRounds}
              myName={myName}
              onPlayAgain={startGame}
              onSurrender={onSurrender}
            />
          )}
        </div>
      )}

      {/* Opponent panel compact */}
      <OpponentIntelPanel opponentUserId={opponent?.user_id ?? null} online={opponentOnline} myUserId={myUserId} />
    </div>
  );
}

// ─── Оригинальные компоненты (без изменений) ──────────────────────────────────

function getMatchmakingSocketUrl(token) {
  const wsOrigin = getWebSocketBaseUrl();
  return `${wsOrigin}/matchmaking/ws?token=${encodeURIComponent(token)}`;
}

function getMatchRoomSocketUrl(matchId, token) {
  const wsOrigin = getWebSocketBaseUrl();
  return `${wsOrigin}/matchmaking/match/${matchId}/ws?token=${encodeURIComponent(token)}`;
}

function formatCountdown(totalSeconds) {
  if (totalSeconds == null || totalSeconds < 0) return "--:--";
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getMyUserIdFromToken() {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub_id ?? payload.user_id ?? null;
  } catch { return null; }
}

function getOpponentFromParticipants(participants, myUserId) {
  if (!Array.isArray(participants)) return null;
  return participants.find((item) => item.user_id !== myUserId) ?? null;
}

const ROLE_BADGE_PALETTES = {
  "back-end": { border: "rgba(99,102,241,0.55)", bg: "rgba(67,56,202,0.24)", text: "#c7d2fe", shadow: "rgba(99,102,241,0.35)" },
  "front-end": { border: "rgba(6,182,212,0.55)", bg: "rgba(8,145,178,0.24)", text: "#a5f3fc", shadow: "rgba(6,182,212,0.35)" },
  "full-stack": { border: "rgba(34,197,94,0.55)", bg: "rgba(22,163,74,0.24)", text: "#bbf7d0", shadow: "rgba(34,197,94,0.35)" },
  "project manager": { border: "rgba(244,114,182,0.55)", bg: "rgba(190,24,93,0.24)", text: "#fbcfe8", shadow: "rgba(244,114,182,0.35)" },
  "ui/ux": { border: "rgba(168,85,247,0.55)", bg: "rgba(126,34,206,0.24)", text: "#e9d5ff", shadow: "rgba(168,85,247,0.35)" },
  "ai/ml": { border: "rgba(245,158,11,0.55)", bg: "rgba(180,83,9,0.24)", text: "#fde68a", shadow: "rgba(245,158,11,0.35)" },
  devops: { border: "rgba(148,163,184,0.55)", bg: "rgba(71,85,105,0.26)", text: "#e2e8f0", shadow: "rgba(148,163,184,0.35)" },
  devop: { border: "rgba(148,163,184,0.55)", bg: "rgba(71,85,105,0.26)", text: "#e2e8f0", shadow: "rgba(148,163,184,0.35)" },
  qa: { border: "rgba(45,212,191,0.55)", bg: "rgba(15,118,110,0.24)", text: "#99f6e4", shadow: "rgba(45,212,191,0.35)" },
};
const DEFAULT_ROLE_BADGE = { border: "rgba(255,214,0,0.45)", bg: "rgba(255,214,0,0.12)", text: "#FFD600", shadow: "rgba(255,214,0,0.28)" };

function getRolePalette(roleLabel) {
  const key = String(roleLabel ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return ROLE_BADGE_PALETTES[key] || DEFAULT_ROLE_BADGE;
}
function getBadgePresentation(badge) {
  return { icon: "R", ...getRolePalette(badge.label) };
}
function translateQuestTitle(title) {
  if (!title) return "";
  const playMatch = title.match(/^Play\s+(\d+)\s+PvP\s+matches$/i);
  if (playMatch) { const count = Number(playMatch[1]); return `Сыграйте ${count} PvP матч${count === 1 ? "" : count >= 2 && count <= 4 ? "а" : "ей"}`; }
  const winMatch = title.match(/^Win\s+(\d+)\s+PvP\s+matches$/i);
  if (winMatch) { const count = Number(winMatch[1]); return `Выиграйте ${count} PvP матч${count === 1 ? "" : count >= 2 && count <= 4 ? "а" : "ей"}`; }
  return title;
}

function QueueSlot({ label, active, complete }) {
  return (
    <div className="rounded-2xl border px-4 py-4 transition-colors" style={{ borderColor: complete ? "#FFD600" : active ? "rgba(255,214,0,0.45)" : "rgba(255,214,0,0.15)", background: complete ? "rgba(255,214,0,0.15)" : active ? "rgba(255,214,0,0.08)" : "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ background: complete ? "#FFD600" : active ? "#f5c400" : "rgba(255,255,255,0.25)", boxShadow: complete || active ? "0 0 12px rgba(255,214,0,0.7)" : "none" }} />
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
    </div>
  );
}

function QueueFill({ queueSize, queuePosition }) {
  const clamped = Math.max(0, Math.min(queueSize, PARTY_SIZE));
  const pct = Math.round((clamped / PARTY_SIZE) * 100);
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-xs text-white/65"><span>Прогресс очереди</span><span>{clamped}/{PARTY_SIZE}</span></div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #b79000 0%, #FFD600 100%)" }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <QueueSlot label="Вы в очереди" active complete={clamped >= 1} />
        <QueueSlot label="Подключаем соперника" active={clamped === 1} complete={clamped >= 2} />
      </div>
      <p className="text-xs text-white/55">Позиция в очереди: <span className="text-[#FFD600]">{queuePosition ?? "--"}</span></p>
    </div>
  );
}

function QuestPanel({ quests, onClaim, claimingQuestKey }) {
  if (!quests) return null;
  const sections = [
    { id: "daily", title: "Ежедневные PvP-квесты", data: quests.daily },
    { id: "weekly", title: "Недельные PvP-квесты", data: quests.weekly },
  ];
  return (
    <div className="mt-6 space-y-4">
      {sections.map((section) => (
        <div key={section.id} className="rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(255,214,0,0.15)", background: "rgba(255,255,255,0.01)" }}>
          <p className="text-[11px] uppercase tracking-wider text-[#FFD600]">{section.title}</p>
          <div className="mt-3 space-y-2.5">
            {(section.data?.quests || []).map((quest) => {
              const target = Math.max(1, Number(quest.target ?? 1));
              const progress = Math.max(0, Number(quest.progress ?? 0));
              const pct = Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
              const rowKey = `${section.id}:${quest.id}`;
              return (
                <div key={rowKey} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{translateQuestTitle(quest.title)}</p>
                      <p className="mt-0.5 text-xs text-white/60">{progress}/{target} • +{quest.reward_pts} PTS</p>
                    </div>
                    {quest.completed && !quest.claimed ? (
                      <button type="button" onClick={() => onClaim(section.id, quest.id)} disabled={claimingQuestKey === rowKey} className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-85 disabled:opacity-50" style={{ background: "#FFD600", color: "#111" }}>
                        {claimingQuestKey === rowKey ? "..." : "Забрать"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-white/50">{quest.claimed ? "Получено" : quest.completed ? "Готово" : "В прогрессе"}</span>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #b79000 0%, #FFD600 100%)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function OpponentIntelPanel({ opponentUserId, online, myUserId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  // Защита: не загружаем если id не задан или это наш собственный профиль
  const safeId = opponentUserId && opponentUserId !== myUserId ? opponentUserId : null;

  useEffect(() => {
    if (!safeId) { setProfile(null); return; }
    let mounted = true;
    setLoading(true);
    apiFetch(`/users/${safeId}/profile`)
      .then((data) => { if (mounted) setProfile(data); })
      .catch(() => { if (mounted) setProfile(null); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [safeId]);

  const badges = useMemo(() => {
    const role = String(profile?.role ?? "").trim();
    return role ? [{ label: role, tone: "role" }] : [];
  }, [profile?.role]);

  const bannerUrl = resolveAssetUrl(profile?.banner_url || "");
  const avatarUrl = resolveAssetUrl(profile?.avatar_url || "");
  const displayName = profile?.nickname || profile?.display_name || "Unknown";
  const mentionName = profile?.nickname || profile?.display_name || "unknown";

  return (
    <aside className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111" }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-[#FFD600]">Профиль соперника</h3>
        <span className="text-[11px] font-medium" style={{ color: online ? "#4ade80" : "rgba(255,255,255,0.45)" }}>{online ? "онлайн" : "оффлайн"}</span>
      </div>
      {!opponentUserId ? <p className="text-sm text-white/50">Ожидаем профиль соперника...</p>
        : loading ? <p className="text-sm text-white/50">Загружаем профиль...</p>
        : !profile ? <p className="text-sm text-white/50">Профиль недоступен.</p>
        : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div className="relative h-24">
                {bannerUrl ? <img src={bannerUrl} alt="Баннер" className="h-full w-full object-cover" /> : <div className="h-full w-full" style={{ background: "linear-gradient(135deg, rgba(25,38,66,1) 0%, rgba(10,15,25,1) 100%)" }} />}
              </div>
              <div className="px-4 pb-4">
                <div className="-mt-7 flex items-end gap-3">
                  <div className="relative h-16 w-16 shrink-0 rounded-full border-[3px] border-[#111] bg-slate-800">
                    {avatarUrl ? <img src={avatarUrl} alt="Аватар" className="h-full w-full rounded-full object-cover" /> : <div className="flex h-full w-full items-center justify-center rounded-full text-xl font-bold text-[#FFD600]">{displayName[0]?.toUpperCase() || "?"}</div>}
                    <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[#111]" style={{ background: online ? "#22c55e" : "#6b7280", boxShadow: online ? "0 0 10px rgba(34,197,94,0.8)" : "none" }} />
                  </div>
                  <div className="min-w-0 pb-1">
                    <p className="truncate text-base font-semibold text-white">{displayName}</p>
                    <p className="truncate text-xs text-white/60">@{mentionName}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-white/70">
                  <span>PTS {profile.pts ?? 0}</span>
                  <span style={{ color: online ? "#4ade80" : "rgba(255,255,255,0.5)" }}>{online ? "онлайн" : "оффлайн"}</span>
                </div>
                {profile.bio && <p className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs leading-5 text-white/75">{profile.bio}</p>}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-wider text-white/50">Роль</p>
              <div className="flex flex-wrap gap-2">
                {badges.length > 0 ? badges.map((badge, idx) => {
                  const view = getBadgePresentation(badge);
                  return (
                    <span key={`${badge.label}-${idx}`} className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium backdrop-blur-sm" style={{ borderColor: view.border, background: `linear-gradient(180deg, rgba(255,255,255,0.08) 0%, ${view.bg} 100%)`, color: view.text, boxShadow: `0 6px 14px ${view.shadow}` }}>
                      <span className="mr-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border text-[10px] font-semibold" style={{ borderColor: view.border, color: view.text, background: "rgba(0,0,0,0.28)" }}>{view.icon}</span>
                      <span className="leading-none">{badge.label}</span>
                    </span>
                  );
                }) : <span className="text-xs text-white/50">Роль не указана</span>}
              </div>
            </div>
          </div>
        )}
    </aside>
  );
}

function ChatPanel({ messages, myUserId, onSend }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);
  function submit(event) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }
  return (
    <div className="flex flex-col rounded-2xl border" style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111", minHeight: 320 }}>
      <div className="border-b px-4 py-3" style={{ borderColor: "rgba(255,214,0,0.12)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FFD600]">Чат матча</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3" style={{ maxHeight: 260 }}>
        {messages.length === 0 ? <p className="text-sm text-white/45">Сообщений пока нет.</p> : null}
        {messages.map((msg, idx) => {
          const mine = msg.user_id === myUserId;
          return (
            <div key={`${msg.user_id}-${idx}-${msg.text}`} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[82%] rounded-xl px-3 py-2 text-xs" style={{ background: mine ? "#FFD600" : "rgba(255,255,255,0.06)", color: mine ? "#111" : "#f8fafc" }}>
                <p className="mb-1 text-[10px] font-semibold opacity-80">{mine ? "вы" : msg.display_name || msg.nickname}</p>
                <p>{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t px-3 py-3" style={{ borderColor: "rgba(255,214,0,0.1)" }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Написать сообщение..." className="h-10 flex-1 rounded-xl bg-black px-3 text-sm text-white placeholder:text-white/35 focus:outline-none" style={{ border: "1px solid rgba(255,214,0,0.2)" }} />
        <button type="submit" className="h-10 rounded-xl px-4 text-sm font-semibold transition-opacity hover:opacity-85" style={{ background: "#FFD600", color: "#111" }}>Отправить</button>
      </form>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function MatchmakingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "leaderboard" ? "leaderboard" : "duel";
  const myUserId = useMemo(() => getMyUserIdFromToken(), []);
  const [activeMatch, setActiveMatch] = useState(null);
  const [queueInfo, setQueueInfo] = useState({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
  const [searching, setSearching] = useState(false);
  const [statusNote, setStatusNote] = useState("Нажмите «Найти матч», чтобы встать в PvP-очередь.");
  const [error, setError] = useState("");
  const [teamCurrent, setTeamCurrent] = useState(null);
  const [quests, setQuests] = useState(null);
  const [claimingQuestKey, setClaimingQuestKey] = useState("");
  const [lastMatchResult, setLastMatchResult] = useState(null);
  const [rematchLoading, setRematchLoading] = useState(false);
  const [surrendering, setSurrendering] = useState(false);

  const state = useMemo(() => {
    if (activeMatch) return "matched";
    if (searching) return "searching";
    return "idle";
  }, [activeMatch, searching]);

  function switchTab(tab) {
    const next = new URLSearchParams(searchParams);
    if (tab === "leaderboard") { next.set("tab", "leaderboard"); } else { next.delete("tab"); }
    setSearchParams(next, { replace: true });
  }

  const loadQuests = useCallback(async () => {
    try { const payload = await apiFetch("/matchmaking/quests"); setQuests(payload); } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const current = await apiFetch("/matchmaking/active");
        if (!mounted) return;
        if (current) { setActiveMatch(current); setSearching(false); setStatusNote("Активная дуэль восстановлена."); }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [myUserId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try { const currentTeam = await apiFetch("/teams/current"); if (!mounted) return; setTeamCurrent(currentTeam); }
      catch { setTeamCurrent(null); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { loadQuests(); }, [loadQuests]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return undefined;
    const ws = new WebSocket(getMatchmakingSocketUrl(token));
    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      const data = payload.data ?? {};
      if (payload.event === "queue_update") {
        setQueueInfo({ queue_size: data.queue_size ?? 0, queue_position: data.queue_position ?? null, total: data.total ?? PARTY_SIZE });
        setSearching(data.status === "queued");
        if (data.status === "queued") setStatusNote("Ищем соперника с близким PTS...");
      }
      if (payload.event === "match_found" || payload.event === "active_match") {
        setActiveMatch((prev) => ({ ...(prev ?? {}), ...data }));
        setLastMatchResult(null); setSearching(false); setSurrendering(false);
        setStatusNote("Соперник найден. Переходим в дуэль.");
        apiFetch("/matchmaking/active").then((current) => { if (current) setActiveMatch(current); }).catch(() => {});
      }
      if (payload.event === "match_finished") {
        setLastMatchResult(data); setActiveMatch(null); setSearching(false);
        setRematchLoading(false); setSurrendering(false);
        setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
        const iWon = data.winner_user_id === myUserId;
        if (iWon) {
          const streak = Number(data.winner_streak ?? 0);
          const bonus = Number(data.winner_streak_bonus ?? 0);
          const streakNote = streak >= 2 ? ` Серия побед: ${streak} (+${bonus} бонус PTS).` : "";
          setStatusNote(data.reason === "surrender" ? `Соперник сдался. Победа!${streakNote}` : `Победа в матче!${streakNote}`);
        } else {
          setStatusNote(data.reason === "surrender" ? "Вы сдались в матче." : "Матч завершен. Попробуйте реванш.");
        }
        loadQuests();
      }
      if (payload.event === "rematch_offered") {
        setLastMatchResult((prev) => ({ ...(prev ?? {}), match_id: data.match_id }));
        setStatusNote("Соперник предлагает реванш. Нажмите кнопку «Реванш».");
      }
    });
    return () => { ws.close(); };
  }, [loadQuests, myUserId]);

  async function runFindMatch() {
    if (state === "searching") return;
    setError(""); setSearching(true); setStatusNote("Подключаем к PvP-очереди...");
    try {
      const res = await apiFetch("/matchmaking/queue", { method: "POST" });
      if (res.status === "matched" || res.status === "already_in_match") { setActiveMatch(res); setSearching(false); setStatusNote("Матч найден."); return; }
      if (res.status === "queued") { setQueueInfo({ queue_size: res.queue_size ?? 1, queue_position: res.queue_position ?? null, total: PARTY_SIZE }); setStatusNote("Вы в очереди. Ожидаем соперника..."); return; }
      setError(res.message || "Ошибка матчмейкинга."); setSearching(false);
    } catch (e) { setError(e?.message || "Ошибка матчмейкинга."); setSearching(false); }
  }

  async function runLeaveQueue() {
    setError("");
    try { await apiFetch("/matchmaking/queue", { method: "DELETE" }); } catch {}
    setActiveMatch(null); setSearching(false);
    setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
    setStatusNote("Поиск отменен.");
  }

  async function runSurrender() {
    if (!activeMatch || surrendering) return;
    const confirmed = window.confirm("Вы точно уверены? Вы потеряете PTS!");
    if (!confirmed) return;
    setError(""); setSurrendering(true);
    try {
      const payload = await apiFetch("/matchmaking/surrender", { method: "POST" });
      setLastMatchResult(payload); setActiveMatch(null); setSearching(false);
      setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
      await loadQuests(); setStatusNote("Вы сдались в матче. PTS были уменьшены.");
    } catch (e) {
      const message = e?.message || "";
      const alreadyFinished = e?.status === 409 || message.includes("Match is already finished") || message.includes("No active match to surrender");
      if (alreadyFinished) { setActiveMatch(null); setSearching(false); setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE }); setStatusNote("Матч уже завершён."); await loadQuests(); }
      else setError(message);
    }
    setSurrendering(false);
  }

  async function handleClaimQuest(period, questId) {
    const key = `${period}:${questId}`;
    setClaimingQuestKey(key); setError("");
    try {
      const reward = await apiFetch(`/matchmaking/quests/${period}/${questId}/claim`, { method: "POST" });
      setStatusNote(`Квест завершен: +${reward.reward_pts ?? 0} PTS`);
      await loadQuests();
    } catch (e) { setError(e?.message || "Не удалось забрать награду за квест."); }
    finally { setClaimingQuestKey(""); }
  }

  async function handleRematch() {
    if (!lastMatchResult?.match_id || rematchLoading) return;
    setRematchLoading(true); setError("");
    try {
      const res = await apiFetch("/matchmaking/rematch", { method: "POST", body: { match_id: lastMatchResult.match_id } });
      if (res.status === "matched" || res.status === "already_in_match") { setActiveMatch(res); setSearching(false); setLastMatchResult(null); setStatusNote("Реванш начинается!"); return; }
      setStatusNote(res.status === "waiting_rematch" ? "Реванш предложен. Ждем подтверждение соперника." : res.message || "Ожидаем подтверждение реванша.");
    } catch (e) { setError(e?.message || "Не удалось запустить реванш."); }
    finally { setRematchLoading(false); }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-7 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-white transition-all duration-300 hover:text-[#FFD600] hover:[text-shadow:0_0_14px_rgba(255,214,0,0.55)] sm:text-5xl">
            PvP Подбор Соперника 1v1
          </h1>
          <p className="mt-2 text-sm text-white/55">Очередь, подключение соперника и дуэльные задания 1v1.</p>
        </div>

        <div className="mx-auto mb-6 flex max-w-xl rounded-2xl border border-yellow-500/20 bg-slate-950/70 p-1">
          <button type="button" onClick={() => switchTab("duel")} className={["h-11 flex-1 rounded-xl text-sm font-semibold transition", activeTab === "duel" ? "bg-[#FFD600] text-slate-950 shadow-[0_0_20px_rgba(255,214,0,0.25)]" : "text-white/75 hover:text-white"].join(" ")}>Дуэль</button>
          <button type="button" onClick={() => switchTab("leaderboard")} className={["h-11 flex-1 rounded-xl text-sm font-semibold transition", activeTab === "leaderboard" ? "bg-[#FFD600] text-slate-950 shadow-[0_0_20px_rgba(255,214,0,0.25)]" : "text-white/75 hover:text-white"].join(" ")}>Рейтинг</button>
        </div>

        {activeTab === "leaderboard" ? <LeaderboardContent embedded /> : (
          <>
            {teamCurrent ? (
              <div className="mb-6 rounded-2xl border border-yellow-500/20 bg-slate-950 p-5 text-sm text-white">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-yellow-300">Текущая команда</p>
                    <h2 className="mt-2 text-xl font-semibold">{teamCurrent.name}</h2>
                    <p className="mt-1 text-sm text-slate-400">Участников: {teamCurrent.members.length}</p>
                  </div>
                  <button type="button" onClick={() => navigate("/team/current")} className="rounded-2xl bg-[#FFD600] px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(255,214,0,0.25)] transition hover:bg-yellow-300">Открыть команду</button>
                </div>
              </div>
            ) : null}

            {state === "matched" ? (
              <MatchArena activeMatch={activeMatch} myUserId={myUserId} onNavigateTask={(taskId) => navigate(`/tasks/${taskId}/solve`)} onSurrender={runSurrender} surrendering={surrendering} />
            ) : (
              <div className="mx-auto max-w-xl rounded-3xl border p-8" style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111" }}>
                <div className="mb-6 text-center">
                  <p className="text-xl font-semibold text-white">{state === "searching" ? "Ищем дуэль..." : "Готовы к PvP?"}</p>
                  <p className="mt-2 text-sm text-white/55">{statusNote}</p>
                </div>

                <QueueFill queueSize={queueInfo.queue_size} queuePosition={queueInfo.queue_position} />

                {lastMatchResult?.match_id ? (
                  <div className="mt-4">
                    <button type="button" onClick={handleRematch} disabled={rematchLoading} className="h-11 w-full rounded-xl border text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ borderColor: "rgba(34,197,94,0.45)", background: "rgba(34,197,94,0.16)" }}>
                      {rematchLoading ? "Запускаем реванш..." : "Реванш (1 клик)"}
                    </button>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col gap-3">
                  {state === "idle" ? (
                    <button type="button" onClick={runFindMatch} className="h-12 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85" style={{ background: "#FFD600", color: "#111" }}>Найти матч 1v1</button>
                  ) : (
                    <button type="button" onClick={runLeaveQueue} className="h-12 rounded-xl border text-sm font-medium text-white/80 transition-colors hover:text-white" style={{ borderColor: "rgba(255,214,0,0.2)", background: "transparent" }}>Отменить поиск</button>
                  )}
                </div>

                {quests?.streak ? (
                  <div className="mt-4 rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(255,214,0,0.15)" }}>
                    <p className="text-[11px] uppercase tracking-wider text-[#FFD600]">Серия побед</p>
                    <p className="mt-1 text-sm text-white">Текущая серия: <span className="font-semibold text-[#FFD600]">{quests.streak.current}</span> • Лучшая: <span className="font-semibold text-[#FFD600]">{quests.streak.best}</span></p>
                  </div>
                ) : null}

                <QuestPanel quests={quests} onClaim={handleClaimQuest} claimingQuestKey={claimingQuestKey} />
                {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

