import { describe, expect, it } from "vitest";
import { gradeAnswer, normalizeAnswer } from "../lib/grading";
import { escapeCsvField } from "../lib/analytics";

describe("normalizeAnswer", () => {
  it("normalizes integer answers", () => {
    expect(normalizeAnswer(" 042 ", "integer")).toBe("42");
  });

  it("normalizes equivalent fractions", () => {
    expect(normalizeAnswer(" 3/6 ", "fraction")).toBe("1/2");
    expect(normalizeAnswer("\\frac{3}{6}", "fraction")).toBe("1/2");
  });

  it("rejects fractions with extra slash-separated values", () => {
    expect(normalizeAnswer("1/2/999", "fraction")).toBe("1/2/999");
    expect(
      gradeAnswer({
        answerType: "fraction",
        answerKey: "1/2",
        rawAnswer: "1/2/999",
      }).isCorrect,
    ).toBe(false);
  });

  it("does not round distinct large integer answers together", () => {
    expect(normalizeAnswer("9007199254740993", "integer")).toBe("9007199254740993");
    expect(
      gradeAnswer({
        answerType: "integer",
        answerKey: "9007199254740992",
        rawAnswer: "9007199254740993",
      }).isCorrect,
    ).toBe(false);
  });

  it("compares zero-tolerance decimals exactly above the safe integer range", () => {
    expect(
      gradeAnswer({
        answerType: "decimal",
        answerKey: "9007199254740992.0",
        rawAnswer: "9007199254740993",
      }).isCorrect,
    ).toBe(false);
    expect(
      gradeAnswer({
        answerType: "decimal",
        answerKey: "9007199254740993.0",
        rawAnswer: "9.007199254740993e15",
      }).isCorrect,
    ).toBe(true);
    expect(
      gradeAnswer({
        answerType: "decimal",
        answerKey: "0.10000000000000000001",
        rawAnswer: "0.10000000000000000002",
      }).isCorrect,
    ).toBe(false);
  });

  it("preserves equivalent leading-dot decimal spellings", () => {
    expect(
      gradeAnswer({
        answerType: "decimal",
        answerKey: "0.5",
        rawAnswer: ".5",
      }).isCorrect,
    ).toBe(true);
    expect(
      gradeAnswer({
        answerType: "decimal",
        answerKey: "-.5",
        rawAnswer: "-0.500",
      }).isCorrect,
    ).toBe(true);
  });

  it("reduces large fractions without losing integer precision", () => {
    expect(normalizeAnswer("18014398509481986/36028797018963972", "fraction")).toBe("1/2");
  });

  it("normalizes unordered sets", () => {
    expect(normalizeAnswer("{5, 1, 2}", "set")).toBe("1,2,5");
  });
});

describe("gradeAnswer", () => {
  it("accepts configured alternate answers", () => {
    const result = gradeAnswer({
      answerType: "multiple",
      answerKey: "triangle",
      acceptedAnswers: ["triangular"],
      rawAnswer: " Triangular ",
    });

    expect(result.isCorrect).toBe(true);
  });

  it("uses decimal tolerance", () => {
    const result = gradeAnswer({
      answerType: "decimal",
      answerKey: "0.333",
      rawAnswer: "0.334",
      decimalTolerance: 0.002,
    });

    expect(result.isCorrect).toBe(true);
  });

  it("evaluates equivalent numeric expressions", () => {
    const result = gradeAnswer({
      answerType: "expression",
      answerKey: "sqrt(2)",
      rawAnswer: "2^0.5",
    });

    expect(result.isCorrect).toBe(true);
    expect(result.normalizedAnswer).toBe("1.4142135623731");
  });

  it("accepts math-delimited integer answers", () => {
    const result = gradeAnswer({
      answerType: "integer",
      answerKey: "5",
      rawAnswer: "$5$",
    });

    expect(result.isCorrect).toBe(true);
    expect(result.normalizedAnswer).toBe("5");
  });

  it("evaluates LaTeX expression answer keys and student answers", () => {
    const result = gradeAnswer({
      answerType: "expression",
      answerKey: "\\sqrt{5}",
      rawAnswer: "sqrt(5)",
    });

    expect(result.isCorrect).toBe(true);
  });

  it("automatically evaluates LaTeX answer keys configured as exact", () => {
    expect(
      gradeAnswer({
        answerType: "exact",
        answerKey: "$\\frac{5}{4}$",
        rawAnswer: "5/4",
      }),
    ).toMatchObject({
      isCorrect: true,
      normalizedAnswer: "1.25",
    });

    expect(
      gradeAnswer({
        answerType: "exact",
        answerKey: "$\\frac{1}{6^{3/2}}$",
        rawAnswer: "1/(6*sqrt(6))",
      }).isCorrect,
    ).toBe(true);
  });

  it("preserves literal matching for non-mathematical exact answers", () => {
    expect(
      gradeAnswer({
        answerType: "exact",
        answerKey: "No",
        rawAnswer: " no ",
      }).isCorrect,
    ).toBe(true);

    expect(
      gradeAnswer({
        answerType: "exact",
        answerKey: "No",
        rawAnswer: "Yes",
      }).isCorrect,
    ).toBe(false);
  });

  it("does not collapse distinct unsafe integers during exact expression fallback", () => {
    expect(
      gradeAnswer({
        answerType: "exact",
        answerKey: "9007199254740992",
        rawAnswer: "9007199254740993",
      }).isCorrect,
    ).toBe(false);
  });

  it("evaluates coefficients before LaTeX functions", () => {
    const result = gradeAnswer({
      answerType: "expression",
      answerKey: "5\\sqrt{2}-7",
      rawAnswer: "5sqrt(2)-7",
    });

    expect(result.isCorrect).toBe(true);
  });

  it("evaluates LaTeX fractions and braced powers in expressions", () => {
    expect(
      gradeAnswer({
        answerType: "expression",
        answerKey: "\\frac{1}{2}",
        rawAnswer: "0.5",
      }).isCorrect,
    ).toBe(true);

    expect(
      gradeAnswer({
        answerType: "expression",
        answerKey: "2^{1/2}",
        rawAnswer: "\\sqrt{2}",
      }).isCorrect,
    ).toBe(true);
  });

  it("supports constants, fractions, and implicit multiplication in expressions", () => {
    const result = gradeAnswer({
      answerType: "expression",
      answerKey: "2pi",
      rawAnswer: "pi + pi",
    });

    expect(result.isCorrect).toBe(true);
  });

  it("rejects unsupported expression identifiers", () => {
    const result = gradeAnswer({
      answerType: "expression",
      answerKey: "x + 1",
      rawAnswer: "2",
    });

    expect(result.isCorrect).toBe(false);
  });
});

describe("escapeCsvField", () => {
  it("guards CSV formula values", () => {
    expect(escapeCsvField("=IMPORTXML(1)")).toBe("'=IMPORTXML(1)");
    expect(escapeCsvField("\t=HYPERLINK(1)")).toBe("'\t=HYPERLINK(1)");
    expect(escapeCsvField("line\rbreak")).toBe('"line\rbreak"');
  });
});
