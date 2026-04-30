import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, LayoutGrid, Search } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getUserGroups } from "@/lib/auth-server";
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
};

const CATEGORY_ORDER = [...STANDARD_PROBLEM_SET_TAGS, OTHER_PROBLEM_SET_TAG];

type ProblemSetsSearchParams = Promise<{
  category?: string;
  q?: string;
  sort?: string;
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
  const query = params.q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();
  const activeCategory =
    CATEGORY_ORDER.find(
      (category) => normalizeProblemTag(category) === normalizeProblemTag(params.category ?? ""),
    ) ?? null;

  function problemSetsHref(next: {
    category?: string | null;
    q?: string;
    sort?: "default" | "solved" | "name";
  }) {
    const nextSort = next.sort ?? sortMode;
    const nextCategory = next.category === undefined ? activeCategory : next.category;
    const nextQuery = next.q === undefined ? query : next.q;
    const urlParams = new URLSearchParams();

    if (nextSort !== "default") {
      urlParams.set("sort", nextSort);
    }
    if (nextCategory) {
      urlParams.set("category", nextCategory);
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
      select: { id: true, role: true, group: true, email: true },
    }),
    prisma.problemSet.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { problems: true } },
        problems: { select: { topicTags: true } },
        attempts: { select: { userId: true, score: true, maxScore: true } },
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
      : allSets.filter((set) => isVisibleToStudent(set, getUserGroups(currentUser)));

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

  const groupedRows = new Map<string, SetRow[]>(
    CATEGORY_ORDER.map((category) => [
      category,
      orderedRows.filter((set) => {
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
  const tableRows = orderedRows.filter((set) => {
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
        <span className="problem-hub-tab active">Recommended</span>
        <span className="problem-hub-tab">Bookmarked</span>
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
        {activeCategory ? <input name="category" type="hidden" value={activeCategory} /> : null}
        <button className="secondary-action compact" type="submit">
          Search
        </button>
        {query || activeCategory ? (
          <Link className="text-link" href={problemSetsHref({ category: null, q: "" })}>
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
            <h2>{tableRows.length} available tasks</h2>
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
                <th># Solved</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>No tasks match this filter.</td>
                </tr>
              ) : (
                tableRows.map((set) => (
                  <tr key={set.id}>
                    <td>{set.order}</td>
                    <td>
                      <strong>{set.title}</strong>
                    </td>
                    <td>{set.categories.join(" · ")}</td>
                    <td>{set.solvedCount}</td>
                    <td>
                      <Link className="text-link" href={`/problem-sets/${set.slug}`}>
                        Open
                        <ChevronRight size={14} />
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
