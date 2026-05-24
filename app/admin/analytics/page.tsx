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
  range?: string;
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

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function startOfMonth(d: Date) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

type RangeKey = "7d" | "30d" | "6m" | "1y";
type Granularity = "day" | "week" | "month";

const RANGES: { key: RangeKey; label: string; short: string; points: number; granularity: Granularity }[] = [
  { key: "7d", label: "Last 7 days", short: "7d", points: 7, granularity: "day" },
  { key: "30d", label: "Last 30 days", short: "30d", points: 30, granularity: "day" },
  { key: "6m", label: "Last 6 months", short: "6m", points: 26, granularity: "week" },
  { key: "1y", label: "Last 12 months", short: "1y", points: 12, granularity: "month" },
];

function bucketKey(d: Date, granularity: Granularity) {
  if (granularity === "day") {
    const x = startOfDay(d);
    return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  }
  if (granularity === "week") {
    const x = startOfWeek(d);
    return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  }
  const x = startOfMonth(d);
  return `${x.getFullYear()}-${x.getMonth()}`;
}

function bucketStart(d: Date, granularity: Granularity) {
  if (granularity === "day") return startOfDay(d);
  if (granularity === "week") return startOfWeek(d);
  return startOfMonth(d);
}

function stepBucket(d: Date, granularity: Granularity, n: number) {
  const x = new Date(d);
  if (granularity === "day") x.setDate(x.getDate() + n);
  else if (granularity === "week") x.setDate(x.getDate() + n * 7);
  else x.setMonth(x.getMonth() + n);
  return x;
}

function bucketLabel(d: Date, granularity: Granularity) {
  if (granularity === "month") return MONTH_LABELS[d.getMonth()];
  return formatShortDate(d);
}

type TrendBucket = { label: string; date: Date; attempts: number; completions: number; avgPct: number };

