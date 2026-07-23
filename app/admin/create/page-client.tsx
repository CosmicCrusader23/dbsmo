"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Eye,
  EyeOff,
  Video,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  FileText,
  ImageIcon,
  Upload,
} from "lucide-react";
import { CANONICAL_TAGS, normalizeProblemTag, normalizeTagList } from "@/lib/problem-tags";
import {
  clearJsonImportDraft,
  loadJsonImportDraft,
  type ImportIssue,
} from "@/lib/import/json-draft-storage";
import { LatexStatement } from "@/app/problem-sets/[slug]/latex-statement";
import { MathCurveLoader } from "@/app/math-curve-loader";

type AnswerType = "INTEGER" | "DECIMAL" | "FRACTION" | "EXACT" | "SET" | "MULTIPLE" | "EXPRESSION";

type ContentFormat = "LATEX" | "HTML";

interface ProblemEntry {
  id: string;
  number: number;
  statement: string;
  contentFormat: ContentFormat;
  answerType: AnswerType;
  answerKey: string;
  topicTags: string;
  points: number;
  explanationNote: string;
  imageAssets: UploadedImageAsset[];
}

type UploadedImageAsset = {
  key: string;
  name: string;
  mimeType: string;
  dataUrl: string;
};

type EditableProblemField = Exclude<keyof ProblemEntry, "id" | "imageAssets">;

const ANSWER_TYPE_OPTIONS: { value: AnswerType; label: string; hint: string }[] = [
  { value: "INTEGER", label: "Integer", hint: "e.g. 42" },
  { value: "DECIMAL", label: "Decimal", hint: "e.g. 3.14" },
  { value: "FRACTION", label: "Fraction", hint: "e.g. 3/7" },
  {
    value: "EXACT",
    label: "Exact match",
    hint: "Text, or equivalent numeric/LaTeX expressions",
  },
  { value: "SET", label: "Set", hint: "e.g. 1,2,5" },
  { value: "MULTIPLE", label: "Multiple accepted", hint: "Use semicolons (e.g. 3/7; 0.4286)" },
  { value: "EXPRESSION", label: "Expression", hint: "e.g. sqrt(2), 2^0.5, pi/3" },
];
const TAG_OPTIONS = CANONICAL_TAGS.filter((tag) => tag.kind === "problem_set_category");

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyProblem(n: number | string): ProblemEntry {
  return {
    id: uid(),
    number: typeof n === "number" ? n : Number(n) || 1,
    statement: "",
    contentFormat: "LATEX",
    answerType: "INTEGER",
    answerKey: "",
    topicTags: "",
    points: 1,
    explanationNote: "",
    imageAssets: [],
  };
}

