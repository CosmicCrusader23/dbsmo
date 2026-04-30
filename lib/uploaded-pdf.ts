import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { saveFile } from "@/lib/storage";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

export type UploadedPdfPayload = {
  name: string;
  dataUrl: string;
};

function safeFileName(name: string) {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "problems"}.pdf`;
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
  const match = /^data:application\/pdf;base64,([a-z0-9+/=]+)$/i.exec(payload.dataUrl.trim());
  if (!match) {
    throw new Error("PDF upload must be a data URL with application/pdf content.");
  }

  const buffer = Buffer.from(match[1], "base64");
  if (buffer.byteLength === 0) {
    throw new Error("PDF upload is empty.");
  }
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF upload must be 25 MB or smaller.");
  }

  const fileName = safeFileName(payload.name);
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const storageKey = `${prefix}/${Date.now()}-${fileName}`;

  await saveFile(storageKey, buffer);

  return prisma.importedFile.create({
    data: {
      storageKey,
      originalName: fileName,
      mimeType: "application/pdf",
      sizeBytes: buffer.byteLength,
      checksum,
      uploadedById,
    },
  });
}
