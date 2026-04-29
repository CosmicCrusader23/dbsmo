export type AnswerType = "exact" | "integer" | "decimal" | "fraction" | "set" | "multiple";

export type GradeInput = {
  answerType: AnswerType;
  answerKey: string;
  rawAnswer: string;
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  decimalTolerance?: number;
};

export type GradeResult = {
  isCorrect: boolean;
  normalizedAnswer: string;
  normalizedAcceptedAnswers: string[];
};

export function gradeAnswer(input: GradeInput): GradeResult {
  const normalizedAnswer = normalizeAnswer(input.rawAnswer, input.answerType, input.caseSensitive);
  const candidates = [input.answerKey, ...(input.acceptedAnswers ?? [])]
    .filter(Boolean)
    .map((answer) => normalizeAnswer(answer, input.answerType, input.caseSensitive));

  if (input.answerType === "decimal") {
    const tolerance = input.decimalTolerance ?? 0;
    const answerNumber = Number(normalizedAnswer);
    const isCorrect = candidates.some((candidate) => {
      const candidateNumber = Number(candidate);
      return (
        Number.isFinite(answerNumber) &&
        Number.isFinite(candidateNumber) &&
        Math.abs(answerNumber - candidateNumber) <= tolerance
      );
    });

    return { isCorrect, normalizedAnswer, normalizedAcceptedAnswers: candidates };
  }

  return {
    isCorrect: candidates.includes(normalizedAnswer),
    normalizedAnswer,
    normalizedAcceptedAnswers: candidates,
  };
}

export function normalizeAnswer(
  rawAnswer: string,
  answerType: AnswerType,
  caseSensitive = false,
): string {
  const compact = normalizeText(rawAnswer, caseSensitive);

  switch (answerType) {
    case "integer":
      return normalizeInteger(compact);
    case "decimal":
      return normalizeDecimal(compact);
    case "fraction":
      return normalizeFraction(compact);
    case "set":
      return normalizeSet(compact, caseSensitive);
    case "exact":
    case "multiple":
    default:
      return compact;
  }
}

function normalizeText(value: string, caseSensitive: boolean): string {
  const normalized = value
    .trim()
    .replace(/[，；]/g, (match) => (match === "，" ? "," : ";"))
    .replace(/\s+/g, " ");

  return caseSensitive ? normalized : normalized.toLowerCase();
}

function normalizeInteger(value: string): string {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue)) {
    return value;
  }
  return String(numberValue);
}

function normalizeDecimal(value: string): string {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return value;
  }
  return String(numberValue);
}

function normalizeFraction(value: string): string {
  const [numeratorRaw, denominatorRaw] = value.split("/");
  if (!numeratorRaw || !denominatorRaw) {
    return normalizeDecimal(value);
  }

  const numerator = Number(numeratorRaw);
  const denominator = Number(denominatorRaw);
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator === 0) {
    return value;
  }

  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(Math.abs(numerator), Math.abs(denominator));
  return `${(sign * numerator) / divisor}/${Math.abs(denominator) / divisor}`;
}

function normalizeSet(value: string, caseSensitive: boolean): string {
  const withoutBraces = value.replace(/^[{([]/, "").replace(/[})\]]$/, "");
  return withoutBraces
    .split(/[,; ]+/)
    .map((part) => normalizeText(part, caseSensitive))
    .filter(Boolean)
    .sort()
    .join(",");
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}
