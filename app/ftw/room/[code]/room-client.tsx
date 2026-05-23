"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Loader2, Play, Send, Users, XCircle } from "lucide-react";
import { LatexStatement } from "@/app/problem-sets/[slug]/latex-statement";

type Player = {
  id: string;
  userId: string;
  name: string;
  score: number;
  hasAnsweredCurrent: boolean;
  isYou: boolean;
};

type RevealedAnswer = {
  userId: string;
  submittedAt: string | null;
  isCorrect: boolean | null;
  points: number;
};

type RoomState = {
  code: string;
  status: "LOBBY" | "IN_PROGRESS" | "COMPLETED";
  hostId: string;
  isHost: boolean;
  tag: string | null;
  totalProblems: number;
  problemLimitMs: number;
  maxScorePerProblem: number;
  currentIndex: number;
  players: Player[];
  current: {
    problemIndex: number;
    endsAt: string;
    locked: boolean;
    remainingMs: number;
    problem: { id: string; statement: string; contentFormat: "LATEX" | "HTML" } | null;
    revealedAnswers: RevealedAnswer[] | null;
    myAnswer: { submitted: boolean; isCorrect: boolean | null; points: number } | null;
  } | null;
  completedAt: string | null;
};

export function FtwRoomClient({
  code,
  isMember,
  isHost,
  userId,
}: {
  code: string;
  isMember: boolean;
  isHost: boolean;
  userId: string;
}) {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(isMember);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastIndex = useRef(-2);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch(`/api/ftw/rooms/${code}/state`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setError((await res.json()).error ?? "Failed to load room.");
          return;
        }
        const data = (await res.json()) as RoomState;
        if (cancelled) return;
        setState(data);
        if (data.current && data.current.problemIndex !== lastIndex.current) {
          lastIndex.current = data.current.problemIndex;
          setAnswer("");
        }
      } catch {
        if (!cancelled) setError("Network error.");
      }
    }
    void tick();
    const iv = window.setInterval(tick, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [code]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(t);
  }, []);

  async function joinRoom() {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/ftw/rooms/${code}/join`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not join.");
        return;
      }
      setJoined(true);
    } finally {
      setJoining(false);
    }
  }

  async function startMatch() {
    setError(null);
    const res = await fetch(`/api/ftw/rooms/${code}/start`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not start.");
    }
  }

  async function submitAnswer() {
    if (!state?.current?.problem) return;
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ftw/rooms/${code}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemIndex: state.current.problemIndex,
          answer,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Submit failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function copyCode() {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const sortedPlayers = useMemo(
    () => (state ? [...state.players].sort((a, b) => b.score - a.score) : []),
    [state],
  );

  const remainingMs =
    state?.current && !state.current.locked
      ? Math.max(0, new Date(state.current.endsAt).getTime() - now)
      : 0;
  const limitMs = state?.problemLimitMs ?? 45000;
  const remainingPct = Math.max(0, Math.min(100, (remainingMs / limitMs) * 100));
  const lowTime = remainingMs <= 10000 && remainingMs > 0;

  if (!state) {
    return (
      <section className="panel ftw-loading">
        <Loader2 className="spin-icon" size={28} />
        <p>{error ?? "Loading room…"}</p>
      </section>
    );
  }

  const totalScored = state.totalProblems * state.maxScorePerProblem;

  return (
    <section className="ftw-room">
      <header className="topbar standalone">
        <div>
          <p className="eyebrow">Room</p>
          <h1 className="ftw-room-code">
            {state.code}
            <button type="button" onClick={copyCode} className="ftw-copy" aria-label="Copy code">
              <Copy size={14} />
              {copied ? "copied" : "copy"}
            </button>
          </h1>
        </div>
        <Link className="secondary-action" href="/ftw">
          <ArrowLeft size={18} />
          Lobby
        </Link>
      </header>

      <div className="ftw-room-grid">
        <div className="ftw-room-main">
          {state.status === "LOBBY" ? (
            <section className="panel ftw-stage-lobby">
              <p className="eyebrow">Waiting room</p>
              <h2>{state.tag ?? "any topic"}</h2>
              <p className="ftw-stage-sub">
                {state.totalProblems} problems · {Math.round(state.problemLimitMs / 1000)}s each
              </p>
              {!joined ? (
                <button
                  type="button"
                  className="primary-action"
                  onClick={joinRoom}
                  disabled={joining}
                >
                  {joining ? <Loader2 size={18} className="spin-icon" /> : <Users size={18} />}
                  Join room
                </button>
              ) : isHost ? (
                <button type="button" className="primary-action" onClick={startMatch}>
                  <Play size={18} />
                  Start match
                </button>
              ) : (
                <p className="ftw-waiting">Waiting for host to start…</p>
              )}
            </section>
          ) : state.status === "IN_PROGRESS" && state.current ? (
            <section className="panel ftw-arena">
              <header className="ftw-arena-head">
                <div>
                  <p className="eyebrow">
                    Problem {state.current.problemIndex + 1} of {state.totalProblems}
                  </p>
                  <h2>{state.tag ?? "any topic"}</h2>
                </div>
              </header>

              <div className={`ftw-timer${lowTime ? " is-low" : ""}`}>
                <div className="ftw-timer-track">
                  <span
                    style={{
                      width: `${state.current.locked ? 0 : remainingPct}%`,
                      background: lowTime ? "var(--color-danger)" : "var(--color-pink)",
                    }}
                  />
                </div>
                <div className="ftw-timer-text">
                  <strong>{state.current.locked ? 0 : Math.ceil(remainingMs / 1000)}s</strong>
                </div>
              </div>

              {state.current.problem ? (
                <div className="ftw-statement">
                  <LatexStatement
                    statement={state.current.problem.statement}
                    format={state.current.problem.contentFormat}
                  />
                </div>
              ) : state.current.locked ? (
                <div className="ftw-statement ftw-locked">
                  <p>Locked. Next problem coming up…</p>
                </div>
              ) : null}

              {!state.current.locked && joined ? (
                <form
                  className="ftw-answer-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitAnswer();
                  }}
                >
                  <input
                    className="form-input"
                    placeholder="answer"
                    value={answer}
                    autoComplete="off"
                    autoFocus
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={submitting || Boolean(state.current.myAnswer?.submitted)}
                  />
                  <button
                    type="submit"
                    className="primary-action"
                    disabled={
                      submitting ||
                      !answer.trim() ||
                      Boolean(state.current.myAnswer?.submitted)
                    }
                  >
                    {submitting ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />}
                    submit
                  </button>
                </form>
              ) : null}

              {state.current.myAnswer?.submitted && !state.current.locked ? (
                <p className="ftw-locked-in">
                  Locked in. Waiting for others…
                </p>
              ) : null}

              {state.current.locked && state.current.revealedAnswers ? (
                <div className="ftw-reveal">
                  <p className="eyebrow">Round results</p>
                  <ul>
                    {state.current.revealedAnswers
                      .slice()
                      .sort((a, b) => b.points - a.points)
                      .map((a) => {
                        const player = state.players.find((p) => p.userId === a.userId);
                        return (
                          <li key={a.userId}>
                            <span>{player?.name ?? "—"}</span>
                            {a.isCorrect ? (
                              <CheckCircle2 size={16} color="var(--color-success)" />
                            ) : (
                              <XCircle size={16} color="var(--color-danger)" />
                            )}
                            <strong>+{a.points}</strong>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="panel ftw-result">
              <p className="eyebrow">Match complete</p>
              <h2>{sortedPlayers[0]?.name ?? "—"} wins</h2>
              <p className="ftw-result-pct">
                {sortedPlayers[0]?.score ?? 0} / {totalScored}
              </p>
              <div className="ftw-result-actions">
                <Link href="/ftw" className="primary-action">
                  Back to lobby
                </Link>
              </div>
            </section>
          )}
          {error ? <p className="ftw-error">{error}</p> : null}
        </div>

        <aside className="panel ftw-scoreboard">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Players</p>
              <h2>scoreboard</h2>
            </div>
            <Users size={18} />
          </div>
          <ul>
            {sortedPlayers.map((p, i) => (
              <li key={p.id} className={p.userId === userId ? "is-you" : ""}>
                <span className={`ftw-rank rank-${i + 1}`}>{i + 1}</span>
                <span className="ftw-leader-name">
                  {p.name}
                  {p.userId === userId ? " (you)" : ""}
                </span>
                {state.status === "IN_PROGRESS" && state.current && !state.current.locked ? (
                  p.hasAnsweredCurrent ? (
                    <CheckCircle2 size={14} color="var(--color-success)" />
                  ) : (
                    <span className="ftw-thinking">…</span>
                  )
                ) : null}
                <strong>{p.score}</strong>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
