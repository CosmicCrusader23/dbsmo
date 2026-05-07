"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crosshair,
  Loader2,
  SkipForward,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";
import { LatexStatement } from "../problem-sets/[slug]/latex-statement";

type Problem = {
  id: string;
  statement: string;
  contentFormat: "LATEX" | "HTML";
  topicTags: string[];
  problemSet: {
    title: string;
  };
};

export default function PracticePage() {
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loadingTags, setLoadingTags] = useState(true);

  const [problem, setProblem] = useState<Problem | null>(null);
  const [loadingProblem, setLoadingProblem] = useState(false);
  const [problemMessage, setProblemMessage] = useState<string | null>(null);

  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const [practiceScore, setPracticeScore] = useState(0);

  async function refreshPracticeTags() {
    setLoadingTags(true);
    try {
      const res = await fetch("/api/practice/tags");
      const data = await res.json();
      if (data.tags) setTags(data.tags);
      if (typeof data.practiceScore === "number") setPracticeScore(data.practiceScore);
    } catch {
      // keep current category list if refresh fails
    } finally {
      setLoadingTags(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetch("/api/practice/tags")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.tags) setTags(data.tags);
        if (typeof data.practiceScore === "number") setPracticeScore(data.practiceScore);
      })
      .catch(() => {
        // keep defaults if initial fetch fails
      })
      .finally(() => {
        if (!cancelled) setLoadingTags(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function loadNextProblem(tag: string) {
    setLoadingProblem(true);
    setProblemMessage(null);
    setAnswer("");
    setIsCorrect(null);

    fetch(`/api/practice/next?tag=${encodeURIComponent(tag)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.problem) {
          setProblem(data.problem);
        } else {
          setProblem(null);
          setProblemMessage(data.message || "No problems found.");
        }
      })
      .catch(() => {
        setProblemMessage("Failed to load problem.");
      })
      .finally(() => {
        setLoadingProblem(false);
      });
  }

  function handleTagSelect(tag: string) {
    setSelectedTag(tag);
    loadNextProblem(tag);
  }

  function skipProblem() {
    if (!selectedTag || loadingProblem || isSubmitting) return;
    loadNextProblem(selectedTag);
  }

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!problem || !answer.trim() || isSubmitting || isCorrect) return;

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/practice/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem.id, answer }),
      });
      const data = await res.json();

      if (data.isCorrect) {
        setIsCorrect(true);
        if (typeof data.practiceScore === "number") {
          setPracticeScore(data.practiceScore);
        } else if (data.counted) {
          setPracticeScore((s) => s + 1);
        }
        void refreshPracticeTags();
      } else {
        setIsCorrect(false);
      }
    } catch {
      alert("Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="single-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
        <span className="bg-spark bg-spark-one" />
      </div>

      <div className="page-frame">
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">Training</p>
            <h1>Practice Mode</h1>
          </div>
          <div className="topbar-actions">
            {practiceScore > 0 && (
              <div
                className="secondary-action"
                style={{
                  cursor: "default",
                  border: "1px solid var(--color-success)",
                  color: "var(--color-success)",
                }}
              >
                <Trophy size={18} />
                Practice Score: {practiceScore}
              </div>
            )}
            <Link className="secondary-action" href="/dashboard">
              <ArrowLeft size={18} />
              Dashboard
            </Link>
          </div>
        </header>

        {!selectedTag ? (
          <section className="panel" style={{ padding: 40, textAlign: "center" }}>
            <Target size={48} style={{ margin: "0 auto 20px", color: "var(--color-pink)" }} />
            <h2 style={{ fontSize: "1.8rem", marginBottom: 10 }}>Select a Category</h2>
            <p style={{ color: "var(--color-muted)", marginBottom: 30 }}>
              Focus your training on specific topics (10+ questions) or try the Endless mode.
            </p>

            {loadingTags ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                <Loader2 className="spin-icon" size={32} color="var(--color-muted)" />
              </div>
            ) : tags.length === 0 ? (
              <p>No categories available with enough questions.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
                {tags.map((tag) => {
                  const isEndless = tag.toLowerCase() === "endless";
                  return isEndless ? (
                    <button
                      key={tag}
                      onClick={() => handleTagSelect(tag)}
                      className="hologram-btn"
                    >
                      <div className="hologram-scan-line" />
                      <span data-text={tag}>{tag}</span>
                    </button>
                  ) : (
                    <button
                      key={tag}
                      onClick={() => handleTagSelect(tag)}
                      style={{
                        padding: "12px 24px",
                        borderRadius: 100,
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-strong)",
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: "none",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = "var(--color-pink)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = "var(--color-border)";
                        e.currentTarget.style.transform = "none";
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <div>
            <div style={{ marginBottom: 20 }}>
              <button
                onClick={() => {
                  setSelectedTag(null);
                  void refreshPracticeTags();
                }}
                className="secondary-action compact"
              >
                ← Back to categories
              </button>
            </div>

            <section className="panel" style={{ padding: 30 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                  borderBottom: "1px solid var(--color-border)",
                  paddingBottom: 15,
                }}
              >
                <div>
                  <p className="eyebrow">Category</p>
                  <h2 style={{ textTransform: "capitalize" }}>{selectedTag}</h2>
                </div>
                {problem && (
                  <div style={{ textAlign: "right" }}>
                    <p className="eyebrow">Source</p>
                    <p style={{ fontWeight: 800, color: "var(--color-muted)" }}>
                      {problem.problemSet.title}
                    </p>
                  </div>
                )}
              </div>

              {loadingProblem ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                  <Loader2 className="spin-icon" size={40} color="var(--color-muted)" />
                </div>
              ) : problemMessage ? (
                <div className="empty-state">
                  <CheckCircle2 size={48} color="var(--color-success)" />
                  <strong>You&apos;ve completed this category!</strong>
                  <p>{problemMessage}</p>
                  <button
                    onClick={() => {
                      setSelectedTag(null);
                      void refreshPracticeTags();
                    }}
                    className="primary-action"
                    style={{ marginTop: 20 }}
                  >
                    Choose another category
                  </button>
                </div>
              ) : problem ? (
                <div>
                  <div className="statement-text" style={{ fontSize: "1.2rem", marginBottom: 30 }}>
                    <LatexStatement statement={problem.statement} format={problem.contentFormat} />
                  </div>

                  <form
                    onSubmit={submitAnswer}
                    style={{ display: "flex", gap: 15, alignItems: "center", flexWrap: "wrap" }}
                  >
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter your answer..."
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      disabled={isSubmitting || isCorrect === true}
                      style={{ flex: 1, fontSize: "1.1rem" }}
                      autoFocus
                    />
                    {isCorrect !== true ? (
                      <>
                        <button
                          type="submit"
                          className="primary-action"
                          disabled={!answer.trim() || isSubmitting}
                        >
                          {isSubmitting ? (
                            <Loader2 size={18} className="spin-icon" />
                          ) : (
                            <Crosshair size={18} />
                          )}
                          Submit
                        </button>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={skipProblem}
                          disabled={loadingProblem || isSubmitting}
                        >
                          <SkipForward size={18} />
                          Skip
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="primary-action"
                        onClick={() => loadNextProblem(selectedTag)}
                        style={{ background: "var(--color-success)" }}
                      >
                        Next Question <ArrowRight size={18} />
                      </button>
                    )}
                  </form>

                  {isCorrect === true && (
                    <div
                      style={{
                        marginTop: 20,
                        padding: 15,
                        background: "rgba(0, 210, 180, 0.15)",
                        border: "1px solid var(--color-success)",
                        borderRadius: 12,
                        color: "var(--color-success)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontWeight: 800,
                      }}
                    >
                      <CheckCircle2 size={24} />
                      Correct! Great job.
                    </div>
                  )}
                  {isCorrect === false && (
                    <div
                      style={{
                        marginTop: 20,
                        padding: 15,
                        background: "rgba(255, 80, 100, 0.15)",
                        border: "1px solid var(--color-danger)",
                        borderRadius: 12,
                        color: "var(--color-danger)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontWeight: 800,
                      }}
                    >
                      <XCircle size={24} />
                      Incorrect. Try again!
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
