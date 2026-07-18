import { z } from "zod";
import { isSafeZipPath, normalizeZipPath } from "./zip-path";

const zipPathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(isSafeZipPath, {
    message: "Path must be relative, bounded, and cannot contain . or .. segments.",
  })
  .transform(normalizeZipPath);

export const manifestSchema = z.object({
  slug: z
    .string()
    .max(100)
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20_000).default(""),
  order: z.coerce.string().trim().max(100),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  allowedGroups: z.array(z.string().trim().min(1).max(64)).max(100).default([]),
  topicTags: z.array(z.string().trim().min(1).max(64)).max(50).default([]),
  difficulty: z.number().int().min(1).max(10).default(1),
  problemFile: zipPathSchema,
  solutionFile: zipPathSchema.optional(),
  videoUrl: z.string().max(2_048).url().optional(),
  answersFile: zipPathSchema.default("answers.csv"),
});

export type ProblemSetManifest = z.infer<typeof manifestSchema>;
