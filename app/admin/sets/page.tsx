import Link from "next/link";
import { ArrowLeft, ExternalLink, FileJson, Plus, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { statusLabel, statusColor } from "@/lib/visibility";
import { DeleteSetButton } from "./delete-set-button";

export const dynamic = "force-dynamic";

type AdminSetsSearchParams = Promise<{
  q?: string;
}>;

export default async function AdminSetsPage({
  searchParams,
}: {
  searchParams?: AdminSetsSearchParams;
}) {
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();

  const sets = await prisma.problemSet.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { problems: true } },
    },
  });

  const visibleSets = sets.filter((set) => {
    if (!normalizedQuery) return true;
    return [set.title, set.slug, String(set.order), ...set.topicTags, set.status]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

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
          <button className="secondary-action compact" type="submit">
            Search
          </button>
          {query ? (
            <Link className="text-link" href="/admin/sets">
              Clear
            </Link>
          ) : null}
        </form>

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
                <p className="eyebrow">All sets</p>
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
                  {visibleSets.map((set) => (
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
                          <DeleteSetButton
                            setId={set.id}
                            title={set.title}
                            status={set.status}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
