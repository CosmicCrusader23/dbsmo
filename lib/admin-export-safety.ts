import { createHash } from "node:crypto";

const MEBIBYTE = 1024 * 1024;

function encodedLengthForBytes(byteLength: number): number {
  return Math.ceil(byteLength / 3) * 4;
}

export const ADMIN_EXPORT_LIMITS = {
  backupBodyBytes: 80 * MEBIBYTE,
  backupOutputBytes: 80 * MEBIBYTE,
  backupFileCount: 128,
  backupFileDecodedBytes: 25 * MEBIBYTE,
  backupFileEncodedBytes: encodedLengthForBytes(25 * MEBIBYTE),
  backupDecodedBytes: 48 * MEBIBYTE,
  backupEncodedBytes: encodedLengthForBytes(48 * MEBIBYTE),
  backupProblemSetCount: 500,
  backupProblemCount: 25_000,
  backupProblemSetBytes: 5 * MEBIBYTE,
  backupProblemSetsBytes: 16 * MEBIBYTE,
  csvStudentCount: 25_000,
  csvAttemptCount: 100_000,
  csvOutputBytes: 16 * MEBIBYTE,
  exportJobRequestBytes: 1024,
  exportJobPayloadBytes: 8 * MEBIBYTE,
  fileRelationTargets: 64,
} as const;

type BackupFileContentInput = {
  checksum: unknown;
  dataBase64: unknown;
  sizeBytes: unknown;
};

export type InspectedBackupFileContent = {
  checksum: string;
  dataBase64: string;
  decodedBytes: number;
  encodedBytes: number;
};

export type BackupFileContentResult =
  | { ok: true; content: InspectedBackupFileContent }
  | { ok: false; error: string };

export type DecodedBackupFileResult = { ok: true; buffer: Buffer } | { ok: false; error: string };

export type BackupFileRelations = {
  problemFileFor: string[];
  solutionFileFor: string[];
  unsupportedRelations: string[];
};

export type BackupFileRelationsResult =
  | { ok: true; relations: BackupFileRelations }
  | { ok: false; error: string };

const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodedBase64Length(value: string): number {
  if (!value) return 0;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

/**
 * Validate base64 metadata without allocating the decoded buffer. Callers can
 * use the returned byte counts to enforce an aggregate budget before decoding.
 */
export function inspectBackupFileContent(
  input: BackupFileContentInput,
  limits: { maxDecodedBytes: number; maxEncodedBytes: number },
): BackupFileContentResult {
  if (typeof input.dataBase64 !== "string") {
    return { ok: false, error: "File content is missing." };
  }

  const encodedBytes = Buffer.byteLength(input.dataBase64, "ascii");
  if (encodedBytes > ADMIN_EXPORT_LIMITS.backupFileEncodedBytes) {
    return { ok: false, error: "File content exceeds the per-file encoded limit." };
  }
  if (encodedBytes > limits.maxEncodedBytes) {
    return { ok: false, error: "File content exceeds the aggregate encoded limit." };
  }
  if (input.dataBase64.length % 4 !== 0 || !BASE64_PATTERN.test(input.dataBase64)) {
    return { ok: false, error: "File content is not valid canonical base64." };
  }

  const decodedBytes = decodedBase64Length(input.dataBase64);
  if (decodedBytes > ADMIN_EXPORT_LIMITS.backupFileDecodedBytes) {
    return { ok: false, error: "File content exceeds the per-file decoded limit." };
  }
  if (decodedBytes > limits.maxDecodedBytes) {
    return { ok: false, error: "File content exceeds the aggregate decoded limit." };
  }
  if (
    typeof input.sizeBytes !== "number" ||
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes < 0
  ) {
    return { ok: false, error: "File size metadata is invalid." };
  }
  if (input.sizeBytes !== decodedBytes) {
    return { ok: false, error: "File size does not match the decoded content." };
  }
  if (typeof input.checksum !== "string" || !SHA256_PATTERN.test(input.checksum.trim())) {
    return { ok: false, error: "File checksum metadata is invalid." };
  }

  return {
    ok: true,
    content: {
      checksum: input.checksum.trim().toLowerCase(),
      dataBase64: input.dataBase64,
      decodedBytes,
      encodedBytes,
    },
  };
}

/** Decode one already-inspected file and verify its actual SHA-256 checksum. */
export function decodeVerifiedBackupFile(
  content: InspectedBackupFileContent,
): DecodedBackupFileResult {
  const buffer = Buffer.from(content.dataBase64, "base64");
  if (buffer.byteLength !== content.decodedBytes) {
    return { ok: false, error: "Decoded file size changed during verification." };
  }

  const checksum = createHash("sha256").update(buffer).digest("hex");
  if (checksum !== content.checksum) {
    return { ok: false, error: "File checksum does not match the decoded content." };
  }

  return { ok: true, buffer };
}

function parseSlugArray(
  value: unknown,
  label: string,
): { ok: true; slugs: string[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: `${label} relation metadata is invalid.` };
  }

  const slugs: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") {
      return { ok: false, error: `${label} relation metadata is invalid.` };
    }
    const slug = item.trim();
    if (slug.length > 100 || !SLUG_PATTERN.test(slug)) {
      return { ok: false, error: `${label} relation metadata contains an invalid slug.` };
    }
    if (!seen.has(slug)) {
      seen.add(slug);
      slugs.push(slug);
    }
  }
  return { ok: true, slugs };
}

/** Parse the additive relation metadata emitted by current v1 backups. */
export function parseBackupFileRelations(value: unknown): BackupFileRelationsResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      error:
        "File relation metadata is missing; legacy unassociated files cannot be restored safely.",
    };
  }

  const problemFiles = parseSlugArray(value.problemFileFor, "Problem file");
  if (!problemFiles.ok) return problemFiles;
  const solutionFiles = parseSlugArray(value.solutionFileFor, "Solution file");
  if (!solutionFiles.ok) return solutionFiles;

  const targetCount = problemFiles.slugs.length + solutionFiles.slugs.length;
  if (targetCount > ADMIN_EXPORT_LIMITS.fileRelationTargets) {
    return { ok: false, error: "File has too many relation targets." };
  }

  const rawUnsupported = value.unsupportedRelations ?? [];
  if (!Array.isArray(rawUnsupported) || rawUnsupported.length > 8) {
    return { ok: false, error: "Unsupported file relation metadata is invalid." };
  }
  const unsupportedRelations: string[] = [];
  for (const item of rawUnsupported) {
    if (typeof item !== "string" || !item.trim() || item.length > 80) {
      return { ok: false, error: "Unsupported file relation metadata is invalid." };
    }
    if (!unsupportedRelations.includes(item.trim())) unsupportedRelations.push(item.trim());
  }

  return {
    ok: true,
    relations: {
      problemFileFor: problemFiles.slugs,
      solutionFileFor: solutionFiles.slugs,
      unsupportedRelations,
    },
  };
}

export function validateBackupStorageKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  if (!key || key.length > 512 || key.includes("\0") || key.startsWith("/")) return null;
  if (key.split("/").includes("..")) return null;
  return key;
}

export function safeAttachmentFileName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const safe = value
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 160);
  return safe || fallback;
}

export function extractStoredExportContent(
  payload: unknown,
  maxBytes: number,
): { ok: true; content: string } | { ok: false; reason: "invalid" | "too_large" } {
  if (!isRecord(payload) || typeof payload.content !== "string") {
    return { ok: false, reason: "invalid" };
  }
  if (Buffer.byteLength(payload.content, "utf8") > maxBytes) {
    return { ok: false, reason: "too_large" };
  }
  return { ok: true, content: payload.content };
}
