import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const root = resolve(process.env.LOCAL_STORAGE_ROOT ?? "./storage");

/**
 * Persist a file buffer to local disk under the given storage key.
 * Creates parent directories if they don't exist.
 */
export async function saveFile(key: string, buffer: Buffer): Promise<void> {
  const dest = resolve(root, key);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buffer);
}

/** Return the absolute filesystem path for a storage key. */
export function getFilePath(key: string): string {
  return join(root, key);
}

/** Remove a stored file. Silently succeeds if the file doesn't exist. */
export async function deleteFile(key: string): Promise<void> {
  await rm(resolve(root, key), { force: true });
}
