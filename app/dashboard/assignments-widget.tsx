"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";

type Assigned = {
  assignmentId: string;
  className: string;
  problemSet: { id: string; slug: string; title: string; totalProblems: number };
  dueAt: string | null;
  completedAt: string | null;
};

export function AssignmentsWidget() {
  const [items, setItems] = useState<Assigned[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/assignments/mine", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { assignments: Assigned[] }) => {
        if (cancelled) return;
        const sorted = d.assignments.slice().sort((a, b) => {
          const aDone = a.completedAt !== null;
          const bDone = b.completedAt !== null;
          if (aDone !== bDone) return aDone ? 1 : -1;
          const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
          const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
          return aDue - bDue;
        });
        setItems(sorted.slice(0, 5));
      })
      .catch(() => setItems([]));
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null || items.length === 0) return null;

  return (
    <section className="panel assignments-widget">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Assigned to you</p>
          <h2>
            <ClipboardList size={18} /> {items.length}
          </h2>
        </div>
      </div>
      <ul>
        {items.map((a) => (
          <li key={a.assignmentId}>
            <Link href={`/problem-sets/${a.problemSet.slug}`}>
              <strong>{a.problemSet.title}</strong>
              <small>{a.className}</small>
              {a.dueAt ? (
                <span className="assignments-widget-due">
                  Due {new Date(a.dueAt).toLocaleDateString()}
                </span>
              ) : null}
              {a.completedAt ? (
                <span className="assignments-widget-done">
                  <CheckCircle2 size={14} /> done
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
