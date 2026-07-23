import { describe, expect, it } from "vitest";
import { categorizeProblemSetTags, normalizeTagList } from "../lib/problem-tags";

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

  it("canonicalizes the HLE problem-set category", () => {
    expect(normalizeTagList(["hle", "Hle", "HLE", "Humanity's Last Exam"])).toEqual(["HLE"]);
  });
});

describe("categorizeProblemSetTags", () => {
  it("promotes custom set tags to filterable categories", () => {
    expect(categorizeProblemSetTags(["algebra", "olympiad shortlist"])).toEqual([
      "Algebra",
      "Olympiad Shortlist",
    ]);
  });

  it("uses Others only when a set has no tags", () => {
    expect(categorizeProblemSetTags([])).toEqual(["Others"]);
  });
});
