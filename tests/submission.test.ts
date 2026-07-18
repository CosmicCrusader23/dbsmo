import { describe, expect, it } from "vitest";
import {
  MAX_ANSWER_CHARS,
  MAX_ANSWERS_PER_SUBMISSION,
  MAX_SUBMISSION_DURATION_SECONDS,
  problemSetSubmissionSchema,
} from "../lib/submission";

describe("problemSetSubmissionSchema", () => {
  it("accepts the normal answer-grid payload", () => {
    expect(
      problemSetSubmissionSchema.safeParse({
        problemSetId: "set-1",
        answers: { "1": "42", "2": "1/2" },
        durationSeconds: 90,
      }).success,
    ).toBe(true);
  });

  it("rejects oversized answers and non-problem keys", () => {
    expect(
      problemSetSubmissionSchema.safeParse({
        problemSetId: "set-1",
        answers: { "1": "x".repeat(MAX_ANSWER_CHARS + 1) },
      }).success,
    ).toBe(false);
    expect(
      problemSetSubmissionSchema.safeParse({
        problemSetId: "set-1",
        answers: { constructor: "42" },
      }).success,
    ).toBe(false);
  });

  it("rejects excessive answer counts and durations", () => {
    const answers = Object.fromEntries(
      Array.from({ length: MAX_ANSWERS_PER_SUBMISSION + 1 }, (_, index) => [String(index + 1), ""]),
    );
    expect(problemSetSubmissionSchema.safeParse({ problemSetId: "set-1", answers }).success).toBe(
      false,
    );
    expect(
      problemSetSubmissionSchema.safeParse({
        problemSetId: "set-1",
        answers: {},
        durationSeconds: MAX_SUBMISSION_DURATION_SECONDS + 1,
      }).success,
    ).toBe(false);
  });
});
