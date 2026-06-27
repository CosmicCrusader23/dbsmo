"use client";

import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MessageSquareWarning, RotateCcw, XCircle } from "lucide-react";
import { LatexStatement } from "./latex-statement";

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

type ProblemSummary = {
  number: number;
  statement: string;
  topicTags: string[];
  explanationNote: string | null;
  contentFormat: "LATEX" | "HTML";
};

type Props = {
  problemSetId: string;
  problemNumbers: number[];
  problemSummaries?: ProblemSummary[];
  videoUrl?: string | null;
  lockedAttemptNumber?: number | null;
  assets?: Record<string, string>;
  answerLayout?: "standard" | "test";
};

const AUTOSAVE_KEY_PREFIX = "mo-draft-";
const REVIEW_KEY_PREFIX = "mo-review-";

export function buildTestQuestionRows(problemNumbers: number[]) {
  return Array.from({ length: Math.ceil(problemNumbers.length / 3) }, (_, rowIndex) => {
    const problemIndex = rowIndex + 1;
    return {
      problemIndex,
      cells: problemNumbers
        .slice(rowIndex * 3, rowIndex * 3 + 3)
        .map((problemNumber, cellIndex) => ({
          problemNumber,
          problemIndex,
          level: cellIndex + 1,
          label: `${problemIndex}(${cellIndex + 1})`,
        })),
    };
  });
}

