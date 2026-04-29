import { z } from "zod";

export const manifestSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  description: z.string().default(""),
  order: z.number().int().positive(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  allowedGroups: z.array(z.string().min(1)).default(["MO"]),
  topicTags: z.array(z.string().min(1)).default([]),
  difficulty: z.number().int().min(1).max(5).default(1),
  problemFile: z.string().min(1),
  solutionFile: z.string().min(1).optional(),
  videoUrl: z.string().url().optional(),
  answersFile: z.string().min(1).default("answers.csv"),
});

export type ProblemSetManifest = z.infer<typeof manifestSchema>;
