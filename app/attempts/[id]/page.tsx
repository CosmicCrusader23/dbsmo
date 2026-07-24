import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  FileText,
  MessageSquareText,
  RotateCcw,
  XCircle,
} from "lucide-react";
import "katex/dist/katex.min.css";

import { Avatar } from "@/app/avatar";
import { ThemeToggle } from "@/app/theme-toggle";
import { PageBackLink } from "@/app/page-back-link";
import { LatexStatement } from "@/app/problem-sets/[slug]/latex-statement";
import { authOptions } from "@/lib/auth";
import {
  acceptedAnswerList,
  attemptPercentage,
  attemptVerdict,
  formatAttemptDuration,
  responseReviewStatus,
} from "@/lib/attempt-review";
import { prisma } from "@/lib/db";
import { displayNameFor } from "@/lib/display-name";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function answerStatement(answer: string) {
  const value = answer.trim();
  if (!value) return "";
  if (/^(?:\$|\\\(|\\\[|\\begin\{)/.test(value)) return value;
  return `\\(${value}\\)`;
}

export default async function AttemptReviewPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const { id } = await params;
  const [viewer, attempt] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    }),
    prisma.attempt.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            displayName: true,
            image: true,
            avatarUrl: true,
          },
        },
        problemSet: {
          include: {
            assets: { select: { key: true, fileId: true } },
            problemFile: { select: { id: true, originalName: true } },
          },
        },
        responses: {
          include: { problem: true },
        },
      },
    }),
  ]);

  if (!viewer || !attempt) notFound();

  const isOwner = attempt.userId === viewer.id;
  const canReviewStudentAttempts = hasPermission(viewer.role, "admin:analytics");
  if (!isOwner && !canReviewStudentAttempts) notFound();

  const responses = [...attempt.responses].sort(
    (left, right) => left.problem.number - right.problem.number,
  );
  const correctCount = responses.filter((response) => response.isCorrect).length;
  const percentage = attemptPercentage(attempt.score, attempt.maxScore);
  const verdict = attemptVerdict(attempt.score, attempt.maxScore, correctCount);
  const skippedCount = responses.filter(
    (response) => responseReviewStatus(response) === "skipped",
  ).length;
  const assetUrls = Object.fromEntries(
    attempt.problemSet.assets.map((asset) => [asset.key, `/api/files/${asset.fileId}`]),
  );
  const studentName = displayNameFor(attempt.user);
  const backHref = isOwner ? "/dashboard#analytics" : `/admin/students/${attempt.userId}`;
  const backLabel = isOwner ? "Attempt history" : "Student profile";

  return (
    <main className="single-page attempt-review-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
      </div>

      <div className="page-frame attempt-review-frame">
        <header className="topbar standalone attempt-review-topbar">
          <div>
            <p className="eyebrow">Attempt review</p>
            <h1>{attempt.problemSet.title}</h1>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <PageBackLink destination={backLabel} href={backHref} />
            <Link className="secondary-action" href={`/problem-sets/${attempt.problemSet.slug}`}>
              <BookOpen size={18} />
              Open set
            </Link>
          </div>
        </header>

        <section className="attempt-submission-header" aria-label="Attempt summary">
          <div className="attempt-submission-identity">
            <Avatar user={attempt.user} size="lg" />
            <div>
              <p className="eyebrow">Attempt #{attempt.attemptNumber}</p>
              <h2>{studentName}</h2>
              <p>
                Submitted {dateTimeFormatter.format(attempt.submittedAt)} on{" "}
                <Link href={`/problem-sets/${attempt.problemSet.slug}`}>
                  {attempt.problemSet.title}
                </Link>
              </p>
            </div>
          </div>

          <div className="attempt-verdict-block">
            <span className="attempt-summary-label">Verdict</span>
            <strong className={`attempt-verdict verdict-${verdict.kind}`}>{verdict.label}</strong>
          </div>

          <dl className="attempt-summary-stats">
            <div>
              <dt>Score</dt>
              <dd>
                {attempt.score}/{attempt.maxScore}
              </dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>{percentage}%</dd>
            </div>
            <div>
              <dt>Correct</dt>
              <dd>
                {correctCount}/{responses.length}
              </dd>
            </div>
            <div>
              <dt>Skipped</dt>
              <dd>{skippedCount}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{formatAttemptDuration(attempt.durationSeconds)}</dd>
            </div>
          </dl>
        </section>

        <section className="attempt-results-panel" aria-labelledby="attempt-results-title">
          <div className="attempt-results-heading">
            <div>
              <p className="eyebrow">Question breakdown</p>
              <h2 id="attempt-results-title">Results</h2>
            </div>
            <p>Select a row to inspect the problem, answer key, and explanation.</p>
          </div>

          <div className="attempt-results-table" role="table" aria-label="Question results">
            <div className="attempt-results-columns" role="row">
              <span role="columnheader">Question</span>
              <span role="columnheader">Result</span>
              <span role="columnheader">Submitted answer</span>
              <span role="columnheader">Marks</span>
              <span role="columnheader">Topic</span>
              <span aria-hidden="true" />
            </div>

            {responses.map((response) => {
              const status = responseReviewStatus(response);
              const acceptedAnswers = acceptedAnswerList(
                response.problem.answerKey,
                response.problem.acceptedAnswers,
              );
              const topics = response.problem.topicTags.length
                ? response.problem.topicTags
                : ["General"];

              return (
                <details
                  className={`attempt-result-row result-${status}`}
                  key={response.id}
                  id={`question-${response.problem.number}`}
                >
                  <summary>
                    <span className="attempt-question-number">Q{response.problem.number}</span>
                    <span className={`attempt-result-status status-${status}`}>
                      {status === "correct" ? <CheckCircle2 size={17} /> : null}
                      {status === "incorrect" ? <XCircle size={17} /> : null}
                      {status === "skipped" ? <CircleDashed size={17} /> : null}
                      {status === "correct"
                        ? "Correct"
                        : status === "incorrect"
                          ? "Incorrect"
                          : "Skipped"}
                    </span>
                    <span className="attempt-submitted-answer">
                      {response.rawAnswer.trim() || "No answer"}
                    </span>
                    <span className="attempt-row-marks">
                      {response.pointsAwarded}/{response.problem.points}
                    </span>
                    <span className="attempt-row-topics">{topics.join(", ")}</span>
                    <ChevronDown className="attempt-row-chevron" size={18} aria-hidden="true" />
                  </summary>

                  <div className="attempt-result-detail">
                    <section className="attempt-problem-statement">
                      <div className="attempt-detail-label">
                        <span>Problem</span>
                        <span>
                          {response.problem.points}{" "}
                          {response.problem.points === 1 ? "mark" : "marks"}
                        </span>
                      </div>
                      {response.problem.statement.trim() ? (
                        <LatexStatement
                          statement={response.problem.statement}
                          format={response.problem.contentFormat}
                          assets={assetUrls}
                        />
                      ) : (
                        <p>
                          This is an answer-only problem. Open the set file to review the full
                          statement.
                        </p>
                      )}
                    </section>

                    <div className="attempt-answer-comparison">
                      <section>
                        <span className="attempt-detail-label">Submitted answer</span>
                        <strong>{response.rawAnswer.trim() || "No answer submitted"}</strong>
                        {response.normalizedAnswer &&
                        response.normalizedAnswer !== response.rawAnswer.trim() ? (
                          <small>Graded as: {response.normalizedAnswer}</small>
                        ) : null}
                      </section>
                      <section>
                        <span className="attempt-detail-label">Accepted answer</span>
                        <div className="attempt-accepted-answers">
                          {acceptedAnswers.map((answer) => (
                            <span key={answer}>
                              <LatexStatement statement={answerStatement(answer)} />
                            </span>
                          ))}
                        </div>
                      </section>
                    </div>

                    {response.graderNote ? (
                      <section className="attempt-review-note">
                        <span className="attempt-detail-label">Grader note</span>
                        <p>{response.graderNote}</p>
                      </section>
                    ) : null}

                    {response.problem.explanationNote ? (
                      <section className="attempt-review-note attempt-explanation-note">
                        <span className="attempt-detail-label">Explanation</span>
                        <LatexStatement
                          statement={response.problem.explanationNote}
                          format={response.problem.contentFormat}
                          assets={assetUrls}
                        />
                      </section>
                    ) : null}

                    <div className="attempt-detail-actions">
                      <Link
                        className="secondary-action compact"
                        href={`/problem-sets/${attempt.problemSet.slug}#problem-${response.problem.number}`}
                      >
                        <RotateCcw size={16} />
                        Revisit question
                      </Link>
                      <Link
                        className="secondary-action compact"
                        href={`/problem-sets/${attempt.problemSet.slug}/writeups`}
                      >
                        <MessageSquareText size={16} />
                        Writeups
                      </Link>
                      {attempt.problemSet.problemFile ? (
                        <a
                          className="secondary-action compact"
                          href={`/api/files/${attempt.problemSet.problemFile.id}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <FileText size={16} />
                          Open {attempt.problemSet.problemFile.originalName}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
