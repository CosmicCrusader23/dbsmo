import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { saveFile } from "@/lib/storage";

const MAX_WRITEUP_IMAGE_BYTES = 5 * 1024 * 1024;
const WRITEUP_IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

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

export async function storeWriteupImage({
  file,
  problemSetId,
  writeupId,
  uploadedById,
}: {
  file: File;
  problemSetId: string;
  writeupId: string;
  uploadedById: string;
}) {
  if (!Object.hasOwn(WRITEUP_IMAGE_MIME_TO_EXT, file.type)) {
    throw new Error(`${file.name || "Image"} must be PNG, JPEG, GIF, or WebP.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new Error(`${file.name || "Image"} is empty.`);
  }
  if (buffer.byteLength > MAX_WRITEUP_IMAGE_BYTES) {
    throw new Error(`${file.name || "Image"} must be 5 MB or smaller.`);
  }

  const checksum = createHash("sha256").update(buffer).digest("hex");
  const fileName = safeFileName(file.name || "writeup-image", file.type);
  const storageKey = `writeups/${problemSetId}/${writeupId}/${checksum.slice(0, 16)}-${fileName}`;

  await saveFile(storageKey, buffer);

  return prisma.importedFile.create({
    data: {
      storageKey,
      originalName: fileName,
      mimeType: file.type,
      sizeBytes: buffer.byteLength,
      checksum,
      uploadedById,
    },
  });
}
