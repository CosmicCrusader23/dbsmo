"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { MathCurveLoader } from "@/app/math-curve-loader";
import { PageBackLink } from "@/app/page-back-link";

type Match = { id: string; name: string; email: string };

export function NewClassForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [picked, setPicked] = useState<Match[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    const ctrl = new AbortController();
    const promise: Promise<{ users: Match[] }> =
      trimmed.length >= 2
        ? fetch(`/api/admin/classes/student-search?q=${encodeURIComponent(trimmed)}`, {
            signal: ctrl.signal,
          }).then((r) => r.json())
        : Promise.resolve({ users: [] });
    promise
      .then((d) => {
        const pickedIds = new Set(picked.map((p) => p.id));
        setMatches(d.users.filter((u) => !pickedIds.has(u.id)));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [query, picked]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, studentIds: picked.map((p) => p.id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create class.");
        return;
      }
      router.push(`/admin/classes/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="classes-shell">
      <header className="topbar">
        <PageBackLink destination="Classes" href="/classes" />
      </header>

      <form className="classes-form" onSubmit={submit}>
        <label>
          <span className="eyebrow">Class name</span>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Form 4 OI"
            required
            maxLength={80}
          />
        </label>

        <label>
          <span className="eyebrow">Add students</span>
          <input
            className="form-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
          />
        </label>

        {matches.length > 0 ? (
          <ul className="classes-pick-list">
            {matches.slice(0, 3).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked((cur) => [...cur, m]);
                    setQuery("");
                  }}
                >
                  <Plus size={14} /> {m.name} <small>{m.email}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <ul className="classes-pick-chips">
          {picked.map((p) => (
            <li key={p.id}>
              <span>{p.name}</span>
              <button
                type="button"
                aria-label={`Remove ${p.name}`}
                onClick={() => setPicked((cur) => cur.filter((c) => c.id !== p.id))}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>

        {error ? <p className="classes-error">{error}</p> : null}

        <button type="submit" className="primary-action" disabled={submitting || !name.trim()}>
          {submitting ? <MathCurveLoader size={16} label="Creating class" /> : null} Create class
        </button>
      </form>
    </main>
  );
}
