/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Users, Trophy } from "lucide-react";
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

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      attempts: {
        select: { score: true, maxScore: true, problemSetId: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const userRows = users.map((u) => {
    const uniqueSets = new Set(u.attempts.map((a) => a.problemSetId)).size;
    const totalAttempts = u.attempts.length;
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
      ...u,
      displayLabel: u.displayName || u.name || "Anonymous",
      uniqueSets,
      totalAttempts,
      avgScore,
    };
  });

  return (
    <main className="users-shell">
      <header className="users-header">
        <div>
          <p className="eyebrow">Community</p>
          <h1>
            <Users size={24} />
            Users
          </h1>
        </div>
        <Link className="secondary-action" href="/leaderboard">
          <Trophy size={16} />
          Leaderboard
        </Link>
      </header>

      <div className="users-grid">
        {userRows.map((u) => (
          <Link key={u.id} href={`/users/${u.id}`} className="user-card-link">
            <div className="user-card">
              <div className="user-card-avatar">
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" className="user-card-img" />
                ) : (
                  <DefaultAvatar size={48} />
                )}
              </div>
              <div className="user-card-info">
                <h3>{u.displayLabel}</h3>
                <span className="user-card-role">{u.role}</span>
              </div>
              <div className="user-card-stats">
                <span>{u.uniqueSets} sets</span>
                <span>{u.avgScore}% avg</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
