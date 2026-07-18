import { describe, expect, it } from "vitest";
import {
  adminFeedbackUpdateSchema,
  buildFeedbackUpdateData,
  legacyAdminFeedbackUpdateSchema,
  MAX_ADMIN_NOTE_CHARS,
} from "@/lib/admin-feedback-policy";
import { practiceSubmissionSchema } from "@/lib/practice-policy";
import { MAX_ANSWER_CHARS } from "@/lib/submission";
import { normalizeWriteupVote, writeupVoteSchema } from "@/lib/writeup-vote-policy";

describe("admin feedback input policy", () => {
  it("clears resolvedAt when a report is reopened", () => {
    const parsed = adminFeedbackUpdateSchema.parse({ status: "OPEN" });
    expect(buildFeedbackUpdateData(parsed)).toMatchObject({
      status: "OPEN",
      resolvedAt: null,
    });
  });

  it("sets resolvedAt for terminal statuses", () => {
    const resolvedAt = new Date("2026-07-18T00:00:00.000Z");
    const parsed = adminFeedbackUpdateSchema.parse({ status: "RESOLVED" });
    expect(buildFeedbackUpdateData(parsed, resolvedAt)).toMatchObject({
      status: "RESOLVED",
      resolvedAt,
    });
  });

  it("rejects oversized notes and missing legacy report ids", () => {
    expect(
      adminFeedbackUpdateSchema.safeParse({
        status: "REVIEWING",
        adminNote: "x".repeat(MAX_ADMIN_NOTE_CHARS + 1),
      }).success,
    ).toBe(false);
    expect(legacyAdminFeedbackUpdateSchema.safeParse({ status: "OPEN" }).success).toBe(false);
  });
});

describe("practice submission input policy", () => {
  it("accepts ordinary answers and rejects oversized grading input", () => {
    expect(
      practiceSubmissionSchema.safeParse({ problemId: "problem-1", answer: "1/2" }).success,
    ).toBe(true);
    expect(
      practiceSubmissionSchema.safeParse({
        problemId: "problem-1",
        answer: "x".repeat(MAX_ANSWER_CHARS + 1),
      }).success,
    ).toBe(false);
  });
});

describe("writeup vote input policy", () => {
  it.each([
    [1, 1],
    ["1", 1],
    [-1, -1],
    ["-1", -1],
    [0, 0],
    ["0", 0],
    [null, 0],
  ])("normalizes %j to %i", (input, expected) => {
    expect(normalizeWriteupVote(input)).toBe(expected);
    expect(writeupVoteSchema.parse({ value: input })).toBe(expected);
  });

  it("rejects all other values", () => {
    expect(writeupVoteSchema.safeParse({ value: 2 }).success).toBe(false);
    expect(writeupVoteSchema.safeParse({ value: {} }).success).toBe(false);
    expect(writeupVoteSchema.safeParse({}).success).toBe(false);
  });
});
