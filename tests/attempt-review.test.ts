import { describe, expect, it } from "vitest";
import {
  acceptedAnswerList,
  attemptPercentage,
  attemptVerdict,
  formatAttemptDuration,
  responseReviewStatus,
} from "../lib/attempt-review";

describe("attempt review helpers", () => {
  it("bounds score percentages and handles an unscored attempt", () => {
    expect(attemptPercentage(7, 10)).toBe(70);
    expect(attemptPercentage(12, 10)).toBe(100);
    expect(attemptPercentage(0, 0)).toBe(0);
  });

  it("describes perfect, completed, and review-needed attempts without inventing a pass mark", () => {
    expect(attemptVerdict(10, 10, 10)).toEqual({ kind: "perfect", label: "Perfect score" });
    expect(attemptVerdict(4, 10, 4)).toEqual({ kind: "completed", label: "Completed" });
    expect(attemptVerdict(0, 10, 0)).toEqual({ kind: "review", label: "Needs review" });
    expect(attemptVerdict(0, 0, 0)).toEqual({ kind: "recorded", label: "Recorded" });
  });

  it("distinguishes skipped responses from incorrect submitted answers", () => {
    expect(responseReviewStatus({ rawAnswer: "  ", isCorrect: false })).toBe("skipped");
    expect(responseReviewStatus({ rawAnswer: "41", isCorrect: false })).toBe("incorrect");
    expect(responseReviewStatus({ rawAnswer: "42", isCorrect: true })).toBe("correct");
  });

  it("deduplicates accepted answers while preserving their display order", () => {
    expect(acceptedAnswerList("42", ["42", " 6\\cdot7 ", ""])).toEqual(["42", "6\\cdot7"]);
  });

  it("formats recorded durations compactly", () => {
    expect(formatAttemptDuration(null)).toBe("Not recorded");
    expect(formatAttemptDuration(38)).toBe("38s");
    expect(formatAttemptDuration(158)).toBe("2m 38s");
    expect(formatAttemptDuration(3720)).toBe("1h 2m");
  });
});
