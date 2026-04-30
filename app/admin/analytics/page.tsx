import Link from "next/link";
import { ArrowLeft, Download, Flame } from "lucide-react";
import { prisma } from "@/lib/db";
import { computeTopicAccuracy, computeQuestionStats, accuracyLevel } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function AnalyticsOverviewPage() {
  const [responses, problemSets] = await Promise.all([
    prisma.response.findMany({
      include: {
        problem: { select: { topicTags: true, number: true, problemSetId: true } },
      },
    }),
    prisma.problemSet.findMany({ select: { id: true, title: true, slug: true } }),
  ]);

  const setMap = new Map<string, { title: string; slug: string }>(
    problemSets.map((s: { id: string; title: string; slug: string }) => [
      s.id,
      { title: s.title, slug: s.slug },
    ]),
  );
  const topics = computeTopicAccuracy(responses);
  const questions = computeQuestionStats(responses, setMap).slice(0, 10);

  const totalResponses = responses.length;
  const correctCount = responses.filter((r: { isCorrect: boolean }) => r.isCorrect).length;
  const overallAccuracy =
    totalResponses > 0 ? Math.round((correctCount / totalResponses) * 100) : 0;

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
            <p className="eyebrow">Admin</p>
            <h1>Analytics overview</h1>
          </div>
          <div className="topbar-actions">
            <a className="secondary-action compact" href="/api/admin/export?type=attempts" download>
              <Download size={16} /> Export CSV
            </a>
            <Link className="secondary-action" href="/dashboard">
              <ArrowLeft size={18} /> Dashboard
            </Link>
          </div>
        </header>

        <section className="metric-grid" aria-label="Overview metrics">
          <article className="metric-card accent-cyan">
            <small>Total responses</small>
            <strong>{totalResponses}</strong>
          </article>
          <article className="metric-card accent-purple">
            <small>Overall accuracy</small>
            <strong>{overallAccuracy}%</strong>
          </article>
          <article className="metric-card accent-pink">
            <small>Topics tracked</small>
            <strong>{topics.length}</strong>
          </article>
          <article className="metric-card accent-orange">
            <small>Problem sets</small>
            <strong>{problemSets.length}</strong>
          </article>
        </section>
        <section className="heatmap-section">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Weak topics</p>
              <h2>Topic accuracy heatmap</h2>
            </div>
            <Flame size={20} />
          </div>
          {topics.length === 0 ? (
            <p style={{ color: "var(--color-muted)", fontWeight: 800 }}>No response data yet.</p>
          ) : (
            <div className="heatmap-grid">
              {topics.map((t) => {
                const level = accuracyLevel(t.accuracy);
                return (
                  <article key={t.topic} className={`accuracy-card level-${level}`}>
                    <strong>{t.topic}</strong>
                    <span className="accuracy-pct">{t.accuracy}%</span>
                    <div className="meter">
                      <span
                        className={`meter-fill fill-${level === "success" ? "cyan" : level === "warning" ? "orange" : "pink"}`}
                        style={{ width: `${t.accuracy}%` }}
                      />
                    </div>
                    <small>{t.total} responses</small>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel table-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Lowest performing</p>
              <h2>Hardest questions</h2>
            </div>
          </div>
          <div className="table-wrap">
            {questions.length === 0 ? (
              <p style={{ padding: 20, color: "var(--color-muted)", fontWeight: 800 }}>
                No data yet.
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Set</th>
                    <th>Q#</th>
                    <th>Responses</th>
                    <th>Accuracy</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={`${q.problemSetSlug}-${q.problemNumber}`}>
                      <td>
                        <Link href={`/problem-sets/${q.problemSetSlug}`} className="text-link">
                          {q.problemSetTitle}
                        </Link>
                      </td>
                      <td>Q{q.problemNumber}</td>
                      <td>{q.total}</td>
                      <td style={{ color: `var(--color-${accuracyLevel(q.accuracy)})` }}>
                        {q.accuracy}%
                      </td>
                      <td style={{ width: "30%" }}>
                        <div className="meter">
                          <span
                            className={`meter-fill fill-${accuracyLevel(q.accuracy) === "success" ? "cyan" : accuracyLevel(q.accuracy) === "warning" ? "orange" : "pink"}`}
                            style={{ width: `${q.accuracy}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
