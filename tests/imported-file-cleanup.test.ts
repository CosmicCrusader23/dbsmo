import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteFile: vi.fn(),
  importedFileDeleteMany: vi.fn(),
  importedFileFindUnique: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({ deleteFile: mocks.deleteFile }));
vi.mock("@/lib/db", () => ({
  prisma: {
    importedFile: {
      deleteMany: mocks.importedFileDeleteMany,
      findUnique: mocks.importedFileFindUnique,
    },
  },
}));

import { cleanupUnreferencedImportedFiles } from "@/lib/imported-file-cleanup";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteFile.mockResolvedValue(undefined);
  mocks.importedFileFindUnique.mockResolvedValue({ storageKey: "writeups/set/post/image.png" });
});

describe("imported file cleanup", () => {
  it("does not remove backing storage while a relation still protects the file", async () => {
    mocks.importedFileDeleteMany.mockResolvedValue({ count: 0 });

    const result = await cleanupUnreferencedImportedFiles(["file-1"]);

    expect(result).toEqual({ deletedIds: [], failedStorageKeys: [] });
    expect(mocks.importedFileDeleteMany).toHaveBeenCalledWith({
      where: {
        id: "file-1",
        problemFileFor: { none: {} },
        solutionFileFor: { none: {} },
        assetFor: { none: {} },
        writeupImageFor: { none: {} },
      },
    });
    expect(mocks.deleteFile).not.toHaveBeenCalled();
  });

  it("deletes an unreferenced record before removing its backing object", async () => {
    mocks.importedFileDeleteMany.mockResolvedValue({ count: 1 });

    const result = await cleanupUnreferencedImportedFiles(["file-1", "file-1"]);

    expect(result).toEqual({ deletedIds: ["file-1"], failedStorageKeys: [] });
    expect(mocks.importedFileFindUnique).toHaveBeenCalledOnce();
    expect(mocks.importedFileDeleteMany).toHaveBeenCalledOnce();
    expect(mocks.deleteFile).toHaveBeenCalledWith("writeups/set/post/image.png");
  });

  it("reports a storage orphan when backing-object deletion fails", async () => {
    mocks.importedFileDeleteMany.mockResolvedValue({ count: 1 });
    mocks.deleteFile.mockRejectedValue(new Error("storage unavailable"));

    const result = await cleanupUnreferencedImportedFiles(["file-1"]);

    expect(result).toEqual({
      deletedIds: ["file-1"],
      failedStorageKeys: ["writeups/set/post/image.png"],
    });
  });
});
