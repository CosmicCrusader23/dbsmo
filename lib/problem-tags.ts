export const STANDARD_PROBLEM_SET_TAGS = [
  "Series",
  "Trigonometry",
  "Geometry",
  "Cogeom",
  "Algebra",
  "Number Theory",
  "Combinatorics",
] as const;

export const OTHER_PROBLEM_SET_TAG = "Others";

const standardTagLookup = new Map(
  STANDARD_PROBLEM_SET_TAGS.map((tag) => [normalizeProblemTag(tag), tag]),
);

export function normalizeProblemTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

export function normalizeTagList(tags: string[]): string[] {
  const normalized = new Map<string, string>();

  for (const rawTag of tags) {
    const trimmed = rawTag.trim();
    if (!trimmed) continue;

    const standardTag = standardTagLookup.get(normalizeProblemTag(trimmed));
    const value = standardTag ?? trimmed;
    const key = normalizeProblemTag(value);
    if (!normalized.has(key)) {
      normalized.set(key, value);
    }
  }

  return Array.from(normalized.values());
}

export function categorizeProblemSetTags(tags: string[]): string[] {
  const normalizedTags = normalizeTagList(tags);
  const categories: string[] = [];
  let hasCustom = false;

  for (const tag of normalizedTags) {
    const standardTag = standardTagLookup.get(normalizeProblemTag(tag));
    if (standardTag) {
      if (!categories.includes(standardTag)) {
        categories.push(standardTag);
      }
    } else {
      hasCustom = true;
    }
  }

  if (categories.length === 0 || hasCustom) {
    categories.push(OTHER_PROBLEM_SET_TAG);
  }

  return categories;
}
