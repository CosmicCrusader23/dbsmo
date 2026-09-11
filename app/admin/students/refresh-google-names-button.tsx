"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RefreshResult = {
  updated?: number;
  unchanged?: number;
  skipped?: number;
  failed?: number;
};

function count(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function RefreshGoogleNamesButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshNames() {
    setRefreshing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/students/refresh-google-names", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as RefreshResult & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Could not refresh Google names.");
      }

      setMessage(
        `Updated ${count(payload.updated)}; ${count(payload.unchanged)} already current; ${count(payload.skipped)} skipped; ${count(payload.failed)} failed.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not refresh Google names.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="admin-students-refresh-control">
      <button
        className="secondary-action compact"
        data-testid="refresh-google-names-button"
        disabled={refreshing}
        type="button"
        onClick={refreshNames}
      >
        <RefreshCw size={16} className={refreshing ? "admin-students-refresh-icon" : undefined} />
        {refreshing ? "Refreshing…" : "Refresh Google names"}
      </button>
      <span aria-live="polite" className="admin-students-refresh-status">
        {message}
      </span>
    </div>
  );
}
