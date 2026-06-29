const EMPTY_NAME_VALUES = new Set(["null", "undefined", "none", "nil"]);

export function normalizeDisplayText(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (EMPTY_NAME_VALUES.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

export function displayNameFor(
  user: {
    displayName?: string | null;
    name?: string | null;
    email?: string | null;
  },
  fallback = "Anonymous",
) {
  return (
    normalizeDisplayText(user.displayName) ??
    normalizeDisplayText(user.name) ??
    normalizeDisplayText(user.email) ??
    fallback
  );
}
