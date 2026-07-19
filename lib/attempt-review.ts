export type AttemptVerdict = "perfect" | "completed" | "review" | "recorded";

export type ResponseReviewStatus = "correct" | "incorrect" | "skipped";

export function attemptPercentage(score: number, maxScore: number) {
  if (maxScore <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
}

export function attemptVerdict(
  score: number,
  maxScore: number,
  correctCount: number,
): { kind: AttemptVerdict; label: string } {
  if (maxScore <= 0) return { kind: "recorded", label: "Recorded" };
  if (score === maxScore) return { kind: "perfect", label: "Perfect score" };
  if (correctCount === 0) return { kind: "review", label: "Needs review" };
  return { kind: "completed", label: "Completed" };
}

export function responseReviewStatus(response: {
  rawAnswer: string;
  isCorrect: boolean;
}): ResponseReviewStatus {
  if (!response.rawAnswer.trim()) return "skipped";
  return response.isCorrect ? "correct" : "incorrect";
}

export function acceptedAnswerList(answerKey: string, acceptedAnswers: string[]) {
  return Array.from(
    new Set([answerKey, ...acceptedAnswers].map((answer) => answer.trim()).filter(Boolean)),
  );
}

export function formatAttemptDuration(durationSeconds: number | null) {
  if (durationSeconds === null) return "Not recorded";
  const safeSeconds = Math.max(0, Math.round(durationSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
