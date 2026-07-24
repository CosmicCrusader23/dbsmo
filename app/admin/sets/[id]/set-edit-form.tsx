"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Hash,
  ImageIcon,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { MathCurveLoader } from "@/app/math-curve-loader";
import { PageBackLink } from "@/app/page-back-link";
import { statusLabel, statusColor } from "@/lib/visibility";
import { CANONICAL_TAGS, normalizeProblemTag, normalizeTagList } from "@/lib/problem-tags";
import { DeleteSetButton } from "../delete-set-button";

type ProblemData = {
  id: string;
  number: number;
  statement: string;
  contentFormat: "LATEX" | "HTML";
  answerKey: string;
  answerType: "EXACT" | "INTEGER" | "DECIMAL" | "FRACTION" | "SET" | "MULTIPLE" | "EXPRESSION";
  topicTags: string[];
  points: number;
  explanationNote: string | null;
};

type UploadedImageAsset = {
  key: string;
  name: string;
  mimeType: string;
  dataUrl: string;
};

type SetData = {
  id: string;
  title: string;
  slug: string;
  description: string;
  order: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  difficulty: number;
  topicTags: string[];
  videoUrl: string | null;
  problemFile: { originalName: string; mimeType: string } | null;
  solutionFile: { originalName: string; mimeType: string } | null;
  problems: ProblemData[];
};

const ANSWER_TYPES: Array<{
  value: ProblemData["answerType"];
  label: string;
}> = [
  { value: "INTEGER", label: "Integer" },
  { value: "DECIMAL", label: "Decimal" },
  { value: "FRACTION", label: "Fraction" },
  { value: "EXACT", label: "Exact" },
  { value: "SET", label: "Set" },
  { value: "MULTIPLE", label: "Multiple" },
  { value: "EXPRESSION", label: "Expression" },
];
const TAG_OPTIONS = CANONICAL_TAGS.filter((tag) => tag.kind === "problem_set_category");

function parseTagInput(value: string): string[] {
  return normalizeTagList(
    value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  );
}

function toggleTagInCsv(csv: string, tag: string): string {
  const normalizedTag = normalizeProblemTag(tag);
  const existing = parseTagInput(csv);
  const next = existing.some((item) => normalizeProblemTag(item) === normalizedTag)
    ? existing.filter((item) => normalizeProblemTag(item) !== normalizedTag)
    : [...existing, tag];
  return next.join(", ");
}

