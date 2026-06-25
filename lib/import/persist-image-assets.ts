import { createHash } from "node:crypto";
import { saveFile } from "../storage";
import { MIME_TO_EXTENSION, type DecodedAsset } from "./image-assets";

export async function persistProblemSetImageAssets(args: {
  problemSetId: string;
  slug: string;
  uploadedById: string;
  assets: DecodedAsset[];
}): Promise<void> {
  const { prisma } = await import("../db");

  for (const asset of args.assets) {
    const ext = MIME_TO_EXTENSION[asset.mimeType] ?? "bin";
    const checksum = createHash("sha256").update(asset.buffer).digest("hex");
    const storageKey = `imports/${args.slug}/images/${asset.key}-${checksum.slice(0, 12)}.${ext}`;

    await saveFile(storageKey, asset.buffer);

    await prisma.$transaction(async (tx) => {
      const file = await tx.importedFile.create({
        data: {
          storageKey,
          originalName: asset.originalName ?? `${asset.key}.${ext}`,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          checksum,
          uploadedById: args.uploadedById,
        },
      });

      await tx.problemSetAsset.upsert({
        where: {
          problemSetId_key: {
            problemSetId: args.problemSetId,
            key: asset.key,
          },
        },
        update: {
          fileId: file.id,
        },
        create: {
          problemSetId: args.problemSetId,
          key: asset.key,
          fileId: file.id,
        },
      });
    });
  }
}