export function AnswerGrid({
  problemSetId,
  problemNumbers,
  problemSummaries = [],
  videoUrl = null,
  lockedAttemptNumber = null,
  assets,
  answerLayout = "standard",
}: Props) {
  const autosaveKey = `${AUTOSAVE_KEY_PREFIX}${problemSetId}`;
  const reviewKey = `${REVIEW_KEY_PREFIX}${problemSetId}`;

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
  const [reviewLater, setReviewLater] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem(reviewKey);
      return new Set(saved ? (JSON.parse(saved) as number[]) : []);
    } catch {
      return new Set();
    }
  });

  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);
  const isSubmissionLocked = lockedAttemptNumber !== null;
  const lockedMessage = lockedAttemptNumber
    ? `Attempt #${lockedAttemptNumber} solved this set, so submissions are locked.`
    : null;

  const startTime = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (next: Record<string, string>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        try {
          localStorage.setItem(autosaveKey, JSON.stringify(next));
        } catch {
          /* quota exceeded */
        }
      }, 400);
    },
    [autosaveKey],
  );

  function onAnswerChange(number: number, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [number]: value };
      debouncedSave(next);
      return next;
    });
  }

  useEffect(() => {
    startTime.current = Date.now();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  async function onSubmit() {
    if (isSubmissionLocked) {
      setSubmitError(lockedMessage);
      return;
    }

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
    if (isSubmissionLocked) {
      setSubmitError(lockedMessage);
      return;
    }

    setSubmitResult(null);
    setSubmitError(null);
    startTime.current = Date.now();
  }

  function toggleReviewLater(problemNumber: number) {
    setReviewLater((current) => {
      const next = new Set(current);
      if (next.has(problemNumber)) {
        next.delete(problemNumber);
      } else {
        next.add(problemNumber);
      }

      try {
        localStorage.setItem(reviewKey, JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }

      return next;
    });
  }

  async function onReportSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setReportSubmitting(true);
    setReportError(null);
    setReportSuccess(false);

    const formData = new FormData(e.currentTarget);
    const type = formData.get("type") as string;
    const message = formData.get("message") as string;
    const problemNumber = formData.get("problemNumber") as string;

    try {
      const response = await fetch("/api/submit/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemSetId,
          problemNumber: problemNumber ? problemNumber : null,
          type,
          message,
        }),
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

  const filledCount = Object.values(answers).filter((value) => value.trim().length > 0).length;
  const isPerfectResult =
    submitResult !== null &&
    submitResult.maxScore > 0 &&
    submitResult.score === submitResult.maxScore;
  const problemSummaryMap = new Map(problemSummaries.map((problem) => [problem.number, problem]));
  const testRows = answerLayout === "test" ? buildTestQuestionRows(problemNumbers) : [];
  const isTestLayout = testRows.length > 0;
  const testLabelMap = new Map(
    testRows.flatMap((row) => row.cells.map((cell) => [cell.problemNumber, cell.label])),
  );
  const hasInlineStatements =
    answerLayout !== "test" &&
    problemNumbers.every((number) => {
      const statement = problemSummaryMap.get(number)?.statement ?? "";
      return statement.trim().length > 0;
    });
  const resultMap = submitResult
    ? new Map(submitResult.results.map((result) => [result.number, result]))
    : null;
  const missedResults = submitResult
    ? submitResult.results.filter((result) => !result.isCorrect)
    : [];
  const missedTopicCounts = new Map<string, number>();

  for (const result of missedResults) {
    const summary = problemSummaryMap.get(result.number);
    const topics = summary?.topicTags.length ? summary.topicTags : ["General"];
    for (const topic of topics) {
      missedTopicCounts.set(topic, (missedTopicCounts.get(topic) ?? 0) + 1);
    }
  }

  const missedTopics = Array.from(missedTopicCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3);
  const primaryMissedTopic = missedTopics[0]?.[0] ?? null;
  const nextAction = isPerfectResult
    ? "Move to the next set or keep this one as solved."
    : primaryMissedTopic
      ? `Review ${primaryMissedTopic}, then retry this set.`
      : videoUrl
        ? "Watch the teaching video, then retry this set."
        : "Retry this set while the questions are fresh.";

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
              <select name="problemNumber" className="form-input">
                <option value="">Whole set issue</option>
                {problemNumbers.map((number) => (
                  <option key={number} value={String(number)}>
                    Problem {questionLabel(number)}
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
            {reportError ? <div style={{ color: "var(--color-danger)" }}>{reportError}</div> : null}
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

  function jumpHref(problemNumber: number) {
    return `#problem-${problemNumber}`;
  }

  function questionLabel(problemNumber: number) {
    return testLabelMap.get(problemNumber) ?? String(problemNumber);
  }

  function jumpButtonState(problemNumber: number) {
    const trimmedAnswer = answers[problemNumber]?.trim() ?? "";
    const result = resultMap?.get(problemNumber);

    if (result) {
      return result.isCorrect ? "correct" : "incorrect";
    }
    if (trimmedAnswer) {
      return "filled";
    }
    return "";
  }

  function renderJumpGrid(className?: string) {
    return (
      <div className={`problem-jump-grid${className ? ` ${className}` : ""}`}>
        {problemNumbers.map((number) => (
          <a
            className={`problem-jump-button ${jumpButtonState(number)}`.trim()}
            href={jumpHref(number)}
            key={number}
          >
            {isTestLayout ? questionLabel(number) : `Q${number}`}
          </a>
        ))}
      </div>
    );
  }

  function renderTestJumpGrid() {
    if (!isTestLayout) {
      return null;
    }

    return (
      <section className="problem-jump-strip problem-jump-toolbar test-jump-toolbar">
        <div className="problem-jump-strip-head problem-jump-toolbar-head">
          <div>
            <p className="eyebrow">Problem Grid</p>
            <h3>Jump to question</h3>
          </div>
        </div>
        {renderJumpGrid("test-jump-grid")}
      </section>
    );
  }

  function renderTopActions() {
    if (isSubmissionLocked) {
      return (
        <>
          <span className="fill-count locked-fill-count">{lockedMessage}</span>
          <button
            className="secondary-action"
            type="button"
            onClick={() => setShowReportDialog(true)}
          >
            <MessageSquareWarning size={18} />
            Report issue
          </button>
        </>
      );
    }

    if (submitResult) {
      return (
        <>
          <span className="fill-count">
            {submitResult.results.filter((result) => result.isCorrect).length}/
            {submitResult.results.length} correct
          </span>
          <button
            className="secondary-action"
            type="button"
            onClick={() => setShowReportDialog(true)}
          >
            <MessageSquareWarning size={18} />
            Report issue
          </button>
          {!isPerfectResult ? (
            <button className="secondary-action" type="button" onClick={onRetry}>
              <RotateCcw size={18} />
              Try again
            </button>
          ) : null}
        </>
      );
    }

    return (
      <>
        <span className="fill-count">
          {filledCount}/{problemNumbers.length} answered
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
          {isSubmitting ? "Submitting…" : "Submit set"}
        </button>
      </>
    );
  }

  function renderInlineWorkspace() {
    return (
      <>
        <div className="problem-workspace">
          <div className="problem-flow">
            <section className="problem-jump-strip problem-jump-toolbar">
              <div className="problem-jump-strip-head problem-jump-toolbar-head">
                <div>
                  <p className="eyebrow">Problem Grid</p>
                  <h3>Jump to question</h3>
                </div>
              </div>
              <div className="problem-toolbar-actions">{renderTopActions()}</div>
              {renderJumpGrid()}
              {submitError ? <span className="form-error">{submitError}</span> : null}
            </section>

            {problemNumbers.map((number) => {
              const summary = problemSummaryMap.get(number);
              const result = resultMap?.get(number);
              const stateClass = result ? (result.isCorrect ? "correct" : "incorrect") : "";
              const draftState =
                !isSubmissionLocked && !submitResult && (answers[number]?.trim() ?? "").length > 0;

              return (
                <section
                  className={`problem-question-card ${stateClass}`.trim()}
                  id={`problem-${number}`}
                  key={number}
                >
                  <div className="question-card-head">
                    <div className="question-card-heading">
                      <span className="statement-number">Q{number}</span>
                      <div className="question-card-meta">
                        <strong>Question {number}</strong>
                        {summary?.topicTags.length ? (
                          <div className="missed-topic-list">
                            {summary.topicTags.map((topic) => (
                              <span key={`${number}-${topic}`}>{topic}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="question-card-actions">
                      {submitResult && result ? (
                        <span
                          className={`question-status-badge ${result.isCorrect ? "correct" : "incorrect"}`}
                        >
                          {result.isCorrect ? "Correct" : "Incorrect"}
                        </span>
                      ) : draftState ? (
                        <span className="question-status-badge filled">Draft</span>
                      ) : null}

                      {submitResult && result && !result.isCorrect ? (
                        <button
                          className="secondary-action compact"
                          type="button"
                          onClick={() => toggleReviewLater(number)}
                        >
                          {reviewLater.has(number) ? "Review saved" : "Review later"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {summary ? (
                    <div className="statement-text">
                      <LatexStatement
                        statement={summary.statement}
                        format={summary.contentFormat}
                        assets={assets}
                      />
                    </div>
                  ) : null}

                  <label className="question-answer-block">
                    <span className="question-answer-label">Answer</span>
                    {submitResult ? (
                      <div className={`question-graded-box ${stateClass}`.trim()}>
                        <span className="question-graded-value">{result?.rawAnswer || "—"}</span>
                        {result?.isCorrect ? (
                          <CheckCircle2 size={16} className="grade-icon correct-icon" />
                        ) : (
                          <XCircle size={16} className="grade-icon incorrect-icon" />
                        )}
                      </div>
                    ) : isSubmissionLocked ? (
                      <div className="question-graded-box locked">
                        <span className="question-graded-value">Submission locked</span>
                        <CheckCircle2 size={16} className="grade-icon correct-icon" />
                      </div>
                    ) : (
                      <input
                        className="question-answer-input"
                        aria-label={`Answer ${number}`}
                        name={`answer-${number}`}
                        placeholder="Enter answer"
                        value={answers[number] ?? ""}
                        onChange={(e) => onAnswerChange(number, e.target.value)}
                      />
                    )}
                  </label>

                  {submitResult && summary?.explanationNote && result && !result.isCorrect ? (
                    <details className="solution-note" open>
                      <summary>Explanation</summary>
                      <LatexStatement
                        statement={summary.explanationNote}
                        format={summary.contentFormat}
                        assets={assets}
                      />
                    </details>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
        {reportDialog}
      </>
    );
  }

  function renderFallbackAnswerGrid() {
    function renderTestAnswerTable() {
      return (
        <div className="test-answer-shell">
          <div className="test-answer-summary">
            <strong>Test answer sheet</strong>
            <span>
              {testRows.length} problems · 3 levels · {problemNumbers.length} marks
            </span>
          </div>
          <div className="test-answer-table-wrap">
            <table className="test-answer-table">
              <thead>
                <tr>
                  <th>Problem</th>
                  <th>(1)</th>
                  <th>(2)</th>
                  <th>(3)</th>
                </tr>
              </thead>
              <tbody>
                {testRows.map((row) => (
                  <tr key={row.problemIndex}>
                    <th scope="row">{row.problemIndex}</th>
                    {[0, 1, 2].map((cellIndex) => {
                      const cell = row.cells[cellIndex];
                      if (!cell) {
                        return <td className="test-answer-cell empty" key={cellIndex} />;
                      }

                      const result = resultMap?.get(cell.problemNumber);
                      const stateClass = result ? (result.isCorrect ? "correct" : "incorrect") : "";

                      return (
                        <td
                          className={`test-answer-cell ${stateClass}`.trim()}
                          id={`problem-${cell.problemNumber}`}
                          key={cell.problemNumber}
                        >
                          {submitResult ? (
                            <div className={`test-answer-graded ${stateClass}`.trim()}>
                              <span>{result?.rawAnswer || "—"}</span>
                              {result?.isCorrect ? (
                                <CheckCircle2 size={14} className="grade-icon correct-icon" />
                              ) : (
                                <XCircle size={14} className="grade-icon incorrect-icon" />
                              )}
                            </div>
                          ) : isSubmissionLocked ? (
                            <div className="test-answer-graded locked">
                              <span>Locked</span>
                              <CheckCircle2 size={14} className="grade-icon correct-icon" />
                            </div>
                          ) : (
                            <input
                              className="test-answer-input"
                              aria-label={`Answer ${cell.label}`}
                              name={`answer-${cell.problemNumber}`}
                              placeholder={cell.label}
                              value={answers[cell.problemNumber] ?? ""}
                              onChange={(e) => onAnswerChange(cell.problemNumber, e.target.value)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (isSubmissionLocked) {
      return (
        <>
          <div className="locked-submit-state">
            <CheckCircle2 size={24} />
            <div>
              <strong>Perfect score already recorded</strong>
              <p>{lockedMessage}</p>
            </div>
          </div>
          {renderTestJumpGrid()}

          {isTestLayout ? (
            renderTestAnswerTable()
          ) : (
            <div className="answer-grid">
              {problemNumbers.map((number) => (
                <div className="answer-cell locked" key={number}>
                  <span className="answer-cell-label">Question {number}</span>
                  <div className="graded-answer">
                    <span className="answer-cell-value">Submission locked</span>
                    <CheckCircle2 size={14} className="grade-icon correct-icon" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="problem-actions">
            <button
              className="secondary-action"
              type="button"
              onClick={() => setShowReportDialog(true)}
            >
              <MessageSquareWarning size={18} />
              Report issue
            </button>
          </div>
          {reportDialog}
        </>
      );
    }

    if (submitResult) {
      const scorePercent = Math.max(0, Math.min(100, submitResult.percentage));
      const scoreRingStyle = { "--score-percent": `${scorePercent}%` } as CSSProperties;

      return (
        <>
          <div className="score-result">
            <div className="score-ring" style={scoreRingStyle}>
              <span>{submitResult.percentage}%</span>
              <small>
                {submitResult.score}/{submitResult.maxScore}
              </small>
            </div>
            <div className="score-details">
              <strong>Attempt #{submitResult.attemptNumber}</strong>
              <p>
                {submitResult.results.filter((result) => result.isCorrect).length} of{" "}
                {submitResult.results.length} correct
              </p>
              {isPerfectResult ? (
                <p className="perfect-lock-note">Perfect score saved. This set is now locked.</p>
              ) : null}
            </div>
          </div>

          <div className="submit-coaching-panel">
            <div>
              <p className="eyebrow">Next step</p>
              <strong>{nextAction}</strong>
            </div>
            {missedTopics.length > 0 ? (
              <div className="missed-topic-list">
                {missedTopics.map(([topic, count]) => (
                  <span key={topic}>
                    {topic}: {count}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {renderTestJumpGrid()}

          {isTestLayout ? (
            renderTestAnswerTable()
          ) : (
            <div className="answer-grid">
              {problemNumbers.map((number) => {
                const result = resultMap?.get(number);
                const stateClass = result ? (result.isCorrect ? "correct" : "incorrect") : "";

                return (
                  <div className={`answer-cell graded ${stateClass}`.trim()} key={number}>
                    <span className="answer-cell-label">Question {number}</span>
                    <div className="graded-answer">
                      <span className="answer-cell-value">{result?.rawAnswer || "—"}</span>
                      {result?.isCorrect ? (
                        <CheckCircle2 size={14} className="grade-icon correct-icon" />
                      ) : (
                        <XCircle size={14} className="grade-icon incorrect-icon" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="problem-actions">
            <button
              className="secondary-action"
              type="button"
              onClick={() => setShowReportDialog(true)}
            >
              <MessageSquareWarning size={18} />
              Report issue
            </button>
            {!isPerfectResult ? (
              <button className="secondary-action" type="button" onClick={onRetry}>
                <RotateCcw size={18} />
                Try again
              </button>
            ) : null}
          </div>
          {reportDialog}
        </>
      );
    }

    return (
      <>
        {renderTestJumpGrid()}
        {isTestLayout ? (
          renderTestAnswerTable()
        ) : (
          <form className="answer-grid" onSubmit={(e) => e.preventDefault()}>
            {problemNumbers.map((number) => (
              <label className="answer-cell" key={number}>
                <span className="answer-cell-label">Question {number}</span>
                <input
                  className="answer-cell-input"
                  aria-label={`Answer ${number}`}
                  name={`answer-${number}`}
                  placeholder="answer"
                  value={answers[number] ?? ""}
                  onChange={(e) => onAnswerChange(number, e.target.value)}
                />
              </label>
            ))}
          </form>
        )}

        <div className="problem-actions">
          <span className="fill-count">
            {filledCount}/{problemNumbers.length} answered
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
            {isSubmitting ? (
              <Loader2 size={18} className="spin-icon" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            {isSubmitting ? "Submitting…" : "Submit set"}
          </button>
        </div>

        {submitError ? (
          <div className="problem-actions">
            <span className="form-error">{submitError}</span>
          </div>
        ) : null}
        {reportDialog}
      </>
    );
  }

  return hasInlineStatements ? renderInlineWorkspace() : renderFallbackAnswerGrid();
}
