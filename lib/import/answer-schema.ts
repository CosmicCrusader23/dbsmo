import { z } from "zod";

export const answerTypeSchema = z.enum([
  "exact",
  "integer",
  "decimal",
  "fraction",
  "set",
  "multiple",
]);

export const answerRowSchema = z.object({
  number: z.coerce.number().int().positive(),
  answerType: answerTypeSchema,
  answer: z.string().trim().min(1),
  acceptedAnswers: z
    .string()
    .optional()
    .default("")
    .transform((value) =>
      value
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  topicTags: z
    .string()
    .optional()
    .default("")
    .transform((value) =>
      value
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  points: z.coerce.number().int().positive().default(1),
});

export type AnswerRow = z.infer<typeof answerRowSchema>;
