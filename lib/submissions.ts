export const SUBMISSIONS_PAGE_SIZE = 20;

export type SubmissionVerdictKind = "accepted" | "partial" | "wrong" | "recorded";

export function normalizeSubmissionPage(value: string | undefined) {
  const parsed = Number(value ?? "1");
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

export function submissionVerdict(
  score: number,
  maxScore: number,
): { kind: SubmissionVerdictKind; label: string } {
  if (maxScore <= 0) return { kind: "recorded", label: "Recorded" };
  if (score >= maxScore) return { kind: "accepted", label: "Accepted" };
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
  isAttemptOwner = false,
) {
  return isAttemptOwner || viewerCanReviewStudentAttempts || viewerSolvedSet;
}
