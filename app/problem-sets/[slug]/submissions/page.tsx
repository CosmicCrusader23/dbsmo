import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Search,
  Users,
  XCircle,
} from "lucide-react";

import { Avatar } from "@/app/avatar";
import { PageBackLink } from "@/app/page-back-link";
import { ThemeToggle } from "@/app/theme-toggle";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { displayNameFor } from "@/lib/display-name";
import { hasPermission } from "@/lib/permissions";
import {
  canViewSubmissionAnswers,
  normalizeSubmissionPage,
  SUBMISSIONS_PAGE_SIZE,
  submissionPercentage,
  submissionVerdict,
} from "@/lib/submissions";
import { isVisibleToStudent } from "@/lib/visibility";
import { profilePathFromEmail } from "@/lib/user-profile";

export const dynamic = "force-dynamic";

type SubmissionsPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ page?: string; q?: string; view?: string }>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function searchParamsHref(
  slug: string,
  options: { page?: number; q?: string; view?: "all" | "friends" },
) {
  const params = new URLSearchParams();
  if (options.view === "friends") params.set("view", "friends");
  if (options.q?.trim()) params.set("q", options.q.trim());
  if (options.page && options.page > 1) params.set("page", String(options.page));
  const query = params.toString();
  return `/problem-sets/${slug}/submissions${query ? `?${query}` : ""}`;
}

