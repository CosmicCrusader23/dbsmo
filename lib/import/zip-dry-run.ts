import { parse } from "csv-parse/sync";
import yaml from "js-yaml";
import JSZip from "jszip";
import { z } from "zod";
import { normalizeTagList } from "../problem-tags";
import { answerRowSchema, type AnswerRow } from "./answer-schema";
import { manifestSchema, type ProblemSetManifest } from "./manifest-schema";
import { isSafeZipPath, normalizeZipPath } from "./zip-path";

const MAX_ZIP_BYTES = 50 * 1024 * 1024;
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

export async function dryRunProblemSetZip(input: ZipDryRunInput): Promise<ZipDryRunResult> {
  const issues: ImportIssue[] = [];

  if (input.sizeBytes > MAX_ZIP_BYTES) {
    return fail(`ZIP exceeds the ${MAX_ZIP_BYTES / 1024 / 1024} MB upload limit.`);
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

  const files = Object.values(zip.files).filter((entry) => !entry.dir);
  const unsafeFiles = files.filter((entry) => !isSafeZipPath(originalZipEntryName(entry)));
  for (const entry of unsafeFiles) {
    issues.push({
      level: "error",
      message: `ZIP contains an unsafe path: ${originalZipEntryName(entry)}.`,
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
  validateReferencedFile(fileNames, manifest.problemFile, "Problem file", issues);
  if (manifest.solutionFile) {
    validateReferencedFile(fileNames, manifest.solutionFile, "Solution file", issues);
  }
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
    rawManifest = yaml.load(await entry.async("string"));
  } catch {
    issues.push({ level: "error", message: "manifest.yml is not valid YAML." });
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
    records = parse(await entry.async("string"), {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
    issues.push({ level: "error", message: "answers.csv could not be parsed." });
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
  fileNames: Set<string>,
  fileName: string,
  label: string,
  issues: ImportIssue[],
) {
  if (!fileNames.has(normalizeZipPath(fileName))) {
    issues.push({ level: "error", message: `${label} does not exist in ZIP: ${fileName}.` });
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
  sorted.forEach((number, index) => {
    if (number !== index + 1) {
      issues.push({
        level: "warning",
        message:
          "Problem numbers are not sequential from 1. Import can continue, but check the set.",
      });
    }
  });
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
      name: entry.name,
      sizeBytes: null,
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

function zodIssues(label: string, error: z.ZodError): ImportIssue[] {
  return error.issues.map((issue) => ({
    level: "error",
    message: `${label}: ${issue.path.join(".") || "value"} ${issue.message}`,
  }));
}
