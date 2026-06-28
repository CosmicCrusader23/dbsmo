"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { MathCurveLoader } from "@/app/math-curve-loader";

type BookmarkButtonProps = {
  problemSetId: string;
  initialBookmarked: boolean;
};

export function BookmarkButton({ problemSetId, initialBookmarked }: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleBookmark() {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/problem-sets/${problemSetId}/bookmark`, {
        method: isBookmarked ? "DELETE" : "PUT",
      });
      const data = (await response.json().catch(() => null)) as {
        bookmarked?: boolean;
        error?: string;
      } | null;

      if (!response.ok || typeof data?.bookmarked !== "boolean") {
        setError(data?.error ?? "Could not update bookmark.");
        return;
      }

      setIsBookmarked(data.bookmarked);
    } catch {
      setError("Network error.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <span className="bookmark-star-wrap">
      <button
        aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
        aria-pressed={isBookmarked}
        className={`bookmark-star-button${isBookmarked ? " active" : ""}`}
        data-testid="bookmark-star-button"
        disabled={isSaving}
        onClick={toggleBookmark}
        title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
        type="button"
      >
        {isSaving ? (
          <MathCurveLoader size={22} label="Saving bookmark" />
        ) : (
          <Star size={24} fill={isBookmarked ? "currentColor" : "none"} />
        )}
      </button>
      {error ? <span className="bookmark-star-error">{error}</span> : null}
    </span>
  );
}
