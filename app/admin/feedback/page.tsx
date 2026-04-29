import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ArrowLeft, MessageSquareWarning } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { ThemeToggle } from "@/app/theme-toggle";
import { FeedbackActions } from "./feedback-actions";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || user.role !== "ADMIN") {
    return (
      <main className="single-page">
        <div className="page-frame">
          <p>Unauthorized - Admin access required</p>
        </div>
      </main>
    );
  }

  const reports = await prisma.feedbackReport.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      problemSet: { select: { title: true, slug: true } },
      problem: { select: { number: true } },
    },
  });

  const counts = {
    all: reports.length,
    open: reports.filter((r) => r.status === "OPEN").length,
    reviewing: reports.filter((r) => r.status === "REVIEWING").length,
    resolved: reports.filter((r) => r.status === "RESOLVED").length,
    rejected: reports.filter((r) => r.status === "REJECTED").length,
  };

  return (
    <main className="single-page">
      <div className="page-frame">
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Feedback Queue</h1>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <Link className="secondary-action" href="/dashboard">
              <ArrowLeft size={18} />
              Dashboard
            </Link>
          </div>
        </header>

        <section className="metric-grid" style={{ marginBottom: 20 }}>
          <article className="metric-card">
            <small>Total reports</small>
            <strong>{counts.all}</strong>
          </article>
          <article className="metric-card accent-pink">
            <small>Open</small>
            <strong>{counts.open}</strong>
          </article>
          <article className="metric-card accent-orange">
            <small>Reviewing</small>
            <strong>{counts.reviewing}</strong>
          </article>
          <article className="metric-card accent-purple">
            <small>Resolved</small>
            <strong>{counts.resolved}</strong>
          </article>
        </section>

        {reports.length === 0 ? (
          <div className="panel">
            <div className="empty-state">
              <MessageSquareWarning size={42} />
              <strong>No feedback reports yet</strong>
              <p>Reports submitted by students will appear here.</p>
            </div>
          </div>
        ) : (
          <section className="panel table-panel">
            <div className="panel-header">
              <h2>All reports</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reporter</th>
                    <th>Set</th>
                    <th>Q#</th>
                    <th>Type</th>
                    <th>Message</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td>{report.user.name ?? report.user.email}</td>
                      <td>
                        <Link
                          className="text-link"
                          href={`/problem-sets/${report.problemSet.slug}`}
                        >
                          {report.problemSet.title}
                        </Link>
                      </td>
                      <td>{report.problem?.number ?? "—"}</td>
                      <td>
                        <span className={`type-badge type-${report.type.toLowerCase()}`}>
                          {report.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={{ maxWidth: 220, whiteSpace: "normal", fontSize: "0.85rem" }}>
                        {report.message}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            report.status === "OPEN"
                              ? "status-not-started"
                              : report.status === "REVIEWING"
                                ? "status-attempted"
                                : report.status === "RESOLVED"
                                  ? "status-solved"
                                  : "status-review"
                          }`}
                        >
                          {report.status}
                        </span>
                      </td>
                      <td>{report.createdAt.toLocaleDateString()}</td>
                      <td>
                        <FeedbackActions
                          reportId={report.id}
                          currentStatus={report.status}
                          adminNote={report.adminNote}
                        />
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
