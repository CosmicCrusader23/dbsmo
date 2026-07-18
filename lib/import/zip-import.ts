import { createHash, randomUUID } from "node:crypto";
import { AnswerType, ProblemSetStatus } from "@prisma/client";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { normalizeTagList } from "@/lib/problem-tags";
import { saveFile, deleteFile } from "@/lib/storage";
import type { ImportIssue } from "./zip-dry-run";
import {
  dryRunProblemSetZip,
  MAX_LEGACY_ANSWERS_BYTES,
  MAX_LEGACY_REFERENCED_FILE_BYTES,
  MAX_LEGACY_REFERENCED_TOTAL_BYTES,
  MAX_LEGACY_MANIFEST_BYTES,
  type ZipDryRunInput,
} from "./zip-dry-run";
import { safeZipPath } from "./zip-path";
import {
  readZipEntryBufferBounded,
  readZipEntryTextBounded,
  ZipExpandedSizeLimitError,
} from "./zip-entry";

export type ImportResult = {
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

export type ZipImportInput = ZipDryRunInput & {
  uploadedById: string;
};

const STATUS_MAP: Record<string, ProblemSetStatus> = {
  draft: "DRAFT",
  published: "PUBLISHED",
  archived: "ARCHIVED",
};

const ANSWER_TYPE_MAP: Record<string, AnswerType> = {
  exact: "EXACT",
  evaluated: "EXPRESSION",
  expression: "EXPRESSION",
  integer: "INTEGER",
  decimal: "DECIMAL",
  fraction: "FRACTION",
  set: "SET",
  multiple: "MULTIPLE",
};

/**
 * Import a problem-set ZIP into the database.
 *
 * 1. Re-runs dry-run validation to ensure the ZIP is still valid.
 * 2. Checks for slug conflicts.
 * 3. Extracts files to local storage.
 * 4. Creates ImportedFile, ProblemSet, and Problem records in one transaction.
 */
export async function importProblemSetZip(input: ZipImportInput): Promise<ImportResult> {
  const { uploadedById, ...zipInput } = input;

  /* ── Re-validate ─────────────────────────────────────────────── */
  const dryRun = await dryRunProblemSetZip(zipInput);
  if (!dryRun.ok || !dryRun.preview) {
    return { ok: false, issues: dryRun.issues, created: null };
  }

  const preview = dryRun.preview;
  const warnings = dryRun.issues.filter((i) => i.level === "warning").map((i) => i.message);

  /* ── Check slug conflict ─────────────────────────────────────── */
  const existing = await prisma.problemSet.findUnique({
    where: { slug: preview.slug },
    select: { id: true },
  });

  if (existing) {
    return {
      ok: false,
      issues: [
        {
          level: "error",
          message: `A problem set with slug "${preview.slug}" already exists. Delete or rename it first.`,
        },
      ],
      created: null,
    };
  }

  const zip = await JSZip.loadAsync(zipInput.buffer);

  /* ── Parse bounded metadata from the already-validated archive ── */
  const { parse } = await import("csv-parse/sync");
  const { answerRowSchema } = await import("./answer-schema");
  const { manifestSchema } = await import("./manifest-schema");
  const yaml = await import("js-yaml");

  const manifestEntry = zip.file("manifest.yml") ?? zip.file("manifest.yaml");
  if (!manifestEntry) {
    return {
      ok: false,
      issues: [{ level: "error", message: "Missing manifest.yml." }],
      created: null,
    };
  }

  let manifest: ReturnType<typeof manifestSchema.parse>;
  let records: Record<string, string>[];
  try {
    const manifestText = await readZipEntryTextBounded(
      manifestEntry,
      MAX_LEGACY_MANIFEST_BYTES,
      "manifest.yml exceeds its expanded limit.",
    );
    manifest = manifestSchema.parse(yaml.load(manifestText, { maxAliases: 50 }));
    const answersEntry = zip.file(manifest.answersFile);
    if (!answersEntry) throw new Error("Missing answers file after validation.");
    const answersText = await readZipEntryTextBounded(
      answersEntry,
      MAX_LEGACY_ANSWERS_BYTES,
      "answers.csv exceeds its expanded limit.",
    );
    records = parse(answersText, {
      columns: true,
      bom: true,
      max_record_size: 20_000,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (error) {
    if (!(error instanceof ZipExpandedSizeLimitError)) {
      console.error("Failed to re-read validated legacy import metadata:", error);
    }
    return {
      ok: false,
      issues: [{ level: "error", message: "ZIP metadata could not be read safely." }],
      created: null,
    };
  }

  const answers: Array<ReturnType<typeof answerRowSchema.parse>> = [];
  const rowFailures: string[] = [];
  records.forEach((row, idx) => {
    const result = answerRowSchema.safeParse(row);
    if (result.success) {
      answers.push(result.data);
      return;
    }
    rowFailures.push(
      `row ${idx + 2}: ${result.error.issues.map((i) => `${i.path.join(".") || "row"} ${i.message}`).join("; ")}`,
    );
  });

  if (rowFailures.length > 0) {
    return {
      ok: false,
      issues: [
        {
          level: "error",
          message: `Refusing to import: answers.csv has ${rowFailures.length} invalid row(s). ${rowFailures.slice(0, 3).join(" | ")}${rowFailures.length > 3 ? " | …" : ""}`,
        },
      ],
      created: null,
    };
  }

  /* ── Stage referenced files under collision-resistant keys ───── */
  type ExtractedFileInfo = { storageKey: string; checksum: string; sizeBytes: number };
  const storagePrefix = `imports/${preview.slug}/${randomUUID()}`;
  const extractedByPath = new Map<string, ExtractedFileInfo>();
  const savedKeys = new Set<string>();
  let expandedTotalBytes = 0;

  async function extractAndSave(fileName: string): Promise<ExtractedFileInfo> {
    const normalizedFileName = safeZipPath(fileName);
    const cached = extractedByPath.get(normalizedFileName);
    if (cached) return cached;

    const entry = zip.file(normalizedFileName);
    if (!entry) throw new Error("Referenced ZIP entry disappeared.");
    const remainingBytes = MAX_LEGACY_REFERENCED_TOTAL_BYTES - expandedTotalBytes;
    const buffer = await readZipEntryBufferBounded(
      entry,
      Math.min(MAX_LEGACY_REFERENCED_FILE_BYTES, remainingBytes),
      `${normalizedFileName} exceeds the legacy import expanded-file limit.`,
    );
    expandedTotalBytes += buffer.byteLength;

    const storageKey = `${storagePrefix}/${normalizedFileName}`;
    const info = {
      storageKey,
      checksum: createHash("sha256").update(buffer).digest("hex"),
      sizeBytes: buffer.byteLength,
    };
    savedKeys.add(storageKey);
    await saveFile(storageKey, buffer);
    extractedByPath.set(normalizedFileName, info);
    return info;
  }

  let problemFileInfo: ExtractedFileInfo;
  let solutionFileInfo: ExtractedFileInfo | null = null;
  try {
    problemFileInfo = await extractAndSave(preview.problemFile);
    if (preview.solutionFile) solutionFileInfo = await extractAndSave(preview.solutionFile);
  } catch (error) {
    await Promise.all(Array.from(savedKeys, (key) => deleteFile(key).catch(() => undefined)));
    if (!(error instanceof ZipExpandedSizeLimitError)) {
      console.error("Failed to stage legacy ZIP files:", error);
    }
    return {
      ok: false,
      issues: [
        {
          level: "error",
          message:
            error instanceof ZipExpandedSizeLimitError
              ? error.message
              : "Referenced ZIP files could not be stored safely.",
        },
      ],
      created: null,
    };
  }

  /* ── Transaction: create all records ─────────────────────────── */
  let result: Awaited<ReturnType<typeof prisma.problemSet.create>>;
  try {
    result = await prisma.$transaction(async (tx) => {
      const problemFile = await tx.importedFile.create({
        data: {
          storageKey: problemFileInfo.storageKey,
          originalName: preview.problemFile,
          mimeType: guessMime(preview.problemFile),
          sizeBytes: problemFileInfo.sizeBytes,
          checksum: problemFileInfo.checksum,
          uploadedById,
        },
      });

      let solutionFile: { id: string } | null = null;
      if (solutionFileInfo && preview.solutionFile) {
        solutionFile =
          solutionFileInfo.storageKey === problemFileInfo.storageKey
            ? problemFile
            : await tx.importedFile.create({
                data: {
                  storageKey: solutionFileInfo.storageKey,
                  originalName: preview.solutionFile,
                  mimeType: guessMime(preview.solutionFile),
                  sizeBytes: solutionFileInfo.sizeBytes,
                  checksum: solutionFileInfo.checksum,
                  uploadedById,
                },
              });
      }

      const problemSet = await tx.problemSet.create({
        data: {
          slug: preview.slug,
          title: preview.title,
          description: manifest.description,
          order: manifest.order,
          status: STATUS_MAP[preview.status] ?? "DRAFT",
          allowedGroups: [],
          topicTags: normalizeTagList(preview.topicTags),
          difficulty: preview.difficulty,
          videoUrl: preview.videoUrl,
          problemFileId: problemFile.id,
          solutionFileId: solutionFile?.id ?? null,
          createdById: uploadedById,
        },
      });

      await tx.problem.createMany({
        data: answers.map((answer) => ({
          problemSetId: problemSet.id,
          number: answer.number,
          answerKey: answer.answer,
          answerType: ANSWER_TYPE_MAP[answer.answerType] ?? "EXACT",
          acceptedAnswers: answer.acceptedAnswers,
          topicTags: normalizeTagList(answer.topicTags),
          points: answer.points,
        })),
      });

      return problemSet;
    });
  } catch (err) {
    await Promise.all(Array.from(savedKeys, (key) => deleteFile(key).catch(() => undefined)));
    console.error("Legacy ZIP database import failed:", err);
    return {
      ok: false,
      issues: [
        {
          level: "error",
          message: "Database write failed and staged files were rolled back.",
        },
      ],
      created: null,
    };
  }

  return {
    ok: true,
    issues: warnings.map((w) => ({ level: "warning" as const, message: w })),
    created: {
      problemSetId: result.id,
      slug: result.slug,
      title: result.title,
      status: result.status,
      problemCount: answers.length,
      problemFileKey: problemFileInfo.storageKey,
      solutionFileKey: solutionFileInfo?.storageKey ?? null,
      videoUrl: preview.videoUrl,
      warnings,
    },
  };
}

function guessMime(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}
