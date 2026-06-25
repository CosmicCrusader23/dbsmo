import JSZip from "jszip";
import { isSafeZipPath, normalizeZipPath } from "./zip-path";
import {
  detectImageMime,
  imageKeyFromFileName,
  validateDecodedImage,
  type DecodedAsset,
} from "./image-assets";
import type { ImportIssue } from "./zip-dry-run";

export const MAX_IMAGE_ZIP_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_ZIP_FILES = 500;

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
    normalizedPath.startsWith("__MACOSX/") ||
    fileName === ".DS_Store" ||
    fileName.startsWith("._")
  );
}

export async function parseImageZip(input: ImageZipInput): Promise<ImageZipResult> {
  if (input.sizeBytes > MAX_IMAGE_ZIP_BYTES) {
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

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const issues: ImportIssue[] = [];
  const assets: DecodedAsset[] = [];
  const seenKeys = new Set<string>();
  let totalBytes = 0;

  if (entries.length > MAX_IMAGE_ZIP_FILES) {
    issues.push({
      level: "error",
      message: `Image ZIP has too many files. Maximum is ${MAX_IMAGE_ZIP_FILES}.`,
    });
  }

  for (const entry of entries) {
    if (isIgnoredZipEntry(entry.name)) {
      continue;
    }

    const originalName =
      (entry as JSZip.JSZipObject & { unsafeOriginalName?: string }).unsafeOriginalName ??
      entry.name;
    if (!isSafeZipPath(originalName)) {
      issues.push({ level: "error", message: `Image ZIP contains an unsafe path: ${originalName}.` });
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

    const buffer = Buffer.from(await entry.async("nodebuffer"));
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_IMAGE_ZIP_BYTES) {
      issues.push({
        level: "error",
        message: `Image ZIP expands beyond ${MAX_IMAGE_ZIP_BYTES / 1024 / 1024} MB.`,
      });
      break;
    }

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
