import { createHash } from "node:crypto";
import { AnswerType, ProblemSetStatus } from "@prisma/client";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import type { ImportIssue } from "./zip-dry-run";
import { dryRunProblemSetZip, type ZipDryRunInput } from "./zip-dry-run";

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

  /* ── Extract ZIP ─────────────────────────────────────────────── */
  const zip = await JSZip.loadAsync(zipInput.buffer);

  /* ── Save files to local storage ─────────────────────────────── */
  async function extractAndSave(fileName: string): Promise<{
    storageKey: string;
    buffer: Buffer;
    checksum: string;
    sizeBytes: number;
  }> {
    const entry = zip.file(fileName) ?? zip.file(fileName.replace(/^\/+/, ""));
    if (!entry) {
      throw new Error(`File not found in ZIP: ${fileName}`);
    }

    const buf = Buffer.from(await entry.async("nodebuffer"));
    const storageKey = `imports/${preview.slug}/${fileName}`;
    const checksum = createHash("sha256").update(buf).digest("hex");

    await saveFile(storageKey, buf);

    return { storageKey, buffer: buf, checksum, sizeBytes: buf.byteLength };
  }

  const problemFileInfo = await extractAndSave(preview.problemFile);

  let solutionFileInfo: Awaited<ReturnType<typeof extractAndSave>> | null = null;
  if (preview.solutionFile) {
    solutionFileInfo = await extractAndSave(preview.solutionFile);
  }

  /* ── Parse answers from dry-run (re-read from ZIP) ───────────── */
  const { parse } = await import("csv-parse/sync");
  const { answerRowSchema } = await import("./answer-schema");
  const { manifestSchema } = await import("./manifest-schema");
  const yaml = await import("js-yaml");

  const manifestEntry = zip.file("manifest.yml") ?? zip.file("manifest.yaml");
  const manifest = manifestSchema.parse(yaml.load(await manifestEntry!.async("string")));

  const answersEntry = zip.file(manifest.answersFile);
  const records: Record<string, string>[] = parse(await answersEntry!.async("string"), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
  });

  const answers = records
    .map((r) => answerRowSchema.safeParse(r))
    .filter((r) => r.success)
    .map((r) => r.data!);

  /* ── Transaction: create all records ─────────────────────────── */
  const result = await prisma.$transaction(async (tx) => {
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
      solutionFile = await tx.importedFile.create({
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
        topicTags: preview.topicTags,
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
        topicTags: answer.topicTags,
        points: answer.points,
      })),
    });

    return problemSet;
  });

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
