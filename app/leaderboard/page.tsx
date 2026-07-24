import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Heart, Target, Trophy, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { profilePathFromEmail } from "@/lib/user-profile";
import { canViewHiddenLeaderboardEntries } from "@/lib/permissions";
import { isVisibleToStudent } from "@/lib/visibility";
import { displayNameFor } from "@/lib/display-name";
import { computePerformanceProfile, performanceEvidenceLabel } from "@/lib/analytics";
import { Avatar } from "@/app/avatar";
import { PageBackLink } from "@/app/page-back-link";

export const dynamic = "force-dynamic";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="rank-badge rank-gold">🥇</span>;
  if (rank === 2) return <span className="rank-badge rank-silver">🥈</span>;
  if (rank === 3) return <span className="rank-badge rank-bronze">🥉</span>;
  return <span className="rank-badge rank-num">#{rank}</span>;
}

type LeaderboardSearchParams = Promise<{
  mode?: string;
  scope?: string;
  sort?: string;
}>;

type StandardSortMode = "index" | "accuracy";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  ANALYST: "Analyst",
  CONTENT_EDITOR: "Content Editor",
  STUDENT: "Student",
  TEACHER: "Teacher",
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ").toLowerCase();
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams?: LeaderboardSearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const params = (await searchParams) ?? {};
  const mode = params.mode === "practice" ? "practice" : "standard";
  const scope = params.scope === "friends" ? "friends" : "all";
  const sortMode: StandardSortMode =
    params.sort === "accuracy" || params.sort === "average" ? "accuracy" : "index";

  function leaderboardHref(next: {
    mode?: "standard" | "practice";
    scope?: "all" | "friends";
    sort?: StandardSortMode;
  }) {
    const query = new URLSearchParams({
      mode: next.mode ?? mode,
      scope: next.scope ?? scope,
      sort: next.sort ?? sortMode,
    });
    return `/leaderboard?${query.toString()}`;
  }

  const [users, attempts, friendships, problemSets] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        leaderboardVisible: true,
        _count: {
          select: { practiceSolves: true },
        },
      },
    }),
    prisma.attempt.findMany({
      select: {
        userId: true,
        problemSetId: true,
        score: true,
        maxScore: true,
        submittedAt: true,
        problemSet: {
          select: {
            status: true,
            visibleFrom: true,
            visibleTo: true,
          },
        },
      },
    }),
    prisma.friendship
      ?.findMany({
        where: {
          OR: [{ requesterId: session.user.id }, { receiverId: session.user.id }],
        },
        select: { requesterId: true, receiverId: true },
      })
      .catch(() => []) ?? Promise.resolve([]),
    prisma.problemSet.findMany({
      select: {
        id: true,
        status: true,
        visibleFrom: true,
        visibleTo: true,
      },
    }),
  ]);

  const visibleSetIds = new Set(
    problemSets.filter((set) => isVisibleToStudent(set)).map((set) => set.id),
  );
  const attemptsByUser = new Map<
    string,
    Array<{ score: number; maxScore: number; problemSetId: string }>
  >();
  const totalAttemptsByUser = new Map<string, number>();
  for (const attempt of attempts) {
    if (!visibleSetIds.has(attempt.problemSetId) || !isVisibleToStudent(attempt.problemSet)) {
      continue;
    }
    totalAttemptsByUser.set(attempt.userId, (totalAttemptsByUser.get(attempt.userId) ?? 0) + 1);
    const userAttempts = attemptsByUser.get(attempt.userId) ?? [];
    userAttempts.push({
      score: attempt.score,
      maxScore: attempt.maxScore,
      problemSetId: attempt.problemSetId,
    });
    attemptsByUser.set(attempt.userId, userAttempts);
  }

  const friendIds = new Set<string>([session.user.id]);
  for (const friendship of friendships) {
    friendIds.add(
      friendship.requesterId === session.user.id ? friendship.receiverId : friendship.requesterId,
    );
  }

  const rows = users
    .map((u) => {
      const performance = computePerformanceProfile(
        attemptsByUser.get(u.id) ?? [],
        visibleSetIds.size,
      );
      const totalAttempts = totalAttemptsByUser.get(u.id) ?? 0;

      return {
        id: u.id,
        email: u.email,
        displayLabel: displayNameFor(u),
        avatarUrl: u.avatarUrl,
        image: u.image,
        role: u.role,
        leaderboardVisible: u.leaderboardVisible,
        performance,
        totalAttempts,
        practiceScore: u._count.practiceSolves,
      };
    })
    .filter(
      (u) =>
        u.leaderboardVisible ||
        u.id === session.user.id ||
        canViewHiddenLeaderboardEntries(session.user.role),
    )
    .filter((u) => scope === "all" || friendIds.has(u.id))
    .sort((a, b) => {
      if (mode === "practice") {
        return b.practiceScore - a.practiceScore || a.displayLabel.localeCompare(b.displayLabel);
      }

      if (sortMode === "accuracy") {
        return (
          b.performance.bestSetAverage - a.performance.bestSetAverage ||
          b.performance.masteryIndex - a.performance.masteryIndex ||
          b.performance.attemptedSets - a.performance.attemptedSets ||
          a.displayLabel.localeCompare(b.displayLabel)
        );
      }

      return (
        b.performance.masteryIndex - a.performance.masteryIndex ||
        b.performance.proficiency - a.performance.proficiency ||
        b.performance.attemptedSets - a.performance.attemptedSets ||
        a.displayLabel.localeCompare(b.displayLabel)
      );
    })
    .map((u, i) => ({ ...u, rank: i + 1 }));
  const topRow = rows[0] ?? null;
  const activeStandardUsers = rows.filter((row) => row.performance.attemptedSets > 0).length;

  return (
    <main className={`leaderboard-shell leaderboard-shell-${mode}`}>
      <header className="leaderboard-header">
        <div>
          <p className="eyebrow">Rankings</p>
          <h1>
            <Trophy size={24} />
            Leaderboard
          </h1>
        </div>
        <div className="topbar-actions">
          <Link className="secondary-action" href="/users">
            <Users size={16} />
            All users
          </Link>
          <PageBackLink destination="Dashboard" href="/dashboard" />
        </div>
      </header>

      <section className="leaderboard-controls" aria-label="Leaderboard controls">
        <div className="leaderboard-control-group">
          <span className="leaderboard-control-label">Mode</span>
          <div className="segmented-control">
            <Link
              className={`segmented-button${mode === "standard" ? " active" : ""}`}
              href={leaderboardHref({ mode: "standard" })}
            >
              <Trophy size={14} />
              Standard
            </Link>
            <Link
              className={`segmented-button${mode === "practice" ? " active" : ""}`}
              href={leaderboardHref({ mode: "practice" })}
            >
              <Target size={14} />
              Practice
            </Link>
          </div>
        </div>
        <div className="leaderboard-control-group">
          <span className="leaderboard-control-label">View</span>
          <div className="segmented-control">
            <Link
              className={`segmented-button${scope === "all" ? " active" : ""}`}
              href={leaderboardHref({ scope: "all" })}
            >
              <Users size={14} />
              All
            </Link>
            <Link
              className={`segmented-button${scope === "friends" ? " active" : ""}`}
              href={leaderboardHref({ scope: "friends" })}
            >
              <Heart size={14} />
              Friends
            </Link>
          </div>
        </div>
        {mode === "standard" && (
          <div className="leaderboard-control-group">
            <span className="leaderboard-control-label">Order by</span>
            <div className="segmented-control">
              <Link
                className={`segmented-button${sortMode === "index" ? " active" : ""}`}
                href={leaderboardHref({ sort: "index" })}
              >
                Mastery index
              </Link>
              <Link
                className={`segmented-button${sortMode === "accuracy" ? " active" : ""}`}
                href={leaderboardHref({ sort: "accuracy" })}
              >
                Best-set average
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="leaderboard-summary-grid" aria-label="Leaderboard summary">
        <article>
          <small>Ranked by</small>
          <strong>
            {mode === "practice"
              ? "Practice solves"
              : sortMode === "accuracy"
                ? "Best-set average"
                : "Mastery Index"}
          </strong>
          <span>
            {mode === "practice"
              ? "Correct practice answers"
              : "Best attempts on visible published sets"}
          </span>
        </article>
        <article>
          <small>{mode === "practice" ? "Visible players" : "Active players"}</small>
          <strong>{mode === "practice" ? rows.length : activeStandardUsers}</strong>
          <span>{scope === "friends" ? "Friends view" : "All visible users"}</span>
        </article>
        <article>
          <small>{mode === "practice" ? "Current leader" : "Sets in season"}</small>
          <strong>{mode === "practice" ? (topRow?.practiceScore ?? 0) : visibleSetIds.size}</strong>
          <span>
            {mode === "practice" ? (topRow?.displayLabel ?? "No entries") : "Published now"}
          </span>
        </article>
        <article>
          <small>Signal</small>
          <strong>{mode === "practice" ? "Drill volume" : "Quality + breadth"}</strong>
          <span>
            {mode === "practice" ? "Correct practice answers" : "Best sets with evidence control"}
          </span>
        </article>
      </section>

      <div className="leaderboard-table-wrap">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>User</th>
              {mode === "standard" ? (
                <>
                  <th>Mastery index</th>
                  <th>Best-set avg</th>
                  <th>Mastered</th>
                  <th>Coverage</th>
                  <th>Evidence</th>
                </>
              ) : (
                <th>Practice Score</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={mode === "standard" ? 7 : 3}>
                  {scope === "friends"
                    ? "No friends yet. Favorite users from their profile to build this list."
                    : "No leaderboard entries yet."}
                </td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id} className={u.rank <= 3 ? `leaderboard-top-${u.rank}` : ""}>
                  <td>
                    <RankBadge rank={u.rank} />
                  </td>
                  <td>
                    <div className="leaderboard-user">
                      <Avatar
                        user={{
                          id: u.id,
                          email: u.email,
                          displayName: u.displayLabel,
                          avatarUrl: u.avatarUrl,
                          image: u.image,
                        }}
                        size="md"
                        className="leaderboard-avatar"
                      />
                      <div className="leaderboard-user-info">
                        <Link className="user-link" href={profilePathFromEmail(u.email)}>
                          {u.displayLabel}
                        </Link>
                        {u.role !== "STUDENT" ? (
                          <span className="role-badge">{roleLabel(u.role)}</span>
                        ) : null}
                        <small className="leaderboard-mobile-meta">
                          {mode === "practice"
                            ? `Score ${u.practiceScore}`
                            : `${u.performance.masteryIndex.toFixed(1)} index · ${u.performance.bestSetAverage.toFixed(1)}% avg`}
                        </small>
                      </div>
                    </div>
                  </td>
                  {mode === "standard" ? (
                    <>
                      <td>
                        <div className="leaderboard-score-cell">
                          <strong>{u.performance.masteryIndex.toFixed(1)}</strong>
                          <small>{u.performance.consistency.toFixed(1)}% consistency floor</small>
                        </div>
                      </td>
                      <td>
                        <div className="leaderboard-score-cell">
                          <span
                            className={`score-color ${
                              u.performance.bestSetAverage >= 80
                                ? "score-high"
                                : u.performance.bestSetAverage >= 50
                                  ? "score-mid"
                                  : "score-low"
                            }`}
                          >
                            {u.performance.bestSetAverage.toFixed(1)}%
                          </span>
                          <small>equal weight per set</small>
                        </div>
                      </td>
                      <td>
                        <div className="leaderboard-score-cell">
                          <strong>{u.performance.masteredSets}</strong>
                          <small>{u.performance.masteryRate.toFixed(1)}% at 80%+</small>
                        </div>
                      </td>
                      <td>
                        <div className="leaderboard-score-cell">
                          <strong>
                            {u.performance.attemptedSets}/{visibleSetIds.size}
                          </strong>
                          <small>{u.performance.breadth.toFixed(1)} breadth</small>
                        </div>
                      </td>
                      <td>
                        <div className="leaderboard-score-cell">
                          <strong>{performanceEvidenceLabel(u.performance.evidence)}</strong>
                          <small>{u.totalAttempts} submissions</small>
                        </div>
                      </td>
                    </>
                  ) : (
                    <td>
                      <div className="leaderboard-score-cell">
                        <strong>{u.practiceScore}</strong>
                        <small>correct solves</small>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
