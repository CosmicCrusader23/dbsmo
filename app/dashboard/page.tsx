import Link from "next/link";
import type { CSSProperties } from "react";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileJson,
  Megaphone,
  MessageSquareWarning,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { AuthButton } from "@/app/auth-button";
import { ThemeToggle } from "@/app/theme-toggle";
import { TypewriterGreeting } from "@/app/typewriter-greeting";
import { isVisibleToStudent } from "@/lib/visibility";
import { profilePathFromEmail } from "@/lib/user-profile";
import { computeBestAverageScore } from "@/lib/analytics";
import { normalizeTagList } from "@/lib/problem-tags";
import { compareProblemSetRecords } from "@/lib/problem-set-order";
import { displayNameFor, normalizeDisplayText } from "@/lib/display-name";
import { AssignmentsWidget } from "./assignments-widget";

export const dynamic = "force-dynamic";

type StudentSetRow = {
  slug: string;
  title: string;
  topics: string[];
  status: "Solved" | "Attempted" | "Not started" | "Review";
  bestScore: number;
  sortPriority: number;
};

const ACCENTS = ["cyan", "purple", "pink", "orange", "black", "grey"] as const;

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  const [currentUser, allSets, attempts, studentRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        displayName: true,
        avatarUrl: true,
        role: true,
      },
    }),
    prisma.problemSet.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { problems: true, attempts: true, feedback: true } },
      },
    }),
    prisma.attempt.findMany({
      where: { userId: session.user.id },
      include: {
        problemSet: {
          select: {
            id: true,
            slug: true,
            title: true,
            topicTags: true,
            order: true,
            difficulty: true,
          },
        },
        responses: {
          select: {
            isCorrect: true,
            problem: { select: { topicTags: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: 200,
    }),
    session.user.role === "ADMIN"
      ? prisma.user.findMany({
          where: { role: "STUDENT" },
          include: {
            attempts: {
              select: { score: true, maxScore: true, submittedAt: true, problemSetId: true },
              orderBy: { submittedAt: "desc" },
              take: 100,
            },
          },
        })
      : Promise.resolve([]),
  ]);

  if (!currentUser) {
    redirect("/");
  }

  const classAnnouncements = await prisma.announcement.findMany({
    where: {
      classes: {
        some: {
          members: {
            some: { studentId: currentUser.id },
          },
        },
      },
    },
    include: {
      createdBy: { select: { displayName: true, name: true, email: true } },
      classes: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const visibleSets = (
    currentUser.role === "ADMIN" ? allSets : allSets.filter((set) => isVisibleToStudent(set))
  ).sort(compareProblemSetRecords);

  const attemptsBySet = new Map<
    string,
    Array<{
      score: number;
      maxScore: number;
      attemptNumber: number;
      submittedAt: Date;
    }>
  >();

  for (const attempt of attempts) {
    const existing = attemptsBySet.get(attempt.problemSetId) ?? [];
    existing.push({
      score: attempt.score,
      maxScore: attempt.maxScore,
      attemptNumber: attempt.attemptNumber,
      submittedAt: attempt.submittedAt,
    });
    attemptsBySet.set(attempt.problemSetId, existing);
  }

  const setRows: StudentSetRow[] = visibleSets.map((set) => {
    const setAttempts = attemptsBySet.get(set.id) ?? [];
    const percentages = setAttempts.map((attempt) =>
      attempt.maxScore > 0 ? Math.round((attempt.score / attempt.maxScore) * 100) : 0,
    );
    const bestScore = percentages.length > 0 ? Math.max(...percentages) : 0;
    const latestScore = percentages[0] ?? null;

    let status: StudentSetRow["status"] = "Not started";
    if (percentages.length > 0) {
      status = bestScore >= 80 ? "Solved" : "Attempted";
      if (setAttempts.length >= 2 && latestScore !== null && latestScore < bestScore) {
        status = "Review";
      }
    }

    const topics = normalizeTagList(set.topicTags);

    return {
      slug: set.slug,
      title: set.title,
      topics: topics.length > 0 ? topics : ["General"],
      status,
      bestScore,
      sortPriority: setAttempts.length > 0 ? 0 : 1,
    };
  });

  const attemptedRows = setRows.filter((row) => row.status !== "Not started");
  const completedSets = attemptedRows.length;
  const totalSets = visibleSets.length;
  const completionPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  const averageScore = computeBestAverageScore(attempts);
  const latestAttempt = attempts[0] ?? null;
  const latestScore =
    latestAttempt && latestAttempt.maxScore > 0
      ? Math.round((latestAttempt.score / latestAttempt.maxScore) * 100)
      : 0;
  const openReports =
    currentUser.role === "ADMIN"
      ? visibleSets.reduce((sum, set) => sum + set._count.feedback, 0)
      : 0;
  const nextUnstartedSet = setRows.find((row) => row.status === "Not started") ?? null;
  const nextRetrySet =
    setRows
      .filter((row) => row.status === "Attempted" && row.bestScore < 80)
      .sort((a, b) => a.bestScore - b.bestScore)[0] ?? null;
  const nextSet =
    nextUnstartedSet ??
    nextRetrySet ??
    setRows.find((row) => row.status === "Attempted") ??
    setRows[0] ??
    null;
  const dashboardSetRows = [...setRows]
    .sort((a, b) => {
      return (
        a.sortPriority - b.sortPriority ||
        b.bestScore - a.bestScore ||
        a.title.localeCompare(b.title)
      );
    })
    .slice(0, 3);

  const topicMap = new Map<string, { correct: number; total: number }>();
  for (const attempt of attempts) {
    for (const response of attempt.responses) {
      const canonicalTopics = normalizeTagList(response.problem.topicTags);
      const topics = canonicalTopics.length > 0 ? canonicalTopics : ["General"];
      for (const topic of topics) {
        const stats = topicMap.get(topic) ?? { correct: 0, total: 0 };
        stats.total += 1;
        if (response.isCorrect) stats.correct += 1;
        topicMap.set(topic, stats);
      }
    }
  }

  const topicScores = Array.from(topicMap.entries())
    .map(([topic, stats], index) => ({
      topic,
      score: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      color: ACCENTS[index % ACCENTS.length],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  const weakestTopic = [...topicScores].sort((a, b) => a.score - b.score)[0]?.topic ?? null;
  const nextSetReason = nextUnstartedSet
    ? "new release"
    : nextRetrySet
      ? `retry: scored ${nextRetrySet.bestScore}%`
      : weakestTopic
        ? `weak topic: ${weakestTopic}`
        : "keep momentum";

  const adminRows =
    currentUser.role === "ADMIN"
      ? studentRows
          .map((student) => {
            const uniqueSets = new Set(student.attempts.map((attempt) => attempt.problemSetId));
            const average = computeBestAverageScore(student.attempts);
            const lastSeen =
              student.attempts.length > 0
                ? student.attempts.reduce(
                    (latest, attempt) =>
                      attempt.submittedAt > latest ? attempt.submittedAt : latest,
                    student.attempts[0].submittedAt,
                  )
                : null;

            return {
              name: displayNameFor(student, "Anonymous"),
              completed: uniqueSets.size,
              average,
              weakTopic: average < 60 ? "Needs review" : average < 80 ? "Mixed" : "Stable",
              lastSeen: lastSeen ? lastSeen.toLocaleDateString() : "—",
            };
          })
          .sort((a, b) => b.completed - a.completed || b.average - a.average)
          .slice(0, 6)
      : [];

  const continueHref = nextSet ? `/problem-sets/${nextSet.slug}` : "/admin/import";
  const profileHref = profilePathFromEmail(currentUser.email);
  const currentDisplayName = displayNameFor(currentUser, "there");

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {currentUser.role === "ADMIN" ? "Teacher view" : "Student view"}
            </p>
            <h1>training dashboard</h1>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <AuthButton
              avatarUrl={currentUser.avatarUrl}
              displayName={normalizeDisplayText(currentUser.displayName)}
              profileHref={profileHref}
              session={session}
            />
            {currentUser.role === "ADMIN" ? (
              <Link className="icon-button" href="/admin/import" aria-label="Import JSON">
                <FileJson size={18} />
              </Link>
            ) : null}
            <Link className="primary-action" href={continueHref}>
              {currentUser.role === "ADMIN"
                ? nextSet
                  ? "continue"
                  : "open import"
                : nextSet
                  ? "continue"
                  : "browse sets"}
              <ArrowRight size={18} />
            </Link>
          </div>
        </header>

        {classAnnouncements.length > 0 ? (
          <section className="dashboard-announcements" aria-label="Class announcements">
            <div className="dashboard-announcements-head">
              <p className="eyebrow">Pinned announcements</p>
              <h2>
                <Megaphone size={18} />
                Class messages
              </h2>
            </div>
            <div className="dashboard-announcement-list">
              {classAnnouncements.map((announcement) => {
                const author = displayNameFor(announcement.createdBy, "Unknown");
                return (
                  <article className="dashboard-announcement" key={announcement.id}>
                    <header>
                      <strong>{announcement.title}</strong>
                      <span>{announcement.createdAt.toLocaleDateString()}</span>
                    </header>
                    <p>{announcement.body}</p>
                    <footer>
                      <span>{announcement.classes.map((cls) => cls.name).join(", ")}</span>
                      <span>From {author}</span>
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">{nextSet ? `Next set: ${nextSet.title}` : "Platform setup"}</p>
            <h2>
              <TypewriterGreeting name={currentDisplayName} />
            </h2>
            {nextSet ? <span className="next-step-reason">{nextSetReason}</span> : null}
            <div className="hero-actions">
              <Link className="primary-action" href={continueHref}>
                {nextSet ? "Open current set" : "Import first set"}
                <PlayCircle size={18} />
              </Link>
              {currentUser.role === "ADMIN" ? (
                <Link className="secondary-action" href="/admin/import">
                  Upload JSON
                  <FileJson size={18} />
                </Link>
              ) : (
                <Link className="secondary-action" href="/problem-sets">
                  View sets
                  <ClipboardList size={18} />
                </Link>
              )}
            </div>
          </div>
          <div
            className="progress-orbit"
            aria-label={`${completedSets} of ${totalSets} sets attempted, ${completionPercent}% complete`}
          >
            <div
              className="progress-ring"
              style={{ "--progress-percent": `${completionPercent}%` } as CSSProperties}
            >
              <span>{completedSets}</span>
              <small>/ {totalSets}</small>
            </div>
            <div className="orbit-card orbit-card-one">
              <CheckCircle2 size={18} />
              {averageScore}% best avg
            </div>
            {currentUser.role === "ADMIN" ? (
              <div className="orbit-card orbit-card-two">
                <MessageSquareWarning size={18} />
                {openReports} reports
              </div>
            ) : null}
          </div>
        </section>

        <AssignmentsWidget />

        <section className="metric-grid" aria-label="Student progress metrics">
          <MetricCard label="Attempted" value={`${completedSets}/${totalSets || 0}`} />
          <MetricCard label="Best average" value={`${averageScore}%`} />
          <MetricCard label="Latest score" value={`${latestScore}%`} />
          {currentUser.role === "ADMIN" ? (
            <MetricCard label="Open reports" value={`${openReports}`} />
          ) : null}
        </section>

        <section className="content-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Student view</p>
                <h2>problem sets</h2>
              </div>
              {nextSet ? (
                <Link className="text-link" href={`/problem-sets/${nextSet.slug}`}>
                  View set
                </Link>
              ) : null}
            </div>
            <div className="set-list">
              {setRows.length === 0 ? (
                <div className="empty-inline-state">
                  <strong>No visible sets yet</strong>
                  <small>
                    {currentUser.role === "ADMIN"
                      ? "Import a JSON problem set to create the first draft."
                      : "Ask a teacher to publish a set for your group."}
                  </small>
                </div>
              ) : (
                dashboardSetRows.map((set) => (
                  <Link className="set-row" href={`/problem-sets/${set.slug}`} key={set.slug}>
                    <div className="set-main">
                      <span className={`status-dot status-${statusClass(set.status)}`} />
                      <div>
                        <strong>{set.title}</strong>
                        <small>{set.topics.join(" / ")}</small>
                      </div>
                    </div>
                    <div
                      className={`score-pill${set.bestScore === 100 ? " score-pill-complete" : ""}`}
                    >
                      {set.bestScore}%
                    </div>
                  </Link>
                ))
              )}
            </div>
            {setRows.length > dashboardSetRows.length ? (
              <div className="panel-footer-link">
                <Link className="text-link" href="/problem-sets">
                  View all {setRows.length} sets
                </Link>
              </div>
            ) : null}
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Strengths</p>
                <h2>topic map</h2>
              </div>
              <Sparkles size={20} />
            </div>
            <div className="topic-stack">
              {topicScores.length === 0 ? (
                <div className="empty-inline-state">
                  <strong>No response data yet</strong>
                  <small>Complete a set to start building topic accuracy.</small>
                </div>
              ) : (
                topicScores.map((topic) => (
                  <div className="topic-bar" key={topic.topic}>
                    <div className="topic-label">
                      <span>{topic.topic}</span>
                      <strong>{topic.score}%</strong>
                    </div>
                    <div className="meter">
                      <span
                        className={`meter-fill fill-${topic.color}`}
                        style={{ width: `${topic.score}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

        <section className="panel table-panel" id="analytics">
          <div className="panel-header">
            <div>
              <p className="eyebrow">
                {currentUser.role === "ADMIN" ? "Teacher view" : "Recent activity"}
              </p>
              <h2>{currentUser.role === "ADMIN" ? "cohort snapshot" : "attempt history"}</h2>
            </div>
            {currentUser.role === "ADMIN" ? (
              <Link className="secondary-action compact" href="/admin/import">
                Import
                <FileJson size={16} />
              </Link>
            ) : null}
          </div>
          <div className="table-wrap">
            {currentUser.role === "ADMIN" ? (
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Completed</th>
                    <th>Average</th>
                    <th>Weak topic</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {adminRows.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No student activity yet.</td>
                    </tr>
                  ) : (
                    adminRows.map((row) => (
                      <tr key={row.name}>
                        <td>{row.name}</td>
                        <td>{row.completed}</td>
                        <td>{row.average}%</td>
                        <td>{row.weakTopic}</td>
                        <td>{row.lastSeen}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
                  {attempts.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No attempts yet.</td>
                    </tr>
                  ) : (
                    attempts.slice(0, 8).map((attempt) => (
                      <tr key={attempt.id}>
                        <td>{attempt.problemSet.title}</td>
                        <td>#{attempt.attemptNumber}</td>
                        <td>
                          {attempt.score}/{attempt.maxScore} (
                          {attempt.maxScore > 0
                            ? Math.round((attempt.score / attempt.maxScore) * 100)
                            : 0}
                          %)
                        </td>
                        <td>{attempt.submittedAt.toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

function statusClass(status: string) {
  return status.toLowerCase().replace(/\s+/g, "-");
}
