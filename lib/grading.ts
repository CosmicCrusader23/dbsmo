import { normalizeMathInputForEvaluation, stripMathDelimiters } from "@/lib/math-input";

export type AnswerType =
  | "exact"
  | "integer"
  | "decimal"
  | "fraction"
  | "set"
  | "multiple"
  | "expression";

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
  const rawCandidates = [input.answerKey, ...(input.acceptedAnswers ?? [])].filter(Boolean);
  const candidates = rawCandidates.map((answer) =>
    normalizeAnswer(answer, input.answerType, input.caseSensitive),
  );

  if (input.answerType === "decimal") {
    const tolerance = input.decimalTolerance ?? 0;
    const answerNumber = Number(normalizedAnswer);
    const answerCanonical = canonicalDecimal(normalizeText(input.rawAnswer, false));
    const isCorrect = candidates.some((candidate, index) => {
      const candidateCanonical = canonicalDecimal(normalizeText(rawCandidates[index], false));
      if (answerCanonical && candidateCanonical && answerCanonical === candidateCanonical) {
        return true;
      }
      if (tolerance === 0) return false;

      const candidateNumber = Number(candidate);
      return (
        Number.isFinite(answerNumber) &&
        Number.isFinite(candidateNumber) &&
        Math.abs(answerNumber) <= Number.MAX_SAFE_INTEGER &&
        Math.abs(candidateNumber) <= Number.MAX_SAFE_INTEGER &&
        Math.abs(answerNumber - candidateNumber) <= tolerance
      );
    });

    return { isCorrect, normalizedAnswer, normalizedAcceptedAnswers: candidates };
  }

  if (input.answerType === "expression") {
    return gradeExpressionCandidates(
      input.rawAnswer,
      rawCandidates,
      normalizedAnswer,
      input.decimalTolerance ?? 1e-9,
    );
  }

  if (input.answerType === "exact") {
    const literalResult = {
      isCorrect: candidates.includes(normalizedAnswer),
      normalizedAnswer,
      normalizedAcceptedAnswers: candidates,
    };
    if (literalResult.isCorrect) {
      return literalResult;
    }

    const expressionResult = gradeExpressionCandidates(
      input.rawAnswer,
      rawCandidates,
      normalizedAnswer,
      input.decimalTolerance ?? 1e-9,
      true,
    );
    return expressionResult.isCorrect ? expressionResult : literalResult;
  }

  return {
    isCorrect: candidates.includes(normalizedAnswer),
    normalizedAnswer,
    normalizedAcceptedAnswers: candidates,
  };
}

function gradeExpressionCandidates(
  rawAnswer: string,
  rawCandidates: string[],
  fallbackNormalizedAnswer: string,
  tolerance: number,
  preserveExactNumericIdentity = false,
): GradeResult {
  const answerNumber = evaluateMathExpression(rawAnswer);
  const evaluatedCandidates = rawCandidates.map((answer) => evaluateMathExpression(answer));
  const normalizedCandidates = evaluatedCandidates.map((candidate) =>
    Number.isFinite(candidate) ? formatNumber(candidate) : "",
  );
  const answerCanonical = preserveExactNumericIdentity
    ? canonicalDecimal(normalizeText(rawAnswer, false))
    : null;
  const isCorrect =
    Number.isFinite(answerNumber) &&
    evaluatedCandidates.some((candidate, index) => {
      const candidateCanonical = preserveExactNumericIdentity
        ? canonicalDecimal(normalizeText(rawCandidates[index], false))
        : null;
      if (answerCanonical && candidateCanonical) {
        return answerCanonical === candidateCanonical;
      }
      if (
        preserveExactNumericIdentity &&
        (Math.abs(answerNumber) > Number.MAX_SAFE_INTEGER ||
          Math.abs(candidate) > Number.MAX_SAFE_INTEGER)
      ) {
        return false;
      }
      return Number.isFinite(candidate) && numbersMatch(answerNumber, candidate, tolerance);
    });

  return {
    isCorrect,
    normalizedAnswer: Number.isFinite(answerNumber)
      ? formatNumber(answerNumber)
      : fallbackNormalizedAnswer,
    normalizedAcceptedAnswers: normalizedCandidates,
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
    case "expression":
      return normalizeExpression(compact);
    case "exact":
    case "multiple":
    default:
      return compact;
  }
}

function normalizeText(value: string, caseSensitive: boolean): string {
  const normalized = stripMathDelimiters(value)
    .trim()
    .replace(/[，；]/g, (match) => (match === "，" ? "," : ";"))
    .replace(/\s+/g, " ");

  return caseSensitive ? normalized : normalized.toLowerCase();
}

