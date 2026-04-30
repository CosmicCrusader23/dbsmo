"use client";

import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";

type Props = {
  targetUserId: string;
  initialIsFriend: boolean;
};

export function FriendButton({ targetUserId, initialIsFriend }: Props) {
  const [isFriend, setIsFriend] = useState(initialIsFriend);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleFriend() {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/friends/${targetUserId}`, { method: "PATCH" });
      const data = (await response.json().catch(() => null)) as {
        isFriend?: boolean;
        error?: string;
      } | null;

      if (!response.ok || typeof data?.isFriend !== "boolean") {
        setError(data?.error ?? "Could not update friend.");
        return;
      }

      setIsFriend(data.isFriend);
    } catch {
      setError("Network error.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <span className="friend-heart-wrap">
      <button
        aria-label={isFriend ? "Remove friend" : "Add friend"}
        aria-pressed={isFriend}
        className={`friend-heart-button${isFriend ? " active" : ""}`}
        data-testid="friend-heart-button"
        disabled={isSaving}
        onClick={toggleFriend}
        title={isFriend ? "Remove friend" : "Add friend"}
        type="button"
      >
        {isSaving ? (
          <Loader2 size={28} className="spin-icon" />
        ) : (
          <Heart size={32} fill={isFriend ? "currentColor" : "none"} />
        )}
      </button>
      {error ? <span className="friend-heart-error">{error}</span> : null}
    </span>
  );
}
