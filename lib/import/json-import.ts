import { AnswerType, ProblemSetStatus } from "@prisma/client";
import { z } from "zod";
import { normalizeTagList } from "../problem-tags";
import {
  isSupportedProblemContentFormat,
  normalizeProblemContentFormat,
} from "../problem-content-format";
import { nextProblemSetOrderFromDatabase } from "../problem-set-order";
import type { JsonImportEditorDraft } from "./json-draft-storage";
import type { ImportIssue } from "./zip-dry-run";
import {
  decodeAssets,
  imageKeyFromFileName,
  imageAssetSchema,
  extractTokens,
  MAX_IMAGES_PER_SET,
  MAX_TOTAL_IMAGE_BYTES,
  MIME_TO_EXTENSION,
  type DecodedAsset,
} from "./image-assets";
import { parseImageZip, type ImageZipInput } from "./image-zip";
import {
  applyStagedProblemSetImageAssets,
  discardProblemSetImageStorageKeys,
  discardStagedProblemSetImageAssets,
  stageProblemSetImageAssets,
} from "./persist-image-assets";
import { cleanupUnreferencedImportedFiles } from "../imported-file-cleanup";
import { lockProblemSet } from "../problem-set-locks";

export const MAX_JSON_BYTES = 5 * 1024 * 1024;
const PROBLEM_SET_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class ReplacementTargetMissingError extends Error {}

export function configuredMaxJsonBytes(value = process.env.MAX_JSON_UPLOAD_MB): number {
  if (value === undefined || !/^\d+$/.test(value.trim())) return MAX_JSON_BYTES;
  const megabytes = Number(value.trim());
  if (!Number.isSafeInteger(megabytes) || megabytes <= 0) return MAX_JSON_BYTES;
  return Math.min(MAX_JSON_BYTES, megabytes * 1024 * 1024);
}

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

const boundedAnswerListSchema = z.array(z.string().max(4_000)).max(200);
const boundedImageRefListSchema = z.array(z.string().max(255)).max(MAX_IMAGES_PER_SET);

const jsonProblemSchema = z.object({
  number: z.number().int().positive().max(1_000_000).optional(),
  statement: z.string().max(200_000).optional().default(""),
  statementFormat: z
    .string()
    .max(20)
    .optional()
    .refine((value) => value === undefined || isSupportedProblemContentFormat(value), {
      message: "Invalid statementFormat. Use LATEX or HTML.",
    }),
  answerType: z.string().max(20).optional().default("EXACT"),
  answerKey: z.string().max(4_000).optional(),
  answer: z.string().max(4_000).optional(),
  acceptedAnswers: z.union([boundedAnswerListSchema, z.string().max(20_000)]).optional(),
  caseSensitive: z.boolean().optional().default(false),
  topicTags: z.array(z.string().max(64)).max(50).optional().default([]),
  points: z.coerce.number().int().positive().max(1_000_000).optional().default(1),
  explanationNote: z.string().max(200_000).nullable().optional(),
  solution: z.string().max(200_000).nullable().optional(),
  image: z.string().max(255).optional(),
  imageRef: z.string().max(255).optional(),
  imageRefs: z.union([boundedImageRefListSchema, z.string().max(255)]).optional(),
  imageFiles: z.union([boundedImageRefListSchema, z.string().max(255)]).optional(),
  images: z.union([boundedImageRefListSchema, z.string().max(255)]).optional(),
});

const jsonProblemSetSchema = z.object({
  slug: z.string().trim().min(1).max(100).regex(PROBLEM_SET_SLUG_PATTERN, {
    message: "Slug must use lowercase letters, numbers, and single hyphens.",
  }),
  title: z.string().min(1).max(200),
  description: z.string().max(20_000).optional().default(""),
  statementFormat: z
    .string()
    .max(20)
    .optional()
    .refine((value) => value === undefined || isSupportedProblemContentFormat(value), {
      message: "Invalid statementFormat. Use LATEX or HTML.",
    }),
  order: z.coerce.string().trim().max(100).optional().default(""),
  status: z.string().max(20).optional().default("DRAFT"),
  visibleFrom: z.string().datetime().nullable().optional(),
  visibleTo: z.string().datetime().nullable().optional(),
  topicTags: z.array(z.string().max(64)).max(50).optional().default([]),
  difficulty: z.coerce.number().int().min(1).max(10).optional().default(1),
  videoUrl: z.string().max(2_048).url().nullable().optional(),
  images: z.array(imageAssetSchema).max(MAX_IMAGES_PER_SET).optional().default([]),
  problems: z.array(jsonProblemSchema).min(1).max(1_000),
});

type ParsedProblemSetJson = z.infer<typeof jsonProblemSetSchema>;

type NormalizedImageRef = {
  source: string;
  key: string | null;
};

