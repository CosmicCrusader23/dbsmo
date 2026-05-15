import { AnswerType, ProblemSetStatus } from "@prisma/client";
import { z } from "zod";
import { normalizeTagList } from "../problem-tags";
import {
  isSupportedProblemContentFormat,
  normalizeProblemContentFormat,
} from "../problem-content-format";
import { nextProblemSetOrder } from "../problem-set-order";
import type { ImportIssue } from "./zip-dry-run";

const MAX_JSON_BYTES = 5 * 1024 * 1024;
const PROBLEM_SET_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const STATUS_MAP: Record<string, ProblemSetStatus> = {
  archived: "ARCHIVED",
  draft: "DRAFT",
  published: "PUBLISHED",
};

const ANSWER_TYPE_MAP: Record<string, AnswerType> = {
  decimal: "DECIMAL",
  exact: "EXACT",
  evaluated: "EXPRESSION",
  expression: "EXPRESSION",
  fraction: "FRACTION",
  integer: "INTEGER",
  multiple: "MULTIPLE",
  set: "SET",
};

const jsonProblemSchema = z.object({
  number: z.number().int().positive().optional(),
  statement: z.string().optional().default(""),
  statementFormat: z
    .string()
    .optional()
    .refine((value) => value === undefined || isSupportedProblemContentFormat(value), {
      message: "Invalid statementFormat. Use LATEX or HTML.",
    }),
  answerType: z.string().optional().default("EXACT"),
  answerKey: z.string().optional(),
  answer: z.string().optional(),
  acceptedAnswers: z.union([z.array(z.string()), z.string()]).optional(),
  caseSensitive: z.boolean().optional().default(false),
  topicTags: z.array(z.string()).optional().default([]),
  points: z.coerce.number().int().positive().optional().default(1),
  explanationNote: z.string().nullable().optional(),
  solution: z.string().nullable().optional(),
});

const jsonProblemSetSchema = z.object({
  slug: z.string().trim().min(1).regex(PROBLEM_SET_SLUG_PATTERN, {
    message: "Slug must use lowercase letters, numbers, and single hyphens.",
  }),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  statementFormat: z
    .string()
    .optional()
    .refine((value) => value === undefined || isSupportedProblemContentFormat(value), {
      message: "Invalid statementFormat. Use LATEX or HTML.",
    }),
  order: z.coerce.string().trim().optional().default(""),
  status: z.string().optional().default("DRAFT"),
  visibleFrom: z.string().datetime().nullable().optional(),
  visibleTo: z.string().datetime().nullable().optional(),
  topicTags: z.array(z.string()).optional().default([]),
  difficulty: z.coerce.number().int().min(1).max(10).optional().default(1),
  videoUrl: z.string().url().nullable().optional(),
  problems: z.array(jsonProblemSchema).min(1),
});

type ParsedProblemSetJson = z.infer<typeof jsonProblemSetSchema>;

export type JsonDryRunInput = {
  fileName: string;
  sizeBytes: number;
  text: string;
};

type JsonImportOptions = {
  replaceSetId?: string;
};

export type JsonDryRunResult = {
  ok: boolean;
  issues: ImportIssue[];
  preview: {
    slug: string;
    title: string;
    status: string;
    problemCount: number;
    totalPoints: number;
    difficulty: number;
    topicTags: string[];
    videoUrl: string | null;
    statementFormat: string;
    answerTypeCounts: Record<string, number>;
    solutionCount: number;
  } | null;
};

export type JsonImportResult = {
  ok: boolean;
  issues: ImportIssue[];
  created: {
    problemSetId: string;
    slug: string;
    title: string;
    status: string;
    problemCount: number;
    problemFileKey: string | null;
    solutionFileKey: string | null;
    videoUrl: string | null;
    warnings: string[];
  } | null;
};

export async function dryRunProblemSetJson(
  input: JsonDryRunInput,
  options: JsonImportOptions = {},
): Promise<JsonDryRunResult> {
  if (input.sizeBytes > MAX_JSON_BYTES) {
    return fail(`JSON exceeds the ${MAX_JSON_BYTES / 1024 / 1024} MB upload limit.`);
  }

  if (!input.fileName.toLowerCase().endsWith(".json")) {
    return fail("Uploaded file must be a .json file.");
  }

  const parsed = parseJson(input.text);
  if (!parsed.ok) {
    return { ok: false, issues: parsed.issues, preview: null };
  }

  const normalized = normalizeParsedJson(parsed.data);
  const issues = validateNormalizedJson(normalized);

  const { existingBySlug, replaceTarget } = await resolveImportTargets(
    normalized.slug,
    options.replaceSetId,
  );

  if (options.replaceSetId) {
    if (!replaceTarget) {
      issues.push({
        level: "error",
        message: "The target problem set for replacement no longer exists.",
      });
    }

    if (existingBySlug && existingBySlug.id !== options.replaceSetId) {
      issues.push({
        level: "error",
        message: `A different problem set already uses slug "${normalized.slug}".`,
      });
    }

    if (replaceTarget && replaceTarget.slug !== normalized.slug) {
      issues.push({
        level: "warning",
        message: `Replacing this set will change its slug from "${replaceTarget.slug}" to "${normalized.slug}".`,
      });
    }
  } else if (existingBySlug) {
    issues.push({
      level: "error",
      message: `A problem set with slug "${normalized.slug}" already exists. Delete or rename it first.`,
    });
  }

  const preview = buildPreview(normalized);

  return {
    ok: issues.every((issue) => issue.level !== "error"),
    issues,
    preview,
  };
}

