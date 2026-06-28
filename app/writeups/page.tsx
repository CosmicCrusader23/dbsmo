import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ArrowLeft, MessageSquareText, Search, TrendingUp } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVisibleToStudent } from "@/lib/visibility";
import { SearchSuggestInput } from "@/app/search-suggest-input";
import { WriteupsClient } from "@/app/problem-sets/[slug]/writeups/writeups-client";

export const dynamic = "force-dynamic";

type WriteupsSearchParams = Promise<{
  q?: string;
  view?: string;
}>;

function writeupsHref(next: { q?: string; view?: "latest" | "top" }) {
  const params = new URLSearchParams();
  if (next.q?.trim()) params.set("q", next.q.trim());
  if (next.view && next.view !== "latest") params.set("view", next.view);
  const suffix = params.toString();
  return suffix ? `/writeups?${suffix}` : "/writeups";
}

export default async function WriteupsPage({
  searchParams,
}: {
  searchParams?: WriteupsSearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();
  const viewMode = params.view === "top" ? "top" : "latest";

  const [currentUser, writeups] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    }),
    prisma.writeup.findMany({
      include: {
        problemSet: true,
        author: {
          select: {
            id: true,
            email: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            image: true,
          },
        },
        images: {
          orderBy: { sortOrder: "asc" },
          include: {
            file: {
              select: {
                id: true,
                originalName: true,
              },
            },
          },
        },
        votes: {
          select: {
            userId: true,
            value: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
  ]);

  if (!currentUser) {
    redirect("/");
  }

  const visibleWriteups = writeups
    .filter((writeup) => currentUser.role === "ADMIN" || isVisibleToStudent(writeup.problemSet))
    .filter((writeup) => {
      if (!normalizedQuery) return true;
      const authorLabel = writeup.author.displayName || writeup.author.name || writeup.author.email;
      return [writeup.problemSet.title, writeup.problemSet.slug, writeup.title, authorLabel]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });

  const problemSetSuggestions = Array.from(
    new Map(
      visibleWriteups.map((writeup) => [
        writeup.problemSet.slug,
        {
          label: writeup.problemSet.title,
          value: writeup.problemSet.title,
          detail: writeup.problemSet.slug,
        },
      ]),
    ).values(),
  );

  const postRows = visibleWriteups
    .map((writeup) => ({
      id: writeup.id,
      title: writeup.title,
      body: writeup.body,
      contentFormat: writeup.contentFormat,
      createdAt: writeup.createdAt.toISOString(),
      score: writeup.votes.reduce((sum, vote) => sum + vote.value, 0),
      myVote: writeup.votes.find((vote) => vote.userId === currentUser.id)?.value ?? 0,
      canDelete: currentUser.role === "ADMIN" || writeup.author.id === currentUser.id,
      problemSet: {
        slug: writeup.problemSet.slug,
        title: writeup.problemSet.title,
      },
      author: writeup.author,
      images: writeup.images.map((image) => ({
        id: image.id,
        url: `/api/files/${image.file.id}`,
        name: image.file.originalName,
      })),
    }))
    .sort((a, b) =>
      viewMode === "top"
        ? b.score - a.score || Date.parse(b.createdAt) - Date.parse(a.createdAt)
        : Date.parse(b.createdAt) - Date.parse(a.createdAt),
    )
    .slice(0, 80);

  return (
    <main className="single-page writeups-page writeups-directory-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
        <span className="bg-spark bg-spark-two" />
      </div>
      <div className="page-frame">
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">Community solutions</p>
            <h1 className="problem-title-row">
              <MessageSquareText size={24} />
              <span>Writeups</span>
            </h1>
          </div>
          <div className="topbar-actions">
            <Link className="secondary-action" href="/problem-sets">
              <ArrowLeft size={18} />
              Problem sets
            </Link>
            <Link className="secondary-action" href={writeupsHref({ q: query, view: "top" })}>
              <TrendingUp size={16} />
              Top
            </Link>
          </div>
        </header>

        <form action="/writeups" className="search-panel writeups-search-panel" role="search">
          <Search size={18} />
          <SearchSuggestInput
            ariaLabel="Search writeups by problem set"
            defaultValue={query}
            name="q"
            placeholder="Search by problem set title, slug, writeup, or author"
            suggestions={problemSetSuggestions}
            submitOnSelect
          />
          {viewMode !== "latest" ? <input name="view" type="hidden" value={viewMode} /> : null}
          <button className="secondary-action compact" type="submit">
            Search
          </button>
          {query ? (
            <Link className="text-link" href={writeupsHref({ view: viewMode })}>
              Clear
            </Link>
          ) : null}
        </form>

        <nav className="writeup-sort-tabs" aria-label="Writeup sorting">
          <Link
            className={`writeup-sort-tab${viewMode === "latest" ? " active" : ""}`}
            href={writeupsHref({ q: query, view: "latest" })}
          >
            Latest
          </Link>
          <Link
            className={`writeup-sort-tab${viewMode === "top" ? " active" : ""}`}
            href={writeupsHref({ q: query, view: "top" })}
          >
            Top
          </Link>
        </nav>

        <section className="writeup-section">
          <div className="writeup-section-head">
            <div>
              <p className="eyebrow">{query ? "Search results" : viewMode}</p>
              <h2>
                {query
                  ? `Writeups matching "${query}"`
                  : viewMode === "top"
                    ? "Top writeups"
                    : "Latest writeups"}
              </h2>
            </div>
            <span>{postRows.length} shown</span>
          </div>
          <WriteupsClient
            writeups={postRows}
            showComposer={false}
            emptyMessage="No writeups match this search yet."
          />
        </section>
      </div>
    </main>
  );
}
