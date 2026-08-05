import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { Sigma } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { profilePathFromEmail } from "@/lib/user-profile";
import { GlobalMobileNavScrim } from "./global-mobile-nav";
import { buildDefaultSidebarLinks } from "@/lib/sidebar-defaults";
import { availableAdminTools } from "@/lib/admin-tools";
import { parseSidebarPreferences } from "@/lib/sidebar-preferences";
import { SiteSidebarNav } from "./site-sidebar-nav";

export async function SiteSidebar() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, role: true, sidebarPreferences: true },
  });
  if (!user) return null;

  const links = buildDefaultSidebarLinks(
    profilePathFromEmail(user.email),
    hasPermission(user.role, "admin:view"),
  );
  const optionalLinks = availableAdminTools(user.role).map((tool) => ({
    href: tool.href,
    label: tool.label,
    icon: tool.icon,
  }));

  return (
    <>
      <GlobalMobileNavScrim />
      <aside className="sidebar site-sidebar" aria-label="Primary" tabIndex={0}>
        <Link className="sidebar-wordmark" href="/dashboard" aria-label="DBSMO dashboard">
          <span className="sidebar-wordmark-mark" aria-hidden="true">
            <Sigma size={23} strokeWidth={2.4} />
          </span>
          <strong>DBSMO</strong>
        </Link>
        <SiteSidebarNav
          links={links}
          optionalLinks={optionalLinks}
          initialPreferences={parseSidebarPreferences(user.sidebarPreferences)}
          userId={session.user.id}
        />
        <div className="sidebar-footer" />
      </aside>
    </>
  );
}

export async function isAuthenticated() {
  const session = await getServerSession(authOptions);
  return Boolean(session?.user?.id);
}
