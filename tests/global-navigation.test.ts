import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GlobalMobileNavToggle } from "@/app/global-mobile-nav";
import { SiteSidebarNav } from "@/app/site-sidebar-nav";
import { EMPTY_SIDEBAR_PREFERENCES } from "@/lib/sidebar-preferences";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("global navigation semantics", () => {
  it("connects the mobile disclosure button to the sidebar", () => {
    const html = renderToStaticMarkup(createElement(GlobalMobileNavToggle));

    expect(html).toContain('aria-controls="site-sidebar-navigation"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Open navigation"');
  });

  it("labels the primary navigation and exposes the current page", () => {
    const html = renderToStaticMarkup(
      createElement(SiteSidebarNav, {
        links: [
          { href: "/dashboard", label: "Dashboard", icon: "Gauge" },
          { href: "/problem-sets", label: "Problem Sets", icon: "ClipboardList" },
        ],
        initialPreferences: EMPTY_SIDEBAR_PREFERENCES,
        userId: "test-user",
      }),
    );

    expect(html).toContain('<nav aria-label="Primary navigation"');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('tabindex="0"');
  });
});
