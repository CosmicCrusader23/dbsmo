import type { SidebarNavLink } from "./sidebar-navigation";

export function buildDefaultSidebarLinks(
  profileHref: string,
  includeAdminPanel: boolean,
): SidebarNavLink[] {
  const links: SidebarNavLink[] = [
    { href: "/dashboard", label: "Dashboard", icon: "Gauge" },
    { href: "/problem-sets", label: "Problem Sets", icon: "ClipboardList" },
    { href: "/writeups", label: "Writeups", icon: "MessageSquareText" },
    { href: "/practice", label: "Practice", icon: "Target" },
    { href: "/classes", label: "Classes", icon: "GraduationCap" },
  ];

  if (includeAdminPanel) {
    links.push({ href: "/admin", label: "Admin Panel", icon: "LayoutGrid", match: "/admin" });
  }

  links.push(
    { href: "/users", label: "Users", icon: "Users" },
    { href: profileHref, label: "My Profile", icon: "User" },
    { href: "/leaderboard", label: "Leaderboard", icon: "Trophy" },
    { href: "/settings", label: "Settings", icon: "Settings" },
  );

  return links;
}
