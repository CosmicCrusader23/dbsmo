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
} from "lucide-react";
import katex from "katex";

/* ── Types ─────────────────────────────────────────────── */

type AnswerType = "INTEGER" | "DECIMAL" | "FRACTION" | "EXACT" | "SET" | "MULTIPLE";

interface ProblemEntry {
  id: string;
  number: number;
  statement: string; // LaTeX
  answerType: AnswerType;
  answerKey: string;
  topicTags: string;
  points: number;
  explanationNote: string;
}

const ANSWER_TYPE_OPTIONS: { value: AnswerType; label: string; hint: string }[] = [
  { value: "INTEGER", label: "Integer", hint: "e.g. 42" },
  { value: "DECIMAL", label: "Decimal", hint: "e.g. 3.14" },
  { value: "FRACTION", label: "Fraction", hint: "e.g. 3/7" },
  { value: "EXACT", label: "Exact match", hint: "e.g. triangle" },
  { value: "SET", label: "Set", hint: "e.g. 1,2,5" },
  { value: "MULTIPLE", label: "Multiple accepted", hint: "e.g. 3/7 or 0.4286" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyProblem(n: number): ProblemEntry {
  return {
    id: uid(),
    number: n,
    statement: "",
    answerType: "INTEGER",
    answerKey: "",
    topicTags: "",
    points: 1,
    explanationNote: "",
  };
}

/* ── LaTeX preview component ──────────────────────────── */

function LatexPreview({ tex }: { tex: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (!tex.trim()) {
      ref.current.innerHTML = '<span class="latex-placeholder">LaTeX preview…</span>';
      return;
    }
    try {
      ref.current.innerHTML = katex.renderToString(tex, {
        throwOnError: false,
        displayMode: true,
        trust: true,
      });
    } catch {
      ref.current.innerHTML = `<span class="latex-error">Invalid LaTeX</span>`;
    }
  }, [tex]);

  return <div ref={ref} className="latex-preview" />;
}

/* ── Slug generator ───────────────────────────────────── */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/* ── Main component ───────────────────────────────────── */

export default function CreateSetPage() {
  const router = useRouter();

  // Set metadata
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState(1);
  const [difficulty, setDifficulty] = useState(1);
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [topicTags, setTopicTags] = useState("");
  const [allowedGroups, setAllowedGroups] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  // Problems
  const [problems, setProblems] = useState<ProblemEntry[]>([emptyProblem(1)]);
  const [showPreview, setShowPreview] = useState<Record<string, boolean>>({});

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const effectiveSlug = slugManual ? slug : slugify(title);

  function addProblem() {
    setProblems((prev) => [...prev, emptyProblem(prev.length + 1)]);
  }

  function removeProblem(id: string) {
    setProblems((prev) => {
      const next = prev.filter((p) => p.id !== id);
      return next.map((p, i) => ({ ...p, number: i + 1 }));
    });
  }

  function updateProblem(id: string, field: keyof ProblemEntry, value: string | number) {
    setProblems((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  function togglePreview(id: string) {
    setShowPreview((prev) => ({ ...prev, [id]: !prev[id] }));
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
          allowedGroups: allowedGroups
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean),
          videoUrl: videoUrl.trim() || null,
          problems: problems.map((p) => ({
            number: p.number,
            statement: p.statement.trim(),
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
      setTimeout(() => router.push("/admin/sets"), 1500);
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
          <h1>Create Problem Set</h1>
        </div>
        <div className="create-set-header-actions">
          <Link className="secondary-action" href="/admin/sets">
            <ArrowLeft size={16} />
            Back to sets
          </Link>
          <button className="primary-action" onClick={handleSubmit} disabled={saving}>
            <Save size={16} />
            {saving ? "Saving…" : "Save problem set"}
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

      {/* ── Metadata section ──────────────────────────── */}
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
              type="number"
              min={0}
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
            />
          </div>

          <div className="form-field">
            <label htmlFor="set-difficulty">Difficulty (1–5)</label>
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
              onChange={(e) => setStatus(e.target.value as "DRAFT" | "PUBLISHED")}
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="set-topics">Topic tags (comma-separated)</label>
            <input
              id="set-topics"
              type="text"
              placeholder="algebra, equations"
              value={topicTags}
              onChange={(e) => setTopicTags(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="set-groups">Allowed groups (comma-separated)</label>
            <input
              id="set-groups"
              type="text"
              placeholder="MO, PD"
              value={allowedGroups}
              onChange={(e) => setAllowedGroups(e.target.value)}
            />
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
        </div>
      </section>

      {/* ── Problems section ──────────────────────────── */}
      <section className="create-set-problems">
        <div className="create-set-problems-head">
          <h2>Problems ({problems.length})</h2>
          <button className="secondary-action" onClick={addProblem}>
            <Plus size={16} />
            Add problem
          </button>
        </div>

        {problems.map((p) => (
          <div key={p.id} className="problem-card">
            <div className="problem-card-head">
              <div className="problem-number">
                <GripVertical size={14} className="grip-icon" />
                <span>Q{p.number}</span>
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
                <label>Problem statement (LaTeX)</label>
                <textarea
                  rows={3}
                  placeholder="Solve for $x$: $2x + 5 = 17$"
                  value={p.statement}
                  onChange={(e) => updateProblem(p.id, "statement", e.target.value)}
                />
                {showPreview[p.id] && p.statement && <LatexPreview tex={p.statement} />}
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
                  <label>Topic tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="algebra, equations"
                    value={p.topicTags}
                    onChange={(e) => updateProblem(p.id, "topicTags", e.target.value)}
                  />
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

      {/* ── Bottom save bar ───────────────────────────── */}
      <footer className="create-set-footer">
        <span className="create-set-footer-count">
          {problems.length} problem{problems.length !== 1 ? "s" : ""} ·{" "}
          {problems.reduce((s, p) => s + p.points, 0)} total points
        </span>
        <button className="primary-action" onClick={handleSubmit} disabled={saving}>
          <Save size={16} />
          {saving ? "Saving…" : "Save problem set"}
        </button>
      </footer>
    </main>
  );
}
