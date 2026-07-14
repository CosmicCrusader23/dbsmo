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

  it("renders a bare tabular environment mixed with statement prose", () => {
    const html = renderToStaticMarkup(
      React.createElement(LatexStatement, {
        statement: String.raw`The values are:
\begin{tabular}{|c|c|}
\toprule
x & $y$ \\
\midrule
1 & \(2\) \\
\bottomrule
\end{tabular}`,
        format: "LATEX",
      }),
    );

    expect(html).toContain("The values are:");
    expect(html).toContain("statement-math-block");
    expect(html).toContain("katex");
    expect(html).not.toContain("katex-error");
    expect(html).not.toContain("tabular");
  });

  it("normalizes document wrappers and common advanced table commands", () => {
    const html = renderToStaticMarkup(
      React.createElement(LatexStatement, {
        statement: String.raw`\documentclass{article}
\usepackage{booktabs}
\begin{document}
\begin{tabular*}{0.8\textwidth}{*{2}{c}}
\multicolumn{2}{c}{Results} \\
\cline{1-2}
3 & 4
\end{tabular*}
\end{document}`,
        format: "LATEX",
      }),
    );

    expect(html).toContain("statement-math-block");
    expect(html).toContain("Results");
    expect(html).not.toContain("katex-error");
    expect(html).not.toContain("multicolumn");
  });

  it("loads the official mhchem extension", () => {
    const html = renderToStaticMarkup(
      React.createElement(LatexStatement, {
        statement: String.raw`Balance $\ce{H2 + O2 -> H2O}$.`,
        format: "LATEX",
      }),
    );

    expect(html).toContain(String.raw`\ce{H2 + O2`);
    expect(html).not.toContain("katex-error");
  });

  it("renders legacy currency commands from imported contest problems", () => {
    const html = renderToStaticMarkup(
      React.createElement(LatexStatement, {
        statement: String.raw`Sale prices are $50\%$ below the original price, with another $20\%$ discount.
A coat originally costs $\textdollar180$. Choose $\text{(A)}\ \54 \qquad \text{(B)}\ \72 \qquad \text{(C)}\ \90$.`,
        format: "LATEX",
      }),
    );

    expect(html).toContain("Sale prices are");
    expect(html).toContain("50");
    expect(html).toContain("180");
    expect(html).not.toContain("katex-error");
  });
});
