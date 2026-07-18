export function normalizeZipPath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\\/g, "/");
}

export function isSafeZipPath(path: string): boolean {
  if (
    !path ||
    path.length > 512 ||
    path.includes("\0") ||
    /^[\\/]/.test(path) ||
    /^[a-zA-Z]:[\\/]/.test(path)
  ) {
    return false;
  }

  const normalized = normalizeZipPath(path);
  return normalized.split("/").every((part) => part && part !== "." && part !== "..");
}

export function safeZipPath(path: string): string {
  const normalized = normalizeZipPath(path);
  if (!isSafeZipPath(normalized)) {
    throw new Error(`Unsafe ZIP path: ${path}`);
  }
  return normalized;
}
