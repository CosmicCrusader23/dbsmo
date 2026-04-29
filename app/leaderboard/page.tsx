/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Trophy, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";

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

export default async function LeaderboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      attempts: {
        select: { score: true, maxScore: true, problemSetId: true },
      },
    },
  });

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
        displayLabel: u.displayName || u.name || "Anonymous",
        avatarUrl: u.avatarUrl,
        role: u.role,
        solvedSets,
        uniqueSets,
        avgScore,
        totalAttempts,
      };
    })
    .sort((a, b) => b.solvedSets - a.solvedSets || b.avgScore - a.avgScore)
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
        <Link className="secondary-action" href="/users">
          <Users size={16} />
          All users
        </Link>
      </header>

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
            {rows.map((row) => (
              <tr key={row.id} className={row.rank <= 3 ? `leaderboard-top-${row.rank}` : ""}>
                <td>
                  <RankBadge rank={row.rank} />
                </td>
                <td>
                  <Link href={`/users/${row.id}`} className="leaderboard-user">
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
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
