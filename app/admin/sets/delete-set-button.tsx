"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

type DeleteSetButtonProps = {
  setId: string;
  title: string;
  status: string;
  redirectTo?: string;
};

export function DeleteSetButton({ setId, title, status, redirectTo }: DeleteSetButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = status === "DRAFT" || status === "PUBLISHED";

  if (!canDelete) {
    return null;
  }

  async function onDelete() {
    const confirmed = window.confirm(
      `Delete "${title}"?\n\nThis permanently removes the set, all attempts, responses, and feedback for it.`,
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/sets/${setId}`, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? "Delete failed.");
        return;
      }

      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch {
      setError("Delete request failed.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <span className="delete-set-action">
      <button
        className="secondary-action compact danger-action"
        data-testid="delete-set-button"
        type="button"
        disabled={isDeleting}
        onClick={onDelete}
      >
        {isDeleting ? <Loader2 size={14} className="spin-icon" /> : <Trash2 size={14} />}
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
      {error ? <small className="form-error">{error}</small> : null}
    </span>
  );
}
