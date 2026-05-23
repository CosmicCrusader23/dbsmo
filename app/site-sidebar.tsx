import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { profilePathFromEmail } from "@/lib/user-profile";
import { GlobalMobileNavScrim } from "./global-mobile-nav";
import { SiteSidebarNav, type SidebarLink } from "./site-sidebar-nav";

export async function SiteSidebar() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, role: true },
  });
  if (!user) return null;

  const profileHref = profilePathFromEmail(user.email);
  const links: SidebarLink[] = [
    { href: "/dashboard", label: "Dashboard", icon: "Gauge" },
    { href: "/problem-sets", label: "Problem Sets", icon: "ClipboardList" },
    { href: "/practice", label: "Practice", icon: "Target" },
    { href: "/ftw", label: "FTW", icon: "Swords" },
  ];

  if (hasPermission(user.role, "admin:view")) {
    if (hasPermission(user.role, "admin:content")) {
      links.push(
        { href: "/admin/sets", label: "Manage Sets", icon: "ListChecks" },
        { href: "/admin/create", label: "Create Set", icon: "PenLine" },
        { href: "/admin/import", label: "JSON Import", icon: "FileJson" },
      );
    }
    if (hasPermission(user.role, "admin:users")) {
      links.push({ href: "/admin/students", label: "Students", icon: "Users" });
    }
    if (hasPermission(user.role, "admin:analytics")) {
      links.push({ href: "/admin/analytics", label: "Analytics", icon: "BarChart3" });
    }
    if (hasPermission(user.role, "admin:feedback")) {
      links.push({
        href: "/admin/feedback",
        label: "Feedback",
        icon: "MessageSquareWarning",
      });
    }
    if (hasPermission(user.role, "admin:audit")) {
      links.push({ href: "/admin/audit", label: "Audit", icon: "CheckCircle2" });
    }
  }

  links.push(
    { href: "/users", label: "Users", icon: "Users" },
    { href: profileHref, label: "My Profile", icon: "User", match: "/users/" },
    { href: "/leaderboard", label: "Leaderboard", icon: "Trophy" },
    { href: "/settings", label: "Settings", icon: "Settings" },
  );

  return (
    <>
      <GlobalMobileNavScrim />
      <aside className="sidebar site-sidebar" aria-label="Primary" tabIndex={0}>
        <Link className="sidebar-brand" href="/dashboard" aria-label="Home">
          <span className="brand-mark sidebar-brand-mark">
            <img src="/logo.png" alt="" />
          </span>
        </Link>
        <SiteSidebarNav links={links} />
        <div className="sidebar-footer" />
      </aside>
    </>
  );
}

export async function isAuthenticated() {
  const session = await getServerSession(authOptions);
  return Boolean(session?.user?.id);
}
