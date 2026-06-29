import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ArrowLeft, Search, Trophy, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { profilePathFromEmail } from "@/lib/user-profile";
import { isStaffRole } from "@/lib/permissions";
import { displayNameFor } from "@/lib/display-name";
import { Avatar } from "@/app/avatar";
import { SearchSuggestInput } from "@/app/search-suggest-input";

export const dynamic = "force-dynamic";

type UsersSearchParams = Promise<{
  page?: string;
  q?: string;
}>;

export default async function UsersPage({ searchParams }: { searchParams?: UsersSearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();
  const currentPage = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 24;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      profileVisible: true,
      createdAt: true,
      attempts: {
        select: { score: true, maxScore: true, problemSetId: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const userRows = users
    .map((u) => {
      const uniqueSets = new Set(u.attempts.map((a) => a.problemSetId)).size;
      const totalAttempts = u.attempts.length;
      const avgScore =
        totalAttempts > 0
          ? Math.round(
              u.attempts.reduce(
                (s, a) => s + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0),
                0,
              ) / totalAttempts,
            )
          : 0;
      return {
        ...u,
        displayLabel: displayNameFor(u),
        uniqueSets,
        totalAttempts,
        avgScore,
      };
    })
    .filter((u) => u.profileVisible || u.id === session.user.id || isStaffRole(session.user.role))
    .filter((u) => {
      if (!normalizedQuery) return true;
      return [u.displayLabel, u.email, u.role].join(" ").toLowerCase().includes(normalizedQuery);
    });
  const totalPages = Math.max(1, Math.ceil(userRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = userRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const searchSuggestions = [
    ...userRows.map((user) => ({
      label: user.displayLabel,
      value: user.displayLabel,
      detail: user.email,
    })),
    ...userRows.map((user) => ({
      label: user.email,
      value: user.email,
      detail: user.role,
    })),
    ...Array.from(new Set(userRows.map((user) => user.role))).map((role) => ({
      label: role,
      value: role,
      detail: "Role",
    })),
  ];

  function usersHref(page: number) {
    const urlParams = new URLSearchParams();
    if (query) urlParams.set("q", query);
    if (page > 1) urlParams.set("page", String(page));
    const suffix = urlParams.toString();
    return suffix ? `/users?${suffix}` : "/users";
  }

  return (
    <main className="users-shell">
      <header className="users-header">
        <div>
          <p className="eyebrow">Community</p>
          <h1>
            <Users size={24} />
            Users
          </h1>
        </div>
        <div className="topbar-actions">
          <Link className="secondary-action" href="/leaderboard">
            <Trophy size={16} />
            Leaderboard
          </Link>
          <Link className="secondary-action" href="/dashboard">
            <ArrowLeft size={16} />
            Dashboard
          </Link>
        </div>
      </header>

      <form action="/users" className="search-panel" role="search">
        <Search size={18} />
        <SearchSuggestInput
          ariaLabel="Search users"
          defaultValue={query}
          name="q"
          placeholder="Search users by name, email, or role"
          suggestions={searchSuggestions}
          submitOnSelect
        />
        <button className="secondary-action compact" type="submit">
          Search
        </button>
        {query ? (
          <Link className="text-link" href="/users">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="users-grid">
        {userRows.length === 0 ? (
          <div className="search-empty-state">No users match this search.</div>
        ) : (
          paginatedRows.map((u) => (
            <Link key={u.id} href={profilePathFromEmail(u.email)} className="user-card-link">
              <div className="user-card">
                <div className="user-card-avatar">
                  <Avatar
                    user={{
                      id: u.id,
                      email: u.email,
                      displayName: u.displayLabel,
                      avatarUrl: u.avatarUrl,
                      image: u.image,
                    }}
                    size="lg"
                    className="user-card-img"
                  />
                </div>
                <div className="user-card-info">
                  <h3>{u.displayLabel}</h3>
                  <span className="user-card-role">{u.role}</span>
                </div>
                <div className="user-card-stats">
                  <span>{u.uniqueSets} sets</span>
                  <span>{u.avgScore}% avg</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
      {totalPages > 1 ? (
        <div className="pagination-row">
          <Link className="secondary-action compact" href={usersHref(Math.max(1, safePage - 1))}>
            Previous
          </Link>
          <span>
            Page {safePage} of {totalPages}
          </span>
          <Link
            className="secondary-action compact"
            href={usersHref(Math.min(totalPages, safePage + 1))}
          >
            Next
          </Link>
        </div>
      ) : null}
    </main>
  );
}
