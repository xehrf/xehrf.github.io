import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyAnswer,
  applyRemoteGameEvent,
  beginRound,
  createInitialGameState,
  getCurrentQuestion,
  resolveNextRound,
  tickCountdown,
  tickRoundTimer,
} from "./gameEngine.js";
import {
  COUNTDOWN_SECONDS,
  ROUND_QUESTIONS,
  ROUND_SECONDS,
  TOTAL_ROUNDS,
  buildQuestionDeck,
} from "./questionBank.js";

function normalizeUserId(userId) {
  if (userId == null) {
    return null;
  }

  return String(userId);
}

function attachSenderUserId(data, myUserId) {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  const senderUserId = normalizeUserId(myUserId);
  if (senderUserId === null) {
    return data;
  }

  return {
    ...data,
    senderUserId,
  };
}

function sortAnswerEvents(events) {
  return [...events].sort((left, right) => {
    const leftId = normalizeUserId(left?.userId) ?? "";
    const rightId = normalizeUserId(right?.userId) ?? "";
    return leftId.localeCompare(rightId);
  });
}

const ROUND_RESULT_AUTO_ADVANCE_MS = 2500;

export function resolveLocalAnswerSubmission({
  state,
  answerLedger,
  userId,
  answer,
  timedOut = false,
  roundStartedAt,
  answeredAt = Date.now(),
} = {}) {
  const answerKey = normalizeUserId(userId) ?? "self";
  const existingAnswer = answerLedger?.[answerKey] ?? null;

  if (existingAnswer?.roundIndex === state?.roundIndex) {
    return {
      nextState: state,
      answerEvent: null,
      answerKey,
      ignored: true,
    };
  }

  const { nextState, answerEvent, ignored } = applyAnswer(state, {
    userId,
    answer,
    timedOut,
    roundStartedAt,
    answeredAt,
  });

  return {
    nextState,
    answerEvent,
    answerKey,
    ignored,
  };
}

