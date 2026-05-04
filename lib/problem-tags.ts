export const STANDARD_PROBLEM_SET_TAGS = [
  "Series",
  "Trigonometry",
  "Geometry",
  "Cogeom",
  "Algebra",
  "Number Theory",
  "Combinatorics",
  "AIME",
  "AMC",
  "AJHSME",
] as const;

export const OTHER_PROBLEM_SET_TAG = "Others";

export type TagKind = "problem_set_category" | "practice_topic";

export type CanonicalTag = {
  slug: string;
  label: string;
  kind: TagKind;
  aliases: string[];
};

export const CANONICAL_TAGS: CanonicalTag[] = [
  { slug: "series", label: "Series", kind: "problem_set_category", aliases: ["sequence"] },
  {
    slug: "trigonometry",
    label: "Trigonometry",
    kind: "problem_set_category",
    aliases: ["trig"],
  },
  { slug: "geometry", label: "Geometry", kind: "problem_set_category", aliases: ["geo"] },
  {
    slug: "cogeom",
    label: "Cogeom",
    kind: "problem_set_category",
    aliases: ["coordinate geometry", "coord geom", "co-geo"],
  },
  { slug: "algebra", label: "Algebra", kind: "problem_set_category", aliases: ["alg"] },
  {
    slug: "number-theory",
    label: "Number Theory",
    kind: "problem_set_category",
    aliases: ["number_theory", "nt"],
  },
  {
    slug: "combinatorics",
    label: "Combinatorics",
    kind: "problem_set_category",
    aliases: ["combo", "combi"],
  },
  { slug: "aime", label: "AIME", kind: "problem_set_category", aliases: [] },
  { slug: "amc", label: "AMC", kind: "problem_set_category", aliases: [] },
  { slug: "ajhsme", label: "AJHSME", kind: "problem_set_category", aliases: [] },
];

const canonicalTagLookup = new Map<string, CanonicalTag>();
for (const tag of CANONICAL_TAGS) {
  canonicalTagLookup.set(normalizeProblemTag(tag.label), tag);
  canonicalTagLookup.set(normalizeProblemTag(tag.slug), tag);
  for (const alias of tag.aliases) {
    canonicalTagLookup.set(normalizeProblemTag(alias), tag);
  }
}

const standardTagLookup = new Map(
  CANONICAL_TAGS.filter((tag) => tag.kind === "problem_set_category").map((tag) => [
    normalizeProblemTag(tag.label),
    tag.label,
  ]),
);

export function normalizeProblemTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function titleCaseCustomTag(tag: string): string {
  return tag
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(" ");
}

export function canonicalizeProblemTag(tag: string): string {
  const normalized = normalizeProblemTag(tag);
  const canonical = canonicalTagLookup.get(normalized);
  return canonical?.label ?? titleCaseCustomTag(tag);
}

export function normalizeTagList(tags: string[]): string[] {
  const normalized = new Map<string, string>();

  for (const rawTag of tags) {
    const trimmed = rawTag.trim();
    if (!trimmed) continue;

    const value = canonicalizeProblemTag(trimmed);
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
