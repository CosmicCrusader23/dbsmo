import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { Avatar } from "@/app/avatar";
import { AuditFilters } from "./audit-filters";

export const dynamic = "force-dynamic";

type AuditSearchParams = Promise<{
  q?: string;
  action?: string;
  actor?: string;
}>;

function timeAgo(d: Date) {
  const ms = Date.now() - d.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function actionTone(action: string) {
  const a = action.toLowerCase();
  if (a.includes("delete") || a.includes("remove")) return "danger";
  if (a.includes("create") || a.includes("publish") || a.includes("add")) return "success";
  if (a.includes("update") || a.includes("edit") || a.includes("regrade")) return "warning";
  return "default";
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: AuditSearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!hasPermission(session.user.role, "admin:audit")) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const actionFilter = params.action?.trim() ?? "";
  const actorFilter = params.actor?.trim() ?? "";

  const where = {
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(actorFilter ? { actorId: actorFilter } : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" as const } },
            { targetType: { contains: q, mode: "insensitive" as const } },
            { targetId: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [logs, totalCount, actionAggregate, actorAggregate] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            image: true,
          },
        },
      },
    }),
    prisma.auditLog.count(),
    prisma.auditLog.groupBy({
      by: ["action"],
      _count: { _all: true },
      orderBy: { _count: { action: "desc" } },
      take: 30,
    }),
    prisma.auditLog.findMany({
      where: { actorId: { not: null } },
      select: {
        actorId: true,
        actor: { select: { displayName: true, name: true, email: true } },
      },
      distinct: ["actorId"],
      take: 80,
    }),
  ]);

  const actionOptions = actionAggregate.map((row) => ({
    value: row.action,
    label: `${row.action} (${row._count._all})`,
  }));
  const actorOptions = actorAggregate
    .filter((r) => r.actorId)
    .map((r) => ({
      value: r.actorId as string,
      label: r.actor?.displayName || r.actor?.name || r.actor?.email || "Unknown",
    }));

  const oneDayAgo = new Date(Date.now() - 86_400_000);
  const last24h = logs.filter((l) => l.createdAt >= oneDayAgo).length;
  const uniqueActors = new Set(logs.map((l) => l.actorId).filter(Boolean)).size;

  return (
    <main className="single-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
      </div>
      <div className="page-frame audit-frame">
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

        <section className="audit-stat-grid">
          <article className="audit-stat-card">
            <small>Total events</small>
            <strong>{totalCount.toLocaleString()}</strong>
          </article>
          <article className="audit-stat-card">
            <small>Last 24h</small>
            <strong>{last24h}</strong>
          </article>
          <article className="audit-stat-card">
            <small>Recent actors</small>
            <strong>{uniqueActors}</strong>
          </article>
          <article className="audit-stat-card">
            <small>Distinct actions</small>
            <strong>{actionAggregate.length}</strong>
          </article>
        </section>

        <section className="audit-card">
          <div className="audit-card-header">
            <div>
              <h2 className="audit-card-title">Recent activity</h2>
              <p className="audit-card-subtitle">
                Showing {logs.length} of {totalCount.toLocaleString()} events
              </p>
            </div>
            <Search size={16} className="audit-card-icon" />
          </div>

          <AuditFilters
            q={q}
            actionFilter={actionFilter}
            actorFilter={actorFilter}
            actionOptions={actionOptions}
            actorOptions={actorOptions}
          />

          <div className="audit-list">
            {logs.length === 0 ? (
              <p className="audit-empty">No audit events match the filters.</p>
            ) : (
              logs.map((log) => {
                const actor =
                  log.actor?.displayName || log.actor?.name || log.actor?.email || "System";
                const meta = log.metadata
                  ? JSON.stringify(log.metadata)
                  : null;
                return (
                  <article className="audit-row" key={log.id}>
                    <div className="audit-actor">
                      {log.actor ? (
                        <Avatar user={log.actor} size="sm" className="audit-avatar-img" />
                      ) : (
                        <span className="audit-avatar audit-avatar-system">S</span>
                      )}
                      <div>
                        <strong>{actor}</strong>
                        <small>{timeAgo(log.createdAt)}</small>
                      </div>
                    </div>
                    <div className="audit-action-cell">
                      <span className={`audit-badge tone-${actionTone(log.action)}`}>
                        {log.action}
                      </span>
                      {log.targetType ? (
                        <span className="audit-target">
                          {log.targetType}
                          {log.targetId ? `:${log.targetId.slice(0, 8)}` : ""}
                        </span>
                      ) : null}
                    </div>
                    <div className="audit-meta">
                      {meta ? (
                        <code title={meta}>{meta.length > 80 ? `${meta.slice(0, 80)}…` : meta}</code>
                      ) : (
                        <span className="audit-meta-empty">no metadata</span>
                      )}
                    </div>
                    <time className="audit-time" dateTime={log.createdAt.toISOString()}>
                      {log.createdAt.toLocaleString()}
                    </time>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
