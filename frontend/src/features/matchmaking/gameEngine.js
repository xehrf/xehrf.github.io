import {
  COUNTDOWN_SECONDS,
  ROUND_SECONDS,
  TIMEOUT_ANSWER,
  TOTAL_ROUNDS,
} from "./questionBank.js";

function cloneQuestions(questions = []) {
  return questions.map((question) => ({
    ...question,
    options: Array.isArray(question.options) ? [...question.options] : [],
  }));
}

function normalizeUserId(userId) {
  if (userId == null) {
    return null;
  }

  return String(userId);
}

function isSameUserId(left, right) {
  const normalizedLeft = normalizeUserId(left);
  return normalizedLeft !== null && normalizedLeft === normalizeUserId(right);
}

function shouldIgnoreRoundEvent(state, eventRoundIndex, expectedOffset = 0) {
  if (typeof eventRoundIndex !== "number") {
    return false;
  }

  return eventRoundIndex !== state.roundIndex + expectedOffset;
}

export function createInitialGameState({
  questions = [],
  roundSeconds = ROUND_SECONDS,
  countdownSeconds = COUNTDOWN_SECONDS,
  totalRounds = TOTAL_ROUNDS,
} = {}) {
  const nextQuestions = cloneQuestions(questions);

  return {
    gameState: "waiting",
    questions: nextQuestions,
    roundIndex: 0,
    myScore: 0,
    opponentScore: 0,
    myAnswer: null,
    opponentAnswered: false,
    roundResult: null,
    timeLeft: roundSeconds,
    countdown: countdownSeconds,
    totalRounds: nextQuestions.length || totalRounds,
  };
}

export function getCurrentQuestion(state) {
  return state.questions[state.roundIndex] ?? null;
}

export function resetForGameStart(
  state,
  {
    questions = state.questions,
    roundSeconds = ROUND_SECONDS,
    countdownSeconds = COUNTDOWN_SECONDS,
    totalRounds = state.totalRounds,
  } = {},
) {
  const nextQuestions = cloneQuestions(questions);

  return {
    ...state,
    gameState: "countdown",
    questions: nextQuestions,
    roundIndex: 0,
    myScore: 0,
    opponentScore: 0,
    myAnswer: null,
    opponentAnswered: false,
    roundResult: null,
    timeLeft: roundSeconds,
    countdown: countdownSeconds,
    totalRounds: nextQuestions.length || totalRounds,
  };
}

export function beginRound(state, { roundSeconds = ROUND_SECONDS } = {}) {
  return {
    ...state,
    gameState: "playing",
    timeLeft: roundSeconds,
  };
}

export function tickCountdown(state) {
  if (state.gameState !== "countdown") {
    return state;
  }

  return {
    ...state,
    countdown: state.countdown - 1,
  };
}

export function tickRoundTimer(state) {
  if (state.gameState !== "playing") {
    return { nextState: state, timedOut: false };
  }

  const nextTime = Math.max(0, state.timeLeft - 1);

  return {
    nextState: {
      ...state,
      timeLeft: nextTime,
    },
    timedOut: nextTime === 0 && state.myAnswer === null,
  };
}

export function buildAnswerSummary(
  question,
  {
    userId,
    roundIndex,
    answer,
    timedOut = false,
    roundStartedAt,
    answeredAt = Date.now(),
  } = {},
) {
  const startedAt = roundStartedAt ?? answeredAt;
  const correct = !timedOut && answer === question?.answer;

  return {
    userId,
    roundIndex,
    answer: answer ?? null,
    correct,
    timedOut,
    myMs: Math.max(0, answeredAt - startedAt),
  };
}

export function applyAnswer(
  state,
  {
    userId,
    answer,
    timedOut = false,
    roundStartedAt,
    answeredAt = Date.now(),
  } = {},
) {
  if (state.myAnswer !== null) {
    return {
      nextState: state,
      answerEvent: null,
      ignored: true,
    };
  }

  const question = getCurrentQuestion(state);
  const answerEvent = buildAnswerSummary(question, {
    userId,
    roundIndex: state.roundIndex,
    answer,
    timedOut,
    roundStartedAt,
    answeredAt,
  });

  return {
    nextState: {
      ...state,
      myAnswer: answer ?? TIMEOUT_ANSWER,
    },
    answerEvent,
    ignored: false,
  };
}

export function buildRoundResult(payload, myUserId) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const myResult = results.find((item) => isSameUserId(item.userId, myUserId)) ?? null;
  const opponentResult = results.find((item) => !isSameUserId(item.userId, myUserId)) ?? null;

  return {
    roundIndex: payload?.roundIndex ?? null,
    myCorrect: Boolean(myResult?.correct),
    opponentCorrect: Boolean(opponentResult?.correct),
    correct_answer: payload?.correct_answer ?? null,
    explanation: payload?.explanation ?? "",
    myMs: Number(myResult?.myMs ?? 0),
    oppMs: opponentResult?.myMs == null ? null : Number(opponentResult.myMs),
  };
}

export function applyResolvedRoundResult(state, payload, myUserId) {
  const roundResult = buildRoundResult(payload, myUserId);

  if (roundResult.roundIndex != null && state.roundResult?.roundIndex === roundResult.roundIndex) {
    return state;
  }

  return {
    ...state,
    roundResult,
    myScore: state.myScore + (roundResult.myCorrect ? 1 : 0),
    opponentScore: state.opponentScore + (roundResult.opponentCorrect ? 1 : 0),
    gameState: "round_result",
  };
}

export function advanceToNextRound(state, { roundSeconds = ROUND_SECONDS } = {}) {
  return {
    ...state,
    roundIndex: state.roundIndex + 1,
    myAnswer: null,
    opponentAnswered: false,
    roundResult: null,
    timeLeft: roundSeconds,
    gameState: "playing",
  };
}

export function finishGame(state) {
  return {
    ...state,
    gameState: "finished",
  };
}

export function resolveNextRound(state, { roundSeconds = ROUND_SECONDS } = {}) {
  if (state.roundIndex + 1 >= state.totalRounds) {
    return {
      nextState: finishGame(state),
      outboundEvent: { event: "game_finished", data: { roundIndex: state.roundIndex } },
      isFinished: true,
    };
  }

  return {
    nextState: advanceToNextRound(state, { roundSeconds }),
    outboundEvent: { event: "game_next_round", data: { roundIndex: state.roundIndex + 1 } },
    isFinished: false,
  };
}

export function applyRemoteGameEvent(
  state,
  event,
  data,
  {
    myUserId,
    roundSeconds = ROUND_SECONDS,
    countdownSeconds = COUNTDOWN_SECONDS,
  } = {},
) {
  switch (event) {
    case "game_start":
      return resetForGameStart(state, {
        questions: Array.isArray(data?.questions) ? data.questions : state.questions,
        roundSeconds,
        countdownSeconds,
        totalRounds: Array.isArray(data?.questions) ? data.questions.length : state.totalRounds,
      });
    case "game_answer_submitted":
      if (shouldIgnoreRoundEvent(state, data?.roundIndex)) {
        return state;
      }

      return {
        ...state,
        opponentAnswered: true,
      };
    case "game_round_result":
      if (shouldIgnoreRoundEvent(state, data?.roundIndex)) {
        return state;
      }

      return applyResolvedRoundResult(state, data, myUserId);
    case "game_next_round":
      if (shouldIgnoreRoundEvent(state, data?.roundIndex, 1)) {
        return state;
      }

      return advanceToNextRound(state, { roundSeconds });
    case "game_finished":
      return finishGame(state);
    default:
      return state;
  }
}
