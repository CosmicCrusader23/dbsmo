import { describe, expect, it } from "vitest";
import { gradeAnswer, normalizeAnswer } from "../lib/grading";

describe("normalizeAnswer", () => {
  it("normalizes integer answers", () => {
    expect(normalizeAnswer(" 042 ", "integer")).toBe("42");
  });

  it("normalizes equivalent fractions", () => {
    expect(normalizeAnswer(" 3/6 ", "fraction")).toBe("1/2");
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
});
