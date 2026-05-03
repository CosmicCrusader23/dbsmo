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
  order: number;
  categories: string[];
  tags: string[];
  problemCount: number;
  bestScore: number;
  attempts: number;
  solvedCount: number;
  isBookmarked: boolean;
};

const CATEGORY_ORDER = [...STANDARD_PROBLEM_SET_TAGS, OTHER_PROBLEM_SET_TAG];

type ProblemSetsSearchParams = Promise<{
  category?: string;
  hideSolved?: string;
  q?: string;
  sort?: string;
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
    params.sort === "solved" ? "solved" : params.sort === "name" ? "name" : "default";
  const activeView = params.view === "bookmarked" ? "bookmarked" : "recommended";
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
    sort?: "default" | "solved" | "name";
    view?: "recommended" | "bookmarked";
  }) {
    const nextSort = next.sort ?? sortMode;
    const nextView = next.view ?? activeView;
    const nextCategory = next.category === undefined ? activeCategory : next.category;
    const nextHideSolved = next.hideSolved ?? hideSolved;
    const nextQuery = next.q === undefined ? query : next.q;
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
    if (nextHideSolved) {
      urlParams.set("hideSolved", "1");
    }
    if (nextQuery.trim()) {
      urlParams.set("q", nextQuery.trim());
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
      select: { score: true, maxScore: true, problemSetId: true },
    }),
  ]);

  if (!currentUser) {
    redirect("/");
  }

  const visibleSets =
    currentUser.role === "ADMIN"
      ? allSets
      : allSets.filter((set) => isVisibleToStudent(set));

  const attemptMap = new Map<string, { bestScore: number; attempts: number }>();
  for (const attempt of attempts) {
    const existing = attemptMap.get(attempt.problemSetId) ?? { bestScore: 0, attempts: 0 };
    const percentage =
      attempt.maxScore > 0 ? Math.round((attempt.score / attempt.maxScore) * 100) : 0;
    existing.bestScore = Math.max(existing.bestScore, percentage);
    existing.attempts += 1;
    attemptMap.set(attempt.problemSetId, existing);
  }

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
      categories: categorizeProblemSetTags(allTags),
      tags: allTags,
      problemCount: set._count.problems,
      bestScore: progress.bestScore,
      attempts: progress.attempts,
      solvedCount: solvedUsers.size,
      isBookmarked: set.bookmarks.length > 0,
    };
  });

  const orderedRows = [...setRows].sort((a, b) => {
    if (sortMode === "solved") {
      return b.solvedCount - a.solvedCount || a.order - b.order || a.title.localeCompare(b.title);
    }

    if (sortMode === "name") {
      return a.title.localeCompare(b.title) || a.order - b.order;
    }

    return a.order - b.order || a.title.localeCompare(b.title);
  });

  const viewRows =
    activeView === "bookmarked" ? orderedRows.filter((set) => set.isBookmarked) : orderedRows;
  const filteredRows = hideSolved ? viewRows.filter((set) => set.bestScore < 100) : viewRows;

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
        <span className="problem-hub-tab">School Hosted</span>
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
        </div>
        <span className="leaderboard-control-label">Solved</span>
        <div className="segmented-control">
          <Link
            className={`segmented-button${!hideSolved ? " active" : ""}`}
            href={problemSetsHref({ hideSolved: false })}
          >
            Show all
          </Link>
          <Link
            className={`segmented-button${hideSolved ? " active" : ""}`}
            href={problemSetsHref({ hideSolved: true })}
          >
            Hide solved
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
        {hideSolved ? <input name="hideSolved" type="hidden" value="1" /> : null}
        {activeCategory ? <input name="category" type="hidden" value={activeCategory} /> : null}
        <button className="secondary-action compact" type="submit">
          Search
        </button>
        {query || activeCategory || hideSolved ? (
          <Link
            className="text-link"
            href={problemSetsHref({ category: null, q: "", hideSolved: false })}
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
                tableRows.map((set) => (
                  <tr key={set.id} className="problem-set-row">
                    <td>
                      <Link className="problem-set-row-link" href={`/problem-sets/${set.slug}`}>
                        {set.order}
                      </Link>
                    </td>
                    <td>
                      <Link className="problem-set-row-link problem-set-title-link" href={`/problem-sets/${set.slug}`}>
                        <strong>{set.title}</strong>
                      </Link>
                    </td>
                    <td>
                      <Link className="problem-set-row-link problem-set-categories-link" href={`/problem-sets/${set.slug}`}>
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
      </section>
    </main>
  );
}