function buildSmoothPath(
  points: { x: number; y: number }[],
  closeToBaseline?: number,
) {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    return closeToBaseline !== undefined
      ? `M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${p.x.toFixed(1)} ${closeToBaseline} Z`
      : `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  let d = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const t = 0.22;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  if (closeToBaseline !== undefined) {
    const last = points[points.length - 1];
    d += ` L${last.x.toFixed(1)} ${closeToBaseline} L${points[0].x.toFixed(1)} ${closeToBaseline} Z`;
  }
  return d;
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
  const rangeKey = (RANGES.find((r) => r.key === params.range)?.key ?? "6m") as RangeKey;
  const rangeConfig = RANGES.find((r) => r.key === rangeKey)!;

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

  // Trend buckets — granularity follows the selected range
  const trendNow = new Date();
  const trendBuckets: TrendBucket[] = [];
  const trendStart = bucketStart(trendNow, rangeConfig.granularity);
  for (let offset = rangeConfig.points - 1; offset >= 0; offset--) {
    const start = stepBucket(trendStart, rangeConfig.granularity, -offset);
    trendBuckets.push({
      label: bucketLabel(start, rangeConfig.granularity),
      date: start,
      attempts: 0,
      completions: 0,
      avgPct: 0,
    });
  }
  const trendIndex = new Map<string, number>(
    trendBuckets.map((b, i) => [bucketKey(b.date, rangeConfig.granularity), i]),
  );
  const trendSums = trendBuckets.map(() => ({ pctSum: 0, pctCount: 0 }));
  for (const attempt of attempts) {
    const key = bucketKey(attempt.submittedAt, rangeConfig.granularity);
    const idx = trendIndex.get(key);
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
  const trendTotalAttempts = trendBuckets.reduce((s, b) => s + b.attempts, 0);
  const trendTotalCompletions = trendBuckets.reduce((s, b) => s + b.completions, 0);
  const trendCompletionRate =
    trendTotalAttempts > 0 ? Math.round((trendTotalCompletions / trendTotalAttempts) * 100) : 0;

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

  // SVG geometry — leaves padding for axis labels
  const CHART_W = 760;
  const CHART_H = 320;
  const PAD_L = 40;
  const PAD_R = 16;
  const PAD_T = 10;
  const PAD_B = 28;
  const PLOT_W = CHART_W - PAD_L - PAD_R;
  const PLOT_H = CHART_H - PAD_T - PAD_B;
  const maxAttemptsBucket = Math.max(1, ...trendBuckets.map((b) => b.attempts));
  const stepX = trendBuckets.length > 1 ? PLOT_W / (trendBuckets.length - 1) : 0;
  const trendPoints = trendBuckets.map((b, i) => ({
    x: PAD_L + i * stepX,
    y: PAD_T + PLOT_H - (b.attempts / maxAttemptsBucket) * PLOT_H,
    bucket: b,
    index: i,
  }));
  const baseline = PAD_T + PLOT_H;
  const linePath = buildSmoothPath(trendPoints.map((p) => ({ x: p.x, y: p.y })));
  const areaPath = buildSmoothPath(
    trendPoints.map((p) => ({ x: p.x, y: p.y })),
    baseline,
  );
  const yTicks = (() => {
    const max = maxAttemptsBucket;
    const step = Math.max(1, Math.ceil(max / 4));
    const ticks: number[] = [];
    for (let v = 0; v <= max; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== max) ticks.push(max);
    return ticks;
  })();
  const xTickIndices = (() => {
    const len = trendBuckets.length;
    if (len <= 8) return trendBuckets.map((_, i) => i);
    const target = 6;
    const stride = Math.max(1, Math.ceil((len - 1) / (target - 1)));
    const idxs: number[] = [];
    for (let i = 0; i < len; i += stride) idxs.push(i);
    if (idxs[idxs.length - 1] !== len - 1) idxs.push(len - 1);
    return idxs;
  })();

  const maxDaily = Math.max(1, ...dailyBuckets.map((b) => b.count));

  function rangeHref(key: RangeKey) {
    const sp = new URLSearchParams();
    if (selectedSet) sp.set("set", selectedSet.slug);
    if (selectedStudent) sp.set("student", selectedStudent.id);
    if (selectedGroup) sp.set("group", selectedGroup);
    if (selectedTopic) sp.set("topic", selectedTopic);
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    sp.set("range", key);
    return `/admin/analytics?${sp.toString()}`;
  }

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

        <section className="panel analytics-chart-panel chart-card">
          <div className="panel-header chart-card-header">
            <div>
              <p className="eyebrow">Completion trends</p>
              <h2>{rangeConfig.label}</h2>
              <p className="chart-card-description">
                {trendTotalAttempts} attempts · {trendTotalCompletions} completions ·{" "}
                {trendCompletionRate}% completion rate
              </p>
            </div>
            <nav className="range-toggle" aria-label="Time range">
              {RANGES.map((r) => (
                <Link
                  key={r.key}
                  href={rangeHref(r.key)}
                  className={`range-toggle-btn${r.key === rangeKey ? " active" : ""}`}
                  scroll={false}
                >
                  {r.short}
                </Link>
              ))}
            </nav>
          </div>
          {trendTotalAttempts === 0 ? (
            <p className="analytics-empty">No attempts in this window yet.</p>
          ) : (
            <div className="chart-wrap">
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label={`Attempts over ${rangeConfig.label.toLowerCase()}`}
              >
                <defs>
                  <linearGradient id="attemptsArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-pink)" stopOpacity="0.45" />
                    <stop offset="55%" stopColor="var(--color-pink)" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="var(--color-pink)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {yTicks.map((v) => {
                  const y = PAD_T + PLOT_H - (v / maxAttemptsBucket) * PLOT_H;
                  return (
                    <g key={v}>
                      <line
                        x1={PAD_L}
                        x2={PAD_L + PLOT_W}
                        y1={y}
                        y2={y}
                        stroke="var(--color-border)"
                        strokeWidth={1}
                        opacity={0.55}
                      />
                      <text
                        x={PAD_L - 8}
                        y={y + 3}
                        textAnchor="end"
                        fill="var(--color-muted)"
                        fontSize={11}
                        fontWeight={700}
                      >
                        {v}
                      </text>
                    </g>
                  );
                })}
                <path d={areaPath} fill="url(#attemptsArea)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="var(--color-pink)"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {xTickIndices.map((i) => {
                  const p = trendPoints[i];
                  return (
                    <text
                      key={i}
                      x={p.x}
                      y={CHART_H - 6}
                      textAnchor="middle"
                      fill="var(--color-muted)"
                      fontSize={11}
                      fontWeight={700}
                    >
                      {p.bucket.label}
                    </text>
                  );
                })}
                {trendPoints.map((p) => (
                  <g key={p.index}>
                    <title>
                      {p.bucket.label}: {p.bucket.attempts} attempts ·{" "}
                      {p.bucket.completions} completions ·{" "}
                      {p.bucket.avgPct || 0}% avg
                    </title>
                    <rect
                      x={p.x - Math.max(8, stepX / 2)}
                      y={PAD_T}
                      width={Math.max(16, stepX)}
                      height={PLOT_H}
                      fill="transparent"
                    />
                  </g>
                ))}
              </svg>
            </div>
          )}
          <div className="chart-card-footer">
            <span className="chart-card-foot-line">
              <span className="legend-dot legend-dot-pink" /> Attempts per{" "}
              {rangeConfig.granularity === "day"
                ? "day"
                : rangeConfig.granularity === "week"
                  ? "week"
                  : "month"}
            </span>
            <span className="chart-card-foot-muted">
              ≥80% scores count as completions
            </span>
          </div>
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
