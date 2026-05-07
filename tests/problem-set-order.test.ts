import { describe, expect, it } from "vitest";
import {
  compareProblemSetOrder,
  compareProblemSetRecords,
  nextProblemSetOrder,
} from "../lib/problem-set-order";

describe("problem set ordering", () => {
  it("sorts numeric-looking IDs by numeric value while keeping text IDs valid", () => {
    const values = ["10", "2", "A10", "A2", "1", ""];

    expect(values.sort(compareProblemSetOrder)).toEqual(["1", "2", "10", "A2", "A10", ""]);
  });

  it("uses created date as a stable tiebreaker for equal order IDs", () => {
    const rows = [
      { order: "1", title: "B", createdAt: new Date("2026-01-02") },
      { order: "1", title: "A", createdAt: new Date("2026-01-01") },
    ];

    expect(rows.sort(compareProblemSetRecords).map((row) => row.title)).toEqual(["A", "B"]);
  });

  it("assigns the next available numeric order and ignores text IDs", () => {
    expect(nextProblemSetOrder(["A1", "2", "10", ""])).toBe("11");
  });
});
