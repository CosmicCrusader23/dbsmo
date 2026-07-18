import { describe, expect, it } from "vitest";
import { calculateRegrade } from "../lib/regrade";

const problem = {
  id: "problem-1",
  answerType: "INTEGER",
  answerKey: "42",
  acceptedAnswers: [],
  caseSensitive: false,
  points: 3,
};

describe("calculateRegrade", () => {
  it("uses indexed problems and returns only changed responses", () => {
    const result = calculateRegrade(new Map([[problem.id, problem]]), [
      {
        id: "response-1",
        problemId: problem.id,
        rawAnswer: "42",
        normalizedAnswer: "41",
        isCorrect: false,
        pointsAwarded: 0,
      },
    ]);

    expect(result).toEqual({
      changedResponses: [
        {
          id: "response-1",
          isCorrect: true,
          normalizedAnswer: "42",
          pointsAwarded: 3,
        },
      ],
      score: 3,
      maxScore: 3,
    });
  });

  it("keeps legacy responses to deleted problems out of the score", () => {
    const result = calculateRegrade(new Map(), [
      {
        id: "response-1",
        problemId: "deleted-problem",
        rawAnswer: "42",
        normalizedAnswer: "42",
        isCorrect: true,
        pointsAwarded: 3,
      },
    ]);

    expect(result).toEqual({ changedResponses: [], score: 0, maxScore: 0 });
  });
});