export function useGameEngine({
  wsRef,
  myUserId,
  hostUserId,
  questionBank = ROUND_QUESTIONS,
  totalRounds = TOTAL_ROUNDS,
  roundSeconds = ROUND_SECONDS,
  countdownSeconds = COUNTDOWN_SECONDS,
  random = Math.random,
} = {}) {
  const [game, setGame] = useState(() =>
    createInitialGameState({
      questions: [],
      roundSeconds,
      countdownSeconds,
      totalRounds,
    }),
  );
  const gameRef = useRef(game);
  const timerRef = useRef(null);
  const autoAdvanceTimerRef = useRef(null);
  const nextRoundRef = useRef(null);
  const roundStartRef = useRef(null);
  const answerLedgerRef = useRef({});

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const isHost = useMemo(() => {
    const normalizedMyUserId = normalizeUserId(myUserId);
    const normalizedHostUserId = normalizeUserId(hostUserId);
    return normalizedMyUserId !== null && normalizedMyUserId === normalizedHostUserId;
  }, [hostUserId, myUserId]);

  const clearActiveTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const clearAutoAdvanceTimer = useCallback(() => {
    clearTimeout(autoAdvanceTimerRef.current);
    autoAdvanceTimerRef.current = null;
  }, []);

  const resetRoundLedger = useCallback(() => {
    answerLedgerRef.current = {};
  }, []);

  const sendWS = useCallback(
    (event, data = {}) => {
      if (!wsRef?.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      wsRef.current.send(
        JSON.stringify({
          event,
          data: attachSenderUserId(data, myUserId),
        }),
      );
    },
    [myUserId, wsRef],
  );

  const scheduleAutoAdvanceRound = useCallback(
    (roundIndex) => {
      if (!isHost) {
        return;
      }

      clearAutoAdvanceTimer();
      autoAdvanceTimerRef.current = setTimeout(() => {
        const snapshot = gameRef.current;
        if (snapshot.gameState !== "round_result" || snapshot.roundResult?.roundIndex !== roundIndex) {
          return;
        }

        nextRoundRef.current?.();
      }, ROUND_RESULT_AUTO_ADVANCE_MS);
    },
    [clearAutoAdvanceTimer, isHost],
  );

  const applyEventLocally = useCallback(
    (event, data) => {
      setGame((prev) => {
        const nextState = applyRemoteGameEvent(prev, event, data, {
          myUserId,
          roundSeconds,
          countdownSeconds,
        });
        gameRef.current = nextState;
        return nextState;
      });
    },
    [countdownSeconds, myUserId, roundSeconds],
  );

  const maybeBroadcastRoundResult = useCallback(() => {
    if (!isHost) {
      return;
    }

    const answerEvents = sortAnswerEvents(Object.values(answerLedgerRef.current));
    if (answerEvents.length < 2) {
      return;
    }

    const snapshot = gameRef.current;
    const question = getCurrentQuestion(snapshot);
    const payload = {
      roundIndex: snapshot.roundIndex,
      correct_answer: question?.answer ?? null,
      explanation: question?.explanation ?? "",
      results: answerEvents,
    };

    clearActiveTimer();
    sendWS("game_round_result", payload);
    applyEventLocally("game_round_result", payload);
    scheduleAutoAdvanceRound(payload.roundIndex);
  }, [applyEventLocally, clearActiveTimer, isHost, scheduleAutoAdvanceRound, sendWS]);

  const handleGameEvent = useCallback(
    (event, data) => {
      const snapshot = gameRef.current;

      if (event === "game_start" || event === "game_start_cancelled") {
        clearActiveTimer();
        clearAutoAdvanceTimer();
        resetRoundLedger();
        roundStartRef.current = null;
      }

      if (event === "game_answer_submitted") {
        if (typeof data?.roundIndex === "number" && data.roundIndex !== snapshot.roundIndex) {
          return;
        }

        const answerKey = normalizeUserId(data?.userId) ?? "opponent";
        answerLedgerRef.current = {
          ...answerLedgerRef.current,
          [answerKey]: data,
        };
      }

      if (event === "game_round_result" || event === "game_finished") {
        clearActiveTimer();
      }

      if (event === "game_next_round") {
        clearAutoAdvanceTimer();
        resetRoundLedger();
        roundStartRef.current = Date.now();
      }

      applyEventLocally(event, data);

      if (event === "game_round_result") {
        scheduleAutoAdvanceRound(data?.roundIndex);
      }

      if (event === "game_answer_submitted") {
        maybeBroadcastRoundResult();
      }
    },
    [applyEventLocally, clearActiveTimer, clearAutoAdvanceTimer, maybeBroadcastRoundResult, resetRoundLedger, scheduleAutoAdvanceRound],
  );

  const startGame = useCallback(() => {
    if (!isHost) {
      return;
    }

    clearActiveTimer();
    clearAutoAdvanceTimer();
    resetRoundLedger();
    roundStartRef.current = null;

    const questions = buildQuestionDeck({ questionBank, totalRounds, random });
    const payload = {
      host: hostUserId ?? myUserId,
      questions,
    };

    sendWS("game_start", payload);
    applyEventLocally("game_start", payload);
  }, [
    applyEventLocally,
    clearActiveTimer,
    hostUserId,
    isHost,
    myUserId,
    questionBank,
    random,
    clearAutoAdvanceTimer,
    resetRoundLedger,
    sendWS,
    totalRounds,
  ]);

  const submitAnswer = useCallback(
    (answer, timedOut = false) => {
      const snapshot = gameRef.current;
      const { nextState, answerEvent, answerKey, ignored } = resolveLocalAnswerSubmission({
        state: snapshot,
        answerLedger: answerLedgerRef.current,
        userId: myUserId,
        answer,
        timedOut,
        roundStartedAt: roundStartRef.current ?? Date.now(),
        answeredAt: Date.now(),
      });

      if (ignored || !answerEvent) {
        return;
      }

      clearActiveTimer();
      answerLedgerRef.current = {
        ...answerLedgerRef.current,
        [answerKey]: answerEvent,
      };

      gameRef.current = nextState;
      setGame(nextState);
      sendWS("game_answer_submitted", answerEvent);
      maybeBroadcastRoundResult();
    },
    [clearActiveTimer, maybeBroadcastRoundResult, myUserId, sendWS],
  );

  const nextRound = useCallback(() => {
    if (!isHost) {
      return;
    }

    clearAutoAdvanceTimer();
    const { nextState, outboundEvent, isFinished } = resolveNextRound(gameRef.current, {
      roundSeconds,
    });

    resetRoundLedger();

    if (!isFinished) {
      roundStartRef.current = Date.now();
    } else {
      clearActiveTimer();
      roundStartRef.current = null;
    }

    gameRef.current = nextState;
    setGame(nextState);
    sendWS(outboundEvent.event, outboundEvent.data);
  }, [clearActiveTimer, clearAutoAdvanceTimer, isHost, resetRoundLedger, roundSeconds, sendWS]);

  nextRoundRef.current = nextRound;

  useEffect(() => {
    if (game.gameState !== "countdown") {
      return undefined;
    }

    if (game.countdown <= 0) {
      const nextState = beginRound(gameRef.current, { roundSeconds });
      roundStartRef.current = Date.now();
      gameRef.current = nextState;
      setGame(nextState);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setGame((prev) => {
        const nextState = tickCountdown(prev);
        gameRef.current = nextState;
        return nextState;
      });
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [game.countdown, game.gameState, roundSeconds]);

  useEffect(() => {
    if (game.gameState !== "playing") {
      return undefined;
    }

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      let shouldTimeout = false;

      setGame((prev) => {
        const { nextState, timedOut } = tickRoundTimer(prev);
        shouldTimeout = timedOut;
        gameRef.current = nextState;
        return nextState;
      });

      if (shouldTimeout) {
        submitAnswer(null, true);
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [game.gameState, game.roundIndex, submitAnswer]);

  return {
    gameState: game.gameState,
    currentQuestion: getCurrentQuestion(game),
    roundIndex: game.roundIndex,
    myScore: game.myScore,
    opponentScore: game.opponentScore,
    myAnswer: game.myAnswer,
    opponentAnswered: game.opponentAnswered,
    roundResult: game.roundResult,
    timeLeft: game.timeLeft,
    countdown: game.countdown,
    totalRounds: game.totalRounds,
    canStartGame: isHost,
    canAdvanceRound: isHost,
    canPlayAgain: isHost,
    startGame,
    submitAnswer,
    nextRound,
    handleGameEvent,
  };
}
