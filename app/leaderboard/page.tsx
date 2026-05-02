/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ArrowLeft, Heart, Target, Trophy, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { profilePathFromEmail } from "@/lib/user-profile";
import { computeBestAverageScore } from "@/lib/analytics";

export const dynamic = "force-dynamic";

function DefaultAvatar({ size = 36 }: { size?: number }) {
  return (
    <div
      className="default-avatar default-avatar-sm"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      <span>M</span>
    </div>
  );
}

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
  const sortMode = params.sort === "average" ? "average" : "solved";

  function leaderboardHref(next: { mode?: "standard" | "practice"; scope?: "all" | "friends"; sort?: "solved" | "average" }) {
    const query = new URLSearchParams({
      mode: next.mode ?? mode,
      scope: next.scope ?? scope,
      sort: next.sort ?? sortMode,
    });
    return `/leaderboard?${query.toString()}`;
  }

  const [users, friendships] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        attempts: {
          select: { score: true, maxScore: true, problemSetId: true },
        },
        _count: {
          select: { practiceSolves: true },
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
  ]);

  const friendIds = new Set<string>([session.user.id]);
  for (const friendship of friendships) {
    friendIds.add(
      friendship.requesterId === session.user.id ? friendship.receiverId : friendship.requesterId,
    );
  }

  const rows = users
    .map((u) => {
      const totalAttempts = u.attempts.length;
      const uniqueSets = new Set(u.attempts.map((a) => a.problemSetId)).size;

      // Calculate best per set
      const bestPerSet = new Map<string, number>();
      for (const a of u.attempts) {
        const pct = a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0;
        bestPerSet.set(a.problemSetId, Math.max(bestPerSet.get(a.problemSetId) ?? 0, pct));
      }
      const solvedSets = [...bestPerSet.values()].filter((p) => p >= 80).length;
      const avgScore = computeBestAverageScore(u.attempts);

      return {
        id: u.id,
        email: u.email,
        displayLabel: u.displayName || u.name || "Anonymous",
        avatarUrl: u.avatarUrl,
        role: u.role,
        solvedSets,
        uniqueSets,
        avgScore,
        totalAttempts,
        practiceScore: u._count.practiceSolves,
      };
    })
    .filter((u) => scope === "all" || friendIds.has(u.id))
    .sort((a, b) => {
      if (mode === "practice") {
        return b.practiceScore - a.practiceScore || a.displayLabel.localeCompare(b.displayLabel);
      }

      if (sortMode === "average") {
        return (
          b.avgScore - a.avgScore ||
          b.solvedSets - a.solvedSets ||
          a.displayLabel.localeCompare(b.displayLabel)
        );
      }

      return (
        b.solvedSets - a.solvedSets ||
        b.avgScore - a.avgScore ||
        a.displayLabel.localeCompare(b.displayLabel)
      );
    })
    .map((u, i) => ({ ...u, rank: i + 1 }));

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
                className={`segmented-button${sortMode === "solved" ? " active" : ""}`}
                href={leaderboardHref({ sort: "solved" })}
              >
                Solved
              </Link>
              <Link
                className={`segmented-button${sortMode === "average" ? " active" : ""}`}
                href={leaderboardHref({ sort: "average" })}
              >
                Average score
              </Link>
            </div>
          </div>
        )}
      </section>

      <div className="leaderboard-table-wrap">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>User</th>
              {mode === "standard" ? (
                <>
                  <th>Solved</th>
                  <th>Avg score</th>
                  <th>Sets tried</th>
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
                <td colSpan={6}>
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
                      {u.avatarUrl ? (
                        <img
                          alt={`${u.displayLabel}'s avatar`}
                          className="leaderboard-avatar"
                          src={u.avatarUrl}
                        />
                      ) : (
                        <DefaultAvatar />
                      )}
                      <div className="leaderboard-user-info">
                        <Link className="user-link" href={profilePathFromEmail(u.email)}>
                          {u.displayLabel}
                        </Link>
                        {u.role === "ADMIN" ? <span className="role-badge">Teacher</span> : null}
                        <small className="leaderboard-mobile-meta">
                          {mode === "practice"
                            ? `Score ${u.practiceScore}`
                            : `Score ${u.avgScore}%`}
                        </small>
                      </div>
                    </div>
                  </td>
                  {mode === "standard" ? (
                    <>
                      <td>
                        <strong>{u.solvedSets}</strong>
                      </td>
                      <td>
                        <div className="leaderboard-score-cell">
                          <span
                            className={`score-color ${
                              u.avgScore >= 80
                                ? "score-high"
                                : u.avgScore >= 50
                                  ? "score-mid"
                                  : "score-low"
                            }`}
                          >
                            {u.avgScore}%
                          </span>
                          <small>{u.solvedSets} solved</small>
                        </div>
                      </td>
                      <td>{u.uniqueSets}</td>
                      <td>{u.totalAttempts}</td>
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
