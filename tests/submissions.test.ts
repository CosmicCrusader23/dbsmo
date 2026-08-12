import { describe, expect, it } from "vitest";
import {
  canLinkSubmissionProfile,
  canShowSubmissionIdentity,
  canViewSubmissionAnswers,
  isPerfectSubmission,
  normalizeSubmissionPage,
  normalizeSubmissionSearch,
  normalizeSubmissionView,
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
    expect(normalizeSubmissionPage(["4", "9"])).toBe(4);
  });

  it("normalizes repeated and oversized filter parameters", () => {
    expect(normalizeSubmissionView(["friends", "all"])).toBe("friends");
    expect(normalizeSubmissionView(["unexpected", "friends"])).toBe("all");
    expect(normalizeSubmissionSearch(["  Edwin  ", "ignored"])).toBe("Edwin");
    expect(normalizeSubmissionSearch("x".repeat(100))).toHaveLength(80);
  });

  it("labels verdicts without exposing response data", () => {
    expect(submissionVerdict(10, 10)).toEqual({ kind: "accepted", label: "Accepted" });
    expect(submissionVerdict(3, 10)).toEqual({ kind: "partial", label: "Partial" });
    expect(submissionVerdict(0, 10)).toEqual({ kind: "wrong", label: "Wrong answer" });
    expect(submissionVerdict(0, 0)).toEqual({ kind: "recorded", label: "Recorded" });
    expect(submissionVerdict(11, 10)).toEqual({ kind: "partial", label: "Partial" });
    expect(isPerfectSubmission(10, 10)).toBe(true);
    expect(isPerfectSubmission(11, 10)).toBe(false);
    expect(isPerfectSubmission(0, 0)).toBe(false);
  });

  it("bounds displayed percentages", () => {
    expect(submissionPercentage(3, 4)).toBe(75);
    expect(submissionPercentage(9, 4)).toBe(100);
    expect(submissionPercentage(-1, 4)).toBe(0);
    expect(submissionPercentage(1, 0)).toBe(0);
  });

  it("only unlocks submitted answers for perfect solvers or staff", () => {
    expect(canViewSubmissionAnswers(false, false)).toBe(false);
    expect(canViewSubmissionAnswers(false, true)).toBe(true);
    expect(canViewSubmissionAnswers(true, false)).toBe(true);
  });

  it("separates submission identity visibility from profile access", () => {
    expect(canShowSubmissionIdentity(false, false, false)).toBe(false);
    expect(canShowSubmissionIdentity(false, true, false)).toBe(true);
    expect(canShowSubmissionIdentity(false, false, true)).toBe(true);
    expect(canLinkSubmissionProfile(false, false, false)).toBe(false);
    expect(canLinkSubmissionProfile(false, true, false)).toBe(true);
    expect(canLinkSubmissionProfile(false, false, true)).toBe(true);
  });
});
