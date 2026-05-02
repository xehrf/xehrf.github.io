import { describe, expect, it } from "vitest";
import { createInitialGameState } from "./gameEngine.js";
import { resolveLocalAnswerSubmission } from "./useGameEngine.js";

const questions = [
  {
    type: "quiz",
    question: "One",
    options: ["A", "B"],
    answer: "A",
    explanation: "Alpha",
  },
];

describe("useGameEngine answer submission guard", () => {
  it("ignores a duplicate local answer when the same round is already in the ledger", () => {
    const state = {
      ...createInitialGameState({ questions, totalRounds: 1 }),
      gameState: "playing",
      myAnswer: null,
    };

    const first = resolveLocalAnswerSubmission({
      state,
      answerLedger: {},
      userId: 12,
      answer: "A",
      roundStartedAt: 1000,
      answeredAt: 1200,
    });

    const second = resolveLocalAnswerSubmission({
      state,
      answerLedger: { 12: first.answerEvent },
      userId: "12",
      answer: "B",
      roundStartedAt: 1000,
      answeredAt: 1300,
    });

    expect(first.ignored).toBe(false);
    expect(first.answerEvent).toMatchObject({
      userId: 12,
      roundIndex: 0,
      answer: "A",
    });
    expect(second.ignored).toBe(true);
    expect(second.answerEvent).toBeNull();
    expect(second.nextState).toBe(state);
  });
});
