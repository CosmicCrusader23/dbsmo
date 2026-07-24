import { describe, expect, it } from "vitest";
import { activeSidebarHref, type SidebarNavLink } from "../lib/sidebar-navigation";

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
});
