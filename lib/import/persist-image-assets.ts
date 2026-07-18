import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { cleanupUnreferencedImportedFiles } from "../imported-file-cleanup";
import { lockProblemSet } from "../problem-set-locks";
import { deleteFile, saveFile } from "../storage";
import { MIME_TO_EXTENSION, type DecodedAsset } from "./image-assets";

export type StagedProblemSetImageAsset = {
  asset: DecodedAsset;
  checksum: string;
  ext: string;
  storageKey: string;
};

export type AppliedProblemSetImageAssets = {
  replacedFileIds: string[];
  unusedStorageKeys: string[];
};

/** Store bytes under unique keys without exposing them through database rows. */
export async function stageProblemSetImageAssets(args: {
  slug: string;
  assets: DecodedAsset[];
}): Promise<StagedProblemSetImageAsset[]> {
  const staged: StagedProblemSetImageAsset[] = [];

  try {
    for (const asset of args.assets) {
      const ext = MIME_TO_EXTENSION[asset.mimeType] ?? "bin";
      const checksum = createHash("sha256").update(asset.buffer).digest("hex");
      const storageKey = `imports/${args.slug}/images/${asset.key}-${checksum.slice(0, 12)}-${randomUUID().slice(0, 8)}.${ext}`;
      await saveFile(storageKey, asset.buffer);
      staged.push({ asset, checksum, ext, storageKey });
    }
    return staged;
  } catch (error) {
    await discardStagedProblemSetImageAssets(staged);
    throw error;
  }
}

export async function discardStagedProblemSetImageAssets(
  staged: readonly StagedProblemSetImageAsset[],
): Promise<void> {
  await Promise.all(staged.map(({ storageKey }) => deleteFile(storageKey).catch(() => undefined)));
}

export async function discardProblemSetImageStorageKeys(
  storageKeys: readonly string[],
): Promise<void> {
  await Promise.all(
    storageKeys.map((storageKey) =>
      deleteFile(storageKey).catch((error) => {
        console.error(`Failed to clean up redundant image upload ${storageKey}:`, error);
      }),
    ),
  );
}

/**
 * Attach staged bytes inside the caller's database transaction. The caller
 * must hold the parent ProblemSet row lock so competing replacements serialize.
 */
export async function applyStagedProblemSetImageAssets(args: {
  tx: Prisma.TransactionClient;
  problemSetId: string;
  uploadedById: string;
  staged: readonly StagedProblemSetImageAsset[];
}): Promise<AppliedProblemSetImageAssets> {
  const replacedFileIds: string[] = [];
  const unusedStorageKeys: string[] = [];

  for (const item of args.staged) {
    const previous = await args.tx.problemSetAsset.findUnique({
      where: {
        problemSetId_key: {
          problemSetId: args.problemSetId,
          key: item.asset.key,
        },
      },
      select: {
        fileId: true,
        file: { select: { checksum: true, mimeType: true, sizeBytes: true } },
      },
    });
    if (
      previous?.file.checksum === item.checksum &&
      previous.file.mimeType === item.asset.mimeType &&
      previous.file.sizeBytes === item.asset.sizeBytes
    ) {
      unusedStorageKeys.push(item.storageKey);
      continue;
    }

    const file = await args.tx.importedFile.create({
      data: {
        storageKey: item.storageKey,
        originalName: item.asset.originalName ?? `${item.asset.key}.${item.ext}`,
        mimeType: item.asset.mimeType,
        sizeBytes: item.asset.sizeBytes,
        checksum: item.checksum,
        uploadedById: args.uploadedById,
      },
    });

    await args.tx.problemSetAsset.upsert({
      where: {
        problemSetId_key: {
          problemSetId: args.problemSetId,
          key: item.asset.key,
        },
      },
      update: { fileId: file.id },
      create: {
        problemSetId: args.problemSetId,
        key: item.asset.key,
        fileId: file.id,
      },
    });
    if (previous && previous.fileId !== file.id) {
      replacedFileIds.push(previous.fileId);
    }
  }

  return { replacedFileIds, unusedStorageKeys };
}

/** Atomic convenience wrapper for callers that only replace image assets. */
export async function persistProblemSetImageAssets(args: {
  problemSetId: string;
  slug: string;
  uploadedById: string;
  assets: DecodedAsset[];
}): Promise<void> {
  if (args.assets.length === 0) return;
  const staged = await stageProblemSetImageAssets({ slug: args.slug, assets: args.assets });
  const { prisma } = await import("../db");

  let applied: AppliedProblemSetImageAssets;
  try {
    applied = await prisma.$transaction(async (tx) => {
      if (!(await lockProblemSet(tx, args.problemSetId))) {
        throw new Error("Problem set no longer exists.");
      }
      return applyStagedProblemSetImageAssets({
        tx,
        problemSetId: args.problemSetId,
        uploadedById: args.uploadedById,
        staged,
      });
    });
  } catch (error) {
    await discardStagedProblemSetImageAssets(staged);
    throw error;
  }

  await discardProblemSetImageStorageKeys(applied.unusedStorageKeys);
  if (applied.replacedFileIds.length > 0) {
    await cleanupUnreferencedImportedFiles(applied.replacedFileIds).catch((error) => {
      console.error(`Failed to clean up replaced image assets for ${args.problemSetId}:`, error);
    });
  }
}
