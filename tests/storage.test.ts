import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  deleteFile,
  getFilePath,
  readFileBufferBounded,
  resolveStorageDriver,
  saveFile,
  StorageReadLimitError,
} from "../lib/storage";

describe("resolveStorageDriver", () => {
  it("defaults to local and accepts the supported drivers", () => {
    expect(resolveStorageDriver(undefined)).toBe("local");
    expect(resolveStorageDriver(" local ")).toBe("local");
    expect(resolveStorageDriver("S3")).toBe("s3");
  });

  it("fails closed on an unknown driver", () => {
    expect(() => resolveStorageDriver("filesystem")).toThrow("STORAGE_DRIVER");
  });
});

describe("getFilePath", () => {
  it("resolves normal storage keys", () => {
    expect(getFilePath("imports/set/problems.pdf")).toContain("storage/imports/set/problems.pdf");
  });

  it("rejects storage keys that escape the storage root", () => {
    expect(() => getFilePath("../outside.pdf")).toThrow("Storage key must stay inside");
  });
});

describe("readFileBufferBounded", () => {
  it("checks actual stored bytes instead of trusting metadata", async () => {
    const key = `tests/${randomUUID()}.bin`;
    await saveFile(key, Buffer.from("12345"));

    try {
      await expect(readFileBufferBounded(key, 4)).rejects.toBeInstanceOf(StorageReadLimitError);
      await expect(readFileBufferBounded(key, 5)).resolves.toEqual(Buffer.from("12345"));
    } finally {
      await deleteFile(key);
    }
  });
});
