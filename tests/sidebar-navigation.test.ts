import { describe, expect, it } from "vitest";
import { availableAdminTools } from "../lib/admin-tools";
import { activeSidebarHref, type SidebarNavLink } from "../lib/sidebar-navigation";
import {
  mergeSidebarLinks,
  parseSidebarPreferences,
  visibleSidebarLinks,
} from "../lib/sidebar-preferences";

const links: SidebarNavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: "Gauge" },
  { href: "/problem-sets", label: "Problem Sets", icon: "ClipboardList" },
  { href: "/users", label: "Users", icon: "Users" },
  { href: "/users/dbs23082490", label: "My Profile", icon: "User" },
];

describe("activeSidebarHref", () => {
  it("selects exactly the current user's profile over the broader users route", () => {
    expect(activeSidebarHref("/users/dbs23082490", links)).toBe("/users/dbs23082490");
  });

  it("keeps the users section active for another user's profile", () => {
    expect(activeSidebarHref("/users/another-user", links)).toBe("/users");
  });

  it("matches nested section routes on a path-segment boundary", () => {
    expect(activeSidebarHref("/problem-sets/algebra-one", links)).toBe("/problem-sets");
    expect(activeSidebarHref("/problem-sets-extra", links)).toBeNull();
  });

  it("normalizes trailing slashes", () => {
    expect(activeSidebarHref("/dashboard/", links)).toBe("/dashboard");
  });

  it("keeps the admin panel active for nested admin routes", () => {
    const adminLinks: SidebarNavLink[] = [
      ...links,
      { href: "/admin", label: "Admin Panel", icon: "LayoutGrid", match: "/admin" },
    ];
    expect(activeSidebarHref("/admin/import", adminLinks)).toBe("/admin");
  });

  it("orders, hides, and enables approved sidebar tools", () => {
    const defaults: SidebarNavLink[] = [
      { href: "/dashboard", label: "Dashboard", icon: "Gauge" },
      { href: "/settings", label: "Settings", icon: "Settings" },
    ];
    const tools: SidebarNavLink[] = [
      { href: "/admin/sets", label: "Manage sets", icon: "ListChecks" },
    ];
    const preferences = parseSidebarPreferences(
      JSON.stringify({
        order: ["/admin/sets", "/settings", "/dashboard"],
        hidden: ["/settings"],
        enabled: ["/admin/sets"],
        custom: [{ id: "notes", label: "Notes", href: "https://example.com" }],
      }),
    );

    expect(mergeSidebarLinks(defaults, preferences, tools).map((link) => link.label)).toEqual([
      "Manage sets",
      "Settings",
      "Dashboard",
    ]);
    expect(visibleSidebarLinks(defaults, preferences, tools).map((link) => link.label)).toEqual([
      "Manage sets",
      "Dashboard",
    ]);
  });
});

describe("availableAdminTools", () => {
  it("filters the sidebar catalog by the server-side role permissions", () => {
    expect(availableAdminTools("CONTENT_EDITOR").map((tool) => tool.href)).toEqual([
      "/admin/sets",
      "/admin/create",
      "/admin/import",
    ]);
    expect(availableAdminTools("ANALYST").map((tool) => tool.href)).toEqual(["/admin/analytics"]);
  });
});
