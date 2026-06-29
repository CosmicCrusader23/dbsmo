"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { MathCurveLoader } from "@/app/math-curve-loader";

export function DeleteAnnouncementButton({ announcementId }: { announcementId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAnnouncement() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/announcements/${announcementId}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Delete failed.");
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Delete request failed.");
    } finally {
      setDeleting(false);
    }
  }

  if (confirming) {
    return (
      <span className="announcement-delete-confirm">
        <button
          className="danger-action compact"
          type="button"
          disabled={deleting}
          onClick={deleteAnnouncement}
        >
          {deleting ? (
            <MathCurveLoader size={14} label="Deleting announcement" />
          ) : (
            <Trash2 size={14} />
          )}
          Delete
        </button>
        <button
          className="secondary-action compact"
          type="button"
          disabled={deleting}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
        >
          <X size={14} />
          Cancel
        </button>
        {error ? <small className="form-error">{error}</small> : null}
      </span>
    );
  }

  return (
    <button
      className="secondary-action compact announcement-delete-button"
      type="button"
      onClick={() => setConfirming(true)}
    >
      <Trash2 size={14} />
      Delete
    </button>
  );
}
