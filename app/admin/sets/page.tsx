import Link from "next/link";
import { ArrowLeft, ExternalLink, FileJson, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { statusLabel, statusColor } from "@/lib/visibility";
import { DeleteSetButton } from "./delete-set-button";

export const dynamic = "force-dynamic";

export default async function AdminSetsPage() {
  const sets = await prisma.problemSet.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { problems: true } },
    },
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

        {sets.length === 0 ? (
          <section className="panel empty-state">
            <FileJson size={42} />
            <strong>No problem sets yet</strong>
            <p>Import your first problem set by uploading a JSON file.</p>
            <Link className="primary-action" href="/admin/import">
              <Plus size={18} />
              Import JSON
            </Link>
          </section>
        ) : (
          <section className="panel table-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">All sets</p>
                <h2>
                  {sets.length} problem set{sets.length !== 1 ? "s" : ""}
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
                  {sets.map((set) => (
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
