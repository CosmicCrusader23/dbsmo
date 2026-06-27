import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  ClipboardList,
  ExternalLink,
  Grid2x2,
  Mail,
  Pencil,
} from "lucide-react";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { computeBestAverageScore } from "@/lib/analytics";
import { normalizeTagList } from "@/lib/problem-tags";
import { usernameFromEmail } from "@/lib/user-profile";
import { isVisibleToStudent } from "@/lib/visibility";
import { hasPermission, isStaffRole } from "@/lib/permissions";
import { compareProblemSetRecords } from "@/lib/problem-set-order";
import { Avatar } from "@/app/avatar";
import { FriendButton } from "./friend-button";
import { PromoteUserButton } from "./promote-user-button";

export const dynamic = "force-dynamic";

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
          problemSet: { select: { title: true, slug: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: 200,
      },
      problemSetBookmarks: {
        select: {
          problemSet: { select: { title: true, slug: true } },
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

  const isOwnProfile = user.id === session.user.id;
  const canViewPrivateProfile = isOwnProfile || isStaffRole(session.user.role);
  if (!user.profileVisible && !canViewPrivateProfile) {
    return (
      <main className="profile-shell">
        <header className="profile-header">
          <div className="topbar-actions">
            <Link className="secondary-action" href="/users">
              <ArrowLeft size={16} />
              All users
            </Link>
            <Link className="secondary-action" href="/dashboard">
              <ArrowLeft size={16} />
              Dashboard
            </Link>
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

  const displayLabel = user.displayName || user.name || "Anonymous";
  const profileUsername = usernameFromEmail(user.email);
  const canManageContent = hasPermission(session.user.role, "admin:content");
  const canViewAnalytics = hasPermission(session.user.role, "admin:analytics");
  const uniqueSets = new Set(user.attempts.map((a) => a.problemSetId)).size;
  const totalAttempts = user.attempts.length;
  const avgScore =
    totalAttempts > 0
      ? Math.round(
          user.attempts.reduce(
            (s, a) => s + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0),
            0,
          ) / totalAttempts,
        )
      : 0;
  const bestScore =
    totalAttempts > 0
      ? Math.round(
          Math.max(
            ...user.attempts.map((a) => (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0)),
          ),
        )
      : 0;

  const setScores = new Map<string, { title: string; slug: string; best: number }>();
  for (const a of user.attempts) {
    const pct = a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0;
    const existing = setScores.get(a.problemSetId);
    if (!existing || pct > existing.best) {
      setScores.set(a.problemSetId, {
        title: a.problemSet.title,
        slug: a.problemSet.slug,
        best: pct,
      });
    }
  }
  const solvedSets = [...setScores.values()].filter((s) => s.best >= 80);
  const recentCompletions = solvedSets.slice(0, 5);
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
  const canSeeAllAuthoredSets = isOwnProfile || isStaffRole(session.user.role);
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
        entry.leaderboardVisible || entry.id === session.user.id || isStaffRole(session.user.role),
    )
    .map((entry) => {
      const bestPerSet = new Map<string, number>();
      for (const attempt of entry.attempts) {
        const pct = attempt.maxScore > 0 ? (attempt.score / attempt.maxScore) * 100 : 0;
        bestPerSet.set(
          attempt.problemSetId,
          Math.max(bestPerSet.get(attempt.problemSetId) ?? 0, pct),
        );
      }

      return {
        id: entry.id,
        displayLabel: entry.displayName || entry.name || "Anonymous",
        solvedSets: [...bestPerSet.values()].filter((pct) => pct >= 80).length,
        avgScore: computeBestAverageScore(entry.attempts),
      };
    })
    .sort(
      (a, b) =>
        b.solvedSets - a.solvedSets ||
        b.avgScore - a.avgScore ||
        a.displayLabel.localeCompare(b.displayLabel),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const practiceRows = leaderboardUsers
    .filter(
      (entry) =>
        entry.leaderboardVisible || entry.id === session.user.id || isStaffRole(session.user.role),
    )
    .map((entry) => ({
      id: entry.id,
      displayLabel: entry.displayName || entry.name || "Anonymous",
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
          <Link className="secondary-action" href="/users">
            <ArrowLeft size={16} />
            All users
          </Link>
          <Link className="secondary-action" href="/dashboard">
            <ArrowLeft size={16} />
            Dashboard
          </Link>
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
          <span className="profile-stat-value">{uniqueSets}</span>
          <span className="profile-stat-label">Sets tried</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{solvedSets.length}</span>
          <span className="profile-stat-label">Solved (≥80%)</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{avgScore}%</span>
          <span className="profile-stat-label">Average</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{bestScore}%</span>
          <span className="profile-stat-label">Best score</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{totalAttempts}</span>
          <span className="profile-stat-label">Attempts</span>
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
          {user.problemSetBookmarks.length === 0 ? (
            <p className="profile-muted">No public bookmarks yet.</p>
          ) : (
            <div className="profile-link-list">
              {user.problemSetBookmarks.map((bookmark) => (
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
          <div className="profile-authored-table-wrap">
            <table className="profile-authored-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Problems</th>
                  <th># Solved</th>
                  <th>Attempts</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {authoredTaskRows.map((set) => (
                  <tr key={set.id}>
                    <td>
                      <span className="profile-authored-id">{set.order}</span>
                    </td>
                    <td>
                      <div className="profile-authored-name-cell">
                        <Link className="text-link" href={`/problem-sets/${set.slug}`}>
                          {set.title}
                        </Link>
                        <span className={`profile-authored-status ${set.status.toLowerCase()}`}>
                          {set.status.toLowerCase()}
                        </span>
                      </div>
                    </td>
                    <td>{set.problemCount}</td>
                    <td>{set.solvedCount}</td>
                    <td>{set.attemptCount}</td>
                    <td>
                      <div className="profile-authored-actions">
                        <Link
                          className="profile-authored-action"
                          href={`/problem-sets/${set.slug}`}
                        >
                          <ExternalLink size={14} />
                          Open
                        </Link>
                        {canViewAnalytics ? (
                          <Link
                            className="profile-authored-action"
                            href={`/admin/sets/${set.id}/analytics`}
                          >
                            <BarChart3 size={14} />
                            Analytics
                          </Link>
                        ) : null}
                        {canManageContent ? (
                          <Link className="profile-authored-action" href={`/admin/sets/${set.id}`}>
                            <Pencil size={14} />
                            Manage
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
