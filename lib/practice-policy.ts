import { z } from "zod";
import { MAX_ANSWER_CHARS } from "@/lib/submission";

export const MAX_PRACTICE_SUBMISSION_BODY_BYTES = 16_384;

export const practiceSubmissionSchema = z.object({
  problemId: z.string().trim().min(1).max(128),
  answer: z.string().max(MAX_ANSWER_CHARS),
});
