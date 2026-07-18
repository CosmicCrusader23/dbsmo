import { FeedbackType } from "@prisma/client";
import { z } from "zod";

export const MAX_FEEDBACK_BODY_BYTES = 16_000;
export const MAX_FEEDBACK_MESSAGE_CHARS = 2_000;

const optionalProblemNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  z.coerce.number().int().positive().max(1_000_000).nullable(),
);

export const feedbackSubmissionSchema = z.object({
  problemSetId: z.string().trim().min(1).max(128),
  problemNumber: optionalProblemNumber.optional().default(null),
  type: z.enum(FeedbackType),
  message: z.string().trim().min(1).max(MAX_FEEDBACK_MESSAGE_CHARS),
});
