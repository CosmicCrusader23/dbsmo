import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound } from "next/navigation";
import "katex/dist/katex.min.css";

import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Maximize2,
  MessageSquareText,
  PlayCircle,
  Settings,
} from "lucide-react";
import { ThemeToggle } from "@/app/theme-toggle";
import { PageBackLink } from "@/app/page-back-link";
import { AnswerGrid } from "./answer-grid";
import { BookmarkButton } from "./bookmark-button";
import { LatexStatement } from "./latex-statement";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeProblemTag } from "@/lib/problem-tags";
import { isVisibleToStudent } from "@/lib/visibility";

export const dynamic = "force-dynamic";

type ProblemSetPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ProblemSetPage({ params }: ProblemSetPageProps) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    notFound();
  }

  const [user, problemSet] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    }),
    prisma.problemSet.findUnique({
      where: { slug },
      include: {
        problems: { orderBy: { number: "asc" } },
        problemFile: true,
        solutionFile: true,
        assets: { select: { key: true, fileId: true } },
        createdBy: { select: { name: true } },
        bookmarks: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
    }),
  ]);

  if (!user || !problemSet) {
    notFound();
  }

  if (user.role !== "ADMIN" && !isVisibleToStudent(problemSet)) {
    notFound();
  }

  const problemCount = problemSet.problems.length;
  const videoHost = problemSet.videoUrl ? new URL(problemSet.videoUrl).hostname : null;
  const isTestSet = problemSet.topicTags.some((tag) => normalizeProblemTag(tag) === "tests");
  const statementProblems = problemSet.problems.filter((problem) => problem.statement.trim());
  const hasInlineStatements =
    !isTestSet && problemSet.problems.every((problem) => problem.statement.trim().length > 0);
  const pdfHref =
    problemSet.problemFile?.mimeType === "application/pdf"
      ? `/api/files/${problemSet.problemFile.id}`
      : null;
  const assetUrls: Record<string, string> = {};
  for (const asset of problemSet.assets) {
    assetUrls[asset.key] = `/api/files/${asset.fileId}`;
  }
  const previousAttempts = await prisma.attempt.findMany({
    where: { userId: user.id, problemSetId: problemSet.id, maxScore: { gt: 0 } },
    select: { id: true, attemptNumber: true, score: true, maxScore: true },
    orderBy: { attemptNumber: "asc" },
  });
  const perfectAttempt = previousAttempts.find((attempt) => attempt.score === attempt.maxScore);
  const recentAttempts = previousAttempts.slice(-5).reverse();

  return (
    <main className="single-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
        <span className="bg-spark bg-spark-two" />
      </div>

      <div className="page-frame">
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">
              {problemSet.slug} • Uploaded by {problemSet.createdBy?.name || "Admin"}
            </p>
            <h1 className="problem-title-row">
              <span>{problemSet.title}</span>
              <BookmarkButton
                initialBookmarked={problemSet.bookmarks.length > 0}
                problemSetId={problemSet.id}
              />
              <Link
                aria-label="Open writeups"
                className="writeups-header-link"
                href={`/problem-sets/${problemSet.slug}/writeups`}
                title="Open writeups"
              >
                <MessageSquareText size={22} />
              </Link>
            </h1>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            {user.role === "ADMIN" && (
              <>
                <Link className="secondary-action" href={`/admin/sets/${problemSet.id}/analytics`}>
                  <BarChart3 size={18} />
                  Analytics
                </Link>
                <Link className="secondary-action" href={`/admin/sets/${problemSet.id}`}>
                  <Settings size={18} />
                  Manage set
                </Link>
              </>
            )}
            <PageBackLink destination="Problem Sets" href="/problem-sets" />
          </div>
        </header>

        {recentAttempts.length > 0 ? (
          <nav className="set-attempt-history" aria-label="Previous attempts">
            <span className="set-attempt-history-label">
              <ClipboardCheck size={17} />
              Your attempts
            </span>
            <div className="set-attempt-history-links">
              {recentAttempts.map((attempt) => (
                <Link href={`/attempts/${attempt.id}`} key={attempt.id}>
                  <span>#{attempt.attemptNumber}</span>
                  <strong>
                    {attempt.maxScore > 0
                      ? Math.round((attempt.score / attempt.maxScore) * 100)
                      : 0}
                    %
                  </strong>
                </Link>
              ))}
            </div>
          </nav>
        ) : null}

        {hasInlineStatements ? (
          <section className="problem-inline-shell">
            <article className="panel statement-panel problem-inline-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Questions</p>
                  <h2>Statements and answers</h2>
                </div>
                <CheckCircle2 size={20} />
              </div>
              {pdfHref ? (
                <div className="file-meta-row problem-inline-file-row">
                  <span>Problem file: {problemSet.problemFile?.originalName}</span>
                  <a className="secondary-action compact" href={pdfHref} target="_blank">
                    <Maximize2 size={16} />
                    Open PDF
                  </a>
                </div>
              ) : null}
              <AnswerGrid
                lockedAttemptId={perfectAttempt?.id ?? null}
                lockedAttemptNumber={perfectAttempt?.attemptNumber ?? null}
                problemNumbers={problemSet.problems.map((problem) => problem.number)}
                problemSummaries={problemSet.problems.map((problem) => ({
                  number: problem.number,
                  statement: problem.statement,
                  topicTags: problem.topicTags,
                  explanationNote: problem.explanationNote,
                  contentFormat: problem.contentFormat,
                }))}
                problemSetId={problemSet.id}
                videoUrl={problemSet.videoUrl}
                assets={assetUrls}
                answerLayout={isTestSet ? "test" : "standard"}
              />
              {problemSet.videoUrl ? (
                <a
                  className="video-strip"
                  href={problemSet.videoUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <PlayCircle size={20} />
                  Teaching video on {videoHost}
                  <ExternalLink size={16} />
                </a>
              ) : (
                <div className="video-strip muted-strip">
                  <PlayCircle size={20} />
                  Teaching video can be attached later
                </div>
              )}
              {problemSet.solutionFile ? (
                <div className="file-meta-row">
                  <span>Solution file: {problemSet.solutionFile.originalName}</span>
                </div>
              ) : null}
            </article>
          </section>
        ) : (
          <section className={`problem-layout${isTestSet ? " test-problem-layout" : ""}`}>
            <article className="panel statement-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Problem file</p>
                  <h2>Set statement</h2>
                </div>
                <FileText size={20} />
              </div>
              {pdfHref ? (
                <div className="pdf-viewer-block">
                  <iframe className="pdf-frame" src={pdfHref} title={`${problemSet.title} PDF`} />
                  <a
                    className="secondary-action compact pdf-open-action"
                    href={pdfHref}
                    target="_blank"
                  >
                    <Maximize2 size={16} />
                    Enlarge PDF
                  </a>
                </div>
              ) : statementProblems.length > 0 ? (
                <div className="problem-statement-list">
                  {problemSet.problems.map((problem) => (
                    <section className="problem-statement-card" key={problem.id}>
                      <span className="statement-number">Q{problem.number}</span>
                      <div className="statement-text">
                        <LatexStatement
                          statement={problem.statement}
                          format={problem.contentFormat}
                          assets={assetUrls}
                        />
                        {problem.explanationNote ? (
                          <details className="solution-note">
                            <summary>Solution</summary>
                            <LatexStatement
                              statement={problem.explanationNote}
                              format={problem.contentFormat}
                              assets={assetUrls}
                            />
                          </details>
                        ) : null}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="pdf-placeholder">
                  <FileText size={42} />
                  <strong>{problemSet.problemFile?.originalName ?? "Problem file attached"}</strong>
                  <span>{problemCount} answer-only questions</span>
                </div>
              )}
              {problemSet.videoUrl ? (
                <a
                  className="video-strip"
                  href={problemSet.videoUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <PlayCircle size={20} />
                  Teaching video on {videoHost}
                  <ExternalLink size={16} />
                </a>
              ) : (
                <div className="video-strip muted-strip">
                  <PlayCircle size={20} />
                  Teaching video can be attached later
                </div>
              )}
              {problemSet.solutionFile ? (
                <div className="file-meta-row">
                  <span>Solution file: {problemSet.solutionFile.originalName}</span>
                </div>
              ) : null}
            </article>

            <article className={`panel answer-panel${isTestSet ? " test-answer-panel" : ""}`}>
              {!isTestSet ? (
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Answer-only</p>
                    <h2>Response grid</h2>
                  </div>
                  <CheckCircle2 size={20} />
                </div>
              ) : null}
              <AnswerGrid
                lockedAttemptId={perfectAttempt?.id ?? null}
                lockedAttemptNumber={perfectAttempt?.attemptNumber ?? null}
                problemNumbers={problemSet.problems.map((problem) => problem.number)}
                problemSummaries={problemSet.problems.map((problem) => ({
                  number: problem.number,
                  statement: problem.statement,
                  topicTags: problem.topicTags,
                  explanationNote: problem.explanationNote,
                  contentFormat: problem.contentFormat,
                }))}
                problemSetId={problemSet.id}
                videoUrl={problemSet.videoUrl}
                assets={assetUrls}
                answerLayout={isTestSet ? "test" : "standard"}
              />
            </article>
          </section>
        )}
      </div>
    </main>
  );
}
