"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Eye, Trash2, X } from "lucide-react";
import { MathCurveLoader } from "@/app/math-curve-loader";

type Props = {
  reportId: string;
  currentStatus: string;
  adminNote: string | null;
};

export function FeedbackActions({ reportId, currentStatus, adminNote }: Props) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const loading = loadingAction !== null;

  async function updateStatus(status: string) {
    setLoadingAction(status);
    try {
      await fetch(`/api/admin/feedback/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setLoadingAction(null);
    }
  }

  async function deleteReport() {
    setLoadingAction("DELETE");
    try {
      await fetch(`/api/admin/feedback/${reportId}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setLoadingAction(null);
    }
  }

  if (currentStatus === "RESOLVED" || currentStatus === "REJECTED") {
    return (
      <div className="resolve-actions">
        <span style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>
          {adminNote || "Done"}
        </span>
        <button className="btn-sm btn-danger" disabled={loading} onClick={deleteReport}>
          {loadingAction === "DELETE" ? (
            <MathCurveLoader size={12} label="Deleting report" />
          ) : (
            <Trash2 size={12} />
          )}{" "}
          Delete
        </button>
      </div>
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
          {loadingAction === "REVIEWING" ? (
            <MathCurveLoader size={12} label="Marking report for review" />
          ) : (
            <Eye size={12} />
          )}{" "}
          Review
        </button>
      )}
      <button
        className="btn-sm btn-success"
        disabled={loading}
        onClick={() => updateStatus("RESOLVED")}
      >
        {loadingAction === "RESOLVED" ? (
          <MathCurveLoader size={12} label="Resolving report" />
        ) : (
          <Check size={12} />
        )}{" "}
        Resolve
      </button>
      <button
        className="btn-sm btn-danger"
        disabled={loading}
        onClick={() => updateStatus("REJECTED")}
      >
        {loadingAction === "REJECTED" ? (
          <MathCurveLoader size={12} label="Rejecting report" />
        ) : (
          <X size={12} />
        )}{" "}
        Reject
      </button>
    </div>
  );
}
