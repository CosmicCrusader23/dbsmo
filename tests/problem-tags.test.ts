import { describe, expect, it } from "vitest";
import { normalizeTagList } from "../lib/problem-tags";

describe("normalizeTagList", () => {
  it("canonicalizes aliases and duplicate casing", () => {
    expect(normalizeTagList(["algebra", "Algebra", "number_theory", "Number Theory"])).toEqual([
      "Algebra",
      "Number Theory",
    ]);
  });

  it("normalizes custom tags to display casing", () => {
    expect(normalizeTagList(["linear-equations", "linear equations"])).toEqual([
      "Linear Equations",
    ]);
  });

  it("canonicalizes the Tests problem-set category", () => {
    expect(normalizeTagList(["test", "Tests", "tests"])).toEqual(["Tests"]);
  });
});
