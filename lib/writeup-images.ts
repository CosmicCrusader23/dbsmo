import { createHash, randomUUID } from "node:crypto";
import { deleteFile, saveFile } from "@/lib/storage";
import { detectImageMime } from "@/lib/import/image-assets";

export const MAX_WRITEUP_IMAGES = 4;
export const MAX_WRITEUP_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_WRITEUP_IMAGE_TOTAL_BYTES = MAX_WRITEUP_IMAGES * MAX_WRITEUP_IMAGE_BYTES;

const WRITEUP_IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

type WriteupImageDeclaration = {
  name: string;
  size: number;
  type: string;
};

export type PreparedWriteupImage = {
  buffer: Buffer;
  checksum: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type StoredWriteupImage = {
  fileId: string;
  storageKey: string;
};

export class WriteupImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteupImageValidationError";
  }
}

function invalidWriteupImage(message: string): never {
  throw new WriteupImageValidationError(message);
}

function imageLabel(file: Pick<WriteupImageDeclaration, "name">) {
  return file.name || "Image";
}

function safeFileName(name: string, mimeType: string) {
  const ext = WRITEUP_IMAGE_MIME_TO_EXT[mimeType] ?? "bin";
  const leaf = name.replace(/\\/g, "/").split("/").pop() ?? "";
  const cleaned = leaf
    .replace(/\.[^.]+$/, "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${cleaned || "writeup-image"}.${ext}`;
}

/**
 * Check all metadata before reading any file bytes. This keeps a declared
 * oversize or unsupported batch from allocating one buffer per upload.
 */
export function validateWriteupImageDeclarations(
  files: readonly WriteupImageDeclaration[],
): string[] {
  const errors: string[] = [];

  if (files.length > MAX_WRITEUP_IMAGES) {
    errors.push(`Upload at most ${MAX_WRITEUP_IMAGES} images.`);
  }

  let totalBytes = 0;
  for (const file of files) {
    const label = imageLabel(file);
    if (!Number.isSafeInteger(file.size) || file.size <= 0) {
      errors.push(`${label} is empty or has an invalid size.`);
    } else {
      totalBytes += file.size;
      if (file.size > MAX_WRITEUP_IMAGE_BYTES) {
        errors.push(`${label} must be 5 MB or smaller.`);
      }
    }

    if (!Object.hasOwn(WRITEUP_IMAGE_MIME_TO_EXT, file.type)) {
      errors.push(`${label} must be PNG, JPEG, GIF, or WebP.`);
    }
  }

  if (totalBytes > MAX_WRITEUP_IMAGE_TOTAL_BYTES) {
    errors.push(
      `Writeup images must total ${MAX_WRITEUP_IMAGE_TOTAL_BYTES / 1024 / 1024} MB or less.`,
    );
  }

  return errors;
}

/** Read and content-check a batch only after every declaration passes. */
export async function prepareWriteupImages(
  files: readonly File[],
): Promise<PreparedWriteupImage[]> {
  const declarationErrors = validateWriteupImageDeclarations(files);
  if (declarationErrors.length > 0) {
    invalidWriteupImage(declarationErrors[0]);
  }

  const prepared: PreparedWriteupImage[] = [];
  let totalBytes = 0;

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const label = imageLabel(file);
    if (buffer.byteLength !== file.size) {
      invalidWriteupImage(`${label} changed size while it was being read.`);
    }
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_WRITEUP_IMAGE_BYTES) {
      invalidWriteupImage(`${label} must be a non-empty image no larger than 5 MB.`);
    }

    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_WRITEUP_IMAGE_TOTAL_BYTES) {
      invalidWriteupImage(
        `Writeup images must total ${MAX_WRITEUP_IMAGE_TOTAL_BYTES / 1024 / 1024} MB or less.`,
      );
    }

    const detectedMime = detectImageMime(buffer);
    if (detectedMime !== file.type) {
      invalidWriteupImage(`${label} bytes do not match the declared ${file.type} image type.`);
    }

    prepared.push({
      buffer,
      checksum: createHash("sha256").update(buffer).digest("hex"),
      fileName: safeFileName(file.name || "writeup-image", file.type),
      mimeType: file.type,
      sizeBytes: buffer.byteLength,
    });
  }

  return prepared;
}

/**
 * Store one already-validated image and create both metadata rows atomically.
 * If either database write fails, the staged storage object is removed.
 */
export async function storePreparedWriteupImage({
  image,
  problemSetId,
  writeupId,
  uploadedById,
  sortOrder,
}: {
  image: PreparedWriteupImage;
  problemSetId: string;
  writeupId: string;
  uploadedById: string;
  sortOrder: number;
}): Promise<StoredWriteupImage> {
  const storageKey = `writeups/${problemSetId}/${writeupId}/${image.checksum.slice(0, 16)}-${randomUUID().slice(0, 8)}-${image.fileName}`;

  try {
    await saveFile(storageKey, image.buffer);
    const { prisma } = await import("@/lib/db");
    const file = await prisma.$transaction(async (tx) => {
      const createdFile = await tx.importedFile.create({
        data: {
          storageKey,
          originalName: image.fileName,
          mimeType: image.mimeType,
          sizeBytes: image.sizeBytes,
          checksum: image.checksum,
          uploadedById,
        },
      });

      await tx.writeupImage.create({
        data: {
          writeupId,
          fileId: createdFile.id,
          sortOrder,
        },
      });

      return createdFile;
    });

    return { fileId: file.id, storageKey };
  } catch (error) {
    await deleteFile(storageKey).catch(() => {});
    throw error;
  }
}

/** Best-effort compensation for artifacts completed before a later failure. */
export async function cleanupStoredWriteupImages(
  images: readonly StoredWriteupImage[],
): Promise<void> {
  if (images.length === 0) return;

  const { prisma } = await import("@/lib/db");
  for (const image of [...images].reverse()) {
    await prisma.importedFile.delete({ where: { id: image.fileId } }).catch(() => {});
    await deleteFile(image.storageKey).catch(() => {});
  }
}
