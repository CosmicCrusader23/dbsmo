"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Hash,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { statusLabel, statusColor } from "@/lib/visibility";
import {
  STANDARD_PROBLEM_SET_TAGS,
  normalizeProblemTag,
  normalizeTagList,
} from "@/lib/problem-tags";
import { DeleteSetButton } from "../delete-set-button";

type ProblemData = {
  id: string;
  number: number;
  statement: string;
  answerKey: string;
  answerType: "EXACT" | "INTEGER" | "DECIMAL" | "FRACTION" | "SET" | "MULTIPLE" | "EXPRESSION";
  topicTags: string[];
  points: number;
  explanationNote: string | null;
};

type SetData = {
  id: string;
  title: string;
  slug: string;
  description: string;
  order: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | string;
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

function newProblem(number: number) {
  return {
    id: `new-${Math.random().toString(36).slice(2, 10)}`,
    number,
    statement: "",
    answerKey: "",
    answerType: "INTEGER" as const,
    topicTags: [],
    topicTagsInput: "",
    points: 1,
    explanationNote: null,
    explanationNoteInput: "",
  };
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
    })),
  );

  function updateProblem(
    problemId: string,
    field:
      | "statement"
      | "answerKey"
      | "answerType"
      | "points"
      | "topicTagsInput"
      | "explanationNoteInput",
    value: string | number,
  ) {
    setProblems((prev) =>
      prev.map((problem) => (problem.id === problemId ? { ...problem, [field]: value } : problem)),
    );
  }

  function addProblem() {
    setProblems((prev) => [...prev, newProblem(prev.length + 1)]);
  }

  function removeProblem(problemId: string) {
    setProblems((prev) => {
      if (prev.length <= 1) return prev;
      return prev
        .filter((problem) => problem.id !== problemId)
        .map((problem, index) => ({ ...problem, number: index + 1 }));
    });
  }

  function setProblemCount(count: number) {
    const safeCount = Math.max(1, Math.min(100, Number.isFinite(count) ? Math.floor(count) : 1));
    setProblems((prev) =>
      Array.from({ length: safeCount }, (_, index) => {
        const existing = prev[index];
        return existing ? { ...existing, number: index + 1 } : newProblem(index + 1);
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
          problems: problems.map((problem) => ({
            id: problem.id.startsWith("new-") ? undefined : problem.id,
            number: problem.number,
            statement: problem.statement.trim(),
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
            <span className={`status-badge ${statusColor({ status: set.status as any, visibleFrom: null, visibleTo: null })}`}>
              {statusLabel({ status: set.status as any, visibleFrom: null, visibleTo: null })}
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
            {isRegrading ? <Loader2 size={18} className="spin-icon" /> : <RotateCcw size={18} />}
            {isRegrading ? "Regrading..." : "Regrade"}
          </button>
          <DeleteSetButton
            setId={set.id}
            title={set.title}
            status={set.status}
            redirectTo="/admin/sets"
          />
          <button className="primary-action" type="button" disabled={isSaving} onClick={onSave}>
            {isSaving ? <Loader2 size={18} className="spin-icon" /> : <Save size={18} />}
            {isSaving ? "Saving…" : "Save changes"}
          </button>
          <Link className="secondary-action" href="/admin/sets" style={{ marginLeft: "10px" }}>
            <ArrowLeft size={18} />
            All sets
          </Link>
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
            style={validationErrors.has("title") ? { borderColor: "var(--color-danger, #ef4444)", outline: "1px solid var(--color-danger, #ef4444)" } : {}}
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
              onChange={(e) => setStatus(e.target.value)}
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
              type="number"
              min={1}
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
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
          <span className="form-label">Topic tags</span>
          <input
            className="form-input"
            value={topicTags}
            placeholder="algebra, equations"
            onChange={(e) => setTopicTags(e.target.value)}
          />
          <div className="tag-chip-group">
            {STANDARD_PROBLEM_SET_TAGS.map((tag) => (
              <button
                className={`tag-chip ${
                  parseTagInput(topicTags).some(
                    (value) => normalizeProblemTag(value) === normalizeProblemTag(tag),
                  )
                    ? "active"
                    : ""
                }`}
                key={`set-tag-${tag}`}
                type="button"
                onClick={() => setTopicTags((prev) => toggleTagInCsv(prev, tag))}
              >
                {tag}
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
            <div className="problem-card-head">
              <div className="problem-number">
                <span>Q{problem.number}</span>
              </div>
              <button
                className="icon-button-sm icon-button-danger"
                type="button"
                disabled={problems.length <= 1}
                onClick={() => removeProblem(problem.id)}
                title="Remove problem"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="problem-card-body">
              <label className="form-field form-field-full">
                <span className="form-label">Statement (LaTeX supported)</span>
                <textarea
                  className="form-input form-textarea"
                  rows={3}
                  value={problem.statement}
                  onChange={(e) => updateProblem(problem.id, "statement", e.target.value)}
                />
              </label>

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
                    style={validationErrors.has(`problem-${problem.id}-answerKey`) ? { borderColor: "var(--color-danger, #ef4444)", outline: "1px solid var(--color-danger, #ef4444)" } : {}}
                  />
                </label>
                <label className="form-field form-field-sm">
                  <span className="form-label">Points</span>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    value={problem.points}
                    onChange={(e) => updateProblem(problem.id, "points", Number(e.target.value))}
                  />
                </label>
              </div>

              <label className="form-field">
                <span className="form-label">Topic tags</span>
                <input
                  className="form-input"
                  value={problem.topicTagsInput}
                  onChange={(e) => updateProblem(problem.id, "topicTagsInput", e.target.value)}
                  placeholder="Algebra, Number Theory"
                />
                <div className="tag-chip-group">
                  {STANDARD_PROBLEM_SET_TAGS.map((tag) => (
                    <button
                      className={`tag-chip ${
                        parseTagInput(problem.topicTagsInput).some(
                          (value) => normalizeProblemTag(value) === normalizeProblemTag(tag),
                        )
                          ? "active"
                          : ""
                      }`}
                      key={`${problem.id}-${tag}`}
                      type="button"
                      onClick={() =>
                        updateProblem(
                          problem.id,
                          "topicTagsInput",
                          toggleTagInCsv(problem.topicTagsInput, tag),
                        )
                      }
                    >
                      {tag}
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
                <small className="topic-chips">{parseTagInput(problem.topicTagsInput).join(", ")}</small>
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
