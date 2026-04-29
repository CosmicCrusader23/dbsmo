import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, Users } from "lucide-react";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    include: {
      attempts: {
        select: { score: true, maxScore: true, submittedAt: true, problemSetId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = students.map((s) => {
    const uniqueSets = new Set(s.attempts.map((a) => a.problemSetId));
    const avgScore =
      s.attempts.length > 0
        ? Math.round(
            s.attempts.reduce(
              (sum, a) => sum + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0),
              0,
            ) / s.attempts.length,
          )
        : 0;
    const lastActive =
      s.attempts.length > 0
        ? s.attempts.reduce(
            (latest, a) => (a.submittedAt > latest ? a.submittedAt : latest),
            s.attempts[0].submittedAt,
          )
        : s.lastLoginAt;

    return { ...s, setsCompleted: uniqueSets.size, avgScore, lastActive };
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
            <h1>Students</h1>
          </div>
          <div className="topbar-actions">
            <a className="secondary-action compact" href="/api/admin/export?type=students" download>
              <Download size={16} />
              Export CSV
            </a>
            <Link className="secondary-action" href="/dashboard">
              <ArrowLeft size={18} />
              Dashboard
            </Link>
          </div>
        </header>

        {rows.length === 0 ? (
          <section className="panel empty-state">
            <Users size={42} />
            <strong>No students yet</strong>
            <p>Students will appear here after they log in and submit attempts.</p>
          </section>
        ) : (
          <section className="panel table-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">All students</p>
                <h2>
                  {rows.length} student{rows.length !== 1 ? "s" : ""}
                </h2>
              </div>
              <Users size={20} />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Group</th>
                    <th>Sets</th>
                    <th>Avg score</th>
                    <th>Attempts</th>
                    <th>Last active</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name ?? "—"}</strong>
                      </td>
                      <td>{row.email}</td>
                      <td>{row.group ?? "—"}</td>
                      <td>{row.setsCompleted}</td>
                      <td>{row.avgScore}%</td>
                      <td>{row.attempts.length}</td>
                      <td>{row.lastActive ? row.lastActive.toLocaleDateString() : "—"}</td>
                      <td>
                        <Link
                          className="secondary-action compact"
                          href={`/admin/students/${row.id}`}
                        >
                          <ExternalLink size={14} />
                          View
                        </Link>
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
