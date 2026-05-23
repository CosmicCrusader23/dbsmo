"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";

type TagOption = { tag: string; count: number };

export function FtwLobbyForm({ tagOptions }: { tagOptions: TagOption[] }) {
  const router = useRouter();
  const [tag, setTag] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ftw/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start match.");
        setBusy(false);
        return;
      }
      router.push(`/ftw/match/${data.matchId}`);
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return (
    <div className="ftw-lobby">
      <div className="ftw-tag-row">
        <button
          type="button"
          className={`ftw-tag${tag === null ? " is-active" : ""}`}
          onClick={() => setTag(null)}
        >
          any topic
        </button>
        {tagOptions.map((opt) => (
          <button
            type="button"
            key={opt.tag}
            className={`ftw-tag${tag === opt.tag ? " is-active" : ""}`}
            onClick={() => setTag(opt.tag)}
          >
            {opt.tag}
            <span>{opt.count}</span>
          </button>
        ))}
      </div>
      {error ? <p className="ftw-error">{error}</p> : null}
      <button type="button" className="primary-action ftw-start" onClick={start} disabled={busy}>
        {busy ? <Loader2 size={18} className="spin-icon" /> : <Play size={18} />}
        Start match
      </button>
    </div>
  );
}
