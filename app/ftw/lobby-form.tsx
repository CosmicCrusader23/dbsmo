"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Swords, Users } from "lucide-react";

type TagOption = { tag: string; count: number };

export function FtwLobbyForm({ tagOptions }: { tagOptions: TagOption[] }) {
  const router = useRouter();
  const [tag, setTag] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "solo" | "host" | "join">("");
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");

  async function startSolo() {
    setBusy("solo");
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
        setBusy("");
        return;
      }
      router.push(`/ftw/match/${data.matchId}`);
    } catch {
      setError("Network error.");
      setBusy("");
    }
  }

  async function hostRoom() {
    setBusy("host");
    setError(null);
    try {
      const res = await fetch("/api/ftw/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create room.");
        setBusy("");
        return;
      }
      router.push(`/ftw/room/${data.code}`);
    } catch {
      setError("Network error.");
      setBusy("");
    }
  }

  async function joinRoom(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = joinCode.trim().toUpperCase();
    if (!trimmed) return;
    setBusy("join");
    setError(null);
    try {
      const res = await fetch(`/api/ftw/rooms/${trimmed}/join`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not join.");
        setBusy("");
        return;
      }
      router.push(`/ftw/room/${data.code}`);
    } catch {
      setError("Network error.");
      setBusy("");
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

      <div className="ftw-mode-row">
        <button type="button" className="primary-action" onClick={startSolo} disabled={busy !== ""}>
          {busy === "solo" ? <Loader2 size={18} className="spin-icon" /> : <Play size={18} />}
          Solo run
        </button>
        <button type="button" className="secondary-action" onClick={hostRoom} disabled={busy !== ""}>
          {busy === "host" ? <Loader2 size={18} className="spin-icon" /> : <Swords size={18} />}
          Host room
        </button>
      </div>

      <form className="ftw-join-row" onSubmit={joinRoom}>
        <Users size={16} />
        <input
          className="form-input ftw-code-input"
          placeholder="enter code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={5}
          disabled={busy !== ""}
        />
        <button type="submit" className="secondary-action" disabled={busy !== "" || !joinCode.trim()}>
          {busy === "join" ? <Loader2 size={18} className="spin-icon" /> : "Join"}
        </button>
      </form>
    </div>
  );
}
