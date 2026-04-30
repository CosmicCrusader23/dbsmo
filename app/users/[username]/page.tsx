/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Calendar, CheckCircle2, Mail, Award } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { usernameFromEmail } from "@/lib/user-profile";
import { FriendButton } from "./friend-button";
import { PromoteUserButton } from "./promote-user-button";

export const dynamic = "force-dynamic";

function DefaultAvatar({ size = 96 }: { size?: number }) {
  return (
    <div className="default-avatar" style={{ width: size, height: size, fontSize: size * 0.45 }}>
      <span>M</span>
    </div>
  );
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  const { username } = await params;
  const normalizedUsername = decodeURIComponent(username).trim().toLowerCase();

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
      displayName: true,
      avatarUrl: true,
      role: true,
      group: true,
      createdAt: true,
      attempts: {
        select: {
          score: true,
          maxScore: true,
          problemSetId: true,
          submittedAt: true,
          problemSet: { select: { title: true, slug: true } },
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!user) notFound();

  const isOwnProfile = user.id === session.user.id;
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
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="profile-avatar-img" />
          ) : (
            <DefaultAvatar size={96} />
          )}
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
          {session.user.role === "ADMIN" && user.role !== "ADMIN" ? (
            <PromoteUserButton userId={user.id} />
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
      </div>

      {solvedSets.length > 0 && (
        <section className="profile-section">
          <h2>
            <CheckCircle2 size={18} />
            Solved sets
          </h2>
          <div className="profile-solved-grid">
            {solvedSets.map((s) => (
              <Link key={s.slug} href={`/problem-sets/${s.slug}`} className="profile-solved-chip">
                <Award size={14} />
                {s.title}
                <span className="profile-solved-pct">{Math.round(s.best)}%</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