function StatementPreview({
  statement,
  format,
  assets,
}: {
  statement: string;
  format: ContentFormat;
  assets?: Record<string, string>;
}) {
  if (!statement.trim()) {
    return (
      <div className="latex-preview">
        <span className="latex-placeholder">
          {format === "HTML" ? "HTML preview..." : "LaTeX preview..."}
        </span>
      </div>
    );
  }

  return (
    <div className="latex-preview">
      <LatexStatement statement={statement} format={format} assets={assets} />
    </div>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function tagsFromCsv(csv: string): string[] {
  return normalizeTagList(
    csv
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  );
}

function toggleTagInCsv(csv: string, tag: string): string {
  const normalizedTag = normalizeProblemTag(tag);
  const existing = tagsFromCsv(csv);
  const next = existing.some((item) => normalizeProblemTag(item) === normalizedTag)
    ? existing.filter((item) => normalizeProblemTag(item) !== normalizedTag)
    : [...existing, tag];
  return next.join(", ");
}

function hasTag(csv: string, tag: string): boolean {
  const normalizedTag = normalizeProblemTag(tag);
  return tagsFromCsv(csv).some((item) => normalizeProblemTag(item) === normalizedTag);
}

function imageKeyFromFileName(fileName: string): string {
  return (
    fileName
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) ?? ""
  );
}

function imageTokens(statement: string) {
  return new Set(
    Array.from(statement.matchAll(/\[\[img:([a-z0-9][a-z0-9_-]{0,63})\]\]/g), (m) => m[1]),
  );
}

function statementWithProblemImages(statement: string, assets: UploadedImageAsset[]) {
  const existing = imageTokens(statement);
  const tokens = assets
    .filter((asset) => !existing.has(asset.key))
    .map((asset) => `[[img:${asset.key}]]`);
  return tokens.length ? [statement.trim(), ...tokens].filter(Boolean).join("\n\n") : statement;
}

function imageAssetMap(assets: UploadedImageAsset[]) {
  return Object.fromEntries(assets.map((asset) => [asset.key, asset.dataUrl]));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unexpected file reader result."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

type CreateSetPageClientProps = {
  importDraftKey: string | null;
};

export function CreateSetPageClient({ importDraftKey }: CreateSetPageClientProps) {
  const router = useRouter();
  const draftLoaded = useRef(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState("1");
  const [difficulty, setDifficulty] = useState(1);
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">("DRAFT");
  const [topicTags, setTopicTags] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [problemPdf, setProblemPdf] = useState<{ name: string; dataUrl: string } | null>(null);

  const [problems, setProblems] = useState<ProblemEntry[]>([emptyProblem(1)]);
  const [showPreview, setShowPreview] = useState<Record<string, boolean>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftIssues, setDraftIssues] = useState<ImportIssue[]>([]);
  const [draftFileName, setDraftFileName] = useState<string | null>(null);
  const effectiveSlug = slugManual ? slug : slugify(title);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!importDraftKey || draftLoaded.current) {
      return;
    }

    const draft = loadJsonImportDraft(importDraftKey);
    draftLoaded.current = true;

    if (!draft) {
      queueMicrotask(() => {
        setError("That import draft is missing or expired. Run the dry run again and reopen it.");
      });
      return;
    }

    setTitle(draft.title);
    setSlug(draft.slug);
    setSlugManual(true);
    setDescription(draft.description);
    setOrder(draft.order);
    setDifficulty(draft.difficulty);
    setStatus(draft.status);
    setTopicTags(draft.topicTags.join(", "));
    setVideoUrl(draft.videoUrl ?? "");
    const draftImages = draft.imageAssets ?? [];
    setProblems(
      draft.problems.length > 0
        ? draft.problems.map((problem) => ({
            id: uid(),
            number: problem.number,
            statement: problem.statement,
            contentFormat: problem.contentFormat,
            answerType: problem.answerType,
            answerKey: problem.answerKey,
            topicTags: problem.topicTags.join(", "),
            points: problem.points,
            explanationNote: problem.explanationNote ?? "",
            imageAssets: draftImages.filter((asset) => {
              const refs = new Set([
                ...(problem.imageRefs ?? []).map(imageKeyFromFileName),
                ...Array.from(imageTokens(problem.statement)),
              ]);
              return refs.has(asset.key);
            }),
          }))
        : [emptyProblem(1)],
    );
    setDraftIssues(draft.issues);
    setDraftFileName(draft.fileName);
  }, [importDraftKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function addProblem() {
    setProblems((prev) => [...prev, emptyProblem(prev.length + 1)]);
  }

  function setProblemCount(count: number) {
    const safeCount = Math.max(1, Math.min(100, Number.isFinite(count) ? Math.floor(count) : 1));
    setProblems((prev) =>
      Array.from({ length: safeCount }, (_, index) => {
        const existing = prev[index];
        return existing ? existing : emptyProblem(index + 1);
      }),
    );
  }

  function handlePdfFile(file: File | undefined) {
    setError(null);
    if (!file) {
      setProblemPdf(null);
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Problem file must be a PDF.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProblemPdf({ name: file.name, dataUrl: reader.result });
      }
    };
    reader.onerror = () => setError("Could not read that PDF.");
    reader.readAsDataURL(file);
  }

  function removeProblem(id: string) {
    setProblems((prev) => prev.filter((p) => p.id !== id));
  }

  function updateProblem(id: string, field: EditableProblemField, value: string | number) {
    setProblems((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  async function handleImageFiles(problemId: string, files: FileList | null) {
    setError(null);
    const selected = Array.from(files ?? []);
    if (selected.length === 0) {
      return;
    }

    const existingKeys = new Set(
      problems.flatMap((problem) => problem.imageAssets.map((a) => a.key)),
    );
    const nextAssets: UploadedImageAsset[] = [];

    for (const file of selected) {
      if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type)) {
        setError(`${file.name} must be PNG, JPEG, GIF, or WebP.`);
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        setError(`${file.name} exceeds the 4MB per-image limit.`);
        return;
      }
      const key = imageKeyFromFileName(file.name);
      if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(key)) {
        setError(`${file.name} cannot be converted into a safe image key.`);
        return;
      }
      if (existingKeys.has(key) || nextAssets.some((asset) => asset.key === key)) {
        setError(`Image key "${key}" is already used in this problem set.`);
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      nextAssets.push({ key, name: file.name, mimeType: file.type, dataUrl });
    }

    setProblems((prev) =>
      prev.map((problem) =>
        problem.id === problemId
          ? { ...problem, imageAssets: [...problem.imageAssets, ...nextAssets] }
          : problem,
      ),
    );
  }

  function removeImage(problemId: string, key: string) {
    setProblems((prev) =>
      prev.map((problem) =>
        problem.id === problemId
          ? { ...problem, imageAssets: problem.imageAssets.filter((asset) => asset.key !== key) }
          : problem,
      ),
    );
  }

  function togglePreview(id: string) {
    setShowPreview((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAllPreviews() {
    const allOn = problems.length > 0 && problems.every((p) => showPreview[p.id]);
    const next: Record<string, boolean> = {};
    for (const p of problems) {
      next[p.id] = !allOn;
    }
    setShowPreview(next);
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!effectiveSlug.trim()) {
      setError("Slug is required.");
      return;
    }
    if (problems.length === 0) {
      setError("Add at least one problem.");
      return;
    }
    for (const p of problems) {
      if (!p.answerKey.trim()) {
        setError(`Problem ${p.number} is missing an answer.`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/create-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          slug: effectiveSlug.trim(),
          description: description.trim(),
          order,
          difficulty,
          status,
          topicTags: topicTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          videoUrl: videoUrl.trim() || null,
          problemPdf,
          imageAssets: problems.flatMap((p) => p.imageAssets),
          problems: problems.map((p) => ({
            number: p.number,
            statement: statementWithProblemImages(p.statement, p.imageAssets).trim(),
            contentFormat: p.contentFormat,
            answerKey: p.answerKey.trim(),
            answerType: p.answerType,
            topicTags: p.topicTags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            points: p.points,
            explanationNote: p.explanationNote.trim() || null,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create problem set.");
        return;
      }

      setSuccess(`Problem set "${title}" created successfully!`);
      if (importDraftKey) {
        clearJsonImportDraft(importDraftKey);
      }
      setTimeout(() => router.push(`/admin/sets/${data.problemSet.id}`), 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="create-set-shell">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />

      <header className="create-set-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>{importDraftKey ? "Fix JSON Draft" : "Create Problem Set"}</h1>
        </div>
        <div className="create-set-header-actions">
          <Link className="secondary-action" href="/dashboard">
            <ArrowLeft size={16} />
            Dashboard
          </Link>
          <Link className="secondary-action" href="/admin/sets">
            <ArrowLeft size={16} />
            Back to sets
          </Link>
          <button className="primary-action" onClick={handleSubmit} disabled={saving}>
            {saving ? <MathCurveLoader size={16} label="Saving problem set" /> : <Save size={16} />}
            {saving ? "Saving..." : "Save problem set"}
          </button>
        </div>
      </header>

      {error && (
        <div className="create-set-alert create-set-alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="create-set-alert create-set-alert-success">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}
      {importDraftKey && draftFileName ? (
        <div className="create-set-alert">
          <CheckCircle2 size={18} />
          <span>Loaded import draft from {draftFileName}. Fix the issues below, then save.</span>
        </div>
      ) : null}
      {draftIssues.length > 0 ? (
        <div className="dry-run-result" aria-live="polite">
          <div className="preview-card">
            <div className="preview-heading">
              <span className="status-dot status-review" />
              <div>
                <strong>Import issues to fix</strong>
                <small>These came from the original JSON dry run.</small>
              </div>
            </div>
          </div>
          <div className="issue-list">
            {draftIssues.map((issue) => (
              <div className={`issue-row ${issue.level}`} key={issue.message}>
                {issue.level === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <section className="create-set-meta">
        <h2>
          <Sparkles size={18} />
          Set details
        </h2>

        <div className="create-set-grid">
          <div className="form-field">
            <label htmlFor="set-title">Title</label>
            <input
              id="set-title"
              type="text"
              placeholder="MO Set 001 - Algebra Basics"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="set-slug">
              Slug
              <button
                type="button"
                className="slug-toggle"
                onClick={() => {
                  if (!slugManual) setSlug(slugify(title));
                  setSlugManual(!slugManual);
                }}
              >
                {slugManual ? "auto" : "manual"}
              </button>
            </label>
            <input
              id="set-slug"
              type="text"
              placeholder="mo-set-001-algebra-basics"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugManual(true);
                setSlug(e.target.value);
              }}
              readOnly={!slugManual}
            />
          </div>

          <div className="form-field form-field-full">
            <label htmlFor="set-desc">Description</label>
            <textarea
              id="set-desc"
              rows={2}
              placeholder="Introductory algebra practice covering equations and identities."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="set-order">Order</label>
            <input
              id="set-order"
              type="text"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="set-difficulty">Difficulty (1-5)</label>
            <input
              id="set-difficulty"
              type="number"
              min={1}
              max={5}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
            />
          </div>

          <div className="form-field">
            <label htmlFor="set-status">Status</label>
            <select
              id="set-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "DRAFT" | "PUBLISHED" | "ARCHIVED")}
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="set-topics">Set tags (comma-separated; new tags allowed)</label>
            <input
              id="set-topics"
              type="text"
              placeholder="algebra, equations"
              value={topicTags}
              onChange={(e) => setTopicTags(e.target.value)}
            />
            <small className="form-hint">
              Type any new tag name; it is created when you save. These describe the whole set.
              Practice pools are built from the optional question tags on each problem below.
            </small>
            <div className="tag-chip-group">
              {TAG_OPTIONS.map((option) => (
                <button
                  className={`tag-chip ${hasTag(topicTags, option.label) ? "active" : ""}`}
                  key={option.slug}
                  title={
                    option.aliases.length ? `Aliases: ${option.aliases.join(", ")}` : option.label
                  }
                  type="button"
                  onClick={() => setTopicTags((prev) => toggleTagInCsv(prev, option.label))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field form-field-full">
            <label htmlFor="set-video">
              <Video size={14} />
              YouTube video URL
            </label>
            <input
              id="set-video"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            {videoUrl && videoUrl.includes("youtu") && (
              <div className="video-preview">
                <iframe
                  src={
                    videoUrl
                      .replace("watch?v=", "embed/")
                      .replace("youtu.be/", "youtube.com/embed/")
                      .split("&")[0]
                  }
                  width="100%"
                  height="200"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Video preview"
                />
              </div>
            )}
          </div>

          <div className="form-field form-field-full pdf-upload-box">
            <label htmlFor="set-pdf">
              <FileText size={14} />
              Problem PDF
            </label>
            <div className="pdf-upload-row">
              <input
                id="set-pdf"
                type="file"
                accept="application/pdf"
                onChange={(event) => handlePdfFile(event.target.files?.[0])}
              />
              <label className="form-field form-field-sm" htmlFor="set-pdf-count">
                <span className="form-label">Answer boxes</span>
                <input
                  id="set-pdf-count"
                  type="number"
                  min={1}
                  max={100}
                  value={problems.length}
                  onChange={(event) => setProblemCount(Number(event.target.value))}
                />
              </label>
            </div>
            <small className="form-hint">
              Upload a PDF when the statements are already in a file, then set how many answer boxes
              students need.
            </small>
            {problemPdf ? (
              <div className="pdf-selected">
                <Upload size={14} />
                {problemPdf.name}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="create-set-problems">
        <div className="create-set-problems-head">
          <h2>Problems ({problems.length})</h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="secondary-action" onClick={toggleAllPreviews} type="button">
              {problems.length > 0 && problems.every((p) => showPreview[p.id]) ? (
                <EyeOff size={16} />
              ) : (
                <Eye size={16} />
              )}
              Toggle Previews
            </button>
            <button className="secondary-action" onClick={addProblem} type="button">
              <Plus size={16} />
              Add problem
            </button>
          </div>
        </div>

        {problems.map((p) => (
          <div key={p.id} className="problem-card">
            <div className="problem-card-head">
              <div className="problem-number-control">
                <GripVertical size={14} className="grip-icon" />
                <input
                  className="problem-number-input"
                  type="number"
                  min={1}
                  value={p.number}
                  onChange={(e) => updateProblem(p.id, "number", Number(e.target.value))}
                  placeholder="ID"
                />
              </div>
              <div className="problem-card-actions">
                <button
                  className="icon-button-sm"
                  onClick={() => togglePreview(p.id)}
                  title={showPreview[p.id] ? "Hide preview" : "Show LaTeX preview"}
                >
                  {showPreview[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                {problems.length > 1 && (
                  <button
                    className="icon-button-sm icon-button-danger"
                    onClick={() => removeProblem(p.id)}
                    title="Remove problem"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="problem-card-body">
              <div className="form-field form-field-full">
                <label
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span>Problem statement</span>
                  <span style={{ display: "inline-flex", gap: 6 }}>
                    <button
                      type="button"
                      className={`tag-chip ${p.contentFormat === "LATEX" ? "active" : ""}`}
                      onClick={() => updateProblem(p.id, "contentFormat", "LATEX")}
                    >
                      LaTeX
                    </button>
                    <button
                      type="button"
                      className={`tag-chip ${p.contentFormat === "HTML" ? "active" : ""}`}
                      onClick={() => updateProblem(p.id, "contentFormat", "HTML")}
                    >
                      HTML
                    </button>
                  </span>
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    p.contentFormat === "HTML"
                      ? "Use HTML with <math>...</math> tags."
                      : "Solve for $x$: $2x + 5 = 17$"
                  }
                  value={p.statement}
                  onChange={(e) => updateProblem(p.id, "statement", e.target.value)}
                />
                {showPreview[p.id] && (
                  <StatementPreview
                    statement={statementWithProblemImages(p.statement, p.imageAssets)}
                    format={p.contentFormat}
                    assets={imageAssetMap(p.imageAssets)}
                  />
                )}
              </div>

              <div className="form-field form-field-full image-upload-box">
                <label htmlFor={`problem-images-${p.id}`}>
                  <ImageIcon size={14} />
                  Problem images
                </label>
                <input
                  id={`problem-images-${p.id}`}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  multiple
                  onChange={(event) => void handleImageFiles(p.id, event.target.files)}
                />
                <small className="form-hint">
                  Images are inserted below this problem when saved. Use PNG, JPEG, GIF, or WebP up
                  to 4MB each.
                </small>
                {p.imageAssets.length > 0 ? (
                  <div className="image-asset-list">
                    {p.imageAssets.map((asset) => (
                      <div className="image-asset-row" key={asset.key}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.dataUrl} alt="" />
                        <div>
                          <strong>{asset.name}</strong>
                          <small>[[img:{asset.key}]]</small>
                        </div>
                        <button
                          className="icon-button-sm icon-button-danger"
                          type="button"
                          title="Remove image"
                          onClick={() => removeImage(p.id, asset.key)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="problem-answer-row">
                <div className="form-field">
                  <label>Answer type</label>
                  <select
                    value={p.answerType}
                    onChange={(e) => updateProblem(p.id, "answerType", e.target.value)}
                  >
                    {ANSWER_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <small className="form-hint">
                    {ANSWER_TYPE_OPTIONS.find((o) => o.value === p.answerType)?.hint}
                  </small>
                </div>

                <div className="form-field">
                  <label>Answer</label>
                  <input
                    type="text"
                    placeholder={ANSWER_TYPE_OPTIONS.find((o) => o.value === p.answerType)?.hint}
                    value={p.answerKey}
                    onChange={(e) => updateProblem(p.id, "answerKey", e.target.value)}
                  />
                </div>

                <div className="form-field form-field-sm">
                  <label>Points</label>
                  <input
                    type="number"
                    min={1}
                    value={p.points}
                    onChange={(e) => updateProblem(p.id, "points", Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="problem-extra-row">
                <div className="form-field">
                  <label>Question tags for Practice (optional)</label>
                  <input
                    type="text"
                    placeholder="algebra, linear-equations"
                    value={p.topicTags}
                    onChange={(e) => updateProblem(p.id, "topicTags", e.target.value)}
                  />
                  <small className="form-hint">
                    Type any new tag name to create it. A tag appears in Practice after more than 10
                    published questions use it.
                  </small>
                  <div className="tag-chip-group">
                    {TAG_OPTIONS.map((option) => (
                      <button
                        className={`tag-chip ${hasTag(p.topicTags, option.label) ? "active" : ""}`}
                        key={`${p.id}-${option.slug}`}
                        title={
                          option.aliases.length
                            ? `Aliases: ${option.aliases.join(", ")}`
                            : option.label
                        }
                        type="button"
                        onClick={() =>
                          updateProblem(
                            p.id,
                            "topicTags",
                            toggleTagInCsv(p.topicTags, option.label),
                          )
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-field">
                  <label>Explanation note (optional)</label>
                  <input
                    type="text"
                    placeholder="Brief note about this problem"
                    value={p.explanationNote}
                    onChange={(e) => updateProblem(p.id, "explanationNote", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        <button className="add-problem-btn" onClick={addProblem}>
          <Plus size={18} />
          Add another problem
        </button>
      </section>

      <footer className="create-set-footer">
        <span className="create-set-footer-count">
          {problems.length} problem{problems.length !== 1 ? "s" : ""} ·{" "}
          {problems.reduce((s, p) => s + p.points, 0)} total points
        </span>
        <button className="primary-action" onClick={handleSubmit} disabled={saving}>
          {saving ? <MathCurveLoader size={16} label="Saving problem set" /> : <Save size={16} />}
          {saving ? "Saving..." : "Save problem set"}
        </button>
      </footer>
    </main>
  );
}
