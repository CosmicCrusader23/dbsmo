import { z } from "zod";
import { isSafeZipPath, normalizeZipPath } from "./zip-path";

const zipPathSchema = z.string().min(1).transform(normalizeZipPath).refine(isSafeZipPath, {
  message: "Path must be relative and cannot contain . or .. segments.",
});

export const manifestSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  description: z.string().default(""),
  order: z.coerce.string().trim(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  allowedGroups: z.array(z.string().min(1)).default([]),
  topicTags: z.array(z.string().min(1)).default([]),
  difficulty: z.number().int().min(1).max(10).default(1),
  problemFile: zipPathSchema,
  solutionFile: zipPathSchema.optional(),
  videoUrl: z.string().url().optional(),
  answersFile: zipPathSchema.default("answers.csv"),
});

export type ProblemSetManifest = z.infer<typeof manifestSchema>;