function normalizeInteger(value: string): string {
  if (/^[+-]?\d+$/.test(value)) {
    try {
      return BigInt(value).toString();
    } catch {
      return value;
    }
  }

  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue)) {
    return value;
  }
  return String(numberValue);
}

function normalizeDecimal(value: string): string {
  if (/^[+-]?\d+$/.test(value)) {
    try {
      return BigInt(value).toString();
    } catch {
      return value;
    }
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || Math.abs(numberValue) > Number.MAX_SAFE_INTEGER) {
    return value;
  }
  return String(numberValue);
}

function normalizeFraction(value: string): string {
  const stripped = stripMathDelimiters(value);
  const latexFractionMatch = stripped.match(/^\\frac\{([+-]?\d+)\}\{([+-]?\d+)\}$/);
  const fractionValue = latexFractionMatch
    ? `${latexFractionMatch[1]}/${latexFractionMatch[2]}`
    : value;
  const fractionParts = fractionValue.split("/");
  if (fractionParts.length !== 2) {
    return normalizeDecimal(value);
  }
  const [numeratorRaw, denominatorRaw] = fractionParts;
  if (!numeratorRaw || !denominatorRaw) return normalizeDecimal(value);

  if (!/^[+-]?\d+$/.test(numeratorRaw) || !/^[+-]?\d+$/.test(denominatorRaw)) {
    return value;
  }
  if (
    numeratorRaw.replace(/^[+-]/, "").length > 512 ||
    denominatorRaw.replace(/^[+-]/, "").length > 512
  ) {
    return value;
  }

  const numerator = BigInt(numeratorRaw);
  const denominator = BigInt(denominatorRaw);
  if (denominator === 0n) return value;

  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcdBigInt(absBigInt(numerator), absBigInt(denominator));
  return `${(sign * numerator) / divisor}/${absBigInt(denominator) / divisor}`;
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

function normalizeExpression(value: string): string {
  const evaluated = evaluateMathExpression(value);
  return Number.isFinite(evaluated) ? formatNumber(evaluated) : value;
}

function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcdBigInt(a: bigint, b: bigint): bigint {
  let x = a;
  let y = b;
  while (y !== 0n) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1n;
}

/**
 * Canonical decimal identity without converting through an IEEE-754 number.
 * Trailing zeros are folded into the base-10 scale, so equivalent exponent
 * spellings compare exactly even above Number.MAX_SAFE_INTEGER.
 */
function canonicalDecimal(value: string): string | null {
  const match = value.match(/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d+))?$/i);
  if (!match) return null;

  const exponent = Number(match[5] ?? "0");
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10_000) return null;

  const negative = match[1] === "-";
  const integer = match[2] ?? "0";
  const fraction = match[3] ?? match[4] ?? "";
  let digits = `${integer}${fraction}`.replace(/^0+/, "");
  let scale = fraction.length - exponent;
  if (!digits) return "0e0";

  while (digits.endsWith("0")) {
    digits = digits.slice(0, -1);
    scale -= 1;
  }

  return `${negative ? "-" : ""}${digits}e${-scale}`;
}

type MathToken =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" | "^" }
  | { type: "leftParen" }
  | { type: "rightParen" }
  | { type: "comma" }
  | { type: "end" };

const MATH_FUNCTIONS: Record<string, (value: number) => number> = {
  abs: Math.abs,
  acos: Math.acos,
  asin: Math.asin,
  atan: Math.atan,
  ceil: Math.ceil,
  cos: Math.cos,
  exp: Math.exp,
  floor: Math.floor,
  ln: Math.log,
  log: Math.log10,
  round: Math.round,
  sin: Math.sin,
  sqrt: Math.sqrt,
  tan: Math.tan,
};

const MATH_CONSTANTS: Record<string, number> = {
  e: Math.E,
  pi: Math.PI,
};

