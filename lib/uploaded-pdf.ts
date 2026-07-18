import { createHash, randomUUID } from "node:crypto";
import { deleteFile, saveFile } from "@/lib/storage";

export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_PDF_DATA_URL_CHARS = Math.ceil(MAX_PDF_BYTES / 3) * 4 + 64;

export type UploadedPdfPayload = {
  name: string;
  dataUrl: string;
};

export class UploadedPdfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadedPdfValidationError";
  }
}

function invalidPdf(message: string): never {
  throw new UploadedPdfValidationError(message);
}

function safeFileName(name: string) {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(0, 120);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "problems"}.pdf`;
}

export function decodeUploadedPdf(payload: UploadedPdfPayload): {
  buffer: Buffer;
  fileName: string;
} {
  const dataUrl = payload.dataUrl.trim();
  if (dataUrl.length > MAX_PDF_DATA_URL_CHARS) {
    invalidPdf("PDF upload must be 25 MB or smaller.");
  }

  const match = /^data:application\/pdf;base64,([a-z0-9+/]+={0,2})$/i.exec(dataUrl);
  if (!match) {
    invalidPdf("PDF upload must be a data URL with application/pdf content.");
  }

  const encoded = match[1];
  const buffer = Buffer.from(encoded, "base64");
  const canonicalInput = encoded.replace(/=+$/, "");
  const canonicalDecoded = buffer.toString("base64").replace(/=+$/, "");
  if (canonicalInput !== canonicalDecoded) {
    invalidPdf("PDF upload contains invalid base64 data.");
  }

  if (buffer.byteLength === 0) {
    invalidPdf("PDF upload is empty.");
  }
  if (buffer.byteLength > MAX_PDF_BYTES) {
    invalidPdf("PDF upload must be 25 MB or smaller.");
  }
  if (buffer.subarray(0, 1024).indexOf("%PDF-") === -1) {
    invalidPdf("Uploaded file is not a valid PDF.");
  }

  return { buffer, fileName: safeFileName(payload.name) };
}

export async function storeUploadedPdf({
  payload,
  prefix,
  uploadedById,
}: {
  payload: UploadedPdfPayload;
  prefix: string;
  uploadedById: string;
}) {
  const { buffer, fileName } = decodeUploadedPdf(payload);
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const storageKey = `${prefix}/${randomUUID()}-${fileName}`;

  await saveFile(storageKey, buffer);

  try {
    const { prisma } = await import("@/lib/db");
    return await prisma.importedFile.create({
      data: {
        storageKey,
        originalName: fileName,
        mimeType: "application/pdf",
        sizeBytes: buffer.byteLength,
        checksum,
        uploadedById,
      },
    });
  } catch (error) {
    await deleteFile(storageKey).catch((cleanupError) => {
      console.error(`Failed to clean up untracked PDF ${storageKey}:`, cleanupError);
    });
    throw error;
  }
}
