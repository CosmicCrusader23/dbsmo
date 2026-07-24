import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { computeScoreBuckets, accuracyLevel } from "@/lib/analytics";
import { hasPermission } from "@/lib/permissions";
import { AnalyticsMotion } from "@/app/admin/analytics/analytics-motion";
import { PageBackLink } from "@/app/page-back-link";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function pct(a: { score: number; maxScore: number }) {
  return a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0;
}

export default async function SetAnalyticsPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!hasPermission(session.user.role, "admin:analytics")) redirect("/dashboard");

  const { id } = await params;
  const set = await prisma.problemSet.findUnique({
    where: { id },
    include: {
      problems: { orderBy: { number: "asc" } },
      attempts: {
        include: {
          user: { select: { name: true, email: true, id: true } },
          responses: true,
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });
  if (!set) notFound();

  const students = new Set(set.attempts.map((a) => a.userId));
  const avg =
    set.attempts.length > 0
      ? Math.round(set.attempts.reduce((s, a) => s + pct(a), 0) / set.attempts.length)
      : 0;
  const buckets = computeScoreBuckets(set.attempts);
  const maxBucket = Math.max(...buckets.map((b) => b.count), 1);

  const qStats = set.problems.map((p) => {
    const rs = set.attempts.flatMap((a) => a.responses.filter((r) => r.problemId === p.id));
    const ok = rs.filter((r) => r.isCorrect).length;
    return {
      number: p.number,
      total: rs.length,
      correct: ok,
      accuracy: rs.length > 0 ? Math.round((ok / rs.length) * 100) : 0,
    };
  });

  return (
    <main className="single-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
      </div>
      <div className="page-frame analytics-frame">
        <AnalyticsMotion />
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">Analytics</p>
            <h1>{set.title}</h1>
          </div>
          <div className="topbar-actions">
            <PageBackLink destination="Set" href={`/admin/sets/${id}`} />
          </div>
        </header>
        <section className="metric-grid" aria-label="Set analytics">
          <article className="metric-card">
            <small>Total attempts</small>
            <strong>{set.attempts.length}</strong>
          </article>
          <article className="metric-card">
            <small>Unique students</small>
            <strong>{students.size}</strong>
          </article>
          <article className="metric-card">
            <small>Average score</small>
            <strong>{avg}%</strong>
          </article>
          <article className="metric-card">
            <small>Questions</small>
            <strong>{set.problems.length}</strong>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Per-question</p>
                <h2>Correctness rate</h2>
              </div>
              <BarChart3 size={20} />
            </div>
            <div className="topic-stack">
              {qStats.map((q) => (
                <div className="topic-bar" key={q.number}>
                  <div className="topic-label">
                    <span>Q{q.number}</span>
                    <strong style={{ color: `var(--color-${accuracyLevel(q.accuracy)})` }}>
                      {q.accuracy}% ({q.correct}/{q.total})
                    </strong>
                  </div>
                  <div className="meter">
                    <span
                      className={`meter-fill fill-${q.accuracy >= 70 ? "cyan" : q.accuracy >= 40 ? "orange" : "pink"}`}
                      style={{ width: `${q.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <div>
            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Distribution</p>
                  <h2>Score buckets</h2>
                </div>
              </div>
              <div className="topic-stack">
                {buckets.map((b) => (
                  <div className="topic-bar" key={b.label}>
                    <div className="topic-label">
                      <span>{b.label}</span>
                      <strong>{b.count}</strong>
                    </div>
                    <div className="meter">
                      <span
                        className="meter-fill fill-purple"
                        style={{ width: `${(b.count / maxBucket) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel table-panel" style={{ marginTop: 18 }}>
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Recent</p>
                  <h2>Attempts</h2>
                </div>
              </div>
              <div className="table-wrap">
                {set.attempts.length === 0 ? (
                  <p style={{ padding: 20, color: "var(--color-muted)", fontWeight: 800 }}>
                    No attempts yet.
                  </p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>#</th>
                        <th>Score</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {set.attempts.slice(0, 20).map((a) => (
                        <tr key={a.id}>
                          <td>
                            <Link href={`/admin/students/${a.user.id}`} className="text-link">
                              {a.user.name ?? a.user.email}
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
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
