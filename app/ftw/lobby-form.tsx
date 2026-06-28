"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Swords, Users, Search } from "lucide-react";
import { MathCurveLoader } from "@/app/math-curve-loader";

type TagOption = { tag: string; count: number };

export function FtwLobbyForm({ tagOptions }: { tagOptions: TagOption[] }) {
  const router = useRouter();
  const [tag, setTag] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "solo" | "host" | "join">("");
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [tagQuery, setTagQuery] = useState("");

  const filteredTags = tagOptions.filter((opt) =>
    opt.tag.toLowerCase().includes(tagQuery.trim().toLowerCase()),
  );

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
      <div className="ftw-lobby-section">
        <div className="ftw-lobby-section-head">
          <div>
            <span className="ftw-lobby-step">1</span>
            <strong>Pick a topic</strong>
          </div>
          <span className="ftw-selected-tag">{tag ?? "Any topic"}</span>
        </div>
        <div className="ftw-tag-search">
          <Search size={14} />
          <input
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            placeholder="Search topics…"
          />
        </div>
        <div className="ftw-tag-row">
          <button
            type="button"
            className={`ftw-tag${tag === null ? " is-active" : ""}`}
            onClick={() => setTag(null)}
          >
            any topic
          </button>
          {filteredTags.map((opt) => (
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
          {filteredTags.length === 0 ? (
            <span className="ftw-tag-empty">No topics match &ldquo;{tagQuery}&rdquo;</span>
          ) : null}
        </div>
      </div>

      <div className="ftw-lobby-section">
        <div className="ftw-lobby-section-head">
          <div>
            <span className="ftw-lobby-step">2</span>
            <strong>Choose a mode</strong>
          </div>
        </div>
        {error ? <p className="ftw-error">{error}</p> : null}
        <div className="ftw-mode-grid">
          <button
            type="button"
            className="ftw-mode-card primary"
            onClick={startSolo}
            disabled={busy !== ""}
          >
            <span className="ftw-mode-icon">
              {busy === "solo" ? (
                <MathCurveLoader size={20} label="Starting solo run" />
              ) : (
                <Play size={20} />
              )}
            </span>
            <strong>Solo run</strong>
            <small>Race the clock alone</small>
          </button>
          <button type="button" className="ftw-mode-card" onClick={hostRoom} disabled={busy !== ""}>
            <span className="ftw-mode-icon">
              {busy === "host" ? (
                <MathCurveLoader size={20} label="Creating room" />
              ) : (
                <Swords size={20} />
              )}
            </span>
            <strong>Host room</strong>
            <small>Invite friends with a code</small>
          </button>
          <form className="ftw-mode-card join" onSubmit={joinRoom}>
            <span className="ftw-mode-icon">
              {busy === "join" ? (
                <MathCurveLoader size={20} label="Joining room" />
              ) : (
                <Users size={20} />
              )}
            </span>
            <strong>Join a room</strong>
            <div className="ftw-join-input-row">
              <input
                className="ftw-code-input"
                placeholder="CODE"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={5}
                disabled={busy !== ""}
              />
              <button
                type="submit"
                className="ftw-join-go"
                disabled={busy !== "" || !joinCode.trim()}
              >
                Go
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
