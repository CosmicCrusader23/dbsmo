import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "@/app/theme-toggle";

describe("ThemeToggle", () => {
  it("supports a local-only mode for signed-out pages", () => {
    const html = renderToStaticMarkup(createElement(ThemeToggle, { persist: false }));

    expect(html).toContain('aria-label="Theme: light"');
    expect(html).toContain('title="Theme: light"');
  });
});
