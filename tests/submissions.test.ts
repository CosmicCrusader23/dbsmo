import { describe, expect, it } from "vitest";
import {
  canViewSubmissionAnswers,
  normalizeSubmissionPage,
  submissionPercentage,
  submissionVerdict,
  SUBMISSIONS_PAGE_SIZE,
} from "../lib/submissions";

describe("submission helpers", () => {
  it("uses a bounded twenty-row page size", () => {
    expect(SUBMISSIONS_PAGE_SIZE).toBe(20);
    expect(normalizeSubmissionPage(undefined)).toBe(1);
    expect(normalizeSubmissionPage("0")).toBe(1);
    expect(normalizeSubmissionPage("3.8")).toBe(3);
    expect(normalizeSubmissionPage("not-a-page")).toBe(1);
  });

  it("labels verdicts without exposing response data", () => {
    expect(submissionVerdict(10, 10)).toEqual({ kind: "accepted", label: "Accepted" });
    expect(submissionVerdict(3, 10)).toEqual({ kind: "partial", label: "Partial" });
    expect(submissionVerdict(0, 10)).toEqual({ kind: "wrong", label: "Wrong answer" });
    expect(submissionVerdict(0, 0)).toEqual({ kind: "recorded", label: "Recorded" });
  });

  it("bounds displayed percentages", () => {
    expect(submissionPercentage(3, 4)).toBe(75);
    expect(submissionPercentage(9, 4)).toBe(100);
    expect(submissionPercentage(-1, 4)).toBe(0);
    expect(submissionPercentage(1, 0)).toBe(0);
  });

  it("only unlocks other submitted answers for perfect solvers or staff", () => {
    expect(canViewSubmissionAnswers(false, false)).toBe(false);
    expect(canViewSubmissionAnswers(false, true)).toBe(true);
    expect(canViewSubmissionAnswers(true, false)).toBe(true);
    expect(canViewSubmissionAnswers(false, false, true)).toBe(true);
  });
});