export type JsonDryRunInput = {
  fileName: string;
  sizeBytes: number;
  text: string;
  imageZip?: ImageZipInput;
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
    imageCount: number;
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

export type JsonImportDraftResult = {
  ok: boolean;
  issues: ImportIssue[];
  draft: JsonImportEditorDraft | null;
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
  const assetCollection = await collectImportAssets(normalized, input.imageZip);
  const issues = [
    ...assetCollection.issues,
    ...validateNormalizedJson(normalized, assetCollection.assets),
  ];

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

  const preview = buildPreview(normalized, assetCollection.assets);

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
  const assetCollection = await collectImportAssets(data, input.imageZip);
  const { prisma } = await import("../db");
  const warnings = dryRun.issues.filter((issue) => issue.level === "warning");

  const existingBySlug = await prisma.problemSet.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });

  if (options.replaceSetId) {
    const target = await prisma.problemSet.findUnique({
      where: { id: options.replaceSetId },
      select: { id: true },
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

    const stagedImages = await stageProblemSetImageAssets({
      slug: data.slug,
      assets: assetCollection.assets,
    });
    let replacement;
    try {
      replacement = await prisma.$transaction(async (tx) => {
        if (!(await lockProblemSet(tx, target.id))) {
          throw new ReplacementTargetMissingError();
        }
        const current = await tx.problemSet.findUniqueOrThrow({
          where: { id: target.id },
          select: {
            order: true,
            problemFileId: true,
            solutionFileId: true,
            assets: { select: { fileId: true } },
            writeups: { select: { images: { select: { fileId: true } } } },
          },
        });
        const replacedFileIds = [
          current.problemFileId,
          current.solutionFileId,
          ...current.assets.map((asset) => asset.fileId),
          ...current.writeups.flatMap((writeup) => writeup.images.map((image) => image.fileId)),
        ];

        await tx.problemSet.delete({ where: { id: target.id } });
        const problemSet = await tx.problemSet.create({
          data: {
            id: target.id,
            slug: data.slug,
            title: data.title,
            description: data.description,
            order: data.order || current.order,
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
                statement: statementWithImageRefs(problem.statement, problem.imageRefs),
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
        const appliedImages = await applyStagedProblemSetImageAssets({
          tx,
          problemSetId: problemSet.id,
          uploadedById: input.uploadedById,
          staged: stagedImages,
        });
        return { appliedImages, problemSet, replacedFileIds };
      });
    } catch (error) {
      await discardStagedProblemSetImageAssets(stagedImages);
      if (error instanceof ReplacementTargetMissingError) {
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
      throw error;
    }

    await discardProblemSetImageStorageKeys(replacement.appliedImages.unusedStorageKeys);
    await cleanupUnreferencedImportedFiles(replacement.replacedFileIds).catch((error) => {
      console.error(
        `Failed to clean up files replaced with problem set ${replacement.problemSet.id}:`,
        error,
      );
    });

    const { problemSet } = replacement;

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
    finalOrder = await nextProblemSetOrderFromDatabase();
  }

  const stagedImages = await stageProblemSetImageAssets({
    slug: data.slug,
    assets: assetCollection.assets,
  });
  let creation;
  try {
    creation = await prisma.$transaction(async (tx) => {
      const problemSet = await tx.problemSet.create({
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
              statement: statementWithImageRefs(problem.statement, problem.imageRefs),
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
      const appliedImages = await applyStagedProblemSetImageAssets({
        tx,
        problemSetId: problemSet.id,
        uploadedById: input.uploadedById,
        staged: stagedImages,
      });
      return { appliedImages, problemSet };
    });
  } catch (error) {
    await discardStagedProblemSetImageAssets(stagedImages);
    throw error;
  }

  await discardProblemSetImageStorageKeys(creation.appliedImages.unusedStorageKeys);
  const { problemSet } = creation;

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

export async function createProblemSetJsonDraft(
  input: JsonDryRunInput,
): Promise<JsonImportDraftResult> {
  if (input.sizeBytes > MAX_JSON_BYTES) {
    return {
      ok: false,
      issues: [
        {
          level: "error",
          message: `JSON exceeds the ${MAX_JSON_BYTES / 1024 / 1024} MB upload limit.`,
        },
      ],
      draft: null,
    };
  }

  if (!input.fileName.toLowerCase().endsWith(".json")) {
    return {
      ok: false,
      issues: [{ level: "error", message: "Uploaded file must be a .json file." }],
      draft: null,
    };
  }

  const parsed = parseJsonForDraft(input.text, input.fileName);
  if (!parsed.ok) {
    return { ok: false, issues: parsed.issues, draft: null };
  }

  const normalized = normalizeParsedJson(parsed.data);
  const assetCollection = await collectImportAssets(normalized, input.imageZip);
  const issues = [
    ...parsed.issues,
    ...assetCollection.issues,
    ...validateNormalizedJson(normalized, assetCollection.assets),
  ];
  const { existingBySlug } = await resolveImportTargets(normalized.slug);

  if (existingBySlug) {
    issues.push({
      level: "error",
      message: `A problem set with slug "${normalized.slug}" already exists. Change the slug before importing.`,
    });
  }

  return {
    ok: issues.every((issue) => issue.level !== "error"),
    issues,
    draft: {
      fileName: input.fileName,
      slug: normalized.slug,
      title: normalized.title,
      description: normalized.description,
      order: normalized.order,
      status: normalized.status,
      difficulty: normalized.difficulty,
      topicTags: normalized.topicTags,
      videoUrl: normalized.videoUrl,
      problems: normalized.problems.map((problem) => ({
        number: problem.number,
        statement: problem.statement,
        contentFormat: problem.statementFormat,
        answerKey: problem.answerKey,
        answerType: problem.answerType,
        topicTags: problem.topicTags,
        points: problem.points,
        explanationNote: problem.solution,
        imageRefs: problem.imageRefs.map((ref) => ref.source),
      })),
      imageAssets: assetCollection.assets.map((asset) => ({
        key: asset.key,
        name: asset.originalName ?? `${asset.key}.${MIME_TO_EXTENSION[asset.mimeType] ?? "bin"}`,
        mimeType: asset.mimeType,
        dataUrl: `data:${asset.mimeType};base64,${asset.buffer.toString("base64")}`,
      })),
      issues,
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

function parseJsonForDraft(
  text: string,
  fileName: string,
):
  | { ok: true; data: ParsedProblemSetJson; issues: ImportIssue[] }
  | { ok: false; issues: ImportIssue[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, issues: [{ level: "error", message: "JSON could not be parsed." }] };
  }

  const strict = jsonProblemSetSchema.safeParse(raw);
  if (strict.success) {
    return { ok: true, data: strict.data, issues: [] };
  }

  const loose = normalizeLooseJson(raw, fileName);
  if (!loose) {
    return { ok: false, issues: zodIssues("JSON", strict.error) };
  }

  const looseResult = jsonProblemSetSchema.safeParse(loose);
  if (!looseResult.success) {
    return { ok: false, issues: zodIssues("JSON", strict.error) };
  }

  return { ok: true, data: looseResult.data, issues: zodIssues("JSON", strict.error) };
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
    images: data.images ?? [],
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
      imageRefs: normalizeProblemImageRefs(problem),
    })),
  };
}

async function collectImportAssets(
  data: ReturnType<typeof normalizeParsedJson>,
  imageZip?: ImageZipInput,
): Promise<{ issues: ImportIssue[]; assets: DecodedAsset[] }> {
  const issues: ImportIssue[] = [];
  const assets: DecodedAsset[] = [];
  const seen = new Set<string>();

  const inline = decodeAssets(data.images);
  for (const error of inline.errors) {
    issues.push({ level: "error", message: error });
  }
  for (const asset of inline.decoded) {
    seen.add(asset.key);
    assets.push(asset);
  }

  if (imageZip) {
    const zip = await parseImageZip(imageZip, {
      maxAssets: Math.max(0, MAX_IMAGES_PER_SET - data.images.length),
    });
    issues.push(...zip.issues);
    for (const asset of zip.assets) {
      if (seen.has(asset.key)) {
        issues.push({
          level: "error",
          message: `Image key "${asset.key}" is supplied more than once.`,
        });
        continue;
      }
      seen.add(asset.key);
      assets.push(asset);
    }
  }

  const totalImageBytes = assets.reduce((sum, asset) => sum + asset.sizeBytes, 0);
  if (totalImageBytes > MAX_TOTAL_IMAGE_BYTES) {
    issues.push({
      level: "error",
      message: `Images exceed the ${MAX_TOTAL_IMAGE_BYTES / 1024 / 1024} MB total expanded limit.`,
    });
  }

  return { issues, assets };
}

function validateNormalizedJson(
  data: ReturnType<typeof normalizeParsedJson>,
  assets: DecodedAsset[],
): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const seenNumbers = new Set<number>();
  const duplicateNumbers = new Set<number>();
  const knownImageKeys = new Set(assets.map((asset) => asset.key));

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

    for (const ref of problem.imageRefs) {
      if (!ref.key) {
        issues.push({
          level: "error",
          message: `Problem ${problem.number} references an invalid image filename: ${ref.source}.`,
        });
      } else if (!knownImageKeys.has(ref.key)) {
        issues.push({
          level: "error",
          message: `Problem ${problem.number} references image "${ref.source}" but no matching image was supplied.`,
        });
      }
    }
  }

  for (const duplicate of duplicateNumbers) {
    issues.push({ level: "error", message: `Duplicate problem number: ${duplicate}.` });
  }

  const sortedNumbers = [...seenNumbers].sort((a, b) => a - b);
  const expected = sortedNumbers.map((_, i) => i + 1);
  const missing = expected.filter((n) => !seenNumbers.has(n));
  if (missing.length > 0) {
    issues.push({
      level: "warning",
      message: `Problem numbers are not sequential from 1. Missing: ${missing.join(", ")}.`,
    });
  }

  const statementsAndSolutions = data.problems.flatMap((p) => [p.statement, p.solution ?? ""]);
  const referenced = new Set<string>();
  for (const text of statementsAndSolutions) {
    for (const key of extractTokens(text)) {
      referenced.add(key);
    }
  }
  for (const key of referenced) {
    if (!knownImageKeys.has(key)) {
      issues.push({
        level: "error",
        message: `Statement references [[img:${key}]] but no image with that key was supplied.`,
      });
    }
  }

  return issues;
}

function buildPreview(
  data: ReturnType<typeof normalizeParsedJson>,
  assets: DecodedAsset[],
): JsonDryRunResult["preview"] {
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
    imageCount: assets.length,
  };
}

function normalizeProblemImageRefs(
  problem: ParsedProblemSetJson["problems"][number],
): NormalizedImageRef[] {
  const rawRefs = [
    ...normalizeStringOrStringArray(problem.image),
    ...normalizeStringOrStringArray(problem.imageRef),
    ...normalizeStringOrStringArray(problem.imageRefs),
    ...normalizeStringOrStringArray(problem.imageFiles),
    ...normalizeStringOrStringArray(problem.images),
  ];
  const seen = new Set<string>();
  const refs: NormalizedImageRef[] = [];
  for (const source of rawRefs) {
    const trimmed = source.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    refs.push({ source: trimmed, key: imageKeyFromFileName(trimmed) });
  }
  return refs;
}

function statementWithImageRefs(statement: string, refs: NormalizedImageRef[]) {
  const existing = new Set(extractTokens(statement));
  const tokens = refs
    .map((ref) => ref.key)
    .filter((key): key is string => Boolean(key))
    .filter((key) => !existing.has(key))
    .map((key) => `[[img:${key}]]`);

  if (tokens.length === 0) {
    return statement;
  }

  return [statement.trim(), ...tokens].filter(Boolean).join("\n\n");
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

function normalizeStringOrStringArray(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return typeof value === "string" ? [value] : [];
}

function normalizeLooseJson(raw: unknown, fileName: string): unknown | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const title = stringValue(record.title) || stringValue(record.name) || "Imported Problem Set";
  const slug =
    normalizeSlug(stringValue(record.slug)) ||
    normalizeSlug(fileName.replace(/\.json$/i, "")) ||
    "imported-problem-set";
  const problemsRaw = Array.isArray(record.problems) ? record.problems : [];
  if (problemsRaw.length === 0) {
    return null;
  }

  return {
    ...record,
    slug,
    title,
    description: stringValue(record.description),
    order: stringValue(record.order),
    status: stringValue(record.status) || "DRAFT",
    topicTags: Array.isArray(record.topicTags) ? record.topicTags : [],
    difficulty: integerValue(record.difficulty) ?? 1,
    videoUrl: typeof record.videoUrl === "string" ? record.videoUrl : null,
    images: Array.isArray(record.images) ? record.images : [],
    problems: problemsRaw
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
      .map((problem, index) => ({
        ...problem,
        number: integerValue(problem.number) ?? index + 1,
        statement: stringValue(problem.statement),
        answerType: stringValue(problem.answerType) || "EXACT",
        answerKey: stringValue(problem.answerKey) || stringValue(problem.answer),
        acceptedAnswers: Array.isArray(problem.acceptedAnswers)
          ? problem.acceptedAnswers
          : stringValue(problem.acceptedAnswers),
        caseSensitive: typeof problem.caseSensitive === "boolean" ? problem.caseSensitive : false,
        topicTags: Array.isArray(problem.topicTags) ? problem.topicTags : [],
        points: integerValue(problem.points) ?? 1,
        explanationNote:
          typeof problem.explanationNote === "string" ? problem.explanationNote : null,
        solution: typeof problem.solution === "string" ? problem.solution : null,
        image: typeof problem.image === "string" ? problem.image : undefined,
        imageRef: typeof problem.imageRef === "string" ? problem.imageRef : undefined,
        imageRefs: normalizeUnknownStringList(problem.imageRefs),
        imageFiles: normalizeUnknownStringList(problem.imageFiles),
        images: normalizeUnknownStringList(problem.images),
      })),
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function integerValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

function normalizeUnknownStringList(value: unknown): string[] | string | undefined {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return typeof value === "string" ? value : undefined;
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
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
