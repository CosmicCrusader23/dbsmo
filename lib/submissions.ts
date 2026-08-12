import {
  firstQueryParam,
  normalizePageNumber,
  normalizeQueryText,
  type QueryParamValue,
} from "./query-params";

export const SUBMISSIONS_PAGE_SIZE = 20;

export type SubmissionVerdictKind = "accepted" | "partial" | "wrong" | "recorded";
export type SubmissionView = "all" | "friends";

type SubmissionSearchParam = QueryParamValue;

export function normalizeSubmissionPage(value: SubmissionSearchParam) {
  return normalizePageNumber(value);
}

export function normalizeSubmissionSearch(value: SubmissionSearchParam) {
  return normalizeQueryText(value);
}

export function normalizeSubmissionView(value: SubmissionSearchParam): SubmissionView {
  return firstQueryParam(value) === "friends" ? "friends" : "all";
}

export function isPerfectSubmission(score: number, maxScore: number) {
  return maxScore > 0 && score === maxScore;
}

export function submissionVerdict(
  score: number,
  maxScore: number,
): { kind: SubmissionVerdictKind; label: string } {
  if (maxScore <= 0) return { kind: "recorded", label: "Recorded" };
  if (isPerfectSubmission(score, maxScore)) return { kind: "accepted", label: "Accepted" };
  if (score > 0) return { kind: "partial", label: "Partial" };
  return { kind: "wrong", label: "Wrong answer" };
}

export function submissionPercentage(score: number, maxScore: number) {
  if (maxScore <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
}

export function canViewSubmissionAnswers(
  viewerCanReviewStudentAttempts: boolean,
  viewerSolvedSet: boolean,
) {
  return viewerCanReviewStudentAttempts || viewerSolvedSet;
}

export function canShowSubmissionIdentity(
  leaderboardVisible: boolean,
  isAttemptOwner: boolean,
  viewerCanReviewStudentAttempts: boolean,
) {
  return leaderboardVisible || isAttemptOwner || viewerCanReviewStudentAttempts;
}

export function canLinkSubmissionProfile(
  profileVisible: boolean,
  isAttemptOwner: boolean,
  viewerCanViewPrivateProfiles: boolean,
) {
  return profileVisible || isAttemptOwner || viewerCanViewPrivateProfiles;
}
