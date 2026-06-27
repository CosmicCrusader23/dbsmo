import Link from "next/link";
import { ArrowLeft, BarChart3, Download, ExternalLink, FileJson, Plus, Search } from "lucide-react";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { statusLabel, statusColor } from "@/lib/visibility";
import { compareProblemSetRecords } from "@/lib/problem-set-order";
import { DeleteSetButton } from "./delete-set-button";

export const dynamic = "force-dynamic";

type AdminSetsSearchParams = Promise<{
  page?: string;
  q?: string;
  status?: string;
}>;

type SetStatusFilter = "all" | "PUBLISHED" | "DRAFT" | "ARCHIVED";

export default async function AdminSetsPage({
  searchParams,
}: {
  searchParams?: AdminSetsSearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!hasPermission(session.user.role, "admin:content")) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();
  const statusFilter: SetStatusFilter =
    params.status === "published"
      ? "PUBLISHED"
      : params.status === "draft"
        ? "DRAFT"
        : params.status === "archived"
          ? "ARCHIVED"
          : "all";
  const currentPage = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 25;

  const sets = await prisma.problemSet.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { problems: true } },
    },
  });

  const orderedSets = [...sets].sort(compareProblemSetRecords);
  const visibleSets = orderedSets.filter((set) => {
    if (statusFilter !== "all" && set.status !== statusFilter) return false;
    if (!normalizedQuery) return true;
    return [set.title, set.slug, String(set.order), ...set.topicTags, set.status]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const totalPages = Math.max(1, Math.ceil(visibleSets.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSets = visibleSets.slice((safePage - 1) * pageSize, safePage * pageSize);

  function setsHref(next: { page?: number; status?: SetStatusFilter } = {}) {
    const urlParams = new URLSearchParams();
    const nextPage = next.page ?? safePage;
    const nextStatus = next.status ?? statusFilter;
    if (query) urlParams.set("q", query);
    if (nextStatus !== "all") urlParams.set("status", nextStatus.toLowerCase());
    if (nextPage > 1) urlParams.set("page", String(nextPage));
    const suffix = urlParams.toString();
    return suffix ? `/admin/sets?${suffix}` : "/admin/sets";
  }

  const statusOptions: Array<{ label: string; value: SetStatusFilter }> = [
    { label: "All", value: "all" },
    { label: "Published", value: "PUBLISHED" },
    { label: "Draft", value: "DRAFT" },
    { label: "Archived", value: "ARCHIVED" },
  ];

  return (
    <main className="single-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
        <span className="bg-spark bg-spark-one" />
      </div>

      <div className="page-frame">
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Problem Sets</h1>
          </div>
          <div className="topbar-actions">
            <Link className="secondary-action" href="/admin/import">
              <Plus size={18} />
              Import JSON
            </Link>
            <Link className="secondary-action" href="/dashboard">
              <ArrowLeft size={18} />
              Dashboard
            </Link>
          </div>
        </header>

        <form action="/admin/sets" className="search-panel" role="search">
          <Search size={18} />
          <input
            aria-label="Search sets"
            defaultValue={query}
            name="q"
            placeholder="Search sets by title, slug, order, tag, or status"
          />
          {statusFilter !== "all" ? (
            <input name="status" type="hidden" value={statusFilter.toLowerCase()} />
          ) : null}
          <button className="secondary-action compact" type="submit">
            Search
          </button>
          {query ? (
            <Link className="text-link" href="/admin/sets">
              Clear
            </Link>
          ) : null}
        </form>

        <section className="admin-set-filter-bar" aria-label="Problem set status filters">
          <span className="leaderboard-control-label">Status</span>
          <div className="segmented-control">
            {statusOptions.map((option) => (
              <Link
                className={`segmented-button${statusFilter === option.value ? " active" : ""}`}
                href={setsHref({ page: 1, status: option.value })}
                key={option.value}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </section>

        {visibleSets.length === 0 ? (
          <section className="panel empty-state">
            <FileJson size={42} />
            <strong>{query ? "No problem sets match this search" : "No problem sets yet"}</strong>
            <p>
              {query
                ? "Try a different title, slug, tag, order, or status."
                : "Import your first problem set by uploading a JSON file."}
            </p>
            {!query ? (
              <Link className="primary-action" href="/admin/import">
                <Plus size={18} />
                Import JSON
              </Link>
            ) : null}
          </section>
        ) : (
          <section className="panel table-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">
                  {statusFilter === "all" ? "All sets" : `${statusFilter.toLowerCase()} sets`}
                </p>
                <h2>
                  {visibleSets.length} problem set{visibleSets.length !== 1 ? "s" : ""}
                </h2>
              </div>
              <Link className="secondary-action compact" href="/admin/import">
                <FileJson size={16} />
                Import
              </Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Title</th>
                    <th>Slug</th>
                    <th>Status</th>
                    <th>Problems</th>
                    <th>Difficulty</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSets.map((set) => (
                    <tr key={set.id}>
                      <td>{set.order}</td>
                      <td>
                        <strong>{set.title}</strong>
                      </td>
                      <td>
                        <code className="slug-code">{set.slug}</code>
                      </td>
                      <td>
                        <span className={`status-badge ${statusColor(set)}`}>
                          {statusLabel(set)}
                        </span>
                      </td>
                      <td>{set._count.problems}</td>
                      <td>{"★".repeat(set.difficulty)}</td>
                      <td>{set.createdAt.toLocaleDateString()}</td>
                      <td>
                        <div className="row-actions">
                          <Link className="secondary-action compact" href={`/admin/sets/${set.id}`}>
                            <ExternalLink size={14} />
                            View
                          </Link>
                          <Link
                            className="secondary-action compact"
                            href={`/admin/sets/${set.id}/analytics`}
                          >
                            <BarChart3 size={14} />
                            Analytics
                          </Link>
                          <a
                            className="secondary-action compact"
                            href={`/api/admin/sets/${set.id}/export`}
                            download
                          >
                            <Download size={14} />
                            JSON
                          </a>
                          <DeleteSetButton setId={set.id} title={set.title} status={set.status} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="pagination-row">
                <Link
                  className="secondary-action compact"
                  href={setsHref({ page: Math.max(1, safePage - 1) })}
                >
                  Previous
                </Link>
                <span>
                  Page {safePage} of {totalPages}
                </span>
                <Link
                  className="secondary-action compact"
                  href={setsHref({ page: Math.min(totalPages, safePage + 1) })}
                >
                  Next
                </Link>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
