/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Calendar, Grid2x2, Mail } from "lucide-react";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { usernameFromEmail } from "@/lib/user-profile";
import { isVisibleToStudent } from "@/lib/visibility";
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
                },
              },
            },
          },
          problemSet: { select: { title: true, slug: true } },
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!user) notFound();

  const allSets = await prisma.problemSet.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
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
  });

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
  const visibleSets =
    session.user.role === "ADMIN" ? allSets : allSets.filter((set) => isVisibleToStudent(set));
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
  const problemGridRows = visibleSets.flatMap((set) =>
    set.problems.map((problem) => ({
      id: problem.id,
      slug: set.slug,
      label: `${set.order}-${problem.number}`,
      title: `${set.title} - Problem ${problem.number}`,
      best: problemProgress.has(problem.id) ? problemProgress.get(problem.id) ?? 0 : null,
    })),
  );
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

      <section className="profile-section">
        <div className="profile-grid-header">
          <h2>
            <Grid2x2 size={18} />
            Progress grids
          </h2>
          <div className="segmented-control" aria-label="Profile progress grid mode">
            <Link
              className={`segmented-button${gridMode === "sets" ? " active" : ""}`}
              href={profileGridHref("sets")}
            >
              Sets
            </Link>
            <Link
              className={`segmented-button${gridMode === "problems" ? " active" : ""}`}
              href={profileGridHref("problems")}
            >
              Problems
            </Link>
          </div>
          <div className="profile-grid-legend" aria-label="Set status legend">
            <span className="profile-grid-legend-item">
              <span className="profile-grid-dot profile-grid-dot-solved" />
              High score
            </span>
            <span className="profile-grid-legend-item">
              <span className="profile-grid-dot profile-grid-dot-attempted" />
              Low score
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
