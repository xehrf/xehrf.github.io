import { describe, expect, it } from "vitest";
import {
  applyAnswer,
  applyRemoteGameEvent,
  buildAnswerSummary,
  buildRoundResult,
  createInitialGameState,
  resolveNextRound,
} from "./gameEngine.js";
import { buildQuestionDeck } from "./questionBank.js";

const questions = [
  {
    type: "quiz",
    question: "One",
    options: ["A", "B"],
    answer: "A",
    explanation: "Alpha",
  },
  {
    type: "quiz",
    question: "Two",
    options: ["C", "D"],
    answer: "D",
    explanation: "Delta",
  },
];

describe("gameEngine", () => {
  it("creates a bounded question deck without mutating the source bank", () => {
    const bank = [...questions, { ...questions[0], question: "Three" }];
    const deck = buildQuestionDeck({ questionBank: bank, totalRounds: 2, random: () => 0 });

    expect(deck).toHaveLength(2);
    expect(bank).toHaveLength(3);
    expect(deck).not.toBe(bank);
  });

  it("resets the match on remote game_start and adopts the shared question deck", () => {
    const sharedDeck = [questions[1], questions[0]];
    const state = {
      ...createInitialGameState({ questions, totalRounds: 2 }),
      gameState: "finished",
      roundIndex: 1,
      myScore: 2,
      opponentScore: 1,
      myAnswer: "A",
      opponentAnswered: true,
      roundResult: { myCorrect: true },
    };

    const nextState = applyRemoteGameEvent(
      state,
      "game_start",
      { host: "host-1", questions: sharedDeck },
      { roundSeconds: 15, countdownSeconds: 3 },
    );

    expect(nextState.gameState).toBe("countdown");
    expect(nextState.roundIndex).toBe(0);
    expect(nextState.myScore).toBe(0);
    expect(nextState.opponentScore).toBe(0);
    expect(nextState.myAnswer).toBeNull();
    expect(nextState.opponentAnswered).toBe(false);
    expect(nextState.roundResult).toBeNull();
    expect(nextState.questions[0].question).toBe("Two");
  });

  it("stores the local answer without finishing the round immediately", () => {
    const state = {
      ...createInitialGameState({ questions, totalRounds: 2 }),
      gameState: "playing",
    };

    const { nextState, answerEvent, ignored } = applyAnswer(state, {
      userId: "me",
      answer: "A",
      roundStartedAt: 1000,
      answeredAt: 1180,
    });

    expect(ignored).toBe(false);
    expect(nextState.gameState).toBe("playing");
    expect(nextState.myAnswer).toBe("A");
    expect(nextState.myScore).toBe(0);
    expect(nextState.roundResult).toBeNull();
    expect(answerEvent).toEqual({
      userId: "me",
      roundIndex: 0,
      answer: "A",
      correct: true,
      timedOut: false,
      myMs: 180,
    });
  });

  it("builds a local round result from canonical multiplayer payload", () => {
    const roundResult = buildRoundResult(
      {
        roundIndex: 0,
        correct_answer: "A",
        explanation: "Alpha",
        results: [
          { userId: "opponent", correct: true, myMs: 210 },
          { userId: "me", correct: false, myMs: 350 },
        ],
      },
      "me",
    );

    expect(roundResult).toEqual({
      roundIndex: 0,
      myCorrect: false,
      opponentCorrect: true,
      correct_answer: "A",
      explanation: "Alpha",
      myMs: 350,
      oppMs: 210,
    });
  });

  it("applies remote round results relative to the current player", () => {
    const state = {
      ...createInitialGameState({ questions, totalRounds: 2 }),
      gameState: "playing",
      myAnswer: "B",
    };

    const nextState = applyRemoteGameEvent(
      state,
      "game_round_result",
      {
        roundIndex: 0,
        correct_answer: "A",
        explanation: "Alpha",
        results: [
          { userId: "me", correct: false, myMs: 300 },
          { userId: "opponent", correct: true, myMs: 180 },
        ],
      },
      { myUserId: "me" },
    );

    expect(nextState.gameState).toBe("round_result");
    expect(nextState.myScore).toBe(0);
    expect(nextState.opponentScore).toBe(1);
    expect(nextState.roundResult).toMatchObject({
      myCorrect: false,
      opponentCorrect: true,
      correct_answer: "A",
    });
  });

  it("marks opponent answers only for the current round", () => {
    const state = {
      ...createInitialGameState({ questions, totalRounds: 2 }),
      gameState: "playing",
      opponentAnswered: false,
      roundIndex: 1,
    };

    const ignored = applyRemoteGameEvent(state, "game_answer_submitted", { roundIndex: 0 }, {});
    expect(ignored.opponentAnswered).toBe(false);

    const accepted = applyRemoteGameEvent(state, "game_answer_submitted", { roundIndex: 1 }, {});
    expect(accepted.opponentAnswered).toBe(true);
  });

  it("advances rounds only for the expected next round index", () => {
    const state = {
      ...createInitialGameState({ questions, totalRounds: 2 }),
      gameState: "round_result",
      roundIndex: 0,
      roundResult: { roundIndex: 0 },
      myAnswer: "A",
    };

    const duplicate = applyRemoteGameEvent(state, "game_next_round", { roundIndex: 0 }, {});
    expect(duplicate.roundIndex).toBe(0);

    const nextState = applyRemoteGameEvent(state, "game_next_round", { roundIndex: 1 }, {});
    expect(nextState.roundIndex).toBe(1);
    expect(nextState.gameState).toBe("playing");
    expect(nextState.myAnswer).toBeNull();
  });

  it("emits indexed next round and finish events", () => {
    const state = {
      ...createInitialGameState({ questions, totalRounds: 2 }),
      gameState: "round_result",
      roundIndex: 0,
    };

    const firstAdvance = resolveNextRound(state, { roundSeconds: 15 });
    expect(firstAdvance.isFinished).toBe(false);
    expect(firstAdvance.outboundEvent).toEqual({ event: "game_next_round", data: { roundIndex: 1 } });

    const secondAdvance = resolveNextRound(firstAdvance.nextState, { roundSeconds: 15 });
    expect(secondAdvance.isFinished).toBe(true);
    expect(secondAdvance.outboundEvent).toEqual({ event: "game_finished", data: { roundIndex: 1 } });
  });

  it("builds timeout answer summaries as incorrect submissions", () => {
    const answerSummary = buildAnswerSummary(questions[0], {
      userId: "me",
      roundIndex: 0,
      answer: null,
      timedOut: true,
      roundStartedAt: 500,
      answeredAt: 900,
    });

    expect(answerSummary).toEqual({
      userId: "me",
      roundIndex: 0,
      answer: null,
      correct: false,
      timedOut: true,
      myMs: 400,
    });
  });
});
