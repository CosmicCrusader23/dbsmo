import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound } from "next/navigation";
import "katex/dist/katex.min.css";

import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  Maximize2,
  PlayCircle,
} from "lucide-react";
import { ThemeToggle } from "@/app/theme-toggle";
import { AnswerGrid } from "./answer-grid";
import { LatexStatement } from "./latex-statement";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserGroups } from "@/lib/auth-server";
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
      select: { id: true, role: true, group: true },
    }),
    prisma.problemSet.findUnique({
      where: { slug },
      include: {
        problems: { orderBy: { number: "asc" } },
        problemFile: true,
        solutionFile: true,
      },
    }),
  ]);

  if (!user || !problemSet) {
    notFound();
  }

  if (user.role !== "ADMIN" && !isVisibleToStudent(problemSet, getUserGroups(user))) {
    notFound();
  }

  const problemCount = problemSet.problems.length;
  const videoHost = problemSet.videoUrl ? new URL(problemSet.videoUrl).hostname : null;
  const statementProblems = problemSet.problems.filter((problem) => problem.statement.trim());
  const pdfHref =
    problemSet.problemFile?.mimeType === "application/pdf"
      ? `/api/files/${problemSet.problemFile.id}`
      : null;
  const previousAttempts = await prisma.attempt.findMany({
    where: { userId: user.id, problemSetId: problemSet.id, maxScore: { gt: 0 } },
    select: { attemptNumber: true, score: true, maxScore: true },
    orderBy: { attemptNumber: "asc" },
  });
  const perfectAttempt = previousAttempts.find((attempt) => attempt.score === attempt.maxScore);

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
            <p className="eyebrow">{problemSet.slug}</p>
            <h1>{problemSet.title}</h1>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <Link className="secondary-action" href="/dashboard">
              <ArrowLeft size={18} />
              Dashboard
            </Link>
          </div>
        </header>

        <section className="problem-layout">
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
                      <LatexStatement statement={problem.statement} />
                      {problem.explanationNote ? (
                        <details className="solution-note">
                          <summary>Solution</summary>
                          <LatexStatement statement={problem.explanationNote} />
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

          <article className="panel answer-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Answer-only</p>
                <h2>Response grid</h2>
              </div>
              <CheckCircle2 size={20} />
            </div>
            <AnswerGrid
              lockedAttemptNumber={perfectAttempt?.attemptNumber ?? null}
              problemCount={problemCount}
              problemSetId={problemSet.id}
            />
          </article>
        </section>
      </div>
    </main>
  );
}
