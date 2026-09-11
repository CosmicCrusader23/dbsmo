"use client";

import { GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RecalculateResult = {
  updated?: number;
  unchanged?: number;
  skipped?: number;
  failed?: number;
  schoolYear?: string;
};

function count(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function RecalculateGradesButton() {
  const router = useRouter();
  const [recalculating, setRecalculating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function recalculateGrades() {
    setRecalculating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/students/recalculate-grades", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as RecalculateResult & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Could not recalculate grades.");

      setMessage(
        `School year ${payload.schoolYear ?? "current"}: updated ${count(payload.updated)}; ${count(payload.unchanged)} already current; ${count(payload.skipped)} skipped; ${count(payload.failed)} failed.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not recalculate grades.");
    } finally {
      setRecalculating(false);
    }
  }

  return (
    <div className="admin-students-refresh-control">
      <button
        className="secondary-action compact"
        data-testid="recalculate-grades-button"
        disabled={recalculating}
        type="button"
        onClick={recalculateGrades}
      >
        <GraduationCap size={16} />
        {recalculating ? "Recalculating…" : "Recalculate grades"}
      </button>
      <span aria-live="polite" className="admin-students-refresh-status">
        {message}
      </span>
    </div>
  );
}
