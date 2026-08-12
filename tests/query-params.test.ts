import { describe, expect, it } from "vitest";
import { firstQueryParam, normalizePageNumber, normalizeQueryText } from "../lib/query-params";

describe("query parameter normalization", () => {
  it("uses the first value when a query parameter is repeated", () => {
    expect(firstQueryParam(["first", "second"])).toBe("first");
    expect(normalizeQueryText(["  Edwin  ", "ignored"])).toBe("Edwin");
    expect(normalizePageNumber(["4", "9"])).toBe(4);
  });

  it("uses page one for missing and invalid values", () => {
    expect(normalizePageNumber(undefined)).toBe(1);
    expect(normalizePageNumber("not-a-number")).toBe(1);
    expect(normalizePageNumber("Infinity")).toBe(1);
  });

  it("clamps pages and bounds normalized search text", () => {
    expect(normalizePageNumber("-4")).toBe(1);
    expect(normalizePageNumber("2.9")).toBe(2);
    expect(normalizeQueryText("  abcdef  ", 4)).toBe("abcd");
    expect(normalizeQueryText("abc", -1)).toBe("abc");
  });
});
