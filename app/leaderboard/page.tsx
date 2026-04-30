/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ArrowLeft, Heart, Trophy, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { profilePathFromEmail } from "@/lib/user-profile";

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
  const scope = params.scope === "friends" ? "friends" : "all";
  const sortMode = params.sort === "average" ? "average" : "solved";

  function leaderboardHref(next: { scope?: "all" | "friends"; sort?: "solved" | "average" }) {
    const query = new URLSearchParams({
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
      const avgScore =
        totalAttempts > 0
          ? Math.round(
              u.attempts.reduce(
                (s, a) => s + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0),
                0,
              ) / totalAttempts,
            )
          : 0;

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
      };
    })
    .filter((u) => scope === "all" || friendIds.has(u.id))
    .sort((a, b) => {
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
    <main className="leaderboard-shell">
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
      </section>

      <div className="leaderboard-table-wrap">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>User</th>
              <th>Solved</th>
              <th>Avg score</th>
              <th>Sets tried</th>
              <th>Attempts</th>
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
              rows.map((row) => (
                <tr key={row.id} className={row.rank <= 3 ? `leaderboard-top-${row.rank}` : ""}>
                  <td>
                    <RankBadge rank={row.rank} />
                  </td>
                  <td>
                    <Link href={profilePathFromEmail(row.email)} className="leaderboard-user">
                      {row.avatarUrl ? (
                        <img src={row.avatarUrl} alt="" className="leaderboard-avatar" />
                      ) : (
                        <DefaultAvatar size={32} />
                      )}
                      <span className="leaderboard-name">{row.displayLabel}</span>
                      <span className="leaderboard-role-tag">{row.role}</span>
                    </Link>
                  </td>
                  <td>
                    <strong>{row.solvedSets}</strong>
                  </td>
                  <td>
                    <span
                      className={`score-color ${
                        row.avgScore >= 80
                          ? "score-high"
                          : row.avgScore >= 50
                            ? "score-mid"
                            : "score-low"
                      }`}
                    >
                      {row.avgScore}%
                    </span>
                  </td>
                  <td>{row.uniqueSets}</td>
                  <td>{row.totalAttempts}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
