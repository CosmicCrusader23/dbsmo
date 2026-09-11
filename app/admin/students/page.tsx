import Link from "next/link";
import { Download, ExternalLink, Search, Users } from "lucide-react";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { computePerformanceProfile, performanceEvidenceLabel } from "@/lib/analytics";
import { hasPermission } from "@/lib/permissions";
import { SearchSuggestInput } from "@/app/search-suggest-input";
import { isVisibleToStudent } from "@/lib/visibility";
import { PageBackLink } from "@/app/page-back-link";
import { normalizePageNumber, normalizeQueryText, type QueryParamValue } from "@/lib/query-params";
import { gradeFromStudentEmail, studentNameWithCurrentGrade } from "@/lib/student-grade";
import { profilePathFromEmail } from "@/lib/user-profile";
import { StudentTableRow } from "./student-table-row";
import { RefreshGoogleNamesButton } from "./refresh-google-names-button";
import { RecalculateGradesButton } from "./recalculate-grades-button";

export const dynamic = "force-dynamic";

type AdminStudentsSearchParams = Promise<{
  group?: QueryParamValue;
  page?: QueryParamValue;
  q?: QueryParamValue;
  role?: QueryParamValue;
}>;

const ROLE_FILTERS = ["STUDENT", "TEACHER", "CONTENT_EDITOR", "ANALYST", "ADMIN"] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams?: AdminStudentsSearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!hasPermission(session.user.role, "admin:users")) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const query = normalizeQueryText(params.q);
  const normalizedQuery = query.toLowerCase();
  const rawRoleFilter = normalizeQueryText(params.role).toUpperCase();
  const roleFilter = ROLE_FILTERS.includes(rawRoleFilter as RoleFilter)
    ? (rawRoleFilter as RoleFilter)
    : "";
  const groupFilter = normalizeQueryText(params.group);
  const hasFilters = Boolean(query || roleFilter || groupFilter);
  const currentPage = normalizePageNumber(params.page);
  const pageSize = 25;

  const [students, problemSets] = await Promise.all([
    prisma.user.findMany({
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
      const currentGrade = gradeFromStudentEmail(s.email) ?? s.grade;
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

      return {
        ...s,
        currentGrade,
        currentName: studentNameWithCurrentGrade(s.name, currentGrade),
        performance,
        lastActive,
      };
    })
    .filter((row) => {
      if (roleFilter && row.role !== roleFilter) return false;
      if (groupFilter && row.group !== groupFilter) return false;
      if (!normalizedQuery) return true;
      return [row.currentName ?? "", row.email, row.group ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const searchSuggestions = [
    ...students.map((student) => ({
      label:
        studentNameWithCurrentGrade(
          student.name,
          gradeFromStudentEmail(student.email) ?? student.grade,
        ) || student.email,
      value:
        studentNameWithCurrentGrade(
          student.name,
          gradeFromStudentEmail(student.email) ?? student.grade,
        ) || student.email,
      detail: student.email,
    })),
    ...students.map((student) => ({
      label: student.email,
      value: student.email,
      detail:
        studentNameWithCurrentGrade(
          student.name,
          gradeFromStudentEmail(student.email) ?? student.grade,
        ) ?? "Student",
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

  function studentsHref(
    page: number,
    overrides?: { group?: string; query?: string; role?: string },
  ) {
    const urlParams = new URLSearchParams();
    const nextQuery = overrides?.query ?? query;
    const nextRole = overrides?.role ?? roleFilter;
    const nextGroup = overrides?.group ?? groupFilter;
    if (nextQuery) urlParams.set("q", nextQuery);
    if (nextRole) urlParams.set("role", nextRole);
    if (nextGroup) urlParams.set("group", nextGroup);
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
            <RefreshGoogleNamesButton />
            <RecalculateGradesButton />
            <PageBackLink destination="Dashboard" href="/dashboard" />
          </div>
        </header>

        <form action="/admin/students" className="search-panel students-search-panel" role="search">
          <Search size={18} />
          <SearchSuggestInput
            ariaLabel="Search students"
            defaultValue={query}
            name="q"
            placeholder="Search students by name, email, or group"
            suggestions={searchSuggestions}
            submitOnSelect
          />
          <select
            aria-label="Filter by role"
            className="student-filter-select"
            defaultValue={roleFilter}
            name="role"
          >
            <option value="">All roles</option>
            {ROLE_FILTERS.map((role) => (
              <option key={role} value={role}>
                {role.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by group"
            className="student-filter-select"
            defaultValue={groupFilter}
            name="group"
          >
            <option value="">All groups</option>
            {Array.from(
              new Set(
                students
                  .map((student) => student.group)
                  .filter((group): group is string => Boolean(group)),
              ),
            )
              .sort((a, b) => a.localeCompare(b))
              .map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
          </select>
          <button className="secondary-action compact" type="submit">
            Apply
          </button>
          {hasFilters ? (
            <Link className="text-link" href={studentsHref(1, { group: "", query: "", role: "" })}>
              Clear
            </Link>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <section className="panel empty-state">
            <Users size={42} />
            <strong>{hasFilters ? "No users match these filters" : "No users yet"}</strong>
            <p>
              {hasFilters
                ? "Try a different name, email, role, or group."
                : "Users will appear here after they log in and submit attempts."}
            </p>
          </section>
        ) : (
          <section className="panel table-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">All users</p>
                <h2>
                  {rows.length} user{rows.length !== 1 ? "s" : ""}
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
                    <th>Grade</th>
                    <th>Role</th>
                    <th>Group</th>
                    <th>Sets</th>
                    <th>Mastery index</th>
                    <th>Best-set avg</th>
                    <th>Evidence</th>
                    <th>Attempts</th>
                    <th>Joined</th>
                    <th>Last active</th>
                    <th>Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => {
                    const href = `/admin/students/${row.id}`;
                    return (
                      <StudentTableRow href={href} key={row.id}>
                        <td data-label="Name">
                          <Link
                            aria-label={`Open ${row.currentName ?? row.email}`}
                            className="student-row-primary-link"
                            href={href}
                          >
                            {row.currentName ?? "—"}
                          </Link>
                        </td>
                        <td data-label="Email">{row.email}</td>
                        <td data-label="Grade">
                          {row.currentGrade ? `G${row.currentGrade}` : "—"}
                        </td>
                        <td data-label="Role">{row.role.replace(/_/g, " ")}</td>
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
                        <td data-label="Profile">
                          <Link
                            aria-label={`View ${row.currentName ?? row.email} profile`}
                            className="secondary-action compact student-profile-link"
                            href={profilePathFromEmail(row.email)}
                          >
                            <ExternalLink size={14} />
                            View
                          </Link>
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
