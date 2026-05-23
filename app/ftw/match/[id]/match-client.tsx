"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Hourglass, Loader2, Send, Timer, XCircle } from "lucide-react";
import { LatexStatement } from "@/app/problem-sets/[slug]/latex-statement";

type ProblemPayload = {
  id: string;
  statement: string;
  contentFormat: "LATEX" | "HTML";
};

type FetchResponse =
  | {
      problem: ProblemPayload;
      problemIndex: number;
      totalProblems: number;
      servedAt: string;
      limitSeconds: number;
      remainingMs: number;
      score: number;
    }
  | { timedOut: true; problemIndex: number; nextIndex: number }
  | {
      done: true;
      match: {
        id: string;
        status: "COMPLETED" | "ABANDONED" | "IN_PROGRESS";
        totalProblems: number;
        problemsServed: number;
        totalScore: number;
        maxScore: number;
        completedAt?: string | null;
      };
    };

type SubmitResponse = {
  isCorrect: boolean;
  points: number;
  elapsedMs: number;
  timedOut: boolean;
  totalScore: number;
  matchStatus: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
};

type Feedback =
  | { kind: "correct"; points: number; elapsedMs: number }
  | { kind: "wrong" }
  | { kind: "timeout" };

type Props = {
  matchId: string;
  tag: string | null;
  totalProblems: number;
  maxScore: number;
  initialStatus: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
};

export function FtwMatchClient({ matchId, tag, totalProblems, maxScore, initialStatus }: Props) {
  const [problem, setProblem] = useState<ProblemPayload | null>(null);
  const [problemIndex, setProblemIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [done, setDone] = useState(initialStatus !== "IN_PROGRESS");
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [limitMs, setLimitMs] = useState(45000);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const tickRef = useRef<number | null>(null);

  async function fetchProblem() {
    setFeedback(null);
    setAnswer("");
    setProblem(null);
    const res = await fetch(`/api/ftw/matches/${matchId}/problem`, { cache: "no-store" });
    const data: FetchResponse = await res.json();
    if ("done" in data && data.done) {
      setDone(true);
      setFinalScore(data.match.totalScore);
      return;
    }
    if ("timedOut" in data && data.timedOut) {
      setFeedback({ kind: "timeout" });
      window.setTimeout(() => void fetchProblem(), 900);
      return;
    }
    if ("problem" in data) {
      setProblem(data.problem);
      setProblemIndex(data.problemIndex);
      setScore(data.score);
      setLimitMs(data.limitSeconds * 1000);
      setRemainingMs(data.remainingMs);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }

  useEffect(() => {
    if (initialStatus === "IN_PROGRESS") {
      void fetchProblem();
    }
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!problem) return;
    if (tickRef.current) window.clearInterval(tickRef.current);
    const start = Date.now();
    const initial = remainingMs;
    tickRef.current = window.setInterval(() => {
      const next = Math.max(0, initial - (Date.now() - start));
      setRemainingMs(next);
      if (next <= 0) {
        if (tickRef.current) window.clearInterval(tickRef.current);
        void submitAnswer(true);
      }
    }, 100);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem?.id]);

  async function submitAnswer(forceTimeout = false) {
    if (!problem || submitting) return;
    if (!forceTimeout && !answer.trim()) return;
    setSubmitting(true);
    if (tickRef.current) window.clearInterval(tickRef.current);
    try {
      const res = await fetch(`/api/ftw/matches/${matchId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemIndex, answer: forceTimeout ? "" : answer }),
      });
      const data: SubmitResponse = await res.json();
      setScore(data.totalScore);
      if (data.timedOut) {
        setFeedback({ kind: "timeout" });
      } else if (data.isCorrect) {
        setFeedback({ kind: "correct", points: data.points, elapsedMs: data.elapsedMs });
      } else {
        setFeedback({ kind: "wrong" });
      }
      if (data.matchStatus === "COMPLETED") {
        window.setTimeout(() => {
          setDone(true);
          setFinalScore(data.totalScore);
        }, 1100);
        return;
      }
      window.setTimeout(() => void fetchProblem(), 1100);
    } catch {
      setFeedback({ kind: "wrong" });
    } finally {
      setSubmitting(false);
    }
  }

  const percent = useMemo(() => Math.round((remainingMs / limitMs) * 100), [remainingMs, limitMs]);
  const seconds = Math.ceil(remainingMs / 1000);

  if (done) {
    const ratio = maxScore > 0 ? Math.round(((finalScore ?? score) / maxScore) * 100) : 0;
    return (
      <section className="panel ftw-result">
        <Hourglass size={32} />
        <p className="eyebrow">Match complete</p>
        <h2>{finalScore ?? score} / {maxScore}</h2>
        <p className="ftw-result-pct">{ratio}%</p>
        <p className="ftw-result-tag">{tag ?? "any topic"}</p>
        <div className="ftw-result-actions">
          <Link href="/ftw" className="primary-action">
            Play again <ArrowRight size={18} />
          </Link>
          <Link href="/dashboard" className="secondary-action">
            Dashboard
          </Link>
        </div>
      </section>
    );
  }

  if (!problem) {
    return (
      <section className="panel ftw-loading">
        <Loader2 className="spin-icon" size={28} />
        <p>Loading next problem.</p>
      </section>
    );
  }

  const lowTime = remainingMs <= 10000;
  const barColor = lowTime ? "var(--color-danger)" : "var(--color-pink)";

  return (
    <section className="panel ftw-arena">
      <header className="ftw-arena-head">
        <div>
          <p className="eyebrow">Problem {problemIndex + 1} of {totalProblems}</p>
          <h2>{tag ?? "any topic"}</h2>
        </div>
        <div className="ftw-score-chip">
          <small>score</small>
          <strong>{score}</strong>
          <span>/ {maxScore}</span>
        </div>
      </header>

      <div className={`ftw-timer${lowTime ? " is-low" : ""}`}>
        <div className="ftw-timer-track">
          <span style={{ width: `${percent}%`, background: barColor }} />
        </div>
        <div className="ftw-timer-text">
          <Timer size={16} />
          <strong>{seconds}s</strong>
        </div>
      </div>

      <div className="ftw-statement">
        <LatexStatement statement={problem.statement} format={problem.contentFormat} />
      </div>

      <form
        className="ftw-answer-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submitAnswer();
        }}
      >
        <input
          ref={inputRef}
          className="form-input"
          placeholder="answer"
          value={answer}
          autoComplete="off"
          autoFocus
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitting || feedback !== null}
        />
        <button
          type="submit"
          className="primary-action"
          disabled={submitting || !answer.trim() || feedback !== null}
        >
          {submitting ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />}
          submit
        </button>
      </form>

      {feedback ? (
        <div className={`ftw-feedback feedback-${feedback.kind}`}>
          {feedback.kind === "correct" ? (
            <>
              <CheckCircle2 size={20} />
              <span>+{feedback.points} pts in {(feedback.elapsedMs / 1000).toFixed(1)}s</span>
            </>
          ) : feedback.kind === "timeout" ? (
            <>
              <Hourglass size={20} />
              <span>time&apos;s up</span>
            </>
          ) : (
            <>
              <XCircle size={20} />
              <span>not quite</span>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
