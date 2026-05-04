import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

type StorageDriver = "local";

const root = resolve(
  /*turbopackIgnore: true*/ process.cwd(),
  process.env.LOCAL_STORAGE_ROOT ?? "./storage",
);
const storageDriver = (process.env.STORAGE_DRIVER ?? "local") as StorageDriver;

function assertLocalStorageDriver() {
  if (storageDriver !== "local") {
    throw new Error(`Unsupported storage driver: ${storageDriver}`);
  }
}

function resolveStoragePath(key: string): string {
  if (!key || key.includes("\0")) {
    throw new Error("Invalid storage key.");
  }

  const dest = resolve(/*turbopackIgnore: true*/ root, key);
  const relativePath = relative(root, dest);

  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Storage key must stay inside the storage root.");
  }

  return dest;
}

/**
 * Persist a file buffer to local disk under the given storage key.
 * Creates parent directories if they don't exist.
 */
export async function saveFile(key: string, buffer: Buffer): Promise<void> {
  assertLocalStorageDriver();
  const dest = resolveStoragePath(key);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buffer);
}

/** Return the absolute filesystem path for a storage key. */
export function getFilePath(key: string): string {
  assertLocalStorageDriver();
  return resolveStoragePath(key);
}

/** Remove a stored file. Silently succeeds if the file doesn't exist. */
export async function deleteFile(key: string): Promise<void> {
  assertLocalStorageDriver();
  await rm(resolveStoragePath(key), { force: true });
}
