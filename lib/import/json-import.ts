import { AnswerType, ProblemSetStatus } from "@prisma/client";
import { z } from "zod";
import { normalizeTagList } from "../problem-tags";
import type { ImportIssue } from "./zip-dry-run";

const MAX_JSON_BYTES = 5 * 1024 * 1024;

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
  number: z.coerce.number().int().positive().optional(),
  statement: z.string().optional().default(""),
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
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  order: z.coerce.number().int().optional().default(0),
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

export async function dryRunProblemSetJson(input: JsonDryRunInput): Promise<JsonDryRunResult> {
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

  const { prisma } = await import("../db");
  const existing = await prisma.problemSet.findUnique({
    where: { slug: normalized.slug },
    select: { id: true },
  });

  if (existing) {
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
): Promise<JsonImportResult> {
  const dryRun = await dryRunProblemSetJson(input);
  if (!dryRun.ok || !dryRun.preview) {
    return { ok: false, issues: dryRun.issues, created: null };
  }

  const parsed = parseJson(input.text);
  if (!parsed.ok) {
    return { ok: false, issues: parsed.issues, created: null };
  }

  const data = normalizeParsedJson(parsed.data);
  const { prisma } = await import("../db");
  const existing = await prisma.problemSet.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });

  if (existing) {
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

  const warnings = dryRun.issues.filter((issue) => issue.level === "warning");
  
  let finalOrder = data.order;
  if (typeof finalOrder !== "number" || finalOrder <= 0) {
    const maxOrderResult = await prisma.problemSet.aggregate({ _max: { order: true } });
    finalOrder = (maxOrderResult._max.order ?? 0) + 1;
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

function normalizeParsedJson(data: ParsedProblemSetJson) {
  return {
    ...data,
    slug: data.slug.trim(),
    title: data.title.trim(),
    description: data.description.trim(),
    status: normalizeStatus(data.status),
    topicTags: normalizeTagList(data.topicTags),
    videoUrl: data.videoUrl?.trim() || null,
    problems: data.problems.map((problem, index) => ({
      number: problem.number ?? index + 1,
      statement: problem.statement.trim(),
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