function newProblem(number: number | string) {
  return {
    id: `new-${Math.random().toString(36).slice(2, 10)}`,
    number: typeof number === "number" ? number : Number(number) || 1,
    statement: "",
    contentFormat: "LATEX" as const,
    answerKey: "",
    answerType: "INTEGER" as const,
    topicTags: [],
    topicTagsInput: "",
    points: 1,
    explanationNote: null,
    explanationNoteInput: "",
    imageAssets: [] as UploadedImageAsset[],
  };
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

export function SetEditForm({ set }: { set: SetData }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isRegrading, setIsRegrading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [regradeResult, setRegradeResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());

  const [title, setTitle] = useState(set.title);
  const [description, setDescription] = useState(set.description);
  const [status, setStatus] = useState(set.status);
  const [order, setOrder] = useState(set.order);
  const [difficulty, setDifficulty] = useState(set.difficulty);
  const [topicTags, setTopicTags] = useState(set.topicTags.join(", "));
  const [videoUrl, setVideoUrl] = useState(set.videoUrl ?? "");
  const [problemPdf, setProblemPdf] = useState<{ name: string; dataUrl: string } | null>(null);
  const [problems, setProblems] = useState(
    set.problems.map((problem) => ({
      ...problem,
      topicTagsInput: problem.topicTags.join(", "),
      explanationNoteInput: problem.explanationNote ?? "",
      imageAssets: [] as UploadedImageAsset[],
    })),
  );
  const [expandedProblems, setExpandedProblems] = useState<Set<string>>(new Set());

  function toggleProblemExpanded(problemId: string) {
    setExpandedProblems((prev) => {
      const next = new Set(prev);
      if (next.has(problemId)) {
        next.delete(problemId);
      } else {
        next.add(problemId);
      }
      return next;
    });
  }

  function downloadJson() {
    const statementFormats = new Set(problems.map((problem) => problem.contentFormat));
    const exportData = {
      slug: set.slug,
      title: title,
      description: description,
      statementFormat:
        statementFormats.size === 1 ? (problems[0]?.contentFormat ?? "LATEX") : undefined,
      order: order,
      status: status,
      difficulty: difficulty,
      topicTags: parseTagInput(topicTags),
      videoUrl: videoUrl,
      problems: problems.map((p) => ({
        number: p.number,
        statement: p.statement,
        statementFormat: p.contentFormat,
        answerType: p.answerType,
        answerKey: p.answerKey,
        points: p.points,
        topicTags: parseTagInput(p.topicTagsInput),
        solution: p.explanationNoteInput,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${set.slug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function updateProblem(
    problemId: string,
    field:
      | "statement"
      | "contentFormat"
      | "answerKey"
      | "answerType"
      | "points"
      | "number"
      | "topicTagsInput"
      | "explanationNoteInput",
    value: string | number,
  ) {
    setProblems((prev) =>
      prev.map((problem) => (problem.id === problemId ? { ...problem, [field]: value } : problem)),
    );
  }

  function addProblem() {
    const nextId = `new-${Math.random().toString(36).slice(2, 10)}`;
    setProblems((prev) => [...prev, { ...newProblem(prev.length + 1), id: nextId }]);
    setExpandedProblems((prev) => new Set(prev).add(nextId));
  }

  function removeProblem(problemId: string) {
    setProblems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((problem) => problem.id !== problemId);
    });
  }

  function setProblemCount(count: number) {
    const safeCount = Math.max(1, Math.min(100, Number.isFinite(count) ? Math.floor(count) : 1));
    setProblems((prev) =>
      Array.from({ length: safeCount }, (_, index) => {
        const existing = prev[index];
        return existing ? existing : newProblem(index + 1);
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
      nextAssets.push({
        key,
        name: file.name,
        mimeType: file.type,
        dataUrl: await readFileAsDataUrl(file),
      });
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

  async function onSave() {
    setIsSaving(true);
    setError(null);
    setValidationErrors(new Set());
    setSaved(false);
    setRegradeResult(null);

    const errors = new Set<string>();
    if (!title.trim()) errors.add("title");
    problems.forEach((p) => {
      if (!p.answerKey.trim()) errors.add(`problem-${p.id}-answerKey`);
    });

    if (errors.size > 0) {
      setValidationErrors(errors);
      setError("Validation failed. Please fill in the highlighted fields.");
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/admin/sets/${set.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          status,
          order,
          difficulty,
          topicTags: parseTagInput(topicTags),
          videoUrl: videoUrl.trim() || null,
          problemPdf,
          imageAssets: problems.flatMap((problem) => problem.imageAssets),
          problems: problems.map((problem) => ({
            id: problem.id.startsWith("new-") ? undefined : problem.id,
            number: problem.number,
            statement: statementWithProblemImages(problem.statement, problem.imageAssets).trim(),
            contentFormat: problem.contentFormat,
            answerKey: problem.answerKey.trim(),
            answerType: problem.answerType,
            topicTags: parseTagInput(problem.topicTagsInput),
            points: Number(problem.points),
            explanationNote: problem.explanationNoteInput.trim() || null,
          })),
        }),
      });

      if (!response.ok) {
        const body = await response.json();

        if (response.status === 422) {
          setError("Validation failed. Check the form data.");
        } else {
          setError(body.error ?? "Save failed.");
        }
        return;
      }

      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Request failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onRegrade() {
    setIsRegrading(true);
    setError(null);
    setSaved(false);
    setRegradeResult(null);

    try {
      const response = await fetch(`/api/admin/sets/${set.id}/regrade`, {
        method: "POST",
      });

      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Regrade failed.");
        return;
      }

      setRegradeResult(`Regraded ${body.totalAttempts} attempts. ${body.updatedAttempts} changed.`);
      router.refresh();
      setTimeout(() => setRegradeResult(null), 4000);
    } catch {
      setError("Regrade request failed.");
    } finally {
      setIsRegrading(false);
    }
  }

  return (
    <div className="page-frame">
      <header className="topbar standalone">
        <div>
          <p className="eyebrow">
            <span
              className={`status-badge ${statusColor({
                status: set.status,
                visibleFrom: null,
                visibleTo: null,
              })}`}
            >
              {statusLabel({ status: set.status, visibleFrom: null, visibleTo: null })}
            </span>
          </p>
          <h1>{set.title}</h1>
        </div>
        <div className="topbar-actions">
          {error && <span className="form-error">{error}</span>}
          {saved && (
            <span className="form-success">
              <CheckCircle2 size={16} /> Saved
            </span>
          )}
          {regradeResult && (
            <span className="form-success">
              <CheckCircle2 size={16} /> {regradeResult}
            </span>
          )}
          <button
            className="secondary-action"
            type="button"
            disabled={isRegrading}
            onClick={onRegrade}
          >
            {isRegrading ? (
              <MathCurveLoader size={18} label="Regrading set" />
            ) : (
              <RotateCcw size={18} />
            )}
            {isRegrading ? "Regrading..." : "Regrade"}
          </button>
          <button className="secondary-action" type="button" onClick={downloadJson}>
            <Download size={18} />
            Export JSON
          </button>
          <Link className="secondary-action" href={`/admin/sets/${set.id}/analytics`}>
            <BarChart3 size={18} />
            Analytics
          </Link>
          <DeleteSetButton
            setId={set.id}
            title={set.title}
            status={set.status}
            redirectTo="/admin/sets"
          />
          <button className="primary-action" type="button" disabled={isSaving} onClick={onSave}>
            {isSaving ? <MathCurveLoader size={18} label="Saving set" /> : <Save size={18} />}
            {isSaving ? "Saving…" : "Save changes"}
          </button>
          <PageBackLink destination="Manage Sets" href="/admin/sets" />
        </div>
      </header>

      <section className="import-layout">
        <section className="panel import-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Metadata</p>
              <h2>Edit set</h2>
            </div>
            <code className="slug-code">{set.slug}</code>
          </div>

          <div className="form-grid">
            <label className="form-field">
              <span className="form-label">Title</span>
              <input
                className="form-input"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setValidationErrors((prev) => {
                    const next = new Set(prev);
                    next.delete("title");
                    return next;
                  });
                }}
                style={
                  validationErrors.has("title")
                    ? {
                        borderColor: "var(--color-danger, #ef4444)",
                        outline: "1px solid var(--color-danger, #ef4444)",
                      }
                    : {}
                }
              />
            </label>

            <label className="form-field">
              <span className="form-label">Description</span>
              <textarea
                className="form-input form-textarea"
                value={description}
                rows={3}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className="form-row">
              <label className="form-field">
                <span className="form-label">Status</span>
                <select
                  className="form-input form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SetData["status"])}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>

              <label className="form-field">
                <span className="form-label">Order</span>
                <input
                  className="form-input"
                  type="text"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                />
              </label>

              <label className="form-field">
                <span className="form-label">Difficulty</span>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  max={5}
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                />
              </label>
            </div>

            <label className="form-field">
              <span className="form-label">Set tags (new tags allowed)</span>
              <input
                className="form-input"
                value={topicTags}
                placeholder="algebra, equations"
                onChange={(e) => setTopicTags(e.target.value)}
              />
              <small className="form-hint">
                Type any new tag name; it is created when you save. These describe the whole set.
                Practice pools are built from the optional question tags on each problem.
              </small>
              <div className="tag-chip-group">
                {TAG_OPTIONS.map((option) => (
                  <button
                    className={`tag-chip ${
                      parseTagInput(topicTags).some(
                        (value) => normalizeProblemTag(value) === normalizeProblemTag(option.label),
                      )
                        ? "active"
                        : ""
                    }`}
                    key={`set-tag-${option.slug}`}
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
            </label>

            <label className="form-field">
              <span className="form-label">Video URL</span>
              <input
                className="form-input"
                type="url"
                value={videoUrl}
                placeholder="https://..."
                onChange={(e) => setVideoUrl(e.target.value)}
              />
            </label>

            <div className="form-field pdf-upload-box">
              <span className="form-label">
                <FileText size={14} />
                Problem PDF
              </span>
              <div className="pdf-upload-row">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => handlePdfFile(event.target.files?.[0])}
                />
                <label className="form-field form-field-sm">
                  <span className="form-label">Answer boxes</span>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={100}
                    value={problems.length}
                    onChange={(event) => setProblemCount(Number(event.target.value))}
                  />
                </label>
              </div>
              <small className="form-hint">
                {set.problemFile
                  ? `Current file: ${set.problemFile.originalName}`
                  : "Attach a PDF if students should read the set from a file."}
              </small>
              {problemPdf ? (
                <div className="pdf-selected">
                  <Upload size={14} />
                  {problemPdf.name}
                </div>
              ) : null}
            </div>
          </div>

          <div className="set-editor-problem-list">
            {problems.map((problem) => (
              <article className="problem-card" key={problem.id}>
                <div
                  className="problem-card-head"
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleProblemExpanded(problem.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {expandedProblems.has(problem.id) ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                    <div className="problem-number-control">
                      <input
                        className="problem-number-input"
                        type="number"
                        min={1}
                        value={problem.number}
                        onChange={(e) =>
                          updateProblem(problem.id, "number", Number(e.target.value))
                        }
                        onClick={(e) => e.stopPropagation()}
                        placeholder="ID"
                      />
                    </div>
                    {!expandedProblems.has(problem.id) && (
                      <small
                        style={{
                          fontWeight: "normal",
                          color: "var(--color-muted)",
                          marginLeft: "4px",
                        }}
                      >
                        {problem.statement.slice(0, 40) || "(No statement)"} •{" "}
                        <strong>{problem.answerKey || "(No answer)"}</strong>
                      </small>
                    )}
                  </div>
                  <button
                    className="icon-button-sm icon-button-danger"
                    type="button"
                    disabled={problems.length <= 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProblem(problem.id);
                    }}
                    title="Remove problem"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {expandedProblems.has(problem.id) && (
                  <div className="problem-card-body">
                    <label className="form-field form-field-full">
                      <span
                        className="form-label"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span>Statement</span>
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            className={`tag-chip ${problem.contentFormat === "LATEX" ? "active" : ""}`}
                            type="button"
                            onClick={() => updateProblem(problem.id, "contentFormat", "LATEX")}
                          >
                            LaTeX
                          </button>
                          <button
                            className={`tag-chip ${problem.contentFormat === "HTML" ? "active" : ""}`}
                            type="button"
                            onClick={() => updateProblem(problem.id, "contentFormat", "HTML")}
                          >
                            HTML
                          </button>
                        </span>
                      </span>
                      <textarea
                        className="form-input form-textarea"
                        rows={3}
                        value={problem.statement}
                        onChange={(e) => updateProblem(problem.id, "statement", e.target.value)}
                      />
                    </label>

                    <div className="form-field form-field-full image-upload-box">
                      <span className="form-label">
                        <ImageIcon size={14} />
                        Problem images
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        multiple
                        onChange={(event) => void handleImageFiles(problem.id, event.target.files)}
                      />
                      <small className="form-hint">
                        New uploads are inserted below this problem when saved. Existing [[img:key]]
                        tokens remain in the statement.
                      </small>
                      {problem.imageAssets.length > 0 ? (
                        <div className="image-asset-list">
                          {problem.imageAssets.map((asset) => (
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
                                onClick={() => removeImage(problem.id, asset.key)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="problem-answer-row">
                      <label className="form-field">
                        <span className="form-label">Answer type</span>
                        <select
                          className="form-input form-select"
                          value={problem.answerType}
                          onChange={(e) => updateProblem(problem.id, "answerType", e.target.value)}
                        >
                          {ANSWER_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-field">
                        <span className="form-label">Answer key</span>
                        <input
                          className="form-input"
                          value={problem.answerKey}
                          onChange={(e) => {
                            updateProblem(problem.id, "answerKey", e.target.value);
                            setValidationErrors((prev) => {
                              const next = new Set(prev);
                              next.delete(`problem-${problem.id}-answerKey`);
                              return next;
                            });
                          }}
                          style={
                            validationErrors.has(`problem-${problem.id}-answerKey`)
                              ? {
                                  borderColor: "var(--color-danger, #ef4444)",
                                  outline: "1px solid var(--color-danger, #ef4444)",
                                }
                              : {}
                          }
                        />
                      </label>
                      <label className="form-field form-field-sm">
                        <span className="form-label">Points</span>
                        <input
                          className="form-input"
                          type="number"
                          min={1}
                          value={problem.points}
                          onChange={(e) =>
                            updateProblem(problem.id, "points", Number(e.target.value))
                          }
                        />
                      </label>
                    </div>

                    <label className="form-field">
                      <span className="form-label">Question tags for Practice</span>
                      <input
                        className="form-input"
                        value={problem.topicTagsInput}
                        onChange={(e) =>
                          updateProblem(problem.id, "topicTagsInput", e.target.value)
                        }
                        placeholder="Algebra, Linear Equations"
                      />
                      <small className="form-hint">
                        Type any new tag name to create it. These tags place the question into
                        Practice pools once more than 10 published questions share the same tag.
                      </small>
                      <div className="tag-chip-group">
                        {TAG_OPTIONS.map((option) => (
                          <button
                            className={`tag-chip ${
                              parseTagInput(problem.topicTagsInput).some(
                                (value) =>
                                  normalizeProblemTag(value) === normalizeProblemTag(option.label),
                              )
                                ? "active"
                                : ""
                            }`}
                            key={`${problem.id}-${option.slug}`}
                            title={
                              option.aliases.length
                                ? `Aliases: ${option.aliases.join(", ")}`
                                : option.label
                            }
                            type="button"
                            onClick={() =>
                              updateProblem(
                                problem.id,
                                "topicTagsInput",
                                toggleTagInCsv(problem.topicTagsInput, option.label),
                              )
                            }
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </label>

                    <label className="form-field">
                      <span className="form-label">Explanation note</span>
                      <input
                        className="form-input"
                        value={problem.explanationNoteInput}
                        onChange={(e) =>
                          updateProblem(problem.id, "explanationNoteInput", e.target.value)
                        }
                        placeholder="Optional note for graders"
                      />
                    </label>
                  </div>
                )}
              </article>
            ))}
          </div>

          <button className="add-problem-btn" type="button" onClick={addProblem}>
            <Plus size={18} />
            Add another problem
          </button>
        </section>

        <aside className="panel import-spec" style={{ paddingBottom: 20 }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Answer key</p>
              <h2>
                {problems.length} problem{problems.length !== 1 ? "s" : ""}
              </h2>
            </div>
            <Hash size={20} />
          </div>

          <div className="set-list">
            {problems.map((problem) => (
              <div className="set-row" key={problem.id}>
                <div className="set-main">
                  <span className="problem-number">{problem.number}</span>
                  <div>
                    <strong>{problem.answerKey || "(No answer)"}</strong>
                    <small>
                      {problem.answerType.toLowerCase()} · {problem.points} pt
                      {problem.points !== 1 ? "s" : ""}
                    </small>
                  </div>
                </div>
                {parseTagInput(problem.topicTagsInput).length > 0 && (
                  <small className="topic-chips">
                    {parseTagInput(problem.topicTagsInput).join(", ")}
                  </small>
                )}
              </div>
            ))}
          </div>

          {(set.problemFile || set.solutionFile) && (
            <div className="preview-files" style={{ padding: "0 20px 0" }}>
              {set.problemFile && (
                <span>
                  <FileText size={14} /> {set.problemFile.originalName}
                </span>
              )}
              {set.solutionFile && (
                <span>
                  <FileText size={14} /> {set.solutionFile.originalName}
                </span>
              )}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
