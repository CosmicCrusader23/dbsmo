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
              <div className="practice-score-chip">
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
          <section className="panel practice-picker">
            <Target size={48} className="practice-picker-icon" />
            <h2>Select a Category</h2>
            <p>Focus your training on specific topics (10+ questions) or try the Endless mode.</p>

            {loadingTags ? (
              <div className="practice-loading">
                <Loader2 className="spin-icon" size={32} />
              </div>
            ) : tags.length === 0 ? (
              <p>No categories available with enough questions.</p>
            ) : (
              <div className="practice-tag-grid">
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
                      className="practice-tag-btn"
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
            <div className="practice-back-row">
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

            <section className="panel practice-arena">
              <div className="practice-arena-head">
                <div>
                  <p className="eyebrow">Category</p>
                  <h2>{selectedTag}</h2>
                </div>
                {problem && (
                  <div className="practice-source">
                    <p className="eyebrow">Source</p>
                    <p>{problem.problemSet.title}</p>
                  </div>
                )}
              </div>

              {loadingProblem ? (
                <div className="practice-loading practice-loading-lg">
                  <Loader2 className="spin-icon" size={40} />
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
                    className="primary-action practice-pick-another"
                  >
                    Choose another category
                  </button>
                </div>
              ) : problem ? (
                <div>
                  <div className="practice-statement">
                    <LatexStatement statement={problem.statement} format={problem.contentFormat} />
                  </div>

                  <form onSubmit={submitAnswer} className="practice-answer-form">
                    <input
                      type="text"
                      className="form-input practice-answer-input"
                      placeholder="Enter your answer..."
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      disabled={isSubmitting || isCorrect === true}
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
                        className="primary-action practice-next"
                        onClick={() => loadNextProblem(selectedTag)}
                      >
                        Next Question <ArrowRight size={18} />
                      </button>
                    )}
                  </form>

                  {isCorrect === true && (
                    <div className="practice-feedback feedback-correct">
                      <CheckCircle2 size={24} />
                      Correct! Great job.
                    </div>
                  )}
                  {isCorrect === false && (
                    <div className="practice-feedback feedback-wrong">
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
