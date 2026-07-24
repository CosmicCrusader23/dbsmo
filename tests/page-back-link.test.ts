import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageBackLink } from "@/app/page-back-link";

describe("PageBackLink", () => {
  it("renders one canonical page-exit control", () => {
    const html = renderToStaticMarkup(
      createElement(PageBackLink, {
        destination: "Classes",
        href: "/classes",
        className: "test-back-link",
      }),
    );

    expect(html).toContain('href="/classes"');
    expect(html).toContain('aria-label="Back to Classes"');
    expect(html).toContain('data-page-back="true"');
    expect(html).toContain("secondary-action page-back-link test-back-link");
    expect(html).not.toContain("compact");
    expect(html).toContain("<span>Back to Classes</span>");
  });
});
