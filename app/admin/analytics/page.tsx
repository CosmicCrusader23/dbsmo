import Link from "next/link";
import { ArrowLeft, Download, Flame } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import {
  computeTopicAccuracy,
  computeQuestionStats,
  computeScoreBuckets,
  accuracyLevel,
} from "@/lib/analytics";
import { normalizeTagList } from "@/lib/problem-tags";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type AnalyticsSearchParams = Promise<{
  from?: string;
  group?: string;
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

function formatShortDate(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

type TrendBucket = { label: string; attempts: number; completions: number; avgPct: number };

function buildLinePath(values: number[], width: number, height: number, max: number) {
  if (values.length === 0 || max <= 0) return "";
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildAreaPath(values: number[], width: number, height: number, max: number) {
  if (values.length === 0 || max <= 0) return "";
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const top = values
    .map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return `${top} L${(values.length - 1) * step} ${height} L0 ${height} Z`;
}

export default async function AnalyticsOverviewPage({
  searchParams,
}: {
  searchParams?: AnalyticsSearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!hasPermission(session.user.role, "admin:analytics")) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const fromDate = parseDateParam(params.from);
  const toDate = parseDateParam(params.to, true);

  const [problemSets, students, allProblems] = await Promise.all([
    prisma.problemSet.findMany({
      select: { id: true, title: true, slug: true, status: true, _count: { select: { problems: true } } },
    }),
    prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, name: true, email: true, displayName: true, group: true },
      orderBy: { name: "asc" },
    }),
    prisma.problem.findMany({ select: { topicTags: true } }),
  ]);

  const selectedSet = problemSets.find((set) => set.slug === params.set) ?? null;
  const selectedTopic = params.topic?.trim() || "";
  const selectedGroup = params.group?.trim() || "";
  const selectedStudent = students.find((student) => student.id === params.student) ?? null;
  const groupOptions = Array.from(
    new Set(
      students.map((student) => student.group).filter((group): group is string => Boolean(group)),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const topicOptions = normalizeTagList(allProblems.flatMap((problem) => problem.topicTags)).sort(
    (a, b) => a.localeCompare(b),
  );

  const problemWhere: Prisma.ProblemWhereInput = {
    ...(selectedSet ? { problemSetId: selectedSet.id } : {}),
    ...(selectedTopic ? { topicTags: { has: selectedTopic } } : {}),
  };

  const responseWhere: Prisma.ResponseWhereInput = {
    ...(Object.keys(problemWhere).length > 0 ? { problem: problemWhere } : {}),
    ...(selectedStudent || selectedGroup || fromDate || toDate
      ? {
          attempt: {
            ...(selectedStudent ? { userId: selectedStudent.id } : {}),
            ...(selectedGroup ? { user: { group: selectedGroup } } : {}),
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
    ...(selectedGroup ? { user: { group: selectedGroup } } : {}),
    ...(fromDate || toDate
      ? {
          submittedAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };

  const [responses, attempts, feedbackGroups, attemptStudents] = await Promise.all([
    prisma.response.findMany({
      where: responseWhere,
      include: {
        attempt: { select: { attemptNumber: true, submittedAt: true, userId: true } },
        problem: { select: { id: true, topicTags: true, number: true, problemSetId: true } },
      },
      orderBy: { attempt: { submittedAt: "desc" } },
      take: 4_000,
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
      take: 4_000,
    }),
    prisma.feedbackReport.groupBy({
      by: ["problemId"],
      _count: { _all: true },
      where: { problemId: { not: null } },
    }),
    prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, name: true, displayName: true, email: true },
    }),
  ]);

  const setMap = new Map<string, { title: string; slug: string }>(
    problemSets.map((s) => [s.id, { title: s.title, slug: s.slug }]),
  );
  const topics = computeTopicAccuracy(responses);
  const questions = computeQuestionStats(responses, setMap).slice(0, 10);
  const feedbackByProblem = new Map(
    feedbackGroups
      .filter((group) => group.problemId)
      .map((group) => [group.problemId as string, group._count._all]),
  );
  const studentMap = new Map(
    attemptStudents.map((s) => [s.id, s.displayName || s.name || s.email]),
  );

  const totalResponses = responses.length;
  const correctCount = responses.filter((r) => r.isCorrect).length;
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
  const activeStudentCount = new Set(
    attempts
      .filter((a) => a.submittedAt >= recentCutoff)
      .map((a) => a.userId),
  ).size;

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

  // 6-week trend buckets, anchored to weeks
  const trendNow = new Date();
  const currentWeekStart = startOfWeek(trendNow);
  const trendBuckets: TrendBucket[] = [];
  for (let offset = 5; offset >= 0; offset--) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - offset * 7);
    trendBuckets.push({
      label: formatShortDate(start),
      attempts: 0,
      completions: 0,
      avgPct: 0,
    });
  }
  const trendIndex = new Map<string, number>(
    trendBuckets.map((b, i) => [b.label, i]),
  );
  const trendSums = trendBuckets.map(() => ({ pctSum: 0, pctCount: 0 }));
  for (const attempt of attempts) {
    const ageDays = Math.floor((trendNow.getTime() - attempt.submittedAt.getTime()) / 86_400_000);
    if (ageDays < 0) continue;
    const bucketStart = startOfWeek(attempt.submittedAt);
    const label = formatShortDate(bucketStart);
    const idx = trendIndex.get(label);
    if (idx === undefined) continue;
    trendBuckets[idx].attempts += 1;
    if (attempt.maxScore > 0) {
      const pct = (attempt.score / attempt.maxScore) * 100;
      trendSums[idx].pctSum += pct;
      trendSums[idx].pctCount += 1;
      if (pct >= 80) trendBuckets[idx].completions += 1;
    }
  }
  for (let i = 0; i < trendBuckets.length; i++) {
    if (trendSums[i].pctCount > 0) {
      trendBuckets[i].avgPct = Math.round(trendSums[i].pctSum / trendSums[i].pctCount);
    }
  }

  // Daily activity for last 30 days
  const dailyBuckets: { label: string; date: Date; count: number }[] = [];
  const dailyIndex = new Map<string, number>();
  for (let offset = 29; offset >= 0; offset--) {
    const d = new Date(trendNow);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    dailyIndex.set(key, dailyBuckets.length);
    dailyBuckets.push({ label: formatShortDate(d), date: d, count: 0 });
  }
  for (const attempt of attempts) {
    const d = attempt.submittedAt;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const idx = dailyIndex.get(key);
    if (idx !== undefined) dailyBuckets[idx].count += 1;
  }

  // Score distribution
  const scoreBuckets = computeScoreBuckets(
    Array.from(bestAttemptByUserSet.entries()).map(([key, pct]) => ({
      score: pct,
      maxScore: 100,
    })),
  );
  const totalDistAttempts = scoreBuckets.reduce((s, b) => s + b.count, 0);

  // Top students by best-attempt average across the filtered scope
  type StudentRow = { id: string; name: string; sets: number; avg: number; recent: number };
  const studentAgg = new Map<
    string,
    { totalPct: number; setKeys: Set<string>; recent: number }
  >();
  for (const [key, pct] of bestAttemptByUserSet.entries()) {
    const [userId, setId] = key.split(":");
    const entry = studentAgg.get(userId) ?? {
      totalPct: 0,
      setKeys: new Set<string>(),
      recent: 0,
    };
    entry.totalPct += pct;
    entry.setKeys.add(setId);
    studentAgg.set(userId, entry);
  }
  for (const a of attempts) {
    if (a.submittedAt >= recentCutoff) {
      const entry = studentAgg.get(a.userId);
      if (entry) entry.recent += 1;
    }
  }
  const topStudents: StudentRow[] = Array.from(studentAgg.entries())
    .map(([id, v]) => ({
      id,
      name: studentMap.get(id) ?? "—",
      sets: v.setKeys.size,
      avg: v.setKeys.size > 0 ? Math.round(v.totalPct / v.setKeys.size) : 0,
      recent: v.recent,
    }))
    .sort((a, b) => b.avg - a.avg || b.sets - a.sets)
    .slice(0, 8);

  // Set completion rates
  type SetRow = {
    title: string;
    slug: string;
    attempts: number;
    students: number;
    avgBest: number;
    completionRate: number;
  };
  const perSet = new Map<
    string,
    { attempts: number; users: Set<string>; pcts: number[]; bestByUser: Map<string, number> }
  >();
  for (const a of attempts) {
    const entry = perSet.get(a.problemSetId) ?? {
      attempts: 0,
      users: new Set<string>(),
      pcts: [],
      bestByUser: new Map<string, number>(),
    };
    entry.attempts += 1;
    entry.users.add(a.userId);
    if (a.maxScore > 0) {
      const pct = (a.score / a.maxScore) * 100;
      entry.pcts.push(pct);
      entry.bestByUser.set(a.userId, Math.max(entry.bestByUser.get(a.userId) ?? 0, pct));
    }
    perSet.set(a.problemSetId, entry);
  }
  const setRows: SetRow[] = Array.from(perSet.entries())
    .map(([id, v]) => {
      const meta = setMap.get(id);
      const bests = Array.from(v.bestByUser.values());
      const avgBest =
        bests.length > 0 ? Math.round(bests.reduce((s, n) => s + n, 0) / bests.length) : 0;
      const completedUsers = bests.filter((p) => p >= 80).length;
      return {
        title: meta?.title ?? "—",
        slug: meta?.slug ?? "",
        attempts: v.attempts,
        students: v.users.size,
        avgBest,
        completionRate:
          v.users.size > 0 ? Math.round((completedUsers / v.users.size) * 100) : 0,
      };
    })
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 10);

  // SVG geometry
  const CHART_W = 760;
  const CHART_H = 320;
  const maxAttemptsBucket = Math.max(1, ...trendBuckets.map((b) => b.attempts));
  const attemptsPath = buildLinePath(
    trendBuckets.map((b) => b.attempts),
    CHART_W,
    CHART_H,
    maxAttemptsBucket,
  );
  const completionsPath = buildLinePath(
    trendBuckets.map((b) => b.completions),
    CHART_W,
    CHART_H,
    maxAttemptsBucket,
  );
  const attemptsArea = buildAreaPath(
    trendBuckets.map((b) => b.attempts),
    CHART_W,
    CHART_H,
    maxAttemptsBucket,
  );

  const maxDaily = Math.max(1, ...dailyBuckets.map((b) => b.count));

  return (
    <main className="single-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
        <span className="bg-spark bg-spark-two" />
      </div>
      <div className="page-frame analytics-frame">
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
          <select aria-label="Filter by cohort" name="group" defaultValue={selectedGroup}>
            <option value="">All cohorts</option>
            {groupOptions.map((group) => (
              <option key={group} value={group}>
                {group}
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
          {selectedSet ||
          selectedStudent ||
          selectedGroup ||
          selectedTopic ||
          params.from ||
          params.to ? (
            <Link className="text-link" href="/admin/analytics">
              Clear
            </Link>
          ) : null}
        </form>

        <section className="metric-grid analytics-metric-grid" aria-label="Overview metrics">
          <article className="metric-card accent-cyan">
            <small>Total responses</small>
            <strong>{totalResponses}</strong>
          </article>
          <article className="metric-card accent-purple">
            <small>Overall accuracy</small>
            <strong>{overallAccuracy}%</strong>
          </article>
          <article className="metric-card accent-pink">
            <small>First attempt avg</small>
            <strong>{firstAttemptAccuracy}%</strong>
          </article>
          <article className="metric-card accent-orange">
            <small>Best attempt avg</small>
            <strong>{bestAttemptAccuracy}%</strong>
          </article>
          <article className="metric-card accent-cyan">
            <small>Active last 7d</small>
            <strong>{activeStudentCount}</strong>
          </article>
          <article className="metric-card accent-purple">
            <small>Attempts last 7d</small>
            <strong>{recentAttemptCount}</strong>
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

        <section className="panel analytics-chart-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Completion trends</p>
              <h2>Last 6 weeks</h2>
            </div>
            <div className="chart-legend">
              <span className="legend-key legend-attempts">Attempts</span>
              <span className="legend-key legend-completions">Completions</span>
            </div>
          </div>
          {maxAttemptsBucket <= 1 && trendBuckets.every((b) => b.attempts === 0) ? (
            <p className="analytics-empty">No attempts in this window yet.</p>
          ) : (
            <div className="chart-wrap">
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H + 36}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Weekly attempts and completions"
              >
                <defs>
                  <linearGradient id="attemptsArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-pink)" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="var(--color-pink)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[0.25, 0.5, 0.75].map((t) => (
                  <line
                    key={t}
                    x1={0}
                    x2={CHART_W}
                    y1={CHART_H * t}
                    y2={CHART_H * t}
                    stroke="var(--color-border)"
                    strokeDasharray="4 6"
                    opacity="0.5"
                  />
                ))}
                <path d={attemptsArea} fill="url(#attemptsArea)" />
                <path
                  d={attemptsPath}
                  fill="none"
                  stroke="var(--color-pink)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={completionsPath}
                  fill="none"
                  stroke="var(--color-cyan)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="6 5"
                />
                {trendBuckets.map((b, i) => {
                  const x = (i / Math.max(1, trendBuckets.length - 1)) * CHART_W;
                  const yA = CHART_H - (b.attempts / maxAttemptsBucket) * CHART_H;
                  const yC = CHART_H - (b.completions / maxAttemptsBucket) * CHART_H;
                  return (
                    <g key={b.label}>
                      <circle cx={x} cy={yA} r={4} fill="var(--color-pink)" />
                      <circle
                        cx={x}
                        cy={yC}
                        r={4}
                        fill="var(--color-card-bg)"
                        stroke="var(--color-cyan)"
                        strokeWidth={2}
                      />
                      <text
                        x={x}
                        y={CHART_H + 24}
                        textAnchor="middle"
                        fill="var(--color-muted)"
                        fontSize={11}
                        fontWeight={700}
                      >
                        {b.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className="chart-summary">
                {trendBuckets.map((b) => (
                  <div key={b.label} className="chart-summary-cell">
                    <span className="chart-summary-week">{b.label}</span>
                    <strong>{b.attempts}</strong>
                    <small>
                      {b.completions} done · {b.avgPct || 0}% avg
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="analytics-row">
          <section className="panel analytics-chart-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Daily activity</p>
                <h2>Last 30 days</h2>
              </div>
            </div>
            {dailyBuckets.every((b) => b.count === 0) ? (
              <p className="analytics-empty">No attempts in the last 30 days.</p>
            ) : (
              <div className="daily-bars">
                {dailyBuckets.map((b) => (
                  <div className="daily-bar" key={b.label} title={`${b.label}: ${b.count} attempts`}>
                    <span
                      style={{
                        height: `${Math.max(4, (b.count / maxDaily) * 100)}%`,
                        opacity: b.count === 0 ? 0.18 : 1,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel analytics-chart-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Score distribution</p>
                <h2>Best attempt per student × set</h2>
              </div>
            </div>
            {totalDistAttempts === 0 ? (
              <p className="analytics-empty">No graded attempts yet.</p>
            ) : (
              <ul className="score-dist">
                {scoreBuckets.map((b) => {
                  const pct = totalDistAttempts > 0 ? (b.count / totalDistAttempts) * 100 : 0;
                  const tier =
                    b.min >= 81 ? "success" : b.min >= 41 ? "warning" : "danger";
                  return (
                    <li key={b.label}>
                      <span className="score-dist-label">{b.label}</span>
                      <span className="score-dist-track">
                        <span
                          className={`score-dist-fill tier-${tier}`}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <strong>{b.count}</strong>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section className="panel heatmap-section analytics-heatmap">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Weak topics</p>
              <h2>Topic accuracy heatmap</h2>
            </div>
            <Flame size={20} />
          </div>
          {topics.length === 0 ? (
            <p className="analytics-empty">No response data yet.</p>
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

        <div className="analytics-row">
          <section className="panel table-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Leaders</p>
                <h2>Top students</h2>
              </div>
            </div>
            <div className="table-wrap">
              {topStudents.length === 0 ? (
                <p className="analytics-empty">No graded attempts in this filter.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Sets</th>
                      <th>Avg best</th>
                      <th>Last 7d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topStudents.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{s.sets}</td>
                        <td style={{ color: `var(--color-${accuracyLevel(s.avg)})` }}>{s.avg}%</td>
                        <td>{s.recent}</td>
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
                <p className="eyebrow">By problem set</p>
                <h2>Engagement & completion</h2>
              </div>
            </div>
            <div className="table-wrap">
              {setRows.length === 0 ? (
                <p className="analytics-empty">No attempts in this filter.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Set</th>
                      <th>Attempts</th>
                      <th>Students</th>
                      <th>Avg best</th>
                      <th>≥80%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setRows.map((s) => (
                      <tr key={s.slug}>
                        <td>
                          <Link href={`/problem-sets/${s.slug}`} className="text-link">
                            {s.title}
                          </Link>
                        </td>
                        <td>{s.attempts}</td>
                        <td>{s.students}</td>
                        <td style={{ color: `var(--color-${accuracyLevel(s.avgBest)})` }}>
                          {s.avgBest}%
                        </td>
                        <td>{s.completionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        <section className="panel table-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Review signals</p>
              <h2>Suspicious answer keys</h2>
            </div>
          </div>
          <div className="table-wrap">
            {suspiciousQuestions.length === 0 ? (
              <p className="analytics-empty">No suspicious questions in the current filter.</p>
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
              <p className="analytics-empty">No data yet.</p>
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