export async function importProblemSetJson(
  input: JsonDryRunInput & { uploadedById: string },
  options: JsonImportOptions = {},
): Promise<JsonImportResult> {
  const dryRun = await dryRunProblemSetJson(input, options);
  if (!dryRun.ok || !dryRun.preview) {
    return { ok: false, issues: dryRun.issues, created: null };
  }

  const parsed = parseJson(input.text);
  if (!parsed.ok) {
    return { ok: false, issues: parsed.issues, created: null };
  }

  const data = normalizeParsedJson(parsed.data);
  const { prisma } = await import("../db");
  const warnings = dryRun.issues.filter((issue) => issue.level === "warning");

  const existingBySlug = await prisma.problemSet.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });

  if (options.replaceSetId) {
    const target = await prisma.problemSet.findUnique({
      where: { id: options.replaceSetId },
      select: { id: true, order: true },
    });

    if (!target) {
      return {
        ok: false,
        issues: [
          {
            level: "error",
            message: "The target problem set for replacement no longer exists.",
          },
        ],
        created: null,
      };
    }

    if (existingBySlug && existingBySlug.id !== target.id) {
      return {
        ok: false,
        issues: [
          {
            level: "error",
            message: `A different problem set already uses slug "${data.slug}".`,
          },
        ],
        created: null,
      };
    }

    const finalOrder = data.order || target.order;
    const problemSet = await prisma.$transaction(async (tx) => {
      await tx.problemSet.delete({
        where: { id: target.id },
      });

      return tx.problemSet.create({
        data: {
          id: target.id,
          slug: data.slug,
          title: data.title,
          description: data.description,
          order: finalOrder,
          status: data.status,
          visibleFrom: data.visibleFrom ? new Date(data.visibleFrom) : null,
          visibleTo: data.visibleTo ? new Date(data.visibleTo) : null,
          allowedGroups: [],
          topicTags: data.topicTags,
          difficulty: data.difficulty,
          videoUrl: data.videoUrl ?? null,
          createdById: input.uploadedById,
          problemFileId: null,
          solutionFileId: null,
          problems: {
            create: data.problems.map((problem) => ({
              number: problem.number,
              statement: problem.statement,
              contentFormat: problem.statementFormat,
              answerKey: problem.answerKey,
              answerType: problem.answerType,
              acceptedAnswers: problem.acceptedAnswers,
              caseSensitive: problem.caseSensitive,
              explanationNote: problem.solution ?? null,
              topicTags: problem.topicTags,
              points: problem.points,
            })),
          },
        },
      });
    });

    return {
      ok: true,
      issues: warnings,
      created: {
        problemSetId: problemSet.id,
        slug: problemSet.slug,
        title: problemSet.title,
        status: problemSet.status,
        problemCount: data.problems.length,
        problemFileKey: null,
        solutionFileKey: null,
        videoUrl: problemSet.videoUrl,
        warnings: warnings.map((issue) => issue.message),
      },
    };
  }

  if (existingBySlug) {
    return {
      ok: false,
      issues: [
        {
          level: "error",
          message: `A problem set with slug "${data.slug}" already exists. Delete or rename it first.`,
        },
      ],
      created: null,
    };
  }

  let finalOrder = data.order;
  if (!finalOrder) {
    const existingSets = await prisma.problemSet.findMany({
      select: { order: true },
    });
    finalOrder = nextProblemSetOrder(existingSets.map((set) => set.order));
  }

  const problemSet = await prisma.problemSet.create({
    data: {
      slug: data.slug,
      title: data.title,
      description: data.description,
      order: finalOrder,
      status: data.status,
      visibleFrom: data.visibleFrom ? new Date(data.visibleFrom) : null,
      visibleTo: data.visibleTo ? new Date(data.visibleTo) : null,
      allowedGroups: [],
      topicTags: data.topicTags,
      difficulty: data.difficulty,
      videoUrl: data.videoUrl ?? null,
      createdById: input.uploadedById,
      problems: {
        create: data.problems.map((problem) => ({
          number: problem.number,
          statement: problem.statement,
          contentFormat: problem.statementFormat,
          answerKey: problem.answerKey,
          answerType: problem.answerType,
          acceptedAnswers: problem.acceptedAnswers,
          caseSensitive: problem.caseSensitive,
          explanationNote: problem.solution ?? null,
          topicTags: problem.topicTags,
          points: problem.points,
        })),
      },
    },
  });

  return {
    ok: true,
    issues: warnings,
    created: {
      problemSetId: problemSet.id,
      slug: problemSet.slug,
      title: problemSet.title,
      status: problemSet.status,
      problemCount: data.problems.length,
      problemFileKey: null,
      solutionFileKey: null,
      videoUrl: problemSet.videoUrl,
      warnings: warnings.map((issue) => issue.message),
    },
  };
}

