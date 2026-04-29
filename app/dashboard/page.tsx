import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileArchive,
  Gauge,
  ListChecks,
  MessageSquareWarning,
  PenLine,
  PlayCircle,
  Settings,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { AuthButton } from "@/app/auth-button";
import { ThemeToggle } from "@/app/theme-toggle";
import { TypewriterGreeting } from "@/app/typewriter-greeting";
import { isVisibleToStudent } from "@/lib/visibility";

export const dynamic = "force-dynamic";

type StudentSetRow = {
  slug: string;
  title: string;
  topics: string[];
  status: "Solved" | "Attempted" | "Not started" | "Review";
  bestScore: number;
};

const ACCENTS = ["cyan", "purple", "pink", "orange"] as const;

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  const [currentUser, allSets, attempts, studentRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, group: true, name: true, displayName: true, role: true },
    }),
    prisma.problemSet.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
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
        responses: { include: { problem: { select: { topicTags: true } } } },
      },
      orderBy: { submittedAt: "desc" },
    }),
    session.user.role === "ADMIN"
      ? prisma.user.findMany({
          where: { role: "STUDENT" },
          include: {
            attempts: {
              select: { score: true, maxScore: true, submittedAt: true, problemSetId: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  if (!currentUser) {
    redirect("/");
  }

  const visibleSets =
    currentUser.role === "ADMIN"
      ? allSets
      : allSets.filter((set) =>
          isVisibleToStudent(set, currentUser.group ? [currentUser.group] : []),
        );

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

    return {
      slug: set.slug,
      title: set.title,
      topics: set.topicTags.length > 0 ? set.topicTags : ["General"],
      status,
      bestScore,
    };
  });

  const attemptedRows = setRows.filter((row) => row.status !== "Not started");
  const completedSets = attemptedRows.length;
  const totalSets = visibleSets.length;
  const averageScore =
    attemptedRows.length > 0
      ? Math.round(
          attemptedRows.reduce((sum, row) => sum + row.bestScore, 0) / attemptedRows.length,
        )
      : 0;
  const latestAttempt = attempts[0] ?? null;
  const latestScore =
    latestAttempt && latestAttempt.maxScore > 0
      ? Math.round((latestAttempt.score / latestAttempt.maxScore) * 100)
      : 0;
  const openReports = visibleSets.reduce((sum, set) => sum + set._count.feedback, 0);
  const nextSet =
    setRows.find((row) => row.status === "Not started") ??
    setRows
      .filter((row) => row.status === "Attempted" && row.bestScore < 80)
      .sort((a, b) => a.bestScore - b.bestScore)[0] ??
    setRows.find((row) => row.status === "Attempted") ??
    setRows[0] ??
    null;

  const topicMap = new Map<string, { correct: number; total: number }>();
  for (const attempt of attempts) {
    for (const response of attempt.responses) {
      const topics =
        response.problem.topicTags.length > 0 ? response.problem.topicTags : ["General"];
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

  const adminRows =
    currentUser.role === "ADMIN"
      ? studentRows
          .map((student) => {
            const uniqueSets = new Set(student.attempts.map((attempt) => attempt.problemSetId));
            const average =
              student.attempts.length > 0
                ? Math.round(
                    student.attempts.reduce(
                      (sum, attempt) =>
                        sum + (attempt.maxScore > 0 ? (attempt.score / attempt.maxScore) * 100 : 0),
                      0,
                    ) / student.attempts.length,
                  )
                : 0;
            const lastSeen =
              student.attempts.length > 0
                ? student.attempts.reduce(
                    (latest, attempt) =>
                      attempt.submittedAt > latest ? attempt.submittedAt : latest,
                    student.attempts[0].submittedAt,
                  )
                : null;

            return {
              name: student.name ?? student.email,
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

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <Link className="brand brand-on-dark" href="/dashboard">
          <span className="brand-mark">
            <img src="/logo.png" alt="MO Logo" />
          </span>
          <span>
            <strong>DBS Training</strong>
            <small>
              {currentUser.role === "ADMIN" ? "Teacher workspace" : "Student workspace"}
            </small>
          </span>
        </Link>

        <nav className="nav-list">
          <Link className="nav-item active" href="/dashboard">
            <Gauge size={18} />
            Dashboard
          </Link>
          <Link
            className="nav-item"
            href={nextSet ? `/problem-sets/${nextSet.slug}` : "/dashboard"}
          >
            <ClipboardList size={18} />
            Problem Sets
          </Link>
          {currentUser.role === "ADMIN" ? (
            <>
              <Link className="nav-item" href="/admin/sets">
                <ListChecks size={18} />
                Manage Sets
              </Link>
              <Link className="nav-item" href="/admin/create">
                <PenLine size={18} />
                Create Set
              </Link>
              <Link className="nav-item" href="/admin/import">
                <FileArchive size={18} />
                ZIP Import
              </Link>
              <Link className="nav-item" href="/admin/students">
                <Users size={18} />
                Students
              </Link>
              <Link className="nav-item" href="/admin/analytics">
                <BarChart3 size={18} />
                Analytics
              </Link>
              <Link className="nav-item" href="/admin/feedback">
                <MessageSquareWarning size={18} />
                Feedback
              </Link>
            </>
          ) : null}
          <Link className="nav-item" href="/users">
            <Users size={18} />
            Users
          </Link>
          <Link className="nav-item" href="/leaderboard">
            <Trophy size={18} />
            Leaderboard
          </Link>
          <Link className="nav-item" href="/settings">
            <Settings size={18} />
            Settings
          </Link>
        </nav>

        <div className="sidebar-footer" />
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {currentUser.role === "ADMIN" ? "Teacher view" : "Student view"}
            </p>
            <h1>Training Dashboard</h1>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <AuthButton session={session} />
            {currentUser.role === "ADMIN" ? (
              <Link className="icon-button" href="/admin/import" aria-label="Import ZIP">
                <FileArchive size={18} />
              </Link>
            ) : null}
            <Link className="primary-action" href={continueHref}>
              {currentUser.role === "ADMIN"
                ? nextSet
                  ? "Continue"
                  : "Open import"
                : nextSet
                  ? "Continue"
                  : "Browse sets"}
              <ArrowRight size={18} />
            </Link>
          </div>
        </header>

        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">{nextSet ? `Next set: ${nextSet.title}` : "Platform setup"}</p>
            <h2>
              <TypewriterGreeting name={currentUser.displayName || currentUser.name || "there"} />
            </h2>
            <div className="hero-actions">
              <Link className="primary-action" href={continueHref}>
                {nextSet ? "Open current set" : "Import first set"}
                <PlayCircle size={18} />
              </Link>
              {currentUser.role === "ADMIN" ? (
                <Link className="secondary-action" href="/admin/import">
                  Upload ZIP
                  <FileArchive size={18} />
                </Link>
              ) : (
                <Link
                  className="secondary-action"
                  href={nextSet ? `/problem-sets/${nextSet.slug}` : "/dashboard"}
                >
                  View sets
                  <ClipboardList size={18} />
                </Link>
              )}
            </div>
          </div>
          <div
            className="progress-orbit"
            aria-label={`${completedSets} of ${totalSets} sets attempted`}
          >
            <div className="progress-ring">
              <span>{completedSets}</span>
              <small>/ {totalSets}</small>
            </div>
            <div className="orbit-card orbit-card-one">
              <CheckCircle2 size={18} />
              {averageScore}% avg
            </div>
            <div className="orbit-card orbit-card-two">
              <MessageSquareWarning size={18} />
              {openReports} reports
            </div>
          </div>
        </section>

        <section className="metric-grid" aria-label="Student progress metrics">
          <MetricCard
            label="Attempted"
            value={`${completedSets}/${totalSets || 0}`}
            accent="cyan"
          />
          <MetricCard label="Average" value={`${averageScore}%`} accent="purple" />
          <MetricCard label="Latest score" value={`${latestScore}%`} accent="pink" />
          <MetricCard label="Open reports" value={`${openReports}`} accent="orange" />
        </section>

        <section className="content-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Student view</p>
                <h2>Problem sets</h2>
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
                      ? "Import a ZIP package to create the first draft."
                      : "Ask a teacher to publish a set for your group."}
                  </small>
                </div>
              ) : (
                setRows.map((set) => (
                  <Link className="set-row" href={`/problem-sets/${set.slug}`} key={set.slug}>
                    <div className="set-main">
                      <span className={`status-dot status-${statusClass(set.status)}`} />
                      <div>
                        <strong>{set.title}</strong>
                        <small>{set.topics.join(" / ")}</small>
                      </div>
                    </div>
                    <div className="score-pill">{set.bestScore}%</div>
                  </Link>
                ))
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Strengths</p>
                <h2>Topic map</h2>
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
              <h2>{currentUser.role === "ADMIN" ? "Cohort snapshot" : "Attempt history"}</h2>
            </div>
            {currentUser.role === "ADMIN" ? (
              <Link className="secondary-action compact" href="/admin/import">
                Import
                <FileArchive size={16} />
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

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "cyan" | "purple" | "pink" | "orange";
}) {
  return (
    <article className={`metric-card accent-${accent}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

function statusClass(status: string) {
  return status.toLowerCase().replace(/\s+/g, "-");
}
