import { describe, expect, it } from "vitest";
import { activeSidebarHref, type SidebarNavLink } from "../lib/sidebar-navigation";
import {
  mergeSidebarLinks,
  normalizeSidebarHref,
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

  it("accepts internal and http(s) custom links but rejects executable schemes", () => {
    expect(normalizeSidebarHref("/writeups")).toBe("/writeups");
    expect(normalizeSidebarHref("https://example.com/resources")).toBe(
      "https://example.com/resources",
    );
    expect(normalizeSidebarHref("javascript:alert(1)")).toBeNull();
    expect(normalizeSidebarHref("//example.com")).toBeNull();
  });

  it("orders, hides, and parses custom sidebar links", () => {
    const defaults: SidebarNavLink[] = [
      { href: "/dashboard", label: "Dashboard", icon: "Gauge" },
      { href: "/settings", label: "Settings", icon: "Settings" },
    ];
    const preferences = parseSidebarPreferences(
      JSON.stringify({
        order: ["custom:notes", "/settings", "/dashboard"],
        hidden: ["/settings"],
        custom: [
          { id: "notes", label: "Notes", href: "/notes", icon: "BookOpen", external: false },
        ],
      }),
    );

    expect(mergeSidebarLinks(defaults, preferences).map((link) => link.label)).toEqual([
      "Notes",
      "Settings",
      "Dashboard",
    ]);
    expect(visibleSidebarLinks(defaults, preferences).map((link) => link.label)).toEqual([
      "Notes",
      "Dashboard",
    ]);
  });
});
