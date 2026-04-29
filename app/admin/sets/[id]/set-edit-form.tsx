"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, Save } from "lucide-react";

type SetData = {
  id: string;
  title: string;
  slug: string;
  description: string;
  order: number;
  status: string;
  difficulty: number;
  allowedGroups: string[];
  topicTags: string[];
  videoUrl: string | null;
};

export function SetEditForm({ set }: { set: SetData }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isRegrading, setIsRegrading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [regradeResult, setRegradeResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(set.title);
  const [description, setDescription] = useState(set.description);
  const [status, setStatus] = useState(set.status);
  const [order, setOrder] = useState(set.order);
  const [difficulty, setDifficulty] = useState(set.difficulty);
  const [allowedGroups, setAllowedGroups] = useState(set.allowedGroups.join(", "));
  const [topicTags, setTopicTags] = useState(set.topicTags.join(", "));
  const [videoUrl, setVideoUrl] = useState(set.videoUrl ?? "");

  async function onSave() {
    setIsSaving(true);
    setError(null);
    setSaved(false);
    setRegradeResult(null);

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
          allowedGroups: allowedGroups
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          topicTags: topicTags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          videoUrl: videoUrl.trim() || null,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Save failed.");
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
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
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
          <span className="form-label">Allowed groups</span>
          <input
            className="form-input"
            value={allowedGroups}
            placeholder="MO, PD"
            onChange={(e) => setAllowedGroups(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span className="form-label">Topic tags</span>
          <input
            className="form-input"
            value={topicTags}
            placeholder="algebra, equations"
            onChange={(e) => setTopicTags(e.target.value)}
          />
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
      </div>

      <div className="import-actions" style={{ paddingBottom: 20 }}>
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
          {isRegrading ? "Regrading..." : "Regrade attempts"}
        </button>
        <button className="primary-action" type="button" disabled={isSaving} onClick={onSave}>
          {isSaving ? <Loader2 size={18} className="spin-icon" /> : <Save size={18} />}
          {isSaving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </section>
  );
}
