import JSZip from "jszip";
import { isSafeZipPath, normalizeZipPath } from "./zip-path";
import {
  detectImageMime,
  imageKeyFromFileName,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_SET,
  validateDecodedImage,
  type DecodedAsset,
} from "./image-assets";
import type { ImportIssue } from "./zip-dry-run";
import {
  declaredZipEntrySize,
  readZipEntryBufferBounded,
  ZipExpandedSizeLimitError,
} from "./zip-entry";

export const MAX_IMAGE_ZIP_BYTES = 100 * 1024 * 1024;
export const MAX_IMAGE_ZIP_FILES = 500;

export type ImageZipInput = {
  fileName: string;
  sizeBytes: number;
  buffer: Buffer;
};

export type ImageZipResult = {
  ok: boolean;
  issues: ImportIssue[];
  assets: DecodedAsset[];
};

type ImageZipOptions = {
  maxAssets?: number;
};

type CandidateEntry = {
  entry: JSZip.JSZipObject;
  key: string;
};

function fail(message: string): ImageZipResult {
  return { ok: false, issues: [{ level: "error", message }], assets: [] };
}

function hasZipSignature(buffer: Buffer) {
  return buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2]);
}

function isIgnoredZipEntry(path: string) {
  const normalizedPath = normalizeZipPath(path);
  const fileName = normalizedPath.split("/").pop() ?? normalizedPath;
  return (
    normalizedPath.startsWith("__MACOSX/") || fileName === ".DS_Store" || fileName.startsWith("._")
  );
}

function originalZipEntryName(entry: JSZip.JSZipObject) {
  return (
    (entry as JSZip.JSZipObject & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name
  );
}

function displayZipEntryName(value: string) {
  const flattened = value.replace(/[\r\n]+/g, " ");
  return flattened.length > 200 ? `${flattened.slice(0, 197)}...` : flattened;
}

export async function parseImageZip(
  input: ImageZipInput,
  options: ImageZipOptions = {},
): Promise<ImageZipResult> {
  if (input.sizeBytes > MAX_IMAGE_ZIP_BYTES || input.buffer.byteLength > MAX_IMAGE_ZIP_BYTES) {
    return fail(`Image ZIP exceeds the ${MAX_IMAGE_ZIP_BYTES / 1024 / 1024} MB upload limit.`);
  }
  if (!input.fileName.toLowerCase().endsWith(".zip")) {
    return fail("Image upload must be a .zip file.");
  }
  if (!hasZipSignature(input.buffer)) {
    return fail("Image upload is not a ZIP archive.");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(input.buffer);
  } catch {
    return fail("Image ZIP could not be opened.");
  }

  const archiveEntries = Object.values(zip.files);
  if (archiveEntries.length > MAX_IMAGE_ZIP_FILES) {
    return fail(`Image ZIP has too many files. Maximum is ${MAX_IMAGE_ZIP_FILES}.`);
  }
  const entries = archiveEntries.filter((entry) => !entry.dir);

  const maximumAssets = Math.max(
    0,
    Math.min(MAX_IMAGES_PER_SET, options.maxAssets ?? MAX_IMAGES_PER_SET),
  );
  const issues: ImportIssue[] = [];
  const candidates: CandidateEntry[] = [];
  const seenKeys = new Set<string>();
  let declaredTotalBytes = 0;

  // Validate paths, names, counts, and central-directory sizes before inflating
  // even the first entry.
  for (const entry of entries) {
    const originalName = originalZipEntryName(entry);
    if (!isSafeZipPath(originalName)) {
      issues.push({
        level: "error",
        message: `Image ZIP contains an unsafe path: ${displayZipEntryName(originalName)}.`,
      });
      continue;
    }
    if (isIgnoredZipEntry(entry.name)) {
      continue;
    }

    const key = imageKeyFromFileName(entry.name);
    if (!key) {
      issues.push({
        level: "error",
        message: `Image file has an unsupported name: ${entry.name}.`,
      });
      continue;
    }
    if (seenKeys.has(key)) {
      issues.push({
        level: "error",
        message: `Image ZIP contains duplicate image key "${key}".`,
      });
      continue;
    }
    seenKeys.add(key);

    const declaredSize = declaredZipEntrySize(entry);
    if (declaredSize.kind === "invalid") {
      issues.push({
        level: "error",
        message: `Image ZIP contains invalid size metadata for ${entry.name}.`,
      });
      continue;
    }
    if (declaredSize.kind === "known") {
      if (declaredSize.bytes > MAX_IMAGE_BYTES) {
        issues.push({
          level: "error",
          message: `Image ${entry.name} expands beyond the ${MAX_IMAGE_BYTES / 1024 / 1024} MB per-image limit.`,
        });
        continue;
      }
      declaredTotalBytes += declaredSize.bytes;
      if (declaredTotalBytes > MAX_IMAGE_ZIP_BYTES) {
        issues.push({
          level: "error",
          message: `Image ZIP expands beyond ${MAX_IMAGE_ZIP_BYTES / 1024 / 1024} MB.`,
        });
        break;
      }
    }

    candidates.push({ entry, key });
  }

  if (candidates.length > maximumAssets) {
    issues.push({
      level: "error",
      message: `Too many images were supplied across JSON and ZIP. Maximum is ${MAX_IMAGES_PER_SET}.`,
    });
  }

  if (issues.some((issue) => issue.level === "error")) {
    return { ok: false, issues, assets: [] };
  }

  const assets: DecodedAsset[] = [];
  let totalBytes = 0;

  for (const { entry, key } of candidates) {
    const remainingTotalBytes = MAX_IMAGE_ZIP_BYTES - totalBytes;
    const perEntryLimit = Math.min(MAX_IMAGE_BYTES, remainingTotalBytes);
    const limitMessage =
      remainingTotalBytes < MAX_IMAGE_BYTES
        ? `Image ZIP expands beyond ${MAX_IMAGE_ZIP_BYTES / 1024 / 1024} MB.`
        : `Image ${entry.name} expands beyond the ${MAX_IMAGE_BYTES / 1024 / 1024} MB per-image limit.`;

    let buffer: Buffer;
    try {
      buffer = await readZipEntryBufferBounded(entry, perEntryLimit, limitMessage);
    } catch (error) {
      issues.push({
        level: "error",
        message:
          error instanceof ZipExpandedSizeLimitError
            ? error.message
            : `Image ZIP entry could not be read: ${entry.name}.`,
      });
      if (error instanceof ZipExpandedSizeLimitError) break;
      continue;
    }

    totalBytes += buffer.byteLength;
    const mimeType = detectImageMime(buffer);
    if (!mimeType) {
      issues.push({
        level: "error",
        message: `Image ZIP contains a non-image or unsupported image file: ${entry.name}.`,
      });
      continue;
    }

    const validated = validateDecodedImage({
      key,
      mimeType,
      buffer,
      originalName: entry.name.split("/").pop() ?? entry.name,
    });
    if (!validated.ok) {
      issues.push({ level: "error", message: validated.error });
      continue;
    }
    assets.push(validated.asset);
  }

  if (assets.length === 0 && issues.length === 0) {
    issues.push({ level: "error", message: "Image ZIP does not contain any images." });
  }

  return {
    ok: issues.every((issue) => issue.level !== "error"),
    issues,
    assets,
  };
}
