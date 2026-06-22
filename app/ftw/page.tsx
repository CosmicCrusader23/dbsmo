import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { ArrowLeft, Crown, Flame, Swords, Trophy, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { normalizeTagList } from "@/lib/problem-tags";
import { FTW_PROBLEMS_PER_MATCH, FTW_PROBLEM_LIMIT_SEC } from "@/lib/ftw";
import { FtwLobbyForm } from "./lobby-form";

export const dynamic = "force-dynamic";

function timeAgo(d: Date | null) {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default async function FtwHomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const now = new Date();

  const [tagAggregates, soloRecent, soloLeaders, roomLeaders, roomRecent, totalCount] =
    await Promise.all([
      prisma.problem.findMany({
        where: {
          problemSet: {
            status: "PUBLISHED",
            AND: [
              { OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }] },
              { OR: [{ visibleTo: null }, { visibleTo: { gte: now } }] },
            ],
          },
        },
        select: { topicTags: true },
      }),
      prisma.ftwMatch.findMany({
        where: { userId: session.user.id, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 8,
      }),
      prisma.ftwMatch.findMany({
        where: { status: "COMPLETED" },
        orderBy: [{ totalScore: "desc" }, { completedAt: "asc" }],
        take: 20,
        include: {
          user: { select: { displayName: true, name: true, leaderboardVisible: true } },
        },
      }),
      prisma.ftwRoomPlayer.findMany({
        where: { room: { status: "COMPLETED" } },
        orderBy: [{ score: "desc" }, { joinedAt: "asc" }],
        take: 20,
        include: {
          user: { select: { displayName: true, name: true, leaderboardVisible: true } },
          room: { select: { tag: true, totalProblems: true, completedAt: true } },
        },
      }),
      prisma.ftwRoomPlayer.findMany({
        where: { userId: session.user.id, room: { status: "COMPLETED" } },
        orderBy: { joinedAt: "desc" },
        take: 8,
        include: {
          room: {
            select: { tag: true, totalProblems: true, completedAt: true, code: true },
          },
        },
      }),
      prisma.problem.count({
        where: {
          problemSet: {
            status: "PUBLISHED",
            AND: [
              { OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }] },
              { OR: [{ visibleTo: null }, { visibleTo: { gte: now } }] },
            ],
          },
        },
      }),
    ]);

  const tagCounts = new Map<string, number>();
  for (const row of tagAggregates) {
    const tags = normalizeTagList(row.topicTags);
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const tagOptions = Array.from(tagCounts.entries())
    .filter(([, c]) => c >= FTW_PROBLEMS_PER_MATCH)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));

  type LeaderEntry = {
    key: string;
    name: string;
    tag: string | null;
    score: number;
    maxScore: number;
    mode: "solo" | "room";
    completedAt: Date | null;
  };

  const FTW_MAX_PER_PROBLEM = 6;
  const soloEntries: LeaderEntry[] = soloLeaders.map((m) => ({
    key: `solo-${m.id}`,
    name: m.user.leaderboardVisible
      ? m.user.displayName || m.user.name || "Anonymous"
      : "Anonymous",
    tag: m.tag,
    score: m.totalScore,
    maxScore: m.maxScore,
    mode: "solo",
    completedAt: m.completedAt,
  }));
  const roomEntries: LeaderEntry[] = roomLeaders.map((p) => ({
    key: `room-${p.id}`,
    name: p.user.leaderboardVisible
      ? p.user.displayName || p.user.name || "Anonymous"
      : "Anonymous",
    tag: p.room.tag,
    score: p.score,
    maxScore: p.room.totalProblems * FTW_MAX_PER_PROBLEM,
    mode: "room",
    completedAt: p.room.completedAt,
  }));
  const leaderboard = [...soloEntries, ...roomEntries]
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const at = a.completedAt?.getTime() ?? 0;
      const bt = b.completedAt?.getTime() ?? 0;
      return at - bt;
    })
    .slice(0, 10);

  type HistoryEntry = {
    key: string;
    tag: string | null;
    score: number;
    maxScore: number;
    mode: "solo" | "room";
    completedAt: Date | null;
  };
  const soloHistory: HistoryEntry[] = soloRecent.map((m) => ({
    key: `solo-${m.id}`,
    tag: m.tag,
    score: m.totalScore,
    maxScore: m.maxScore,
    mode: "solo",
    completedAt: m.completedAt,
  }));
  const roomHistory: HistoryEntry[] = roomRecent.map((p) => ({
    key: `room-${p.id}`,
    tag: p.room.tag,
    score: p.score,
    maxScore: p.room.totalProblems * FTW_MAX_PER_PROBLEM,
    mode: "room",
    completedAt: p.room.completedAt,
  }));
  const recent = [...soloHistory, ...roomHistory]
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
    .slice(0, 6);

  const personalBest =
    recent.length > 0
      ? recent.reduce((acc, m) => (m.score > acc.score ? m : acc), recent[0])
      : null;

  const matchesPlayed = recent.length;
  const wins = recent.filter((m) => m.maxScore > 0 && m.score / m.maxScore >= 0.8).length;

  return (
    <main className="single-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
        <span className="bg-spark bg-spark-two" />
      </div>
      <div className="page-frame ftw-frame">
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">Speed round</p>
            <h1>FTW</h1>
          </div>
          <Link className="secondary-action" href="/dashboard">
            <ArrowLeft size={18} />
            Dashboard
          </Link>
        </header>

        <section className="ftw-hero">
          <div className="ftw-hero-copy">
            <h2>Race the clock.</h2>
            <p>
              {FTW_PROBLEMS_PER_MATCH} problems · {FTW_PROBLEM_LIMIT_SEC}s each. Faster correct
              answers earn more points. Loosely modelled on AoPS For The Win.
            </p>
            <div className="ftw-hero-rules">
              <span><strong>6 pts</strong> · first 7s</span>
              <span><strong>1 pt</strong> · minimum correct</span>
              <span><strong>0 pts</strong> · wrong or timeout</span>
            </div>
          </div>
          <div className="ftw-hero-stats">
            <div className="ftw-hero-stat">
              <Flame size={18} />
              <small>Pool</small>
              <strong>{totalCount}</strong>
            </div>
            <div className="ftw-hero-stat">
              <Trophy size={18} />
              <small>Personal best</small>
              <strong>{personalBest ? `${personalBest.score}/${personalBest.maxScore}` : "—"}</strong>
            </div>
            <div className="ftw-hero-stat">
              <Swords size={18} />
              <small>Recent runs</small>
              <strong>{matchesPlayed}{wins > 0 ? <span className="ftw-hero-stat-sub"> · {wins} wins</span> : null}</strong>
            </div>
          </div>
        </section>

        <section className="ftw-lobby-card">
          <div className="ftw-lobby-card-head">
            <div>
              <p className="eyebrow">New match</p>
              <h2>Set up a run</h2>
            </div>
            <Swords size={20} />
          </div>
          <FtwLobbyForm tagOptions={tagOptions} />
        </section>

        <div className="ftw-grid">
          <section className="ftw-card">
            <div className="ftw-card-head">
              <div>
                <p className="eyebrow">Top scores</p>
                <h2>Leaderboard</h2>
              </div>
              <Trophy size={18} />
            </div>
            <div className="ftw-leaderboard">
              {leaderboard.length === 0 ? (
                <p className="ftw-empty">No matches finished yet. Be the first.</p>
              ) : (
                leaderboard.map((m, i) => (
                  <div className="ftw-leader-row" key={m.key}>
                    <span className={`ftw-rank rank-${i + 1}`}>
                      {i === 0 ? <Crown size={14} /> : i + 1}
                    </span>
                    <div className="ftw-leader-main">
                      <strong>{m.name}</strong>
                      <small>
                        <span className={`ftw-mode-pill mode-${m.mode}`}>{m.mode}</span>
                        <span className="ftw-leader-tag">{m.tag ?? "any"}</span>
                      </small>
                    </div>
                    <span className="ftw-leader-score">
                      {m.score}
                      <small>/{m.maxScore}</small>
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="ftw-card">
            <div className="ftw-card-head">
              <div>
                <p className="eyebrow">Your runs</p>
                <h2>Recent matches</h2>
              </div>
              <Users size={18} />
            </div>
            <div className="ftw-history">
              {recent.length === 0 ? (
                <p className="ftw-empty">No completed matches yet.</p>
              ) : (
                recent.map((m) => {
                  const pct = m.maxScore > 0 ? Math.round((m.score / m.maxScore) * 100) : 0;
                  const tier = pct >= 80 ? "success" : pct >= 50 ? "warning" : "danger";
                  return (
                    <div className="ftw-history-row" key={m.key}>
                      <div className="ftw-history-main">
                        <strong>{m.tag ?? "any"}</strong>
                        <small>
                          <span className={`ftw-mode-pill mode-${m.mode}`}>{m.mode}</span>
                          <span>{timeAgo(m.completedAt)}</span>
                        </small>
                      </div>
                      <div className="ftw-history-meter">
                        <span className={`ftw-history-fill tier-${tier}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="ftw-history-score">
                        {m.score}
                        <small>/{m.maxScore}</small>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
