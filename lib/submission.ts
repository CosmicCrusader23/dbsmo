import { z } from "zod";

export const MAX_ANSWER_CHARS = 4_000;
export const MAX_ANSWERS_PER_SUBMISSION = 200;
export const MAX_SUBMISSION_BODY_BYTES = 1_000_000;
export const MAX_SUBMISSION_DURATION_SECONDS = 31 * 24 * 60 * 60;

const problemNumberSchema = z.string().regex(/^\d{1,6}$/);

export const problemSetSubmissionSchema = z
  .object({
    problemSetId: z.string().trim().min(1).max(128),
    answers: z.record(problemNumberSchema, z.string().max(MAX_ANSWER_CHARS)),
    durationSeconds: z.number().int().nonnegative().max(MAX_SUBMISSION_DURATION_SECONDS).optional(),
  })
  .superRefine(({ answers }, context) => {
    if (Object.keys(answers).length > MAX_ANSWERS_PER_SUBMISSION) {
      context.addIssue({
        code: "custom",
        path: ["answers"],
        message: `Submit at most ${MAX_ANSWERS_PER_SUBMISSION} answers at once.`,
      });
    }
  });
