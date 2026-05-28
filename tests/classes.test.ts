import { describe, expect, it } from "vitest";
import {
  buildCompletionMap,
  validateClassName,
  type AttemptForCompletion,
} from "../lib/classes";

describe("validateClassName", () => {
  it("accepts a normal name", () => {
    expect(validateClassName("Form 4 OI")).toEqual({ ok: true, value: "Form 4 OI" });
  });

  it("trims surrounding whitespace", () => {
    expect(validateClassName("  Form 4  ")).toEqual({ ok: true, value: "Form 4" });
  });

  it("rejects empty / whitespace-only", () => {
    expect(validateClassName("   ").ok).toBe(false);
  });

  it("rejects > 80 chars", () => {
    expect(validateClassName("x".repeat(81)).ok).toBe(false);
  });
});

describe("buildCompletionMap", () => {
  const assignmentCreatedAt = new Date("2026-01-01T00:00:00Z");
  const studentIds = ["s1", "s2", "s3"];
  const attempts: AttemptForCompletion[] = [
    // s1 completed AFTER assignment — counts
    { userId: "s1", submittedAt: new Date("2026-01-02T10:00:00Z") },
    // s1 also has a later one — earlier wins
    { userId: "s1", submittedAt: new Date("2026-01-05T10:00:00Z") },
    // s2 completed BEFORE assignment — does not count
    { userId: "s2", submittedAt: new Date("2025-12-30T10:00:00Z") },
    // s3 has no rows
  ];

  it("returns earliest qualifying submittedAt for each student", () => {
    const map = buildCompletionMap({ assignmentCreatedAt, studentIds, attempts });
    expect(map.get("s1")?.toISOString()).toBe("2026-01-02T10:00:00.000Z");
    expect(map.get("s2")).toBeNull();
    expect(map.get("s3")).toBeNull();
  });

  it("includes every studentId in the map", () => {
    const map = buildCompletionMap({ assignmentCreatedAt, studentIds, attempts });
    expect(map.size).toBe(3);
  });
});
