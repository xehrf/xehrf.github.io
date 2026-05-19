import { describe, expect, it } from "vitest";
import {
  CODE_REVIEW_SCENARIOS,
  REVIEW_CATEGORIES,
  pickCodeReviewScenario,
  scoreCodeReviewAnswer,
} from "./codeReview.js";

describe("code review interview scenarios", () => {
  it("scores all review categories independently", () => {
    const scenario = CODE_REVIEW_SCENARIOS[0];
    const result = scoreCodeReviewAnswer(scenario, {
      problem: scenario.answers.problem,
      improvement: "wrong",
      comment: scenario.answers.comment,
    });

    expect(result.total).toBe(REVIEW_CATEGORIES.length);
    expect(result.correct).toBe(2);
    expect(result.details).toContainEqual({
      category: "improvement",
      selectedId: "wrong",
      expectedId: scenario.answers.improvement,
      correct: false,
    });
  });

  it("picks scenarios from the code review bank", () => {
    const first = pickCodeReviewScenario(() => 0);
    const last = pickCodeReviewScenario(() => 0.999);

    expect(first).toBe(CODE_REVIEW_SCENARIOS[0]);
    expect(last).toBe(CODE_REVIEW_SCENARIOS[CODE_REVIEW_SCENARIOS.length - 1]);
  });
});
