export const FTW_PROBLEM_LIMIT_SEC = 45;
export const FTW_PROBLEMS_PER_MATCH = 10;
export const FTW_MAX_POINTS_PER_PROBLEM = 6;

export function scoreFromElapsed(elapsedMs: number, isCorrect: boolean): number {
  if (!isCorrect) return 0;
  if (elapsedMs >= FTW_PROBLEM_LIMIT_SEC * 1000) return 0;
  const elapsedSec = Math.max(0, elapsedMs / 1000);
  const decay = Math.floor(elapsedSec / 7.5);
  return Math.max(1, FTW_MAX_POINTS_PER_PROBLEM - decay);
}

export function maxScoreForMatch(totalProblems: number): number {
  return totalProblems * FTW_MAX_POINTS_PER_PROBLEM;
}
