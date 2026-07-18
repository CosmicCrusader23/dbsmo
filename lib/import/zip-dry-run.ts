import { parse } from "csv-parse/sync";
import * as yaml from "js-yaml";
import JSZip from "jszip";
import { z } from "zod";
import { normalizeTagList } from "../problem-tags";
import { answerRowSchema, type AnswerRow } from "./answer-schema";
import { manifestSchema, type ProblemSetManifest } from "./manifest-schema";
import { isSafeZipPath, normalizeZipPath } from "./zip-path";
import {
  declaredZipEntrySize,
  readZipEntryTextBounded,
  ZipExpandedSizeLimitError,
} from "./zip-entry";

export const MAX_LEGACY_ZIP_BYTES = 50 * 1024 * 1024;
export const MAX_LEGACY_ZIP_ENTRIES = 1_000;
export const MAX_LEGACY_MANIFEST_BYTES = 256 * 1024;
export const MAX_LEGACY_ANSWERS_BYTES = 5 * 1024 * 1024;
export const MAX_LEGACY_ANSWER_ROWS = 1_000;
export const MAX_LEGACY_REFERENCED_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_LEGACY_REFERENCED_TOTAL_BYTES = 100 * 1024 * 1024;
const REQUIRED_COLUMNS = [
  "number",
  "answerType",
  "answer",
  "acceptedAnswers",
  "topicTags",
  "points",
];

export type ImportIssue = {
  level: "error" | "warning";
  message: string;
};

export type DryRunPreview = {
  slug: string;
  title: string;
  status: string;
  problemCount: number;
  totalPoints: number;
  difficulty: number;
  topicTags: string[];
  allowedGroups: string[];
  problemFile: string;
  solutionFile: string | null;
  answersFile: string;
  videoUrl: string | null;
  answerTypeCounts: Record<string, number>;
  files: Array<{
    name: string;
    sizeBytes: number | null;
  }>;
};

export type ZipDryRunResult = {
  ok: boolean;
  issues: ImportIssue[];
  preview: DryRunPreview | null;
};

export type ZipDryRunInput = {
  fileName: string;
  sizeBytes: number;
  buffer: Buffer;
};

export function configuredMaxLegacyZipBytes(value = process.env.MAX_ZIP_UPLOAD_MB): number {
  if (value === undefined || !/^\d+$/.test(value.trim())) return MAX_LEGACY_ZIP_BYTES;
  const megabytes = Number(value.trim());
  if (!Number.isSafeInteger(megabytes) || megabytes < 1) return MAX_LEGACY_ZIP_BYTES;
  return Math.min(MAX_LEGACY_ZIP_BYTES, megabytes * 1024 * 1024);
}

export async function dryRunProblemSetZip(input: ZipDryRunInput): Promise<ZipDryRunResult> {
  const issues: ImportIssue[] = [];
  const maxZipBytes = configuredMaxLegacyZipBytes();

  if (input.sizeBytes > maxZipBytes || input.buffer.byteLength > maxZipBytes) {
    return fail(`ZIP exceeds the ${maxZipBytes / 1024 / 1024} MB upload limit.`);
  }
  if (!input.fileName.toLowerCase().endsWith(".zip")) {
    return fail("Uploaded file must be a .zip archive.");
  }

  if (!hasZipSignature(input.buffer)) {
    return fail("Uploaded file is not a ZIP archive.");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(input.buffer);
  } catch {
    return fail("ZIP archive could not be opened.");
  }

  const archiveEntries = Object.values(zip.files);
  if (archiveEntries.length > MAX_LEGACY_ZIP_ENTRIES) {
    return fail(`ZIP has too many entries. Maximum is ${MAX_LEGACY_ZIP_ENTRIES}.`);
  }
  const files = archiveEntries.filter((entry) => !entry.dir);
  const unsafeFiles = files.filter((entry) => !isSafeZipPath(originalZipEntryName(entry)));
  for (const entry of unsafeFiles) {
    issues.push({
      level: "error",
      message: `ZIP contains an unsafe path: ${displayZipEntryName(originalZipEntryName(entry))}.`,
    });
  }

  const fileNames = new Set(files.map((entry) => normalizeZipPath(entry.name)));
  const manifestEntry = findEntry(zip, "manifest.yml") ?? findEntry(zip, "manifest.yaml");

  if (!manifestEntry) {
    return fail("Missing manifest.yml.");
  }

  const manifest = await readManifest(manifestEntry, issues);
  if (!manifest) {
    return { ok: false, issues, preview: null };
  }

  const answersEntry = findEntry(zip, manifest.answersFile);
  if (!answersEntry) {
    issues.push({ level: "error", message: `Missing answers file: ${manifest.answersFile}.` });
    return { ok: false, issues, preview: null };
  }

  const answers = await readAnswers(answersEntry, issues);
  const referencedEntries = [
    validateReferencedFile(zip, fileNames, manifest.problemFile, "Problem file", issues),
  ];
  if (manifest.solutionFile) {
    referencedEntries.push(
      validateReferencedFile(zip, fileNames, manifest.solutionFile, "Solution file", issues),
    );
  }
  validateReferencedFileSizes(referencedEntries, issues);
  validateProblemNumbers(answers, issues);

  const errorCount = issues.filter((issue) => issue.level === "error").length;
  const preview = buildPreview(manifest, answers, files);
  return { ok: errorCount === 0, issues, preview };
}

