export type ImportIssue = {
  level: "error" | "warning";
  message: string;
};

export type JsonProblemDraft = {
  number: number;
  statement: string;
  contentFormat: "LATEX" | "HTML";
  answerKey: string;
  answerType: "EXACT" | "INTEGER" | "DECIMAL" | "FRACTION" | "SET" | "MULTIPLE" | "EXPRESSION";
  topicTags: string[];
  points: number;
  explanationNote: string | null;
  imageRefs: string[];
};

export type JsonDraftImageAsset = {
  key: string;
  name: string;
  mimeType: string;
  dataUrl: string;
};

export type JsonImportEditorDraft = {
  fileName: string;
  slug: string;
  title: string;
  description: string;
  order: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  difficulty: number;
  topicTags: string[];
  videoUrl: string | null;
  problems: JsonProblemDraft[];
  imageAssets: JsonDraftImageAsset[];
  issues: ImportIssue[];
};

const DRAFT_STORAGE_PREFIX = "json-import-draft:";

export function createJsonImportDraftKey() {
  return `${DRAFT_STORAGE_PREFIX}${crypto.randomUUID()}`;
}

export function saveJsonImportDraft(key: string, draft: JsonImportEditorDraft) {
  sessionStorage.setItem(key, JSON.stringify(draft));
}

export function loadJsonImportDraft(key: string): JsonImportEditorDraft | null {
  const raw = sessionStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as JsonImportEditorDraft;
  } catch {
    return null;
  }
}

export function clearJsonImportDraft(key: string) {
  sessionStorage.removeItem(key);
}
