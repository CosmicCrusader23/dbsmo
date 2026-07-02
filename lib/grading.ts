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

  if (input.answerType === "expression") {
    const tolerance = input.decimalTolerance ?? 1e-9;
    const answerNumber = evaluateMathExpression(input.rawAnswer);
    const evaluatedCandidates = [input.answerKey, ...(input.acceptedAnswers ?? [])]
      .filter(Boolean)
      .map((answer) => evaluateMathExpression(answer));
    const normalizedCandidates = evaluatedCandidates.map((candidate) =>
      Number.isFinite(candidate) ? formatNumber(candidate) : "",
    );
    const isCorrect =
      Number.isFinite(answerNumber) &&
      evaluatedCandidates.some(
        (candidate) =>
          Number.isFinite(candidate) && numbersMatch(answerNumber, candidate, tolerance),
      );

    return {
      isCorrect,
      normalizedAnswer: Number.isFinite(answerNumber)
        ? formatNumber(answerNumber)
        : normalizedAnswer,
      normalizedAcceptedAnswers: normalizedCandidates,
    };
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
  const stripped = stripMathDelimiters(value);
  const latexFractionMatch = stripped.match(/^\\frac\{(-?\d+)\}\{(-?\d+)\}$/);
  const fractionValue = latexFractionMatch
    ? `${latexFractionMatch[1]}/${latexFractionMatch[2]}`
    : value;
  const [numeratorRaw, denominatorRaw] = fractionValue.split("/");
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

function normalizeExpression(value: string): string {
  const evaluated = evaluateMathExpression(value);
  return Number.isFinite(evaluated) ? formatNumber(evaluated) : value;
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

function shouldInsertMultiplication(
  previous: MathToken,
  current: MathToken,
): boolean {
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
