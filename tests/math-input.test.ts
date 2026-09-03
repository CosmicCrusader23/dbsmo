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
    expect(mathInputToTex("5sqrt2-7")).toBe("5\\sqrt{2}-7");
    expect(mathInputToTex("sqrt(1+sqrt2)")).toBe("\\sqrt{1+\\sqrt{2}}");
    expect(mathInputToTex("sqrtpi")).toBe("\\sqrt{\\pi}");
    expect(mathInputToTex("2sqrt2pi")).toBe("2\\sqrt{2}\\pi");
    expect(mathInputToTex("\\pi")).toBe("\\pi");
  });

  it("converts Alcumus-style indexed roots for preview", () => {
    expect(mathInputToTex("cbrt(8)")).toBe("\\sqrt[3]{8}");
    expect(mathInputToTex("sqrt[4](16)")).toBe("\\sqrt[4]{16}");
  });

  it("normalizes LaTeX syntax for expression evaluation", () => {
    expect(normalizeMathInputForEvaluation("\\frac{1}{2}")).toBe("((1)/(2))");
    expect(normalizeMathInputForEvaluation("2^{1/2}")).toBe("2^(1/2)");
    expect(normalizeMathInputForEvaluation("5sqrt2-7")).toBe("5sqrt(2)-7");
    expect(normalizeMathInputForEvaluation("5\\sqrt2-7")).toBe("5sqrt(2)-7");
    expect(normalizeMathInputForEvaluation("\\sqrt[3]{8}")).toBe("root((8),(3))");
    expect(normalizeMathInputForEvaluation("sqrt[4](16)")).toBe("root((16),(4))");
    expect(normalizeMathInputForEvaluation("\\dfrac{1}{2}")).toBe("((1)/(2))");
  });

  it("does not repair malformed LaTeX into a different valid expression", () => {
    expect(normalizeMathInputForEvaluation("\\frac junk {1}{2}")).toContain("\\frac");
    expect(normalizeMathInputForEvaluation("\\frac{1} junk {2}")).toContain("\\frac");
    expect(normalizeMathInputForEvaluation("\\fraction{1}{2}")).toContain("\\fraction");
    expect(normalizeMathInputForEvaluation("2{3}")).toBe("2{3}");
  });
});
