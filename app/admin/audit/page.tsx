import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!hasPermission(session.user.role, "admin:audit")) redirect("/dashboard");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { email: true, name: true, displayName: true } } },
  });

  return (
    <main className="single-page">
      <div className="page-frame">
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>
              <ShieldCheck size={22} />
              Audit log
            </h1>
          </div>
          <Link className="secondary-action" href="/dashboard">
            <ArrowLeft size={18} />
            Dashboard
          </Link>
        </header>

        <section className="panel table-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Latest events</p>
              <h2>{logs.length} recorded actions</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No audit events recorded yet.</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.createdAt.toLocaleString()}</td>
                      <td>
                        {log.actor?.displayName || log.actor?.name || log.actor?.email || "System"}
                      </td>
                      <td>
                        <code className="slug-code">{log.action}</code>
                      </td>
                      <td>
                        {log.targetType ?? "—"}
                        {log.targetId ? `:${log.targetId.slice(0, 8)}` : ""}
                      </td>
                      <td>
                        <code className="slug-code">
                          {log.metadata ? JSON.stringify(log.metadata).slice(0, 120) : "—"}
                        </code>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
