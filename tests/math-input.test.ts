import { describe, expect, it } from "vitest";
import {
  mathInputToTex,
  normalizeMathInputForEvaluation,
  stripMathDelimiters,
} from "../lib/math-input";

describe("math input helpers", () => {
  it("strips common math delimiters", () => {
    expect(stripMathDelimiters("$5$")).toBe("5");
    expect(stripMathDelimiters("\\(x+1\\)")).toBe("x+1");
  });

  it("converts typed sqrt syntax for preview", () => {
    expect(mathInputToTex("sqrt(5)")).toBe("\\sqrt{5}");
  });

  it("normalizes LaTeX syntax for expression evaluation", () => {
    expect(normalizeMathInputForEvaluation("\\frac{1}{2}")).toBe("((1)/(2))");
    expect(normalizeMathInputForEvaluation("2^{1/2}")).toBe("2^(1/2)");
  });
});
