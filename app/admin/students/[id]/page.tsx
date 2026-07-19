import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { computeTopicAccuracy, accuracyLevel, computeBestAverageScore } from "@/lib/analytics";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ page?: string }> };

const ACCENT = ["cyan", "purple", "pink", "orange"] as const;

function pct(a: { score: number; maxScore: number }) {
  return a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0;
}

export default async function StudentDetailPage({ params, searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!hasPermission(session.user.role, "admin:users")) redirect("/dashboard");

  const { id } = await params;
  const query = (await searchParams) ?? {};
  const currentPage = Math.max(1, Number(query.page ?? "1") || 1);
  const pageSize = 20;
  const student = await prisma.user.findUnique({
    where: { id },
    include: {
      attempts: {
        include: {
          problemSet: { select: { title: true, slug: true } },
          responses: { include: { problem: { select: { topicTags: true, points: true } } } },
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });
  if (!student) notFound();

  const sets = new Set(student.attempts.map((a) => a.problemSetId));
  const n = student.attempts.length;
  const avg = computeBestAverageScore(student.attempts);
  const best = n > 0 ? Math.round(Math.max(...student.attempts.map(pct))) : 0;
  const topics = computeTopicAccuracy(student.attempts.flatMap((a) => a.responses));
  const totalPages = Math.max(1, Math.ceil(student.attempts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAttempts = student.attempts.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <main className="single-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
      </div>
      <div className="page-frame">
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">Student</p>
            <h1>{student.name ?? student.email}</h1>
          </div>
          <div className="topbar-actions">
            <Link className="secondary-action" href="/dashboard">
              <ArrowLeft size={18} />
              Dashboard
            </Link>
            <Link className="secondary-action" href="/admin/students">
              <ArrowLeft size={18} />
              All students
            </Link>
          </div>
        </header>
        <section className="metric-grid" aria-label="Student metrics">
          <article className="metric-card">
            <small>Sets attempted</small>
            <strong>{sets.size}</strong>
          </article>
          <article className="metric-card">
            <small>Average score</small>
            <strong>{avg}%</strong>
          </article>
          <article className="metric-card">
            <small>Best score</small>
            <strong>{best}%</strong>
          </article>
          <article className="metric-card">
            <small>Total attempts</small>
            <strong>{n}</strong>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel table-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">History</p>
                <h2>Attempts</h2>
              </div>
            </div>
            <div className="table-wrap">
              {n === 0 ? (
                <p style={{ padding: 20, color: "var(--color-muted)", fontWeight: 800 }}>
                  No attempts yet.
                </p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Set</th>
                      <th>Attempt</th>
                      <th>Score</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAttempts.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <Link href={`/admin/sets/${a.problemSetId}`} className="text-link">
                            {a.problemSet.title}
                          </Link>
                        </td>
                        <td>
                          <Link href={`/attempts/${a.id}`} className="text-link">
                            #{a.attemptNumber}
                          </Link>
                        </td>
                        <td>
                          {a.score}/{a.maxScore} ({Math.round(pct(a))}%)
                        </td>
                        <td>{a.submittedAt.toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {totalPages > 1 ? (
              <div className="pagination-row">
                <Link
                  className="secondary-action compact"
                  href={`/admin/students/${student.id}${safePage > 2 ? `?page=${safePage - 1}` : ""}`}
                >
                  Previous
                </Link>
                <span>
                  Page {safePage} of {totalPages}
                </span>
                <Link
                  className="secondary-action compact"
                  href={`/admin/students/${student.id}?page=${Math.min(totalPages, safePage + 1)}`}
                >
                  Next
                </Link>
              </div>
            ) : null}
          </article>
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Strengths &amp; weaknesses</p>
                <h2>Topic accuracy</h2>
              </div>
            </div>
            <div className="topic-stack">
              {topics.length === 0 ? (
                <p style={{ color: "var(--color-muted)", fontWeight: 800 }}>No data yet.</p>
              ) : (
                topics.map((t, i) => (
                  <div className="topic-bar" key={t.topic}>
                    <div className="topic-label">
                      <span>{t.topic}</span>
                      <strong style={{ color: `var(--color-${accuracyLevel(t.accuracy)})` }}>
                        {t.accuracy}%
                      </strong>
                    </div>
                    <div className="meter">
                      <span
                        className={`meter-fill fill-${ACCENT[i % ACCENT.length]}`}
                        style={{ width: `${t.accuracy}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
