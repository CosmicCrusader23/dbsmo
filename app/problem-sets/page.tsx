import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ArrowLeft, LayoutGrid, Search } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  OTHER_PROBLEM_SET_TAG,
  STANDARD_PROBLEM_SET_TAGS,
  categorizeProblemSetTags,
  normalizeTagList,
  normalizeProblemTag,
} from "@/lib/problem-tags";
import { profilePathFromEmail } from "@/lib/user-profile";
import { isVisibleToStudent } from "@/lib/visibility";

export const dynamic = "force-dynamic";

type SetRow = {
  id: string;
  slug: string;
  title: string;
  order: string;
  createdAt: Date;
  categories: string[];
  tags: string[];
  problemCount: number;
  bestScore: number;
  attempts: number;
  solvedCount: number;
  isBookmarked: boolean;
  hasPdf: boolean;
  hasVideo: boolean;
  weakMatch: number;
  recommendationScore: number;
};

const CATEGORY_ORDER = [...STANDARD_PROBLEM_SET_TAGS, OTHER_PROBLEM_SET_TAG];

type ProblemSetsSearchParams = Promise<{
  category?: string;
  hideSolved?: string;
  media?: string;
  page?: string;
  q?: string;
  sort?: string;
  status?: string;
  view?: string;
}>;

