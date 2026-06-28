"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crosshair,
  Infinity as InfinityIcon,
  SkipForward,
  Target,
  Trophy,
  XCircle,
  Search,
} from "lucide-react";
import { MathCurveLoader } from "@/app/math-curve-loader";
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
  const [tagQuery, setTagQuery] = useState("");

  const [problem, setProblem] = useState<Problem | null>(null);
  const [loadingProblem, setLoadingProblem] = useState(false);
  const [problemMessage, setProblemMessage] = useState<string | null>(null);

  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const [practiceScore, setPracticeScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [solvedThisSession, setSolvedThisSession] = useState(0);

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
    setStreak(0);
    setSolvedThisSession(0);
    loadNextProblem(tag);
  }

  function skipProblem() {
    if (!selectedTag || loadingProblem || isSubmitting) return;
    setStreak(0);
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
        setStreak((s) => s + 1);
        setSolvedThisSession((s) => s + 1);
        if (typeof data.practiceScore === "number") {
          setPracticeScore(data.practiceScore);
        } else if (data.counted) {
          setPracticeScore((s) => s + 1);
        }
        void refreshPracticeTags();
      } else {
        setIsCorrect(false);
        setStreak(0);
      }
    } catch {
      alert("Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredTags = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.toLowerCase().includes(q));
  }, [tagQuery, tags]);

  return (
    <main className="single-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
        <span className="bg-spark bg-spark-one" />
      </div>

      <div className="page-frame practice-frame">
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">Training</p>
            <h1>
              <Target size={22} />
              Practice
            </h1>
          </div>
          <div className="topbar-actions">
            {practiceScore > 0 ? (
              <div className="practice-score-chip">
                <Trophy size={16} />
                <span>Practice score</span>
                <strong>{practiceScore}</strong>
              </div>
            ) : null}
            <Link className="secondary-action" href="/dashboard">
              <ArrowLeft size={18} />
              Dashboard
            </Link>
          </div>
        </header>

        {!selectedTag ? (
          <section className="practice-picker-card">
            <div className="practice-picker-head">
              <div>
                <p className="eyebrow">Pick a category</p>
                <h2>Choose your focus</h2>
                <p className="practice-picker-sub">
                  Drill a specific topic, or run Endless mode to mix everything.
                </p>
              </div>
              <Target size={28} className="practice-picker-glyph" />
            </div>

            <div className="practice-tag-search">
              <Search size={14} />
              <input
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                placeholder="Search categories…"
                aria-label="Search categories"
              />
            </div>

            {loadingTags ? (
              <div className="practice-loading">
                <MathCurveLoader size={28} label="Loading categories" />
                <span>Loading categories…</span>
              </div>
            ) : tags.length === 0 ? (
              <p className="practice-empty">No categories with enough questions yet.</p>
            ) : filteredTags.length === 0 ? (
              <p className="practice-empty">
                No categories match &ldquo;{tagQuery}&rdquo;.
              </p>
            ) : (
              <div className="practice-tag-grid">
                {filteredTags.map((tag) => {
                  const isEndless = tag.toLowerCase() === "endless";
                  return (
                    <button
                      key={tag}
                      onClick={() => handleTagSelect(tag)}
                      className={`practice-tag-card${isEndless ? " endless" : ""}`}
                    >
                      <span className="practice-tag-card-icon">
                        {isEndless ? <InfinityIcon size={18} /> : <Target size={16} />}
                      </span>
                      <span className="practice-tag-card-name">{tag}</span>
                      <span className="practice-tag-card-go" aria-hidden>
                        <ArrowRight size={14} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <div className="practice-arena-wrap">
            <div className="practice-arena-bar">
              <button
                onClick={() => {
                  setSelectedTag(null);
                  void refreshPracticeTags();
                }}
                className="secondary-action compact"
              >
                <ArrowLeft size={16} />
                Categories
              </button>
              <div className="practice-arena-stats">
                <span><small>Solved</small><strong>{solvedThisSession}</strong></span>
                <span><small>Streak</small><strong>{streak}</strong></span>
                <span><small>Total</small><strong>{practiceScore}</strong></span>
              </div>
            </div>

            <section className="practice-arena-card">
              <div className="practice-arena-head">
                <div>
                  <p className="eyebrow">Category</p>
                  <h2>{selectedTag}</h2>
                </div>
                {problem ? (
                  <div className="practice-source-pill">
                    <small>Source</small>
                    <span>{problem.problemSet.title}</span>
                  </div>
                ) : null}
              </div>

              {loadingProblem ? (
                <div className="practice-loading practice-loading-lg">
                  <MathCurveLoader size={36} label="Loading next problem" />
                  <span>Pulling next problem…</span>
                </div>
              ) : problemMessage ? (
                <div className="practice-finished">
                  <CheckCircle2 size={44} />
                  <strong>You&apos;ve cleared this category!</strong>
                  <p>{problemMessage}</p>
                  <button
                    onClick={() => {
                      setSelectedTag(null);
                      void refreshPracticeTags();
                    }}
                    className="primary-action"
                  >
                    Choose another category
                  </button>
                </div>
              ) : problem ? (
                <>
                  <div className="practice-statement">
                    <LatexStatement
                      statement={problem.statement}
                      format={problem.contentFormat}
                    />
                  </div>

                  <form onSubmit={submitAnswer} className="practice-answer-form">
                    <input
                      type="text"
                      className="practice-answer-input"
                      placeholder="Enter your answer…"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      disabled={isSubmitting || isCorrect === true}
                      autoFocus
                    />
                    <div className="practice-answer-actions">
                      {isCorrect !== true ? (
                        <>
                          <button
                            type="submit"
                            className="primary-action"
                            disabled={!answer.trim() || isSubmitting}
                          >
                            {isSubmitting ? (
                              <MathCurveLoader size={16} label="Submitting answer" />
                            ) : (
                              <Crosshair size={16} />
                            )}
                            Submit
                          </button>
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={skipProblem}
                            disabled={loadingProblem || isSubmitting}
                          >
                            <SkipForward size={16} />
                            Skip
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="primary-action"
                          onClick={() => loadNextProblem(selectedTag)}
                        >
                          Next problem
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </form>

                  {isCorrect === true ? (
                    <div className="practice-feedback feedback-correct">
                      <CheckCircle2 size={20} />
                      <strong>Correct.</strong>
                      <span>Streak {streak}.</span>
                    </div>
                  ) : null}
                  {isCorrect === false ? (
                    <div className="practice-feedback feedback-wrong">
                      <XCircle size={20} />
                      <strong>Not quite.</strong>
                      <span>Try again or skip.</span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