function parseJson(
  text: string,
): { ok: true; data: ParsedProblemSetJson } | { ok: false; issues: ImportIssue[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, issues: [{ level: "error", message: "JSON could not be parsed." }] };
  }

  const result = jsonProblemSetSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, issues: zodIssues("JSON", result.error) };
  }

  return { ok: true, data: result.data };
}

async function resolveImportTargets(slug: string, replaceSetId?: string) {
  if (!process.env.DATABASE_URL) {
    return { existingBySlug: null, replaceTarget: null };
  }

  const { prisma } = await import("../db");
  const [existingBySlug, replaceTarget] = await Promise.all([
    prisma.problemSet.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    }),
    replaceSetId
      ? prisma.problemSet.findUnique({
          where: { id: replaceSetId },
          select: { id: true, slug: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    existingBySlug,
    replaceTarget,
  };
}

function normalizeParsedJson(data: ParsedProblemSetJson) {
  const defaultStatementFormat = normalizeProblemContentFormat(data.statementFormat);

  return {
    ...data,
    slug: data.slug.trim(),
    title: data.title.trim(),
    description: data.description.trim(),
    statementFormat: defaultStatementFormat,
    status: normalizeStatus(data.status),
    topicTags: normalizeTagList(data.topicTags),
    videoUrl: data.videoUrl?.trim() || null,
    problems: data.problems.map((problem, index) => ({
      number: problem.number ?? index + 1,
      statement: problem.statement.trim(),
      statementFormat: normalizeProblemContentFormat(
        problem.statementFormat ?? data.statementFormat,
        defaultStatementFormat,
      ),
      answerKey: (problem.answerKey ?? problem.answer ?? "").trim(),
      answerType: normalizeAnswerType(problem.answerType),
      acceptedAnswers: normalizeAcceptedAnswers(problem.acceptedAnswers),
      caseSensitive: problem.caseSensitive,
      topicTags: normalizeTagList(problem.topicTags),
      points: problem.points,
      solution: (problem.solution ?? problem.explanationNote ?? null)?.trim() || null,
    })),
  };
}

function validateNormalizedJson(data: ReturnType<typeof normalizeParsedJson>): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const seenNumbers = new Set<number>();
  const duplicateNumbers = new Set<number>();

  if (!Object.values(ProblemSetStatus).includes(data.status)) {
    issues.push({ level: "error", message: `Invalid status: ${data.status}.` });
  }

  for (const problem of data.problems) {
    if (seenNumbers.has(problem.number)) {
      duplicateNumbers.add(problem.number);
    }
    seenNumbers.add(problem.number);

    if (!problem.answerKey) {
      issues.push({
        level: "error",
        message: `Problem ${problem.number} is missing answerKey.`,
      });
    }

    if (!Object.values(AnswerType).includes(problem.answerType)) {
      issues.push({
        level: "error",
        message: `Problem ${problem.number} has invalid answerType: ${problem.answerType}.`,
      });
    }
  }

  for (const duplicate of duplicateNumbers) {
    issues.push({ level: "error", message: `Duplicate problem number: ${duplicate}.` });
  }

  const sortedNumbers = [...seenNumbers].sort((a, b) => a - b);
  sortedNumbers.forEach((number, index) => {
    if (number !== index + 1) {
      issues.push({
        level: "warning",
        message: "Problem numbers are not sequential from 1. Import can continue.",
      });
    }
  });

  return issues;
}

function buildPreview(data: ReturnType<typeof normalizeParsedJson>): JsonDryRunResult["preview"] {
  return {
    slug: data.slug,
    title: data.title,
    status: data.status,
    problemCount: data.problems.length,
    totalPoints: data.problems.reduce((sum, problem) => sum + problem.points, 0),
    difficulty: data.difficulty,
    topicTags: data.topicTags,
    videoUrl: data.videoUrl,
    statementFormat: data.statementFormat,
    answerTypeCounts: data.problems.reduce<Record<string, number>>((counts, problem) => {
      counts[problem.answerType] = (counts[problem.answerType] ?? 0) + 1;
      return counts;
    }, {}),
    solutionCount: data.problems.filter((problem) => problem.solution).length,
  };
}

function normalizeStatus(value: string): ProblemSetStatus {
  return STATUS_MAP[value.trim().toLowerCase()] ?? (value.trim().toUpperCase() as ProblemSetStatus);
}

function normalizeAnswerType(value: string): AnswerType {
  return ANSWER_TYPE_MAP[value.trim().toLowerCase()] ?? (value.trim().toUpperCase() as AnswerType);
}

function normalizeAcceptedAnswers(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function fail(message: string): JsonDryRunResult {
  return { ok: false, issues: [{ level: "error", message }], preview: null };
}

function zodIssues(label: string, error: z.ZodError): ImportIssue[] {
  return error.issues.map((issue) => ({
    level: "error",
    message: `${label}: ${issue.path.join(".") || "value"} ${issue.message}`,
  }));
}
