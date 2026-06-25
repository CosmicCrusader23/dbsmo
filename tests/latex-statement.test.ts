import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LatexStatement } from "../app/problem-sets/[slug]/latex-statement";

const assetUrl = "data:image/png;base64,aW1hZ2U=";

describe("LatexStatement", () => {
  it("renders referenced image assets in LaTeX statements", () => {
    const html = renderToStaticMarkup(
      React.createElement(LatexStatement, {
        statement: "Find x.\n\n[[img:geomnumber1]]",
        format: "LATEX",
        assets: { geomnumber1: assetUrl },
      }),
    );

    expect(html).toContain('src="data:image/png;base64,aW1hZ2U="');
    expect(html).toContain('class="problem-image"');
  });

  it("preserves image tokens while normalizing HTML statements", () => {
    const html = renderToStaticMarkup(
      React.createElement(LatexStatement, {
        statement: "<p>Find x.</p>[[img:geomnumber1]]",
        format: "HTML",
        assets: { geomnumber1: assetUrl },
      }),
    );

    expect(html).toContain('src="data:image/png;base64,aW1hZ2U="');
    expect(html).toContain('class="problem-image"');
  });
});
