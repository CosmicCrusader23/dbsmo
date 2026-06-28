"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Plus, Trash2, X } from "lucide-react";
import { MathCurveLoader } from "@/app/math-curve-loader";

type Member = { id: string; name: string; email: string; addedAt: string };
type SetSummary = { id: string; slug: string; title: string };
type Assignment = {
  id: string;
  problemSet: SetSummary;
  dueAt: string | null;
  createdAt: string;
  completedCount: number;
  totalCount: number;
  perStudent: { studentId: string; completedAt: string | null }[];
};
type Detail = {
  id: string;
  name: string;
  members: Member[];
  assignments: Assignment[];
};

export function ClassDetailClient({ classId }: { classId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/admin/classes/${classId}`, { cache: "no-store" });
    if (!res.ok) {
      setError((await res.json()).error ?? "Failed to load.");
      return;
    }
    setDetail(await res.json());
  }, [classId]);

  useEffect(() => {
    Promise.resolve()
      .then(() => refresh())
      .catch(() => {});
  }, [refresh]);

  async function addMembers(ids: string[]) {
    setBusy(true);
    try {
      await fetch(`/api/admin/classes/${classId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: ids }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(studentId: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/classes/${classId}/members/${studentId}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function assignSet(setId: string, dueAt: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/classes/${classId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemSetId: setId, dueAt }),
      });
      if (!res.ok) setError((await res.json()).error ?? "Failed.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(aid: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/classes/${classId}/assignments/${aid}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteClass() {
    if (!detail) {
      return;
    }
    const ok = window.confirm(
      `Delete class "${detail.name}"? This removes roster membership and assignments for this class.`,
    );
    if (!ok) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/classes/${classId}`, { method: "DELETE" });
      if (!res.ok) {
        setError((await res.json()).error ?? "Failed to delete class.");
        return;
      }
      router.push("/admin/classes");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  if (!detail) {
    return (
      <main className="classes-shell">
        <p className="classes-loading">
          <MathCurveLoader size={28} label="Loading class" />
          <span>{error ?? "Loading…"}</span>
        </p>
      </main>
    );
  }

  return (
    <main className="classes-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Class</p>
          <h1>{detail.name}</h1>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="secondary-action danger-action"
            disabled={deleting || busy}
            onClick={() => void deleteClass()}
          >
            {deleting ? <MathCurveLoader size={16} label="Deleting class" /> : <Trash2 size={16} />}
            {deleting ? "Deleting..." : "Delete class"}
          </button>
          <Link href="/admin/classes" className="secondary-action">
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
      </header>

      {error ? <p className="classes-error">{error}</p> : null}
      {busy ? (
        <p className="classes-loading compact">
          <MathCurveLoader size={18} label="Updating class" />
          <span>Updating class…</span>
        </p>
      ) : null}

      <div className="classes-summary-grid" aria-label="Class summary">
        <div>
          <span>Students</span>
          <strong>{detail.members.length}</strong>
        </div>
        <div>
          <span>Assignments</span>
          <strong>{detail.assignments.length}</strong>
        </div>
        <div>
          <span>Completed work</span>
          <strong>
            {detail.assignments.reduce((sum, assignment) => sum + assignment.completedCount, 0)}
          </strong>
        </div>
      </div>

      <section className="classes-section">
        <div className="classes-section-header">
          <div>
            <p className="eyebrow">Roster</p>
            <h2>
              {detail.members.length} student{detail.members.length === 1 ? "" : "s"}
            </h2>
          </div>
        </div>
        <RosterPicker
          onPick={addMembers}
          excludeIds={detail.members.map((m) => m.id)}
          disabled={busy}
        />
        {detail.members.length > 0 ? (
          <ul className="classes-roster">
            {detail.members.map((m) => (
              <li key={m.id}>
                <span>
                  <strong>{m.name}</strong>
                  <small>{m.email}</small>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${m.name}`}
                  onClick={() => void removeMember(m.id)}
                  disabled={busy}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="classes-empty-inline">No students have been added yet.</p>
        )}
      </section>

      <section className="classes-section">
        <div className="classes-section-header">
          <div>
            <p className="eyebrow">Assignments</p>
            <h2>
              {detail.assignments.length} set{detail.assignments.length === 1 ? "" : "s"}
            </h2>
          </div>
        </div>
        <AssignmentPicker onAssign={assignSet} disabled={busy} />
        {detail.assignments.length > 0 ? (
          <ul className="classes-assignments">
            {detail.assignments.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.problemSet.title}</strong>
                  <small>
                    {a.dueAt ? `Due ${new Date(a.dueAt).toLocaleDateString()}` : "No due date"}
                  </small>
                </div>
                <span className="classes-progress">
                  <CheckCircle2 size={14} /> {a.completedCount} / {a.totalCount}
                </span>
                <button
                  type="button"
                  aria-label="Delete assignment"
                  onClick={() => void removeAssignment(a.id)}
                  disabled={busy}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="classes-empty-inline">No problem sets are assigned to this class.</p>
        )}
      </section>
    </main>
  );
}

