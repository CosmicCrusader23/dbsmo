import { AnswerType, ProblemSetStatus } from "@prisma/client";
import { z } from "zod";
import {
  normalizeProblemContentFormat,
  isSupportedProblemContentFormat,
} from "./problem-content-format";
import { normalizeTagList } from "./problem-tags";
import { MAX_TOTAL_IMAGE_BYTES, uploadedImageAssetSchema } from "./import/image-assets";
import { MAX_PDF_DATA_URL_CHARS } from "./uploaded-pdf";

export const PROBLEM_SET_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_AUTHORING_BODY_BYTES =
  MAX_PDF_DATA_URL_CHARS + Math.ceil(MAX_TOTAL_IMAGE_BYTES / 3) * 4 + 4 * 1024 * 1024;

export const uploadedPdfSchema = z
  .object({
    name: z.string().min(1).max(255),
    dataUrl: z.string().min(1).max(MAX_PDF_DATA_URL_CHARS),
  })
  .nullable()
  .optional();

export const authoringProblemSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  number: z.coerce.number().int().positive().max(1_000_000).optional(),
  statement: z.string().max(200_000).optional().default(""),
  contentFormat: z
    .string()
    .optional()
    .refine((value) => value === undefined || isSupportedProblemContentFormat(value), {
      message: "Invalid contentFormat. Use LATEX or HTML.",
    }),
  answerKey: z.string().trim().min(1).max(4_000),
  answerType: z.nativeEnum(AnswerType),
  topicTags: z.array(z.string().max(64)).max(50).optional().default([]),
  points: z.coerce.number().int().positive().max(1_000_000).optional().default(1),
  explanationNote: z.string().max(200_000).nullable().optional(),
});

export const createProblemSetAuthoringSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(100).regex(PROBLEM_SET_SLUG_PATTERN, {
    message: "Slug must use lowercase letters, numbers, and single hyphens.",
  }),
  description: z.string().max(20_000).optional().default(""),
  order: z.coerce.string().trim().max(100).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional().default(1),
  status: z.nativeEnum(ProblemSetStatus).optional().default("DRAFT"),
  topicTags: z.array(z.string().max(64)).max(50).optional().default([]),
  videoUrl: z.string().max(2_048).url().nullable().optional(),
  problemPdf: uploadedPdfSchema,
  imageAssets: z.array(uploadedImageAssetSchema).optional().default([]),
  problems: z.array(authoringProblemSchema).min(1).max(1_000),
});

export const patchProblemSetAuthoringSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(20_000).optional(),
  status: z.nativeEnum(ProblemSetStatus).optional(),
  order: z.coerce.string().trim().max(100).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  topicTags: z.array(z.string().min(1).max(64)).max(50).optional(),
  videoUrl: z.string().max(2_048).url().nullable().optional(),
  problemPdf: uploadedPdfSchema,
  imageAssets: z.array(uploadedImageAssetSchema).optional().default([]),
  problems: z.array(authoringProblemSchema).min(1).max(1_000).optional(),
});

export type AuthoringProblemInput = z.infer<typeof authoringProblemSchema>;
export type CreateProblemSetAuthoringInput = z.infer<typeof createProblemSetAuthoringSchema>;
export type PatchProblemSetAuthoringInput = z.infer<typeof patchProblemSetAuthoringSchema>;

export function splitAnswerKey(answerKey: string) {
  const parts = answerKey
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    answerKey: parts[0] || answerKey.trim(),
    acceptedAnswers: parts.slice(1),
  };
}

export function normalizeAuthoringProblem(problem: AuthoringProblemInput, index = 0) {
  const answer = splitAnswerKey(problem.answerKey);
  return {
    number: problem.number ?? index + 1,
    statement: problem.statement?.trim() ?? "",
    contentFormat: normalizeProblemContentFormat(problem.contentFormat),
    answerKey: answer.answerKey,
    acceptedAnswers: answer.acceptedAnswers,
    answerType: problem.answerType,
    topicTags: normalizeTagList(problem.topicTags ?? []),
    points: problem.points ?? 1,
    explanationNote: problem.explanationNote?.trim() || null,
  };
}

export function assertUniqueProblemNumbers(problems: Array<{ number?: number }>): string | null {
  const numbers = problems.map((problem, index) => problem.number ?? index + 1);
  const duplicate = numbers.find((number, index) => numbers.indexOf(number) !== index);
  return duplicate ? `Problem number ${duplicate} is duplicated.` : null;
}
