import { deleteFile } from "@/lib/storage";

export type ImportedFileCleanupResult = {
  deletedIds: string[];
  failedStorageKeys: string[];
};

/**
 * Delete file records only when no live model still references them, then remove
 * their backing objects. The relational delete is authoritative; object cleanup
 * remains best-effort because local/S3 deletion cannot join a database transaction.
 */
export async function cleanupUnreferencedImportedFiles(
  fileIds: Iterable<string | null | undefined>,
): Promise<ImportedFileCleanupResult> {
  const { prisma } = await import("@/lib/db");
  const deletedIds: string[] = [];
  const failedStorageKeys: string[] = [];

  for (const id of new Set(
    Array.from(fileIds).filter((value): value is string => Boolean(value)),
  )) {
    const file = await prisma.importedFile.findUnique({
      where: { id },
      select: { storageKey: true },
    });
    if (!file) continue;

    const deleted = await prisma.importedFile.deleteMany({
      where: {
        id,
        problemFileFor: { none: {} },
        solutionFileFor: { none: {} },
        assetFor: { none: {} },
        writeupImageFor: { none: {} },
      },
    });
    if (deleted.count === 0) continue;

    deletedIds.push(id);
    try {
      await deleteFile(file.storageKey);
    } catch (error) {
      failedStorageKeys.push(file.storageKey);
      console.error(`Failed to remove unreferenced stored file ${file.storageKey}:`, error);
    }
  }

  return { deletedIds, failedStorageKeys };
}
