export type ProblemContentFormat = "LATEX" | "HTML";

const CONTENT_FORMAT_MAP: Record<string, ProblemContentFormat> = {
  latex: "LATEX",
  html: "HTML",
};

export function normalizeProblemContentFormat(
  value: unknown,
  fallback: ProblemContentFormat = "LATEX",
): ProblemContentFormat {
  if (typeof value !== "string") {
    return fallback;
  }
  return CONTENT_FORMAT_MAP[value.trim().toLowerCase()] ?? fallback;
}

export function isSupportedProblemContentFormat(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  return Boolean(CONTENT_FORMAT_MAP[value.trim().toLowerCase()]);
}
