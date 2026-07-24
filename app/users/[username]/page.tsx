import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect, notFound } from "next/navigation";
import { Calendar, ClipboardList, Grid2x2, Mail } from "lucide-react";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { computePerformanceProfile } from "@/lib/analytics";
import { normalizeTagList } from "@/lib/problem-tags";
import { usernameFromEmail } from "@/lib/user-profile";
import { isVisibleToStudent } from "@/lib/visibility";
import {
  canViewHiddenLeaderboardEntries,
  canViewPrivateProfiles,
  hasPermission,
} from "@/lib/permissions";
import { compareProblemSetRecords } from "@/lib/problem-set-order";
import { canLinkProblemSetFromProfile } from "@/lib/profile-visibility";
import { displayNameFor } from "@/lib/display-name";
import { Avatar } from "@/app/avatar";
import { PageBackLink } from "@/app/page-back-link";
import { AuthoredTasksTable } from "./authored-tasks-table";
import { FriendButton } from "./friend-button";
import { PromoteUserButton } from "./promote-user-button";

export const dynamic = "force-dynamic";

const HEATMAP_WEEKS = 53;
const HEATMAP_DAYS = HEATMAP_WEEKS * 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function progressTileStyle(percent: number | null): CSSProperties {
  if (percent === null) {
    return {
      background: "rgba(125, 137, 164, 0.12)",
      borderColor: "rgba(125, 137, 164, 0.2)",
      color: "var(--color-muted)",
    };
  }

  const hue = Math.round((Math.max(0, Math.min(100, percent)) / 100) * 120);
  return {
    background: `hsla(${hue}, 72%, 48%, 0.18)`,
    borderColor: `hsla(${hue}, 72%, 48%, 0.34)`,
    color: `hsl(${hue}, 72%, 58%)`,
  };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function masteryLevel(count: number) {
  return Math.min(5, Math.max(0, count));
}

function formatMasteryTitle(date: Date, count: number) {
  const label = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (count === 0) return `No mastered sets on ${label}`;
  return `${count} mastered set${count === 1 ? "" : "s"} on ${label}`;
}

export default async function UserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{ grid?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  const { username } = await params;
  const gridParams = (await searchParams) ?? {};
  const normalizedUsername = decodeURIComponent(username).trim().toLowerCase();
  const gridMode = gridParams.grid === "problems" ? "problems" : "sets";
  const profileVisibilityNow = new Date();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: normalizedUsername },
        { email: { startsWith: `${normalizedUsername}@`, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      group: true,
      profileVisible: true,
      leaderboardVisible: true,
      createdAt: true,
      practiceSolves: {
        select: {
          problemId: true,
        },
      },
      attempts: {
        select: {
          score: true,
          maxScore: true,
          problemSetId: true,
          submittedAt: true,
          responses: {
            select: {
              isCorrect: true,
              pointsAwarded: true,
              problem: {
                select: {
                  id: true,
                  number: true,
                  problemSetId: true,
                  points: true,
                  topicTags: true,
                },
              },
            },
          },
          problemSet: {
            select: {
              title: true,
              slug: true,
              status: true,
              visibleFrom: true,
              visibleTo: true,
            },
          },
        },
        orderBy: { submittedAt: "desc" },
        take: 1000,
      },
      problemSetBookmarks: {
        where:
          session.user.role === "ADMIN"
            ? undefined
            : {
                problemSet: {
                  status: "PUBLISHED",
                  AND: [
                    {
                      OR: [{ visibleFrom: null }, { visibleFrom: { lte: profileVisibilityNow } }],
                    },
                    {
                      OR: [{ visibleTo: null }, { visibleTo: { gte: profileVisibilityNow } }],
                    },
                  ],
                },
              },
        select: {
          problemSet: {
            select: {
              title: true,
              slug: true,
              status: true,
              visibleFrom: true,
              visibleTo: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      createdProblemSets: {
        select: {
          id: true,
          slug: true,
          title: true,
          order: true,
          status: true,
          visibleFrom: true,
          visibleTo: true,
          createdAt: true,
          attempts: {
            select: {
              userId: true,
              score: true,
              maxScore: true,
            },
          },
          _count: {
            select: {
              attempts: true,
              problems: true,
            },
          },
        },
      },
    },
  });

  if (!user) notFound();

  const allSets = await prisma.problemSet
    .findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        order: true,
        status: true,
        visibleFrom: true,
        visibleTo: true,
        problems: {
          orderBy: { number: "asc" },
          select: {
            id: true,
            number: true,
          },
        },
      },
    })
    .then((sets) => sets.sort(compareProblemSetRecords));
  const performanceSets = allSets.filter((set) => isVisibleToStudent(set));
  const performanceSetIds = new Set(performanceSets.map((set) => set.id));

  const isOwnProfile = user.id === session.user.id;
  const canViewPrivateProfile = isOwnProfile || canViewPrivateProfiles(session.user.role);
  if (!user.profileVisible && !canViewPrivateProfile) {
    return (
      <main className="profile-shell">
        <header className="profile-header">
          <div className="topbar-actions">
            <PageBackLink destination="Users" href="/users" />
          </div>
        </header>
        <section className="profile-section">
          <div className="profile-grid-panel">
            <h1>Profile hidden</h1>
            <p className="profile-muted">This user has chosen not to show their public profile.</p>
          </div>
        </section>
      </main>
    );
  }
  const [friendRequesterId, friendReceiverId] = [session.user.id, user.id].sort() as [
    string,
    string,
  ];
  const friendship = isOwnProfile
    ? null
    : ((await prisma.friendship
        ?.findUnique({
          where: {
            requesterId_receiverId: {
              requesterId: friendRequesterId,
              receiverId: friendReceiverId,
            },
          },
          select: { id: true },
        })
        .catch(() => null)) ?? null);

  const displayLabel = displayNameFor(user);
  const profileUsername = usernameFromEmail(user.email);
  const canManageContent = hasPermission(session.user.role, "admin:content");
  const canViewAnalytics = hasPermission(session.user.role, "admin:analytics");
  const performance = computePerformanceProfile(
    user.attempts.filter((attempt) => performanceSetIds.has(attempt.problemSetId)),
    performanceSets.length,
  );

  const setScores = new Map<
    string,
    {
      title: string;
      slug: string;
      status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      visibleFrom: Date | null;
      visibleTo: Date | null;
      best: number;
    }
  >();
  const today = startOfDay(new Date());
  const lastYearStart = addDays(today, -364);
  const heatmapStart = addDays(lastYearStart, -lastYearStart.getDay());
  const masteredSetsByDay = new Map<string, Set<string>>();
  for (const a of user.attempts) {
    const pct = a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0;
    const existing = setScores.get(a.problemSetId);
    if (!existing || pct > existing.best) {
      setScores.set(a.problemSetId, {
        title: a.problemSet.title,
        slug: a.problemSet.slug,
        status: a.problemSet.status,
        visibleFrom: a.problemSet.visibleFrom,
        visibleTo: a.problemSet.visibleTo,
        best: pct,
      });
    }
    const submittedDay = startOfDay(a.submittedAt);
    if (pct >= 80 && submittedDay >= lastYearStart && submittedDay <= today) {
      const key = dateKey(submittedDay);
      const masteredSets = masteredSetsByDay.get(key) ?? new Set<string>();
      masteredSets.add(a.problemSetId);
      masteredSetsByDay.set(key, masteredSets);
    }
  }
  const masteryCells = Array.from({ length: HEATMAP_DAYS }, (_, index) => {
    const date = addDays(heatmapStart, index);
    const count = masteredSetsByDay.get(dateKey(date))?.size ?? 0;
    const inRange = date >= lastYearStart && date <= today;
    return {
      key: dateKey(date),
      date,
      week: Math.floor(index / 7),
      day: date.getDay(),
      count: inRange ? count : 0,
      inRange,
    };
  });
  const masteryMonthLabels = Array.from({ length: HEATMAP_WEEKS }, (_, week) => {
    const weekDays = masteryCells.slice(week * 7, week * 7 + 7);
    const monthStart = weekDays.find((cell) => cell.date.getDate() === 1);
    if (!monthStart) return null;
    return {
      week,
      label: monthStart.date.toLocaleDateString("en-US", { month: "short" }),
    };
  }).filter(Boolean) as Array<{ week: number; label: string }>;
  const masteryTotal = Array.from(masteredSetsByDay.values()).reduce(
    (sum, masteredSets) => sum + masteredSets.size,
    0,
  );
  const masteryActiveDays = masteryCells.filter((cell) => cell.inRange && cell.count > 0).length;
  const solvedSets = [...setScores.values()].filter((s) => s.best >= 80);
  const recentCompletions = solvedSets
    .filter((set) => canLinkProblemSetFromProfile(set, session.user.role, profileVisibilityNow))
    .slice(0, 5);
  const visibleBookmarks = user.problemSetBookmarks.filter((bookmark) =>
    canLinkProblemSetFromProfile(bookmark.problemSet, session.user.role, profileVisibilityNow),
  );
  const topicStats = new Map<string, { correct: number; total: number }>();
  for (const attempt of user.attempts) {
    for (const response of attempt.responses) {
      const canonicalTopics = normalizeTagList(response.problem.topicTags);
      const topics = canonicalTopics.length > 0 ? canonicalTopics : ["General"];
      for (const topic of topics) {
        const stats = topicStats.get(topic) ?? { correct: 0, total: 0 };
        stats.total += 1;
        if (response.isCorrect) stats.correct += 1;
        topicStats.set(topic, stats);
      }
    }
  }
  const strongestTopics = Array.from(topicStats.entries())
    .map(([topic, stats]) => ({
      topic,
      score: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      total: stats.total,
    }))
    .sort((a, b) => b.score - a.score || b.total - a.total)
    .slice(0, 4);
  const visibleSets =
    session.user.role === "ADMIN" ? allSets : allSets.filter((set) => isVisibleToStudent(set));
  const canSeeAllAuthoredSets = isOwnProfile || hasPermission(session.user.role, "admin:content");
  const authoredTaskRows = user.createdProblemSets
    .filter((set) => canSeeAllAuthoredSets || isVisibleToStudent(set))
    .sort(compareProblemSetRecords)
    .map((set) => {
      const solvedUsers = new Set(
        set.attempts
          .filter((attempt) => attempt.maxScore > 0 && attempt.score === attempt.maxScore)
          .map((attempt) => attempt.userId),
      );

      return {
        id: set.id,
        slug: set.slug,
        title: set.title,
        order: set.order || set.slug,
        status: set.status,
        solvedCount: solvedUsers.size,
        attemptCount: set._count.attempts,
        problemCount: set._count.problems,
      };
    });
  const setGridRows = visibleSets.map((set) => {
    const progress = setScores.get(set.id);
    const best = progress ? Math.round(progress.best) : null;
    return {
      id: set.id,
      slug: set.slug,
      title: set.title,
      order: set.order,
      best,
    };
  });
  const problemProgress = new Map<string, number>();
  for (const attempt of user.attempts) {
    for (const response of attempt.responses) {
      const maxPoints = response.problem.points > 0 ? response.problem.points : 1;
      const pct = response.isCorrect ? 100 : Math.round((response.pointsAwarded / maxPoints) * 100);
      problemProgress.set(
        response.problem.id,
        Math.max(problemProgress.get(response.problem.id) ?? 0, pct),
      );
    }
  }
  for (const solve of user.practiceSolves) {
    problemProgress.set(solve.problemId, 100);
  }
  const problemGridRows = visibleSets.flatMap((set) =>
    set.problems.map((problem) => ({
      id: problem.id,
      slug: set.slug,
      label: `${set.order}-${problem.number}`,
      title: `${set.title} - Problem ${problem.number}`,
      best: problemProgress.has(problem.id) ? (problemProgress.get(problem.id) ?? 0) : null,
    })),
  );

  const leaderboardUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      displayName: true,
      leaderboardVisible: true,
      attempts: {
        select: { score: true, maxScore: true, problemSetId: true },
      },
      _count: {
        select: { practiceSolves: true },
      },
    },
  });

  const standardRows = leaderboardUsers
    .filter(
      (entry) =>
        entry.leaderboardVisible ||
        entry.id === session.user.id ||
        canViewHiddenLeaderboardEntries(session.user.role),
    )
    .map((entry) => {
      return {
        id: entry.id,
        displayLabel: displayNameFor(entry),
        performance: computePerformanceProfile(
          entry.attempts.filter((attempt) => performanceSetIds.has(attempt.problemSetId)),
          performanceSets.length,
        ),
      };
    })
    .sort(
      (a, b) =>
        b.performance.masteryIndex - a.performance.masteryIndex ||
        b.performance.bestSetAverage - a.performance.bestSetAverage ||
        b.performance.attemptedSets - a.performance.attemptedSets ||
        a.displayLabel.localeCompare(b.displayLabel),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const practiceRows = leaderboardUsers
    .filter(
      (entry) =>
        entry.leaderboardVisible ||
        entry.id === session.user.id ||
        canViewHiddenLeaderboardEntries(session.user.role),
    )
    .map((entry) => ({
      id: entry.id,
      displayLabel: displayNameFor(entry),
      practiceScore: entry._count.practiceSolves,
    }))
    .sort(
      (a, b) => b.practiceScore - a.practiceScore || a.displayLabel.localeCompare(b.displayLabel),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const standardRank = standardRows.find((entry) => entry.id === user.id)?.rank ?? null;
  const practiceRank = practiceRows.find((entry) => entry.id === user.id)?.rank ?? null;

  function profileGridHref(nextGrid: "sets" | "problems") {
    if (nextGrid === "sets") {
      return `/users/${encodeURIComponent(username)}`;
    }
    return `/users/${encodeURIComponent(username)}?grid=problems`;
  }

  return (
    <main className="profile-shell">
      <header className="profile-header">
        <div className="topbar-actions">
          <PageBackLink destination="Users" href="/users" />
        </div>
      </header>

      <section className="profile-hero">
        <div className="profile-avatar">
          <Avatar
            user={{
              id: user.id,
              email: user.email,
              displayName: displayLabel,
              avatarUrl: user.avatarUrl,
              image: user.image,
            }}
            size="lg"
            className="profile-avatar-img"
          />
        </div>
        <div className="profile-identity">
          <div className="profile-title-row">
            <h1>{displayLabel}</h1>
            {!isOwnProfile ? (
              <FriendButton targetUserId={user.id} initialIsFriend={Boolean(friendship)} />
            ) : null}
          </div>
          {user.displayName && user.name && <p className="profile-realname">{user.name}</p>}
          <div className="profile-badges">
            <span className="profile-role-badge">{user.role}</span>
            {user.group && <span className="profile-group-badge">{user.group}</span>}
          </div>
          <p className="profile-username">
            <Mail size={14} />@{profileUsername}
          </p>
          <p className="profile-username">
            <Mail size={14} />
            {user.email}
          </p>
          <p className="profile-joined">
            <Calendar size={14} />
            Joined {user.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long" })}
          </p>
          {session.user.role === "ADMIN" && !isOwnProfile ? (
            <PromoteUserButton userId={user.id} currentRole={user.role} />
          ) : null}
        </div>
      </section>

      <div className="profile-stats-row">
        <div className="profile-stat">
          <span className="profile-stat-value">{performance.masteryIndex.toFixed(1)}</span>
          <span className="profile-stat-label">Mastery index</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{performance.attemptedSets}</span>
          <span className="profile-stat-label">Visible sets tried</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{performance.bestSetAverage.toFixed(1)}%</span>
          <span className="profile-stat-label">Best-set average</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{performance.consistency.toFixed(1)}%</span>
          <span className="profile-stat-label">Consistency floor</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{performance.masteryRate.toFixed(1)}%</span>
          <span className="profile-stat-label">Mastery rate</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{standardRank ? `#${standardRank}` : "—"}</span>
          <span className="profile-stat-label">Standard rank</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{practiceRank ? `#${practiceRank}` : "—"}</span>
          <span className="profile-stat-label">Practice rank</span>
        </div>
      </div>

      <section className="profile-section profile-summary-grid">
        <article className="profile-grid-panel">
          <h3>Strongest topics</h3>
          {strongestTopics.length === 0 ? (
            <p className="profile-muted">No topic data yet.</p>
          ) : (
            <div className="topic-stack">
              {strongestTopics.map((topic) => (
                <div className="topic-bar" key={topic.topic}>
                  <div className="topic-label">
                    <span>{topic.topic}</span>
                    <strong>{topic.score}%</strong>
                  </div>
                  <div className="meter">
                    <span className="meter-fill fill-cyan" style={{ width: `${topic.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="profile-grid-panel">
          <h3>Recent completions</h3>
          {recentCompletions.length === 0 ? (
            <p className="profile-muted">No completed sets yet.</p>
          ) : (
            <div className="profile-link-list">
              {recentCompletions.map((set) => (
                <Link href={`/problem-sets/${set.slug}`} key={set.slug}>
                  {set.title}
                  <span>{Math.round(set.best)}%</span>
                </Link>
              ))}
            </div>
          )}
        </article>
        <article className="profile-grid-panel">
          <h3>Bookmarked sets</h3>
          {visibleBookmarks.length === 0 ? (
            <p className="profile-muted">No public bookmarks yet.</p>
          ) : (
            <div className="profile-link-list">
              {visibleBookmarks.map((bookmark) => (
                <Link
                  href={`/problem-sets/${bookmark.problemSet.slug}`}
                  key={bookmark.problemSet.slug}
                >
                  {bookmark.problemSet.title}
                </Link>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="profile-section profile-authored-section">
        <div className="profile-grid-header">
          <div className="profile-grid-title-row">
            <h2>
              <ClipboardList size={18} />
              Authored tasks ({authoredTaskRows.length})
            </h2>
          </div>
        </div>
        {authoredTaskRows.length === 0 ? (
          <p className="profile-muted">No authored public tasks yet.</p>
        ) : (
          <AuthoredTasksTable
            rows={authoredTaskRows}
            canManageContent={canManageContent}
            canViewAnalytics={canViewAnalytics}
          />
        )}
      </section>

      <section className="profile-section profile-mastery-section">
        <div className="profile-grid-header">
          <div className="profile-grid-title-row">
            <h2>
              <Calendar size={18} />
              Problem mastery
            </h2>
          </div>
          <p className="profile-mastery-summary">
            {masteryTotal} mastered set{masteryTotal === 1 ? "" : "s"} across {masteryActiveDays}{" "}
            active day{masteryActiveDays === 1 ? "" : "s"} in the last year
          </p>
        </div>
        <div className="profile-heatmap-scroll" aria-label="Problem mastery heatmap">
          <div className="profile-heatmap-grid">
            {masteryMonthLabels.map((month) => (
              <span
                className="profile-heatmap-month"
                key={`${month.week}-${month.label}`}
                style={{ gridColumn: month.week + 2, gridRow: 1 }}
              >
                {month.label}
              </span>
            ))}
            <span className="profile-heatmap-day-label" style={{ gridColumn: 1, gridRow: 3 }}>
              Mon
            </span>
            <span className="profile-heatmap-day-label" style={{ gridColumn: 1, gridRow: 5 }}>
              Wed
            </span>
            <span className="profile-heatmap-day-label" style={{ gridColumn: 1, gridRow: 7 }}>
              Fri
            </span>
            {masteryCells.map((cell) => (
              <span
                aria-label={formatMasteryTitle(cell.date, cell.count)}
                className="profile-heatmap-cell"
                data-level={cell.inRange ? masteryLevel(cell.count) : 0}
                key={cell.key}
                style={{ gridColumn: cell.week + 2, gridRow: cell.day + 2 }}
                title={formatMasteryTitle(cell.date, cell.count)}
              />
            ))}
          </div>
          <div className="profile-heatmap-footer">
            <span className="profile-muted">Last 12 months</span>
            <div className="profile-heatmap-legend" aria-label="Mastery scale">
              <span>Less</span>
              {[0, 1, 2, 3, 4, 5].map((level) => (
                <span
                  aria-label={`${level}${level === 5 ? "+" : ""} mastered sets`}
                  className="profile-heatmap-cell"
                  data-level={level}
                  key={level}
                />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </section>

      <section className="profile-section">
        <div className="profile-grid-header">
          <div className="profile-grid-title-row">
            <h2>
              <Grid2x2 size={18} />
              {gridMode === "sets" ? "Set grid" : "Problems grid"}
            </h2>
            <Link
              className="secondary-action compact"
              href={profileGridHref(gridMode === "sets" ? "problems" : "sets")}
            >
              {gridMode === "sets" ? "Show problems" : "Show sets"}
            </Link>
          </div>
          <div className="profile-grid-legend" aria-label="Set status legend">
            <span className="profile-grid-legend-item">
              <span className="profile-grid-dot profile-grid-dot-attempted" />
              0%
            </span>
            <span className="profile-grid-legend-item">
              <span className="profile-grid-dot profile-grid-dot-mid" />
              50%
            </span>
            <span className="profile-grid-legend-item">
              <span className="profile-grid-dot profile-grid-dot-solved" />
              100%
            </span>
            <span className="profile-grid-legend-item">
              <span className="profile-grid-dot profile-grid-dot-unattempted" />
              Unattempted
            </span>
          </div>
        </div>
        <div className="profile-grid-panel">
          <h3>{gridMode === "sets" ? "Sets" : "Problems"}</h3>
          <div className="profile-set-grid">
            {(gridMode === "sets" ? setGridRows : problemGridRows).map((item) => (
              <Link
                key={item.id}
                href={`/problem-sets/${item.slug}`}
                className="profile-set-tile"
                style={progressTileStyle(item.best)}
                title={`${item.title}${item.best !== null ? ` (${item.best}%)` : ""}`}
                aria-label={`${item.title}${item.best !== null ? `, ${item.best}%` : ", unattempted"}`}
              >
                {"label" in item ? item.label : item.order}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
