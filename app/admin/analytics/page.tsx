import Link from "next/link";
import { ArrowLeft, Download, Flame } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeTopicAccuracy, computeQuestionStats, accuracyLevel } from "@/lib/analytics";
import { normalizeTagList } from "@/lib/problem-tags";

export const dynamic = "force-dynamic";

type AnalyticsSearchParams = Promise<{
  from?: string;
  set?: string;
  student?: string;
  to?: string;
  topic?: string;
}>;

function parseDateParam(value: string | undefined, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

export default async function AnalyticsOverviewPage({
  searchParams,
}: {
  searchParams?: AnalyticsSearchParams;
}) {
  const params = (await searchParams) ?? {};
  const fromDate = parseDateParam(params.from);
  const toDate = parseDateParam(params.to, true);

  const [problemSets, students, allProblems] = await Promise.all([
    prisma.problemSet.findMany({ select: { id: true, title: true, slug: true } }),
    prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, name: true, email: true, displayName: true },
      orderBy: { name: "asc" },
    }),
    prisma.problem.findMany({ select: { topicTags: true } }),
  ]);

  const selectedSet = problemSets.find((set) => set.slug === params.set) ?? null;
  const selectedTopic = params.topic?.trim() || "";
  const selectedStudent = students.find((student) => student.id === params.student) ?? null;
  const topicOptions = normalizeTagList(allProblems.flatMap((problem) => problem.topicTags)).sort(
    (a, b) => a.localeCompare(b),
  );

  const problemWhere: Prisma.ProblemWhereInput = {
    ...(selectedSet ? { problemSetId: selectedSet.id } : {}),
    ...(selectedTopic ? { topicTags: { has: selectedTopic } } : {}),
  };

  const responseWhere: Prisma.ResponseWhereInput = {
    ...(Object.keys(problemWhere).length > 0 ? { problem: problemWhere } : {}),
    ...(selectedStudent || fromDate || toDate
      ? {
          attempt: {
            ...(selectedStudent ? { userId: selectedStudent.id } : {}),
            ...(fromDate || toDate
              ? {
                  submittedAt: {
                    ...(fromDate ? { gte: fromDate } : {}),
                    ...(toDate ? { lte: toDate } : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
  };

  const attemptWhere: Prisma.AttemptWhereInput = {
    ...(selectedSet ? { problemSetId: selectedSet.id } : {}),
    ...(selectedStudent ? { userId: selectedStudent.id } : {}),
    ...(fromDate || toDate
      ? {
          submittedAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };

  const [responses, attempts, feedbackGroups] = await Promise.all([
    prisma.response.findMany({
      where: responseWhere,
      include: {
        attempt: { select: { attemptNumber: true, submittedAt: true, userId: true } },
        problem: { select: { id: true, topicTags: true, number: true, problemSetId: true } },
      },
      orderBy: { attempt: { submittedAt: "desc" } },
      take: 2_000,
    }),
    prisma.attempt.findMany({
      where: attemptWhere,
      select: {
        attemptNumber: true,
        score: true,
        maxScore: true,
        problemSetId: true,
        submittedAt: true,
        userId: true,
      },
      orderBy: { submittedAt: "asc" },
      take: 2_000,
    }),
    prisma.feedbackReport.groupBy({
      by: ["problemId"],
      _count: { _all: true },
      where: { problemId: { not: null } },
    }),
  ]);

  const setMap = new Map<string, { title: string; slug: string }>(
    problemSets.map((s: { id: string; title: string; slug: string }) => [
      s.id,
      { title: s.title, slug: s.slug },
    ]),
  );
  const topics = computeTopicAccuracy(responses);
  const questions = computeQuestionStats(responses, setMap).slice(0, 10);
  const feedbackByProblem = new Map(
    feedbackGroups
      .filter((group) => group.problemId)
      .map((group) => [group.problemId as string, group._count._all]),
  );

  const totalResponses = responses.length;
  const correctCount = responses.filter((r: { isCorrect: boolean }) => r.isCorrect).length;
  const overallAccuracy =
    totalResponses > 0 ? Math.round((correctCount / totalResponses) * 100) : 0;
  const firstAttempts = attempts.filter((attempt) => attempt.attemptNumber === 1);
  const firstAttemptAccuracy =
    firstAttempts.length > 0
      ? Math.round(
          firstAttempts.reduce(
            (sum, attempt) =>
              sum + (attempt.maxScore > 0 ? (attempt.score / attempt.maxScore) * 100 : 0),
            0,
          ) / firstAttempts.length,
        )
      : 0;
  const bestAttemptByUserSet = new Map<string, number>();
  for (const attempt of attempts) {
    const key = `${attempt.userId}:${attempt.problemSetId}`;
    const pct = attempt.maxScore > 0 ? (attempt.score / attempt.maxScore) * 100 : 0;
    bestAttemptByUserSet.set(key, Math.max(bestAttemptByUserSet.get(key) ?? 0, pct));
  }
  const bestScores = Array.from(bestAttemptByUserSet.values());
  const bestAttemptAccuracy =
    bestScores.length > 0
      ? Math.round(bestScores.reduce((sum, score) => sum + score, 0) / bestScores.length)
      : 0;
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 7);
  const recentAttemptCount = attempts.filter(
    (attempt) => attempt.submittedAt >= recentCutoff,
  ).length;
  const suspiciousQuestions = questions
    .map((question) => {
      const matchingResponses = responses.filter(
        (response) =>
          response.problem.problemSetId ===
            problemSets.find((set) => set.slug === question.problemSetSlug)?.id &&
          response.problem.number === question.problemNumber,
      );
      const feedbackCount = matchingResponses.reduce(
        (sum, response) => sum + (feedbackByProblem.get(response.problem.id) ?? 0),
        0,
      );
      const reasons = [
        question.total >= 2 && question.accuracy <= 35 ? "low accuracy" : null,
        feedbackCount > 0
          ? `${feedbackCount} feedback report${feedbackCount === 1 ? "" : "s"}`
          : null,
      ].filter(Boolean);

      return { ...question, reasons };
    })
    .filter((question) => question.reasons.length > 0)
    .slice(0, 6);

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

        <form action="/admin/analytics" className="search-panel analytics-filter-panel">
          <select aria-label="Filter by set" name="set" defaultValue={selectedSet?.slug ?? ""}>
            <option value="">All sets</option>
            {problemSets.map((set) => (
              <option key={set.id} value={set.slug}>
                {set.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by student"
            name="student"
            defaultValue={selectedStudent?.id ?? ""}
          >
            <option value="">All students</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.displayName || student.name || student.email}
              </option>
            ))}
          </select>
          <select aria-label="Filter by topic" name="topic" defaultValue={selectedTopic}>
            <option value="">All topics</option>
            {topicOptions.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
          <input aria-label="From date" name="from" type="date" defaultValue={params.from ?? ""} />
          <input aria-label="To date" name="to" type="date" defaultValue={params.to ?? ""} />
          <button className="secondary-action compact" type="submit">
            Filter
          </button>
          {selectedSet || selectedStudent || selectedTopic || params.from || params.to ? (
            <Link className="text-link" href="/admin/analytics">
              Clear
            </Link>
          ) : null}
        </form>

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
          <article className="metric-card accent-cyan">
            <small>First attempt avg</small>
            <strong>{firstAttemptAccuracy}%</strong>
          </article>
          <article className="metric-card accent-purple">
            <small>Best attempt avg</small>
            <strong>{bestAttemptAccuracy}%</strong>
          </article>
          <article className="metric-card accent-pink">
            <small>Last 7 days</small>
            <strong>{recentAttemptCount}</strong>
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
              <p className="eyebrow">Review signals</p>
              <h2>Suspicious answer keys</h2>
            </div>
          </div>
          <div className="table-wrap">
            {suspiciousQuestions.length === 0 ? (
              <p style={{ padding: 20, color: "var(--color-muted)", fontWeight: 800 }}>
                No suspicious questions in the current filter.
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Set</th>
                    <th>Q#</th>
                    <th>Accuracy</th>
                    <th>Signals</th>
                  </tr>
                </thead>
                <tbody>
                  {suspiciousQuestions.map((question) => (
                    <tr key={`${question.problemSetSlug}-${question.problemNumber}`}>
                      <td>
                        <Link
                          href={`/problem-sets/${question.problemSetSlug}`}
                          className="text-link"
                        >
                          {question.problemSetTitle}
                        </Link>
                      </td>
                      <td>Q{question.problemNumber}</td>
                      <td>{question.accuracy}%</td>
                      <td>{question.reasons.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
