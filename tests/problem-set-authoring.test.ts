import { describe, expect, it } from "vitest";
import { authoringProblemSchema, normalizeAuthoringProblem } from "../lib/problem-set-authoring";

describe("multiple-choice authoring", () => {
  it("accepts any option count from two through twenty", () => {
    for (const count of [2, 3, 5, 20]) {
      const options = Array.from({ length: count }, (_, index) => `Choice ${index + 1}`);
      const parsed = authoringProblemSchema.parse({
        answerType: "MULTIPLE_CHOICE",
        answerKey: options.at(-1),
        options,
      });
      expect(normalizeAuthoringProblem(parsed).options).toEqual(options);
    }
  });

  it("rejects too few, duplicate, and unmatched choices", () => {
    expect(
      authoringProblemSchema.safeParse({
        answerType: "MULTIPLE_CHOICE",
        answerKey: "Only",
        options: ["Only"],
      }).success,
    ).toBe(false);
    expect(
      authoringProblemSchema.safeParse({
        answerType: "MULTIPLE_CHOICE",
        answerKey: "Same",
        options: ["Same", "Same"],
      }).success,
    ).toBe(false);
    expect(
      authoringProblemSchema.safeParse({
        answerType: "MULTIPLE_CHOICE",
        answerKey: "Missing",
        options: ["A", "B"],
      }).success,
    ).toBe(false);
  });
});