function fail(message: string): ZipDryRunResult {
  return { ok: false, issues: [{ level: "error", message }], preview: null };
}

function hasZipSignature(buffer: Buffer) {
  return buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2]);
}

async function readManifest(
  entry: JSZip.JSZipObject,
  issues: ImportIssue[],
): Promise<ProblemSetManifest | null> {
  let rawManifest: unknown;
  try {
    const text = await readZipEntryTextBounded(
      entry,
      MAX_LEGACY_MANIFEST_BYTES,
      `manifest.yml exceeds the ${MAX_LEGACY_MANIFEST_BYTES / 1024} KB expanded limit.`,
    );
    rawManifest = yaml.load(text, { maxAliases: 50 });
  } catch (error) {
    issues.push({
      level: "error",
      message:
        error instanceof ZipExpandedSizeLimitError
          ? error.message
          : "manifest.yml is not valid bounded UTF-8 YAML.",
    });
    return null;
  }

  const result = manifestSchema.safeParse(rawManifest);
  if (!result.success) {
    issues.push(...zodIssues("manifest.yml", result.error));
    return null;
  }

  return result.data;
}

async function readAnswers(entry: JSZip.JSZipObject, issues: ImportIssue[]): Promise<AnswerRow[]> {
  let records: Record<string, string>[];
  try {
    const text = await readZipEntryTextBounded(
      entry,
      MAX_LEGACY_ANSWERS_BYTES,
      `answers.csv exceeds the ${MAX_LEGACY_ANSWERS_BYTES / 1024 / 1024} MB expanded limit.`,
    );
    records = parse(text, {
      columns: true,
      bom: true,
      max_record_size: 20_000,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (error) {
    issues.push({
      level: "error",
      message:
        error instanceof ZipExpandedSizeLimitError
          ? error.message
          : "answers.csv could not be parsed as bounded UTF-8 CSV.",
    });
    return [];
  }

  if (records.length > MAX_LEGACY_ANSWER_ROWS) {
    issues.push({
      level: "error",
      message: `answers.csv has too many rows. Maximum is ${MAX_LEGACY_ANSWER_ROWS}.`,
    });
    return [];
  }

  const headers = Object.keys(records[0] ?? {});
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  for (const column of missingColumns) {
    issues.push({ level: "error", message: `answers.csv is missing column: ${column}.` });
  }

  const answers: AnswerRow[] = [];
  records.forEach((record, index) => {
    const result = answerRowSchema.safeParse(record);
    if (result.success) {
      answers.push(result.data);
      return;
    }

    issues.push(...zodIssues(`answers.csv row ${index + 2}`, result.error));
  });

  if (answers.length === 0) {
    issues.push({ level: "error", message: "answers.csv must contain at least one answer row." });
  }

  return answers;
}

function validateReferencedFile(
  zip: JSZip,
  fileNames: Set<string>,
  fileName: string,
  label: string,
  issues: ImportIssue[],
): JSZip.JSZipObject | null {
  if (!fileNames.has(normalizeZipPath(fileName))) {
    issues.push({ level: "error", message: `${label} does not exist in ZIP: ${fileName}.` });
    return null;
  }
  return findEntry(zip, fileName) ?? null;
}

function validateReferencedFileSizes(
  rawEntries: Array<JSZip.JSZipObject | null>,
  issues: ImportIssue[],
) {
  const entries = Array.from(
    new Map(
      rawEntries
        .filter((entry): entry is JSZip.JSZipObject => entry !== null)
        .map((entry) => [entry.name, entry]),
    ).values(),
  );
  let declaredTotal = 0;
  for (const entry of entries) {
    const declared = declaredZipEntrySize(entry);
    if (declared.kind === "invalid") {
      issues.push({
        level: "error",
        message: `ZIP contains invalid size metadata for ${displayZipEntryName(entry.name)}.`,
      });
      continue;
    }
    if (declared.kind === "unknown") continue;
    if (declared.bytes > MAX_LEGACY_REFERENCED_FILE_BYTES) {
      issues.push({
        level: "error",
        message: `${displayZipEntryName(entry.name)} expands beyond the ${MAX_LEGACY_REFERENCED_FILE_BYTES / 1024 / 1024} MB per-file limit.`,
      });
      continue;
    }
    declaredTotal += declared.bytes;
  }
  if (declaredTotal > MAX_LEGACY_REFERENCED_TOTAL_BYTES) {
    issues.push({
      level: "error",
      message: `Referenced files expand beyond ${MAX_LEGACY_REFERENCED_TOTAL_BYTES / 1024 / 1024} MB total.`,
    });
  }
}

function validateProblemNumbers(answers: AnswerRow[], issues: ImportIssue[]) {
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const answer of answers) {
    if (seen.has(answer.number)) {
      duplicates.add(answer.number);
    }
    seen.add(answer.number);
  }

  for (const duplicate of duplicates) {
    issues.push({
      level: "error",
      message: `Duplicate problem number in answers.csv: ${duplicate}.`,
    });
  }

  const sorted = [...seen].sort((a, b) => a - b);
  const expected = sorted.map((_, i) => i + 1);
  const missing = expected.filter((n) => !seen.has(n));
  if (missing.length > 0) {
    issues.push({
      level: "warning",
      message: `Problem numbers are not sequential from 1. Missing: ${missing.join(", ")}. Import can continue.`,
    });
  }
}

function buildPreview(
  manifest: ProblemSetManifest,
  answers: AnswerRow[],
  files: JSZip.JSZipObject[],
): DryRunPreview {
  const answerTypeCounts = answers.reduce<Record<string, number>>((counts, answer) => {
    counts[answer.answerType] = (counts[answer.answerType] ?? 0) + 1;
    return counts;
  }, {});

  return {
    slug: manifest.slug,
    title: manifest.title,
    status: manifest.status,
    problemCount: answers.length,
    totalPoints: answers.reduce((sum, answer) => sum + answer.points, 0),
    difficulty: manifest.difficulty,
    topicTags: normalizeTagList(manifest.topicTags),
    allowedGroups: manifest.allowedGroups,
    problemFile: manifest.problemFile,
    solutionFile: manifest.solutionFile ?? null,
    answersFile: manifest.answersFile,
    videoUrl: manifest.videoUrl ?? null,
    answerTypeCounts,
    files: files.map((entry) => ({
      name: displayZipEntryName(entry.name),
      sizeBytes: previewEntrySize(entry),
    })),
  };
}

function findEntry(zip: JSZip, path: string) {
  return zip.file(normalizeZipPath(path));
}

function originalZipEntryName(entry: JSZip.JSZipObject) {
  return (
    (entry as JSZip.JSZipObject & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name
  );
}

function displayZipEntryName(value: string): string {
  const flattened = value.replace(/\r/g, " ").replace(/\n/g, " ");
  return flattened.length > 200 ? `${flattened.slice(0, 197)}...` : flattened;
}

function previewEntrySize(entry: JSZip.JSZipObject): number | null {
  const declared = declaredZipEntrySize(entry);
  return declared.kind === "known" ? declared.bytes : null;
}

function zodIssues(label: string, error: z.ZodError): ImportIssue[] {
  return error.issues.map((issue) => ({
    level: "error",
    message: `${label}: ${issue.path.join(".") || "value"} ${issue.message}`,
  }));
}
