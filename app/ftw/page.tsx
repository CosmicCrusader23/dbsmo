import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { ArrowLeft, Crown, Flame, Swords, Trophy } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { normalizeTagList } from "@/lib/problem-tags";
import { FTW_PROBLEMS_PER_MATCH, FTW_PROBLEM_LIMIT_SEC } from "@/lib/ftw";
import { FtwLobbyForm } from "./lobby-form";

export const dynamic = "force-dynamic";

export default async function FtwHomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/");
  }

  const now = new Date();

  const [tagAggregates, recent, leaderboard, totalCount] = await Promise.all([
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
      take: 5,
    }),
    prisma.ftwMatch.findMany({
      where: { status: "COMPLETED" },
      orderBy: [{ totalScore: "desc" }, { completedAt: "asc" }],
      take: 10,
      include: {
        user: { select: { displayName: true, name: true, leaderboardVisible: true } },
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

  const personalBest =
    recent.length > 0
      ? recent.reduce((acc, m) => (m.totalScore > acc.totalScore ? m : acc), recent[0])
      : null;

  return (
    <main className="ftw-shell">
      <div className="ftw-page">
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">Speed round</p>
            <h1>FTW</h1>
          </div>
          <Link className="secondary-action" href="/dashboard">
            <ArrowLeft size={18} />
            Back to dashboard
          </Link>
        </header>

        <section className="ftw-intro">
          <div>
            <h2>Race the clock.</h2>
            <p>
              {FTW_PROBLEMS_PER_MATCH} problems. {FTW_PROBLEM_LIMIT_SEC}s each. Faster correct
              answers earn more points. Loosely modelled on AoPS For The Win.
            </p>
            <ul className="ftw-rules">
              <li>
                <strong>6 pts</strong> if you answer in the first 7s
              </li>
              <li>
                <strong>1 pt</strong> minimum for a correct answer
              </li>
              <li>Wrong or timed out = 0</li>
            </ul>
          </div>
          <div className="ftw-hero-stat">
            <Flame size={28} />
            <div>
              <small>Problem pool</small>
              <strong>{totalCount}</strong>
              <span>published problems</span>
            </div>
          </div>
        </section>

        <section className="panel ftw-start-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">New match</p>
              <h2>pick a topic</h2>
            </div>
            <Swords size={22} />
          </div>
          <FtwLobbyForm tagOptions={tagOptions} />
        </section>

        <div className="ftw-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Top scores</p>
                <h2>leaderboard</h2>
              </div>
              <Trophy size={20} />
            </div>
            <div className="ftw-leaderboard">
              {leaderboard.length === 0 ? (
                <p className="ftw-empty">No matches finished yet. Be the first.</p>
              ) : (
                leaderboard.map((m, i) => {
                  const display = m.user.leaderboardVisible
                    ? m.user.displayName || m.user.name || "Anonymous"
                    : "Anonymous";
                  return (
                    <div className="ftw-leader-row" key={m.id}>
                      <span className={`ftw-rank rank-${i + 1}`}>
                        {i === 0 ? <Crown size={14} /> : i + 1}
                      </span>
                      <span className="ftw-leader-name">{display}</span>
                      <span className="ftw-leader-tag">{m.tag ?? "any"}</span>
                      <span className="ftw-leader-score">
                        {m.totalScore}
                        <small>/{m.maxScore}</small>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Your runs</p>
                <h2>recent matches</h2>
              </div>
              {personalBest ? (
                <small className="ftw-pb">
                  PB {personalBest.totalScore}/{personalBest.maxScore}
                </small>
              ) : null}
            </div>
            <div className="ftw-history">
              {recent.length === 0 ? (
                <p className="ftw-empty">No completed matches yet.</p>
              ) : (
                recent.map((m) => (
                  <div className="ftw-history-row" key={m.id}>
                    <div>
                      <strong>{m.tag ?? "any"}</strong>
                      <small>
                        {m.completedAt ? m.completedAt.toLocaleDateString() : "—"}
                      </small>
                    </div>
                    <span className="ftw-history-score">
                      {m.totalScore}
                      <small>/{m.maxScore}</small>
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
