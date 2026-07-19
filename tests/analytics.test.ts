import { describe, expect, it } from "vitest";
import { computePerformanceProfile } from "../lib/analytics";

describe("computePerformanceProfile", () => {
  it("uses the best attempt per set with equal set weight", () => {
    const profile = computePerformanceProfile(
      [
        { problemSetId: "short", score: 1, maxScore: 1 },
        { problemSetId: "long", score: 4, maxScore: 10 },
        { problemSetId: "long", score: 7, maxScore: 10 },
      ],
      10,
    );

    expect(profile.bestSetAverage).toBe(85);
    expect(profile.attemptedSets).toBe(2);
    expect(profile.masteredSets).toBe(1);
    expect(profile.totalAttempts).toBe(3);
  });

  it("ignores zero-point attempts and returns an empty profile", () => {
    expect(
      computePerformanceProfile([{ problemSetId: "bad", score: 0, maxScore: 0 }], 100),
    ).toEqual({
      masteryIndex: 0,
      bestSetAverage: 0,
      proficiency: 0,
      breadth: 0,
      consistency: 0,
      masteryRate: 0,
      attemptedSets: 0,
      masteredSets: 0,
      totalAttempts: 1,
      evidence: "none",
    });
  });

  it("shrinks tiny samples and rewards breadth", () => {
    const onePerfect = computePerformanceProfile(
      [{ problemSetId: "only", score: 10, maxScore: 10 }],
      100,
    );
    const broadStrong = computePerformanceProfile(
      Array.from({ length: 50 }, (_, index) => ({
        problemSetId: `set-${index}`,
        score: 8,
        maxScore: 10,
      })),
      100,
    );

    expect(onePerfect.proficiency).toBe(62.5);
    expect(onePerfect.evidence).toBe("limited");
    expect(broadStrong.evidence).toBe("established");
    expect(broadStrong.masteryIndex).toBeGreaterThan(onePerfect.masteryIndex);
  });

  it("uses the lower quartile as the consistency floor", () => {
    const steady = computePerformanceProfile(
      [80, 80, 80, 80].map((score, index) => ({
        problemSetId: `steady-${index}`,
        score,
        maxScore: 100,
      })),
      4,
    );
    const volatile = computePerformanceProfile(
      [100, 100, 60, 60].map((score, index) => ({
        problemSetId: `volatile-${index}`,
        score,
        maxScore: 100,
      })),
      4,
    );

    expect(steady.bestSetAverage).toBe(volatile.bestSetAverage);
    expect(steady.consistency).toBeGreaterThan(volatile.consistency);
    expect(steady.masteryIndex).toBeGreaterThan(volatile.masteryIndex);
  });
});