function RosterPicker({
  onPick,
  excludeIds,
  disabled,
}: {
  onPick: (ids: string[]) => void | Promise<void>;
  excludeIds: string[];
  disabled: boolean;
}) {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<{ id: string; name: string; email: string }[]>([]);

  useEffect(() => {
    const trimmed = q.trim();
    const ctrl = new AbortController();
    const promise: Promise<{ users: { id: string; name: string; email: string }[] }> =
      trimmed.length >= 2
        ? fetch(`/api/admin/classes/student-search?q=${encodeURIComponent(trimmed)}`, {
            signal: ctrl.signal,
          }).then((r) => r.json())
        : Promise.resolve({ users: [] });
    promise
      .then((d) => {
        const ex = new Set(excludeIds);
        setMatches(d.users.filter((u) => !ex.has(u.id)));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [q, excludeIds]);

  return (
    <div>
      <input
        className="form-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Add students by name or email"
        disabled={disabled}
      />
      {matches.length > 0 ? (
        <ul className="classes-pick-list">
          {matches.slice(0, 3).map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  void onPick([m.id]);
                  setQ("");
                }}
              >
                <Plus size={14} /> {m.name} <small>{m.email}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AssignmentPicker({
  onAssign,
  disabled,
}: {
  onAssign: (setId: string, dueAt: string | null) => void | Promise<void>;
  disabled: boolean;
}) {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [picked, setPicked] = useState<{ id: string; title: string } | null>(null);
  const [due, setDue] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    const promise: Promise<{ sets: { id: string; title: string; slug: string }[] }> = fetch(
      `/api/admin/classes/set-search?q=${encodeURIComponent(q.trim())}`,
      {
        signal: ctrl.signal,
      },
    ).then((r) => r.json());
    promise.then((d) => setMatches(d.sets)).catch(() => {});
    return () => ctrl.abort();
  }, [q]);

  return (
    <div className="classes-assign-picker">
      {!picked ? (
        <>
          <input
            className="form-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search published sets"
            disabled={disabled}
          />
          {matches.length > 0 ? (
            <ul className="classes-pick-list">
              {matches.slice(0, 3).map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setPicked({ id: s.id, title: s.title })}>
                    <Plus size={14} /> {s.title} <small>{s.slug}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <div className="classes-assign-confirm">
          <strong>{picked.title}</strong>
          <input
            type="date"
            className="form-input"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <button
            type="button"
            className="primary-action"
            disabled={disabled}
            onClick={() => {
              const dueAt = due ? new Date(`${due}T23:59:00`).toISOString() : null;
              void onAssign(picked.id, dueAt);
              setPicked(null);
              setDue("");
              setQ("");
            }}
          >
            Assign
          </button>
          <button type="button" className="secondary-action" onClick={() => setPicked(null)}>
            <X size={14} /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}
