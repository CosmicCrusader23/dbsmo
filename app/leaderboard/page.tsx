import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ArrowLeft, Heart, Target, Trophy, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { profilePathFromEmail } from "@/lib/user-profile";
import { isStaffRole } from "@/lib/permissions";
import { isVisibleToStudent } from "@/lib/visibility";
import { Avatar } from "@/app/avatar";

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

type StandardSortMode = "mastery" | "average";

type BestAttempt = {
  score: number;
  maxScore: number;
  pct: number;
  submittedAt: Date;
};

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

function betterAttempt(next: BestAttempt, current: BestAttempt | undefined) {
  if (!current) return true;
  if (next.pct !== current.pct) return next.pct > current.pct;
  if (next.score !== current.score) return next.score > current.score;
  return next.submittedAt > current.submittedAt;
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
  const sortMode: StandardSortMode = params.sort === "average" ? "average" : "mastery";

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
  const bestPerSetByUser = new Map<string, Map<string, BestAttempt>>();
  const totalAttemptsByUser = new Map<string, number>();
  for (const attempt of attempts) {
    if (!visibleSetIds.has(attempt.problemSetId) || !isVisibleToStudent(attempt.problemSet)) {
      continue;
    }
    totalAttemptsByUser.set(attempt.userId, (totalAttemptsByUser.get(attempt.userId) ?? 0) + 1);
    if (attempt.maxScore <= 0) {
      continue;
    }

    const next = {
      score: attempt.score,
      maxScore: attempt.maxScore,
      pct: (attempt.score / attempt.maxScore) * 100,
      submittedAt: attempt.submittedAt,
    };
    const perSet = bestPerSetByUser.get(attempt.userId) ?? new Map<string, BestAttempt>();
    if (betterAttempt(next, perSet.get(attempt.problemSetId))) {
      perSet.set(attempt.problemSetId, next);
      bestPerSetByUser.set(attempt.userId, perSet);
    }
  }

  const friendIds = new Set<string>([session.user.id]);
  for (const friendship of friendships) {
    friendIds.add(
      friendship.requesterId === session.user.id ? friendship.receiverId : friendship.requesterId,
    );
  }

  const rows = users
    .map((u) => {
      const perSet = Array.from(bestPerSetByUser.get(u.id)?.values() ?? []);
      const attemptedSets = perSet.length;
      const totalAttempts = totalAttemptsByUser.get(u.id) ?? 0;
      const masteredSets = perSet.filter((s) => s.pct >= 80).length;
      const bestPoints = perSet.reduce((sum, attempt) => sum + attempt.score, 0);
      const possiblePoints = perSet.reduce((sum, attempt) => sum + attempt.maxScore, 0);
      const bestAverage =
        possiblePoints > 0 ? Math.round((bestPoints / possiblePoints) * 100) : 0;

      return {
        id: u.id,
        email: u.email,
        displayLabel: u.displayName || u.name || "Anonymous",
        avatarUrl: u.avatarUrl,
        image: u.image,
        role: u.role,
        leaderboardVisible: u.leaderboardVisible,
        masteredSets,
        attemptedSets,
        bestAverage,
        bestPoints,
        possiblePoints,
        masteryPoints: bestPoints,
        totalAttempts,
        practiceScore: u._count.practiceSolves,
      };
    })
    .filter(
      (u) => u.leaderboardVisible || u.id === session.user.id || isStaffRole(session.user.role),
    )
    .filter((u) => scope === "all" || friendIds.has(u.id))
    .sort((a, b) => {
      if (mode === "practice") {
        return b.practiceScore - a.practiceScore || a.displayLabel.localeCompare(b.displayLabel);
      }

      if (sortMode === "average") {
        return (
          b.bestAverage - a.bestAverage ||
          b.masteryPoints - a.masteryPoints ||
          b.masteredSets - a.masteredSets ||
          a.displayLabel.localeCompare(b.displayLabel)
        );
      }

      return (
        b.masteryPoints - a.masteryPoints ||
        b.masteredSets - a.masteredSets ||
        b.bestAverage - a.bestAverage ||
        b.attemptedSets - a.attemptedSets ||
        a.displayLabel.localeCompare(b.displayLabel)
      );
    })
    .map((u, i) => ({ ...u, rank: i + 1 }));
  const topRow = rows[0] ?? null;
  const activeStandardUsers = rows.filter((row) => row.attemptedSets > 0).length;

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
          <Link className="secondary-action" href="/dashboard">
            <ArrowLeft size={16} />
            Dashboard
          </Link>
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
                className={`segmented-button${sortMode === "mastery" ? " active" : ""}`}
                href={leaderboardHref({ sort: "mastery" })}
              >
                Mastery
              </Link>
              <Link
                className={`segmented-button${sortMode === "average" ? " active" : ""}`}
                href={leaderboardHref({ sort: "average" })}
              >
                Best average
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
              : sortMode === "average"
                ? "Weighted best average"
                : "Mastery points"}
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
          <span>{mode === "practice" ? (topRow?.displayLabel ?? "No entries") : "Published now"}</span>
        </article>
        <article>
          <small>Signal</small>
          <strong>{mode === "practice" ? "Drill volume" : "Breadth × accuracy"}</strong>
          <span>Designed to reward useful progress</span>
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
                  <th>Mastery</th>
                  <th>Mastered</th>
                  <th>Best avg</th>
                  <th>Coverage</th>
                  <th>Attempts</th>
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
                            : `${u.masteryPoints} pts · ${u.bestAverage}% avg`}
                        </small>
                      </div>
                    </div>
                  </td>
                  {mode === "standard" ? (
                    <>
                      <td>
                        <div className="leaderboard-score-cell">
                          <strong>{u.masteryPoints}</strong>
                          <small>
                            {u.bestPoints}/{u.possiblePoints || 0} best points
                          </small>
                        </div>
                      </td>
                      <td>
                        <div className="leaderboard-score-cell">
                          <strong>{u.masteredSets}</strong>
                          <small>sets at 80%+</small>
                        </div>
                      </td>
                      <td>
                        <div className="leaderboard-score-cell">
                          <span
                            className={`score-color ${
                              u.bestAverage >= 80
                                ? "score-high"
                                : u.bestAverage >= 50
                                  ? "score-mid"
                                  : "score-low"
                            }`}
                          >
                            {u.bestAverage}%
                          </span>
                          <small>weighted by points</small>
                        </div>
                      </td>
                      <td>
                        <div className="leaderboard-score-cell">
                          <strong>
                            {u.attemptedSets}/{visibleSetIds.size}
                          </strong>
                          <small>sets tried</small>
                        </div>
                      </td>
                      <td>
                        <div className="leaderboard-score-cell">
                          <strong>{u.totalAttempts}</strong>
                          <small>submitted</small>
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