function evaluateMathExpression(rawExpression: string): number {
  const normalized = normalizeMathInputForEvaluation(rawExpression);

  if (!normalized || normalized.length > 200) {
    return Number.NaN;
  }

  try {
    const parser = new MathExpressionParser(
      insertImplicitMultiplication(tokenizeExpression(normalized)),
    );
    const value = parser.parse();
    return Number.isFinite(value) ? value : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

function tokenizeExpression(expression: string): MathToken[] {
  const tokens: MathToken[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const numberMatch = expression.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/);
    if (numberMatch) {
      tokens.push({ type: "number", value: Number(numberMatch[0]) });
      index += numberMatch[0].length;
      continue;
    }

    const identifierMatch = expression.slice(index).match(/^[a-z]+/);
    if (identifierMatch) {
      tokens.push({ type: "identifier", value: identifierMatch[0] });
      index += identifierMatch[0].length;
      continue;
    }

    if (char === "(") tokens.push({ type: "leftParen" });
    else if (char === ")") tokens.push({ type: "rightParen" });
    else if (char === ",") tokens.push({ type: "comma" });
    else if (char === "+" || char === "-" || char === "*" || char === "/" || char === "^") {
      tokens.push({ type: "operator", value: char });
    } else {
      throw new Error("Unsupported expression token.");
    }

    index += 1;
  }

  tokens.push({ type: "end" });
  return tokens;
}

function insertImplicitMultiplication(tokens: MathToken[]): MathToken[] {
  const result: MathToken[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index];
    const previous = result[result.length - 1];

    if (previous && shouldInsertMultiplication(previous, current)) {
      result.push({ type: "operator", value: "*" });
    }

    result.push(current);
  }

  return result;
}

function shouldInsertMultiplication(previous: MathToken, current: MathToken): boolean {
  const previousCanEndValue =
    previous.type === "number" ||
    previous.type === "rightParen" ||
    (previous.type === "identifier" && previous.value in MATH_CONSTANTS);
  const currentCanStartValue =
    current.type === "number" || current.type === "leftParen" || current.type === "identifier";

  if (!previousCanEndValue || !currentCanStartValue) {
    return false;
  }

  return true;
}

class MathExpressionParser {
  private index = 0;

  constructor(private readonly tokens: MathToken[]) {}

  parse(): number {
    const value = this.parseAdditive();
    if (this.peek().type !== "end") {
      throw new Error("Unexpected token after expression.");
    }
    return value;
  }

  private parseAdditive(): number {
    let value = this.parseMultiplicative();

    while (true) {
      const operator = this.peek();
      if (operator.type !== "operator" || (operator.value !== "+" && operator.value !== "-")) {
        break;
      }
      this.consume();
      const right = this.parseMultiplicative();
      value = operator.value === "+" ? value + right : value - right;
    }

    return value;
  }

  private parseMultiplicative(): number {
    let value = this.parsePower();

    while (true) {
      const operator = this.peek();
      if (operator.type !== "operator" || (operator.value !== "*" && operator.value !== "/")) {
        break;
      }
      this.consume();
      const right = this.parsePower();
      value = operator.value === "*" ? value * right : value / right;
    }

    return value;
  }

  private parsePower(): number {
    const base = this.parseUnary();
    const operator = this.peek();

    if (operator.type === "operator" && operator.value === "^") {
      this.consume();
      return base ** this.parsePower();
    }

    return base;
  }

  private parseUnary(): number {
    const operator = this.peek();

    if (operator.type === "operator" && operator.value === "+") {
      this.consume();
      return this.parseUnary();
    }

    if (operator.type === "operator" && operator.value === "-") {
      this.consume();
      return -this.parseUnary();
    }

    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.consume();

    if (token.type === "number") {
      return token.value;
    }

    if (token.type === "leftParen") {
      const value = this.parseAdditive();
      this.expect("rightParen");
      return value;
    }

    if (token.type === "identifier") {
      if (token.value in MATH_CONSTANTS) {
        return MATH_CONSTANTS[token.value];
      }

      const fn = MATH_FUNCTIONS[token.value];
      if (!fn) {
        throw new Error("Unknown function.");
      }

      this.expect("leftParen");
      const argument = this.parseAdditive();
      this.expect("rightParen");
      return fn(argument);
    }

    throw new Error("Unexpected expression token.");
  }

  private peek(): MathToken {
    return this.tokens[this.index] ?? { type: "end" };
  }

  private consume(): MathToken {
    const token = this.peek();
    this.index += 1;
    return token;
  }

  private expect(type: MathToken["type"]): void {
    if (this.peek().type !== type) {
      throw new Error(`Expected ${type}.`);
    }
    this.consume();
  }
}

function numbersMatch(left: number, right: number, tolerance: number): boolean {
  const absoluteDifference = Math.abs(left - right);
  if (absoluteDifference <= tolerance) {
    return true;
  }

  return absoluteDifference <= tolerance * Math.max(1, Math.abs(left), Math.abs(right));
}

function formatNumber(value: number): string {
  return Number.parseFloat(value.toPrecision(15)).toString();
}
