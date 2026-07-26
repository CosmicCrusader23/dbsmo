import Link from "next/link";
import { Download, Search, Users } from "lucide-react";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { computePerformanceProfile, performanceEvidenceLabel } from "@/lib/analytics";
import { hasPermission } from "@/lib/permissions";
import { SearchSuggestInput } from "@/app/search-suggest-input";
import { isVisibleToStudent } from "@/lib/visibility";
import { PageBackLink } from "@/app/page-back-link";
import { StudentTableRow } from "./student-table-row";

export const dynamic = "force-dynamic";

type AdminStudentsSearchParams = Promise<{
  page?: string;
  q?: string;
}>;

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams?: AdminStudentsSearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!hasPermission(session.user.role, "admin:users")) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();
  const currentPage = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 25;

  const [students, problemSets] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT" },
      include: {
        attempts: {
          select: { score: true, maxScore: true, submittedAt: true, problemSetId: true },
          orderBy: { submittedAt: "desc" },
          take: 1000,
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.problemSet.findMany({
      select: { id: true, status: true, visibleFrom: true, visibleTo: true },
    }),
  ]);
  const visibleSetIds = new Set(
    problemSets.filter((set) => isVisibleToStudent(set)).map((set) => set.id),
  );

  const rows = students
    .map((s) => {
      const performance = computePerformanceProfile(
        s.attempts.filter((attempt) => visibleSetIds.has(attempt.problemSetId)),
        visibleSetIds.size,
      );
      const lastActive =
        s.attempts.length > 0
          ? s.attempts.reduce(
              (latest, a) => (a.submittedAt > latest ? a.submittedAt : latest),
              s.attempts[0].submittedAt,
            )
          : s.lastLoginAt;

      return { ...s, performance, lastActive };
    })
    .filter((row) => {
      if (!normalizedQuery) return true;
      return [row.name ?? "", row.email, row.group ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const searchSuggestions = [
    ...students.map((student) => ({
      label: student.name || student.email,
      value: student.name || student.email,
      detail: student.email,
    })),
    ...students.map((student) => ({
      label: student.email,
      value: student.email,
      detail: student.name ?? "Student",
    })),
    ...Array.from(
      new Set(
        students.map((student) => student.group).filter((group): group is string => Boolean(group)),
      ),
    ).map((group) => ({
      label: group,
      value: group,
      detail: "Group",
    })),
  ];

  function studentsHref(page: number) {
    const urlParams = new URLSearchParams();
    if (query) urlParams.set("q", query);
    if (page > 1) urlParams.set("page", String(page));
    const suffix = urlParams.toString();
    return suffix ? `/admin/students?${suffix}` : "/admin/students";
  }

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
            <PageBackLink destination="Dashboard" href="/dashboard" />
          </div>
        </header>

        <form action="/admin/students" className="search-panel" role="search">
          <Search size={18} />
          <SearchSuggestInput
            ariaLabel="Search students"
            defaultValue={query}
            name="q"
            placeholder="Search students by name, email, or group"
            suggestions={searchSuggestions}
            submitOnSelect
          />
          <button className="secondary-action compact" type="submit">
            Search
          </button>
          {query ? (
            <Link className="text-link" href="/admin/students">
              Clear
            </Link>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <section className="panel empty-state">
            <Users size={42} />
            <strong>{query ? "No students match this search" : "No students yet"}</strong>
            <p>
              {query
                ? "Try a different student name, email, or group."
                : "Students will appear here after they log in and submit attempts."}
            </p>
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
            <div className="table-wrap students-table-wrap">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Group</th>
                    <th>Sets</th>
                    <th>Mastery index</th>
                    <th>Best-set avg</th>
                    <th>Evidence</th>
                    <th>Attempts</th>
                    <th>Joined</th>
                    <th>Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => {
                    const href = `/admin/students/${row.id}`;
                    return (
                      <StudentTableRow href={href} key={row.id}>
                        <td data-label="Name">
                          <Link
                            aria-label={`Open ${row.name ?? row.email}`}
                            className="student-row-primary-link"
                            href={href}
                          >
                            {row.name ?? "—"}
                          </Link>
                        </td>
                        <td data-label="Email">{row.email}</td>
                        <td data-label="Group">{row.group ?? "—"}</td>
                        <td data-label="Sets">{row.performance.attemptedSets}</td>
                        <td data-label="Mastery index">
                          {row.performance.masteryIndex.toFixed(1)}
                        </td>
                        <td data-label="Best-set avg">
                          {row.performance.bestSetAverage.toFixed(1)}%
                        </td>
                        <td data-label="Evidence">
                          {performanceEvidenceLabel(row.performance.evidence)}
                        </td>
                        <td data-label="Attempts">{row.attempts.length}</td>
                        <td data-label="Joined">{row.createdAt.toLocaleDateString()}</td>
                        <td data-label="Last active">
                          {row.lastActive ? row.lastActive.toLocaleDateString() : "—"}
                        </td>
                      </StudentTableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="pagination-row">
                <Link
                  className="secondary-action compact"
                  href={studentsHref(Math.max(1, safePage - 1))}
                >
                  Previous
                </Link>
                <span>
                  Page {safePage} of {totalPages}
                </span>
                <Link
                  className="secondary-action compact"
                  href={studentsHref(Math.min(totalPages, safePage + 1))}
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
