import { describe, expect, it } from "vitest";
import { feedbackSubmissionSchema, MAX_FEEDBACK_MESSAGE_CHARS } from "../lib/feedback";

describe("feedbackSubmissionSchema", () => {
  it("normalizes the optional problem number", () => {
    expect(
      feedbackSubmissionSchema.parse({
        problemSetId: "set-1",
        problemNumber: "12",
        type: "TYPO",
        message: "  Typo in the prompt.  ",
      }),
    ).toEqual({
      problemSetId: "set-1",
      problemNumber: 12,
      type: "TYPO",
      message: "Typo in the prompt.",
    });
  });

  it("rejects invalid types and oversized messages", () => {
    expect(
      feedbackSubmissionSchema.safeParse({
        problemSetId: "set-1",
        type: "NOT_A_TYPE",
        message: "Message",
      }).success,
    ).toBe(false);
    expect(
      feedbackSubmissionSchema.safeParse({
        problemSetId: "set-1",
        type: "TYPO",
        message: "x".repeat(MAX_FEEDBACK_MESSAGE_CHARS + 1),
      }).success,
    ).toBe(false);
  });
});
