export function normalizeZipPath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\\/g, "/");
}

export function isSafeZipPath(path: string): boolean {
  const normalized = normalizeZipPath(path);
  if (!normalized || normalized.includes("\0")) {
    return false;
  }

  return normalized.split("/").every((part) => part && part !== "." && part !== "..");
}

export function safeZipPath(path: string): string {
  const normalized = normalizeZipPath(path);
  if (!isSafeZipPath(normalized)) {
    throw new Error(`Unsafe ZIP path: ${path}`);
  }
  return normalized;
}