export default async function ProblemSetSubmissionsPage({
  params,
  searchParams,
}: SubmissionsPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) notFound();

  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const searchQuery = query?.q?.trim().slice(0, 80) ?? "";
  const view = query?.view === "friends" ? "friends" : "all";
  const requestedPage = normalizeSubmissionPage(query?.page);

  const [currentUser, problemSet] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    }),
    prisma.problemSet.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        visibleFrom: true,
        visibleTo: true,
      },
    }),
  ]);

  if (!currentUser || !problemSet) notFound();
  if (currentUser.role !== "ADMIN" && !isVisibleToStudent(problemSet)) notFound();

  const canReviewStudentAttempts = hasPermission(currentUser.role, "admin:analytics");
  const [friendships, viewerAttempts] = await Promise.all([
    view === "friends"
      ? prisma.friendship.findMany({
          where: {
            OR: [{ requesterId: currentUser.id }, { receiverId: currentUser.id }],
          },
          select: { requesterId: true, receiverId: true },
        })
      : Promise.resolve([]),
    prisma.attempt.findMany({
      where: { userId: currentUser.id, problemSetId: problemSet.id, maxScore: { gt: 0 } },
      select: { score: true, maxScore: true },
    }),
  ]);

  const friendIds = new Set<string>([currentUser.id]);
  for (const friendship of friendships) {
    friendIds.add(
      friendship.requesterId === currentUser.id ? friendship.receiverId : friendship.requesterId,
    );
  }

  const userFilters: Prisma.UserWhereInput[] = [];
  if (!canReviewStudentAttempts) {
    userFilters.push({ OR: [{ leaderboardVisible: true }, { id: currentUser.id }] });
  }
  if (searchQuery) {
    userFilters.push({
      OR: [
        { displayName: { contains: searchQuery, mode: "insensitive" } },
        { name: { contains: searchQuery, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.AttemptWhereInput = {
    problemSetId: problemSet.id,
    ...(view === "friends" ? { userId: { in: Array.from(friendIds) } } : {}),
    ...(userFilters.length > 0 ? { user: { AND: userFilters } } : {}),
  };
  const totalCount = await prisma.attempt.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / SUBMISSIONS_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const attempts = await prisma.attempt.findMany({
    where,
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * SUBMISSIONS_PAGE_SIZE,
    take: SUBMISSIONS_PAGE_SIZE,
    select: {
      id: true,
      attemptNumber: true,
      score: true,
      maxScore: true,
      submittedAt: true,
      durationSeconds: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          image: true,
          avatarUrl: true,
          leaderboardVisible: true,
        },
      },
    },
  });

  const viewerSolvedSet = viewerAttempts.some((attempt) => attempt.score >= attempt.maxScore);
  return (
    <main className="single-page submissions-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
      </div>

      <div className="page-frame submissions-frame">
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">{problemSet.slug}</p>
            <h1 className="problem-title-row">
              <ClipboardCheck size={24} />
              <span>{problemSet.title} submissions</span>
            </h1>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <PageBackLink destination="Problem Set" href={`/problem-sets/${problemSet.slug}`} />
          </div>
        </header>

        <section className="submissions-toolbar" aria-label="Submission filters">
          <div className="submissions-toolbar-heading">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h2>Submissions</h2>
            </div>
            <span>{totalCount} total</span>
          </div>
          <div className="submissions-controls">
            <nav className="submissions-scope-tabs" aria-label="Submission scope">
              <Link
                className={`submissions-scope-tab${view === "all" ? " active" : ""}`}
                href={searchParamsHref(problemSet.slug, { q: searchQuery, view: "all" })}
              >
                <Users size={16} />
                Everyone
              </Link>
              <Link
                className={`submissions-scope-tab${view === "friends" ? " active" : ""}`}
                href={searchParamsHref(problemSet.slug, { q: searchQuery, view: "friends" })}
              >
                <Users size={16} />
                Friends
              </Link>
            </nav>
            <form className="submissions-search" method="get">
              {view === "friends" ? <input name="view" type="hidden" value="friends" /> : null}
              <Search size={18} aria-hidden="true" />
              <input
                aria-label="Search submissions by name"
                defaultValue={searchQuery}
                maxLength={80}
                name="q"
                placeholder="Search by name"
                type="search"
              />
              <button className="secondary-action compact" type="submit">
                Search
              </button>
            </form>
          </div>
          <p className="submissions-privacy-note">
            Scores and verdicts are public. Your own answers stay reviewable; other answers unlock
            after you solve the set or for admins.
          </p>
        </section>

        <section className="submissions-panel" aria-labelledby="submissions-table-title">
          <div className="submissions-panel-heading">
            <div>
              <p className="eyebrow">Newest first</p>
              <h2 id="submissions-table-title">Latest submissions</h2>
            </div>
            <span>
              Showing {attempts.length} of {totalCount}
            </span>
          </div>

          {attempts.length === 0 ? (
            <div className="submissions-empty">
              <ClipboardCheck size={28} />
              <strong>No submissions found</strong>
              <span>
                {view === "friends"
                  ? "Your friends have not submitted this set yet."
                  : searchQuery
                    ? "Try a different name."
                    : "Be the first to submit this set."}
              </span>
            </div>
          ) : (
            <div className="submissions-table-wrap">
              <table className="submissions-table">
                <thead>
                  <tr>
                    <th>Attempt</th>
                    <th>User</th>
                    <th>Date / time</th>
                    <th>Verdict</th>
                    <th>Score</th>
                    <th>Answers</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((attempt) => {
                    const verdict = submissionVerdict(attempt.score, attempt.maxScore);
                    const percentage = submissionPercentage(attempt.score, attempt.maxScore);
                    const isOwner = attempt.user.id === currentUser.id;
                    const canReviewAnswers = canViewSubmissionAnswers(
                      canReviewStudentAttempts,
                      viewerSolvedSet,
                      isOwner,
                    );
                    const visibleName =
                      attempt.user.leaderboardVisible || isOwner || canReviewStudentAttempts;
                    const userLabel = visibleName
                      ? displayNameFor(attempt.user)
                      : "Anonymous student";

                    return (
                      <tr key={attempt.id}>
                        <td data-label="Attempt">
                          <strong>#{attempt.attemptNumber}</strong>
                          <small>
                            {attempt.durationSeconds ? `${attempt.durationSeconds}s` : "—"}
                          </small>
                        </td>
                        <td data-label="User">
                          <div className="submission-user">
                            <Avatar user={attempt.user} size="sm" />
                            {visibleName ? (
                              <Link href={profilePathFromEmail(attempt.user.email)}>
                                {userLabel}
                                {isOwner ? <small>You</small> : null}
                              </Link>
                            ) : (
                              <span>{userLabel}</span>
                            )}
                          </div>
                        </td>
                        <td data-label="Date / time">
                          <time dateTime={attempt.submittedAt.toISOString()}>
                            {dateTimeFormatter.format(attempt.submittedAt)}
                          </time>
                        </td>
                        <td data-label="Verdict">
                          <span className={`submission-verdict verdict-${verdict.kind}`}>
                            {verdict.kind === "accepted" ? (
                              <CheckCircle2 size={16} />
                            ) : verdict.kind === "wrong" ? (
                              <XCircle size={16} />
                            ) : null}
                            {verdict.label}
                          </span>
                        </td>
                        <td data-label="Score">
                          <strong>
                            {attempt.score}/{attempt.maxScore}
                          </strong>
                          <small>{percentage}%</small>
                        </td>
                        <td data-label="Answers">
                          {canReviewAnswers ? (
                            <Link
                              className="secondary-action compact"
                              href={`/attempts/${attempt.id}`}
                            >
                              <Eye size={16} />
                              Review
                            </Link>
                          ) : (
                            <span className="submission-hidden-answer">Hidden</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 ? (
            <nav className="submissions-pagination" aria-label="Submissions pages">
              {page > 1 ? (
                <Link
                  className="secondary-action compact"
                  href={searchParamsHref(problemSet.slug, {
                    page: page - 1,
                    q: searchQuery,
                    view,
                  })}
                >
                  <ChevronLeft size={16} />
                  Previous
                </Link>
              ) : (
                <span className="secondary-action compact disabled">
                  <ArrowLeft size={16} />
                  Previous
                </span>
              )}
              <span>
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  className="secondary-action compact"
                  href={searchParamsHref(problemSet.slug, {
                    page: page + 1,
                    q: searchQuery,
                    view,
                  })}
                >
                  Next
                  <ChevronRight size={16} />
                </Link>
              ) : (
                <span className="secondary-action compact disabled">
                  Next
                  <ChevronRight size={16} />
                </span>
              )}
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}
