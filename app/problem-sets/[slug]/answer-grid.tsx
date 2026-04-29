"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MessageSquareWarning, RotateCcw, XCircle } from "lucide-react";

type SubmitResult = {
  ok: boolean;
  attemptNumber: number;
  score: number;
  maxScore: number;
  percentage: number;
  results: Array<{
    number: number;
    rawAnswer: string;
    isCorrect: boolean;
    pointsAwarded: number;
  }>;
};

type Props = {
  problemSetId: string;
  problemCount: number;
};

const AUTOSAVE_KEY_PREFIX = "mo-draft-";

export function AnswerGrid({ problemSetId, problemCount }: Props) {
  const problemNumbers = Array.from({ length: problemCount }, (_, i) => i + 1);
  const autosaveKey = `${AUTOSAVE_KEY_PREFIX}${problemSetId}`;

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem(autosaveKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);

  const startTime = useRef(0);

  /* ── Autosave to localStorage ──────────────────────── */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (next: Record<string, string>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        try {
          localStorage.setItem(autosaveKey, JSON.stringify(next));
        } catch {
          /* quota exceeded — skip */
        }
      }, 400);
    },
    [autosaveKey],
  );

  function onAnswerChange(number: number, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [String(number)]: value };
      debouncedSave(next);
      return next;
    });
  }

  /* Record start time + cleanup timer on unmount */
  useEffect(() => {
    startTime.current = Date.now();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  /* ── Submit ────────────────────────────────────────── */
  async function onSubmit() {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitResult(null);

    const durationSeconds = Math.round((Date.now() - startTime.current) / 1000);

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemSetId, answers, durationSeconds }),
      });

      const result = await response.json();

      if (!response.ok) {
        setSubmitError(result.error ?? "Submission failed.");
        return;
      }

      setSubmitResult(result);
      // Clear autosave on successful submission
      try {
        localStorage.removeItem(autosaveKey);
      } catch {
        /* ignore */
      }
    } catch {
      setSubmitError("Network error. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function onRetry() {
    setSubmitResult(null);
    setSubmitError(null);
    startTime.current = Date.now();
  }

  async function onReportSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setReportSubmitting(true);
    setReportError(null);
    setReportSuccess(false);

    const formData = new FormData(e.currentTarget);
    const type = formData.get("type") as string;
    const message = formData.get("message") as string;
    const problemId = formData.get("problemId") as string;

    try {
      const response = await fetch("/api/submit/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemSetId, problemId: problemId || null, type, message }),
      });

      if (!response.ok) {
        const data = await response.json();
        setReportError(data.error || "Failed to submit report");
        return;
      }
      setReportSuccess(true);
      setTimeout(() => setShowReportDialog(false), 2000);
    } catch {
      setReportError("Network error");
    } finally {
      setReportSubmitting(false);
    }
  }

  const filledCount = Object.values(answers).filter((v) => v.trim().length > 0).length;

  const reportDialog = showReportDialog && (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div className="panel" style={{ width: 400, padding: 24 }}>
        <h3 style={{ marginTop: 0 }}>Report Issue</h3>
        {reportSuccess ? (
          <div style={{ color: "var(--color-success)" }}>Report submitted successfully!</div>
        ) : (
          <form
            onSubmit={onReportSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Problem Number
              <select name="problemId" className="form-input">
                <option value="">Whole set issue</option>
                {problemNumbers.map((n) => (
                  <option key={n} value={String(n)}>
                    Problem {n}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Issue Type
              <select name="type" className="form-input" required>
                <option value="WRONG_ANSWER_KEY">Wrong Answer Key</option>
                <option value="WRONG_SOLUTION">Wrong Solution</option>
                <option value="TYPO">Typo</option>
                <option value="UNCLEAR">Unclear Statement</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Description
              <textarea name="message" className="form-input" required rows={3} />
            </label>
            {reportError && <div style={{ color: "var(--color-danger)" }}>{reportError}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="secondary-action"
                onClick={() => setShowReportDialog(false)}
              >
                Cancel
              </button>
              <button type="submit" className="primary-action" disabled={reportSubmitting}>
                Submit
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  /* ── Score result view ─────────────────────────────── */
  if (submitResult) {
    const resultMap = new Map(submitResult.results.map((r) => [r.number, r]));

    return (
      <>
        <div className="score-result">
          <div className="score-ring">
            <span>{submitResult.percentage}%</span>
            <small>
              {submitResult.score}/{submitResult.maxScore}
            </small>
          </div>
          <div className="score-details">
            <strong>Attempt #{submitResult.attemptNumber}</strong>
            <p>
              {submitResult.results.filter((r) => r.isCorrect).length} of{" "}
              {submitResult.results.length} correct
            </p>
          </div>
        </div>

        <div className="answer-grid">
          {problemNumbers.map((number) => {
            const r = resultMap.get(number);
            const cls = r ? (r.isCorrect ? "correct" : "incorrect") : "";
            return (
              <div className={`answer-cell graded ${cls}`} key={number}>
                <span>{number}</span>
                <div className="graded-answer">
                  <span>{r?.rawAnswer || "—"}</span>
                  {r?.isCorrect ? (
                    <CheckCircle2 size={14} className="grade-icon correct-icon" />
                  ) : (
                    <XCircle size={14} className="grade-icon incorrect-icon" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="problem-actions">
          <button
            className="secondary-action"
            type="button"
            onClick={() => setShowReportDialog(true)}
          >
            <MessageSquareWarning size={18} />
            Report issue
          </button>
          <button className="secondary-action" type="button" onClick={onRetry}>
            <RotateCcw size={18} />
            Try again
          </button>
        </div>
        {reportDialog}
      </>
    );
  }

  /* ── Answer entry view ─────────────────────────────── */
  return (
    <>
      <form className="answer-grid" onSubmit={(e) => e.preventDefault()}>
        {problemNumbers.map((number) => (
          <label className="answer-cell" key={number}>
            <span>{number}</span>
            <input
              aria-label={`Answer ${number}`}
              name={`answer-${number}`}
              placeholder="answer"
              value={answers[String(number)] ?? ""}
              onChange={(e) => onAnswerChange(number, e.target.value)}
            />
          </label>
        ))}
      </form>

      <div className="problem-actions">
        <span className="fill-count">
          {filledCount}/{problemCount} answered
        </span>
        <button
          className="secondary-action"
          type="button"
          onClick={() => setShowReportDialog(true)}
        >
          <MessageSquareWarning size={18} />
          Report issue
        </button>
        <button
          className="primary-action"
          type="button"
          disabled={isSubmitting || filledCount === 0}
          onClick={onSubmit}
        >
          {isSubmitting ? <Loader2 size={18} className="spin-icon" /> : <CheckCircle2 size={18} />}
          {isSubmitting ? "Submitting…" : "Submit"}
        </button>
      </div>

      {submitError && (
        <div className="problem-actions">
          <span className="form-error">{submitError}</span>
        </div>
      )}
      {reportDialog}
    </>
  );
}
