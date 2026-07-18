import { z } from "zod";

export const answerTypeSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(
    z.enum([
      "exact",
      "integer",
      "decimal",
      "fraction",
      "set",
      "multiple",
      "expression",
      "evaluated",
    ]),
  );

export const answerRowSchema = z.object({
  number: z.coerce.number().int().positive().max(1_000_000),
  answerType: answerTypeSchema,
  answer: z.string().trim().min(1).max(4_000),
  acceptedAnswers: z
    .string()
    .max(20_000)
    .optional()
    .default("")
    .transform((value) =>
      value
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(4_000)).max(200)),
  topicTags: z
    .string()
    .max(20_000)
    .optional()
    .default("")
    .transform((value) =>
      value
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(64)).max(50)),
  points: z.coerce.number().int().positive().max(1_000_000).default(1),
});

export type AnswerRow = z.infer<typeof answerRowSchema>;
