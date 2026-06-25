import { describe, expect, it } from "vitest";
import { computeBestAverageScore } from "../lib/analytics";

describe("computeBestAverageScore", () => {
  it("uses each set's best attempt weighted by possible points", () => {
    const average = computeBestAverageScore([
      { problemSetId: "short", score: 1, maxScore: 1 },
      { problemSetId: "long", score: 4, maxScore: 10 },
      { problemSetId: "long", score: 7, maxScore: 10 },
    ]);

    expect(average).toBe(73);
  });

  it("ignores zero-point attempts", () => {
    expect(computeBestAverageScore([{ problemSetId: "bad", score: 0, maxScore: 0 }])).toBe(0);
  });
});
