"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Send } from "lucide-react";
import { MathCurveLoader } from "@/app/math-curve-loader";

type ClassOption = {
  id: string;
  name: string;
  memberCount: number;
};

export function AnnouncementComposer({ classes }: { classes: ClassOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set(classes.map((cls) => cls.id)));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleClass(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function submitAnnouncement(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          classIds: Array.from(selectedIds),
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Announcement failed.");
        return;
      }
      setTitle("");
      setBody("");
      setMessage("Announcement posted.");
      router.refresh();
    } catch {
      setError("Announcement request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (classes.length === 0) {
    return null;
  }

  return (
    <section className="class-announcement-composer">
      <div className="class-announcement-copy">
        <p className="eyebrow">Announcements</p>
        <h2>
          <Megaphone size={18} />
          Message classes
        </h2>
        <small>Pinned on student dashboards when they reload.</small>
      </div>
      <form onSubmit={submitAnnouncement}>
        <input
          className="form-input"
          maxLength={120}
          placeholder="Announcement title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          className="form-input"
          maxLength={2000}
          placeholder="Write the message students should see."
          required
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <div className="class-announcement-targets" aria-label="Target classes">
          {classes.map((cls) => (
            <label key={cls.id}>
              <input
                checked={selectedIds.has(cls.id)}
                type="checkbox"
                onChange={() => toggleClass(cls.id)}
              />
              <span>
                {cls.name}
                <small>{cls.memberCount} students</small>
              </span>
            </label>
          ))}
        </div>
        <div className="class-announcement-actions">
          {error ? <span className="form-error">{error}</span> : null}
          {message ? <span className="form-success">{message}</span> : null}
          <button
            className="primary-action compact"
            type="submit"
            disabled={submitting || selectedIds.size === 0}
          >
            {submitting ? (
              <MathCurveLoader size={16} label="Posting announcement" />
            ) : (
              <Send size={16} />
            )}
            Post
          </button>
        </div>
      </form>
    </section>
  );
}
