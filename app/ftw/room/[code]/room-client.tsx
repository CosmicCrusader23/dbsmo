"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Play,
  Send,
  Users,
  XCircle,
} from "lucide-react";
import { MathCurveLoader } from "@/app/math-curve-loader";
import { LatexStatement } from "@/app/problem-sets/[slug]/latex-statement";
import { PageBackLink } from "@/app/page-back-link";

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
  elapsedMs: number | null;
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
    correctAnswer: string | null;
    myAnswer: {
      submitted: boolean;
      isCorrect: boolean | null;
      points: number;
      elapsedMs: number | null;
    } | null;
    isLastProblem: boolean;
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
  const [advancing, setAdvancing] = useState(false);
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

  async function advanceRound() {
    if (advancing) return;
    setAdvancing(true);
    setError(null);
    try {
      const res = await fetch(`/api/ftw/rooms/${code}/advance`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not advance.");
      }
    } finally {
      setAdvancing(false);
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
        <MathCurveLoader size={28} label="Loading room" />
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
        <PageBackLink destination="FTW" href="/ftw" />
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
                  {joining ? (
                    <MathCurveLoader size={18} label="Joining room" />
                  ) : (
                    <Users size={18} />
                  )}
                  Join room
                </button>
              ) : isHost ? (
                <button type="button" className="primary-action" onClick={startMatch}>
                  <Play size={18} />
                  Start match
                </button>
              ) : (
                <p className="ftw-waiting">
                  <MathCurveLoader size={16} label="Waiting for host" />
                  <span>Waiting for host to start…</span>
                </p>
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
                  className={`ftw-answer-form${
                    state.current.myAnswer?.submitted ? " is-locked" : ""
                  }`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitAnswer();
                  }}
                >
                  <input
                    className="form-input"
                    placeholder={state.current.myAnswer?.submitted ? "answer locked in" : "answer"}
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
                      submitting || !answer.trim() || Boolean(state.current.myAnswer?.submitted)
                    }
                  >
                    {submitting ? (
                      <MathCurveLoader size={18} label="Submitting answer" />
                    ) : (
                      <Send size={18} />
                    )}
                    {state.current.myAnswer?.submitted ? "submitted" : "submit"}
                  </button>
                </form>
              ) : null}

              {state.current.myAnswer?.submitted && !state.current.locked ? (
                <div className="ftw-locked-in is-pending">
                  <MathCurveLoader size={16} label="Waiting for other players" />
                  <span>
                    Locked in
                    {state.current.myAnswer.elapsedMs !== null
                      ? ` at ${(state.current.myAnswer.elapsedMs / 1000).toFixed(1)}s`
                      : ""}
                    . Waiting for others…
                  </span>
                </div>
              ) : null}

              {state.current.locked && state.current.revealedAnswers ? (
                <div className="ftw-reveal">
                  <div className="ftw-reveal-head">
                    <p className="eyebrow">Round results</p>
                    {isHost ? (
                      <button
                        type="button"
                        className="primary-action ftw-next-btn"
                        onClick={advanceRound}
                        disabled={advancing}
                      >
                        {advancing ? (
                          <MathCurveLoader size={16} label="Advancing round" />
                        ) : (
                          <ArrowRight size={16} />
                        )}
                        {state.current.isLastProblem ? "Finish match" : "Next"}
                      </button>
                    ) : (
                      <small className="ftw-reveal-wait">Waiting on host…</small>
                    )}
                  </div>
                  {state.current.correctAnswer ? (
                    <div className="ftw-reveal-answer">
                      <span className="eyebrow">Correct answer</span>
                      <strong>{state.current.correctAnswer}</strong>
                    </div>
                  ) : null}
                  <ul>
                    {state.current.revealedAnswers
                      .slice()
                      .sort((a, b) => {
                        if (a.isCorrect !== b.isCorrect) {
                          return a.isCorrect ? -1 : 1;
                        }
                        const aMs = a.elapsedMs ?? Number.POSITIVE_INFINITY;
                        const bMs = b.elapsedMs ?? Number.POSITIVE_INFINITY;
                        return aMs - bMs;
                      })
                      .map((a, idx) => {
                        const player = state.players.find((p) => p.userId === a.userId);
                        const seconds =
                          a.elapsedMs !== null ? (a.elapsedMs / 1000).toFixed(1) : "—";
                        return (
                          <li key={a.userId} className={a.isCorrect ? "is-correct" : "is-wrong"}>
                            <span className={`ftw-rank rank-${idx + 1}`}>{idx + 1}</span>
                            <span className="ftw-leader-name">{player?.name ?? "—"}</span>
                            <span className="ftw-reveal-time">{seconds}s</span>
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
                <PageBackLink destination="FTW" href="/ftw" />
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