export default async function ProblemSetsPage({
  searchParams,
}: {
  searchParams?: ProblemSetsSearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const sortMode =
    params.sort === "solved"
      ? "solved"
      : params.sort === "name"
        ? "name"
        : params.sort === "latest"
          ? "latest"
          : params.sort === "weakest"
            ? "weakest"
            : params.sort === "recommended"
              ? "recommended"
              : "default";
  const activeView =
    params.view === "bookmarked"
      ? "bookmarked"
      : params.view === "assigned"
        ? "assigned"
        : params.view === "completed"
          ? "completed"
          : params.view === "practice"
            ? "practice"
            : "recommended";
  const currentPage = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 20;
  const statusFilter =
    params.status === "not-started" ||
    params.status === "in-progress" ||
    params.status === "completed"
      ? params.status
      : "all";
  const mediaFilter = params.media === "video" ? "video" : params.media === "pdf" ? "pdf" : "all";
  const hideSolved = params.hideSolved === "1";
  const query = params.q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();
  const activeCategory =
    CATEGORY_ORDER.find(
      (category) => normalizeProblemTag(category) === normalizeProblemTag(params.category ?? ""),
    ) ?? null;

  function problemSetsHref(next: {
    category?: string | null;
    hideSolved?: boolean;
    q?: string;
    sort?: "default" | "solved" | "name" | "latest" | "weakest" | "recommended";
    media?: "all" | "video" | "pdf";
    status?: "all" | "not-started" | "in-progress" | "completed";
    page?: number;
    view?: "recommended" | "bookmarked" | "assigned" | "completed" | "practice";
  }) {
    const nextSort = next.sort ?? sortMode;
    const nextView = next.view ?? activeView;
    const nextCategory = next.category === undefined ? activeCategory : next.category;
    const nextMedia = next.media ?? mediaFilter;
    const nextStatus = next.status ?? statusFilter;
    const nextHideSolved = next.hideSolved ?? hideSolved;
    const nextQuery = next.q === undefined ? query : next.q;
    const nextPage = next.page ?? 1;
    const urlParams = new URLSearchParams();

    if (nextView === "bookmarked") {
      urlParams.set("view", nextView);
    }
    if (nextSort !== "default") {
      urlParams.set("sort", nextSort);
    }
    if (nextCategory) {
      urlParams.set("category", nextCategory);
    }
    if (nextStatus !== "all") {
      urlParams.set("status", nextStatus);
    }
    if (nextMedia !== "all") {
      urlParams.set("media", nextMedia);
    }
    if (nextHideSolved) {
      urlParams.set("hideSolved", "1");
    }
    if (nextQuery.trim()) {
      urlParams.set("q", nextQuery.trim());
    }
    if (nextPage > 1) {
      urlParams.set("page", String(nextPage));
    }

    const suffix = urlParams.toString();
    return suffix ? `/problem-sets?${suffix}` : "/problem-sets";
  }

  const [currentUser, allSets, attempts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, email: true },
    }),
    prisma.problemSet.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { problems: true } },
        problems: { select: { topicTags: true } },
        attempts: { select: { userId: true, score: true, maxScore: true } },
        bookmarks: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
    }),
    prisma.attempt.findMany({
      where: { userId: session.user.id },
      select: {
        score: true,
        maxScore: true,
        problemSetId: true,
        responses: {
          select: {
            isCorrect: true,
            problem: { select: { topicTags: true } },
          },
        },
      },
    }),
  ]);

  if (!currentUser) {
    redirect("/");
  }

  const visibleSets =
    currentUser.role === "ADMIN" ? allSets : allSets.filter((set) => isVisibleToStudent(set));

  const attemptMap = new Map<string, { bestScore: number; attempts: number }>();
  const topicStats = new Map<string, { correct: number; total: number }>();
  for (const attempt of attempts) {
    const existing = attemptMap.get(attempt.problemSetId) ?? { bestScore: 0, attempts: 0 };
    const percentage =
      attempt.maxScore > 0 ? Math.round((attempt.score / attempt.maxScore) * 100) : 0;
    existing.bestScore = Math.max(existing.bestScore, percentage);
    existing.attempts += 1;
    attemptMap.set(attempt.problemSetId, existing);
    for (const response of attempt.responses) {
      const topics = normalizeTagList(response.problem.topicTags);
      for (const topic of topics.length > 0 ? topics : ["General"]) {
        const stats = topicStats.get(topic) ?? { correct: 0, total: 0 };
        stats.total += 1;
        if (response.isCorrect) stats.correct += 1;
        topicStats.set(topic, stats);
      }
    }
  }

  const weakTopicScores = new Map(
    Array.from(topicStats.entries()).map(([topic, stats]) => [
      topic,
      stats.total > 0 ? 1 - stats.correct / stats.total : 0,
    ]),
  );

  const setRows: SetRow[] = visibleSets.map((set) => {
    const progress = attemptMap.get(set.id) ?? { bestScore: 0, attempts: 0 };
    const allTags = normalizeTagList([
      ...set.topicTags,
      ...set.problems.flatMap((problem) => problem.topicTags),
    ]);
    const solvedUsers = new Set(
      set.attempts
        .filter((attempt) => attempt.maxScore > 0 && attempt.score === attempt.maxScore)
        .map((attempt) => attempt.userId),
    );
    return {
      id: set.id,
      slug: set.slug,
      title: set.title,
      order: set.order,
      createdAt: set.createdAt,
      categories: categorizeProblemSetTags(allTags),
      tags: allTags,
      problemCount: set._count.problems,
      bestScore: progress.bestScore,
      attempts: progress.attempts,
      solvedCount: solvedUsers.size,
      isBookmarked: set.bookmarks.length > 0,
      hasPdf: Boolean(set.problemFileId),
      hasVideo: Boolean(set.videoUrl),
      weakMatch: allTags.reduce((sum, tag) => sum + (weakTopicScores.get(tag) ?? 0), 0),
      recommendationScore:
        (progress.attempts === 0 ? 40 : Math.max(0, 100 - progress.bestScore)) +
        set.difficulty * 3 +
        (set.videoUrl ? 5 : 0),
    };
  });

  const orderedRows = [...setRows].sort((a, b) => {
    if (sortMode === "solved") {
      return b.solvedCount - a.solvedCount || a.order.localeCompare(b.order) || a.title.localeCompare(b.title);
    }

    if (sortMode === "name") {
      return a.title.localeCompare(b.title) || a.order.localeCompare(b.order);
    }

    if (sortMode === "latest") {
      return b.createdAt.getTime() - a.createdAt.getTime() || a.title.localeCompare(b.title);
    }

    if (sortMode === "weakest") {
      return b.weakMatch - a.weakMatch || a.order.localeCompare(b.order) || a.title.localeCompare(b.title);
    }

    if (sortMode === "recommended") {
      return (
        b.recommendationScore - a.recommendationScore ||
        b.weakMatch - a.weakMatch ||
        a.order.localeCompare(b.order)
      );
    }

    return a.order.localeCompare(b.order) || a.title.localeCompare(b.title);
  });

  const viewRows = orderedRows.filter((set) => {
    if (activeView === "bookmarked") return set.isBookmarked;
    if (activeView === "assigned") return set.bestScore < 100;
    if (activeView === "completed") return set.bestScore >= 100;
    if (activeView === "practice") return set.weakMatch > 0 || set.attempts > 0;
    return true;
  });
  const statusRows = viewRows.filter((set) => {
    if (statusFilter === "not-started") return set.attempts === 0;
    if (statusFilter === "in-progress") return set.attempts > 0 && set.bestScore < 100;
    if (statusFilter === "completed") return set.bestScore >= 100;
    return true;
  });
  const mediaRows = statusRows.filter((set) => {
    if (mediaFilter === "video") return set.hasVideo;
    if (mediaFilter === "pdf") return set.hasPdf;
    return true;
  });
  const filteredRows = hideSolved ? mediaRows.filter((set) => set.bestScore < 100) : mediaRows;

  const groupedRows = new Map<string, SetRow[]>(
    CATEGORY_ORDER.map((category) => [
      category,
      filteredRows.filter((set) => {
        const matchesSearch =
          !normalizedQuery ||
          [set.title, set.slug, ...set.tags, ...set.categories]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        return matchesSearch && set.categories.includes(category);
      }),
    ]),
  );
  const tableRows = filteredRows.filter((set) => {
    const matchesCategory = !activeCategory || set.categories.includes(activeCategory);
    const matchesSearch =
      !normalizedQuery ||
      [set.title, set.slug, ...set.tags, ...set.categories]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    return matchesCategory && matchesSearch;
  });
  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = tableRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const profileHref = profilePathFromEmail(currentUser.email);

  return (
    <main className="problem-hub-shell">
      <header className="problem-hub-header">
        <div>
          <p className="eyebrow">Browse sets</p>
          <h1>
            <LayoutGrid size={24} />
            Problem Sets
          </h1>
        </div>
        <div className="topbar-actions">
          <Link className="secondary-action" href={profileHref}>
            My profile
          </Link>
          <Link className="secondary-action" href="/dashboard">
            <ArrowLeft size={16} />
            Dashboard
          </Link>
        </div>
      </header>

      <nav className="problem-hub-tabs" aria-label="Problem set filters">
        <Link
          className={`problem-hub-tab${activeView === "recommended" ? " active" : ""}`}
          href={problemSetsHref({ category: null, view: "recommended" })}
        >
          Recommended
        </Link>
        <Link
          className={`problem-hub-tab${activeView === "bookmarked" ? " active" : ""}`}
          href={problemSetsHref({ category: null, view: "bookmarked" })}
        >
          Bookmarked
        </Link>
        <Link
          className={`problem-hub-tab${activeView === "assigned" ? " active" : ""}`}
          href={problemSetsHref({ category: null, view: "assigned" })}
        >
          Assigned
        </Link>
        <Link
          className={`problem-hub-tab${activeView === "practice" ? " active" : ""}`}
          href={problemSetsHref({ category: null, view: "practice", sort: "weakest" })}
        >
          Self-practice
        </Link>
        <Link
          className={`problem-hub-tab${activeView === "completed" ? " active" : ""}`}
          href={problemSetsHref({ category: null, view: "completed", status: "completed" })}
        >
          Completed archive
        </Link>
        <span className="problem-hub-tab tag-tab">Tags</span>
      </nav>

      <section className="problem-sort-controls" aria-label="Problem-set ordering">
        <span className="leaderboard-control-label">Order by</span>
        <div className="segmented-control">
          <Link
            className={`segmented-button${sortMode === "default" ? " active" : ""}`}
            href={problemSetsHref({ sort: "default" })}
          >
            Default
          </Link>
          <Link
            className={`segmented-button${sortMode === "solved" ? " active" : ""}`}
            href={problemSetsHref({ sort: "solved" })}
          >
            Solve count
          </Link>
          <Link
            className={`segmented-button${sortMode === "name" ? " active" : ""}`}
            href={problemSetsHref({ sort: "name" })}
          >
            Name
          </Link>
          <Link
            className={`segmented-button${sortMode === "latest" ? " active" : ""}`}
            href={problemSetsHref({ sort: "latest" })}
          >
            Latest
          </Link>
          <Link
            className={`segmented-button${sortMode === "weakest" ? " active" : ""}`}
            href={problemSetsHref({ sort: "weakest" })}
          >
            Weakest topic
          </Link>
          <Link
            className={`segmented-button${sortMode === "recommended" ? " active" : ""}`}
            href={problemSetsHref({ sort: "recommended" })}
          >
            Teacher recommended
          </Link>
        </div>
        <span className="leaderboard-control-label">Status</span>
        <div className="segmented-control">
          <Link
            className={`segmented-button${statusFilter === "all" ? " active" : ""}`}
            href={problemSetsHref({ status: "all", hideSolved: false })}
          >
            All
          </Link>
          <Link
            className={`segmented-button${statusFilter === "not-started" ? " active" : ""}`}
            href={problemSetsHref({ status: "not-started", hideSolved: false })}
          >
            Not started
          </Link>
          <Link
            className={`segmented-button${statusFilter === "in-progress" ? " active" : ""}`}
            href={problemSetsHref({ status: "in-progress", hideSolved: false })}
          >
            In progress
          </Link>
          <Link
            className={`segmented-button${statusFilter === "completed" ? " active" : ""}`}
            href={problemSetsHref({ status: "completed", hideSolved: false })}
          >
            Completed
          </Link>
        </div>
        <span className="leaderboard-control-label">Media</span>
        <div className="segmented-control">
          <Link
            className={`segmented-button${mediaFilter === "all" ? " active" : ""}`}
            href={problemSetsHref({ media: "all" })}
          >
            All
          </Link>
          <Link
            className={`segmented-button${mediaFilter === "video" ? " active" : ""}`}
            href={problemSetsHref({ media: "video" })}
          >
            Video
          </Link>
          <Link
            className={`segmented-button${mediaFilter === "pdf" ? " active" : ""}`}
            href={problemSetsHref({ media: "pdf" })}
          >
            PDF
          </Link>
        </div>
      </section>

      <form action="/problem-sets" className="search-panel task-search-panel" role="search">
        <Search size={18} />
        <input
          aria-label="Search tasks"
          defaultValue={query}
          name="q"
          placeholder="Search tasks by title, slug, or tag"
        />
        {sortMode !== "default" ? <input name="sort" type="hidden" value={sortMode} /> : null}
        {activeView === "bookmarked" ? (
          <input name="view" type="hidden" value="bookmarked" />
        ) : null}
        {statusFilter !== "all" ? <input name="status" type="hidden" value={statusFilter} /> : null}
        {mediaFilter !== "all" ? <input name="media" type="hidden" value={mediaFilter} /> : null}
        {hideSolved ? <input name="hideSolved" type="hidden" value="1" /> : null}
        {activeCategory ? <input name="category" type="hidden" value={activeCategory} /> : null}
        <button className="secondary-action compact" type="submit">
          Search
        </button>
        {query ||
        activeCategory ||
        hideSolved ||
        statusFilter !== "all" ||
        mediaFilter !== "all" ? (
          <Link
            className="text-link"
            href={problemSetsHref({
              category: null,
              q: "",
              hideSolved: false,
              media: "all",
              status: "all",
            })}
          >
            Clear
          </Link>
        ) : null}
      </form>

      <section className="problem-category-grid" aria-label="Problem-set categories">
        {CATEGORY_ORDER.map((category) => {
          const rows = groupedRows.get(category) ?? [];
          return (
            <Link
              className={`problem-category-card problem-category-filter${
                activeCategory === category ? " active" : ""
              }`}
              href={problemSetsHref({ category })}
              key={category}
            >
              <div className="problem-category-head">
                <h2>{category}</h2>
                <span className="problem-category-count">{rows.length}</span>
              </div>
              <p className="problem-category-empty">
                {activeCategory === category ? "Showing below" : "Click to filter tasks"}
              </p>
            </Link>
          );
        })}
      </section>

      <section className="panel table-panel problem-hub-table-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">{activeCategory ?? "All categories"}</p>
            <h2>
              {tableRows.length} {activeView === "bookmarked" ? "bookmarked" : "available"} tasks
            </h2>
          </div>
          {activeCategory ? (
            <Link className="secondary-action compact" href={problemSetsHref({ category: null })}>
              Show all
            </Link>
          ) : null}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Categories</th>
                <th>Your best</th>
                <th># Solved</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    {activeView === "bookmarked"
                      ? "No bookmarked tasks match this filter."
                      : "No tasks match this filter."}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((set) => (
                  <tr key={set.id} className="problem-set-row">
                    <td>
                      <Link className="problem-set-row-link" href={`/problem-sets/${set.slug}`}>
                        {set.order}
                      </Link>
                    </td>
                    <td>
                      <Link
                        className="problem-set-row-link problem-set-title-link"
                        href={`/problem-sets/${set.slug}`}
                      >
                        <strong>{set.title}</strong>
                      </Link>
                    </td>
                    <td>
                      <Link
                        className="problem-set-row-link problem-set-categories-link"
                        href={`/problem-sets/${set.slug}`}
                      >
                        {set.categories.join(" · ")}
                      </Link>
                    </td>
                    <td>
                      <Link className="problem-set-row-link" href={`/problem-sets/${set.slug}`}>
                        <span
                          className={`score-pill${
                            set.bestScore === 100 ? " score-pill-complete" : ""
                          }`}
                        >
                          {set.attempts > 0 ? `${set.bestScore}%` : "—"}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Link className="problem-set-row-link" href={`/problem-sets/${set.slug}`}>
                        {set.solvedCount}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? (
          <div className="pagination-row">
            <Link
              className={`secondary-action compact${safePage <= 1 ? " disabled" : ""}`}
              href={problemSetsHref({ page: Math.max(1, safePage - 1) })}
            >
              Previous
            </Link>
            <span>
              Page {safePage} of {totalPages}
            </span>
            <Link
              className={`secondary-action compact${safePage >= totalPages ? " disabled" : ""}`}
              href={problemSetsHref({ page: Math.min(totalPages, safePage + 1) })}
            >
              Next
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
