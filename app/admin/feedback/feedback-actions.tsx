"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Eye, X } from "lucide-react";

type Props = {
  reportId: string;
  currentStatus: string;
  adminNote: string | null;
};

export function FeedbackActions({ reportId, currentStatus, adminNote }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(status: string) {
    setLoading(true);
    try {
      await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, status }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (currentStatus === "RESOLVED" || currentStatus === "REJECTED") {
    return (
      <span style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>
        {adminNote || "Done"}
      </span>
    );
  }

  return (
    <div className="resolve-actions">
      {currentStatus === "OPEN" && (
        <button
          className="btn-sm btn-warning"
          disabled={loading}
          onClick={() => updateStatus("REVIEWING")}
        >
          <Eye size={12} /> Review
        </button>
      )}
      <button
        className="btn-sm btn-success"
        disabled={loading}
        onClick={() => updateStatus("RESOLVED")}
      >
        <Check size={12} /> Resolve
      </button>
      <button
        className="btn-sm btn-danger"
        disabled={loading}
        onClick={() => updateStatus("REJECTED")}
      >
        <X size={12} /> Reject
      </button>
    </div>
  );
}
