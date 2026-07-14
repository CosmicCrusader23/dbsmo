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

  it("keeps escaped currency inside HTML math tags from closing the delimiter", () => {
    const html = renderToStaticMarkup(
      React.createElement(LatexStatement, {
        statement: String.raw`Ana's monthly salary was <math>\$2000</math> in May. In June she received a 20% raise. In July she received a 20% pay cut. After the two changes, her salary was <math>\text{(A)}\ 1920\text{ dollars} \qquad \text{(B)}\ 1980\text{ dollars} \qquad \text{(C)}\ 2000\text{ dollars}</math>.`,
        format: "HTML",
      }),
    );

    expect(html).toContain("Ana&#x27;s monthly salary was");
    expect(html).toContain("2000");
    expect(html).toContain("20% raise");
    expect(html).not.toContain("katex-error");
  });

  it("parses escaped dollars and multiline math without splitting early", () => {
    const html = renderToStaticMarkup(
      React.createElement(LatexStatement, {
        statement: String.raw`The price is $\$50$ and the total is $
50 + 25 = \$75$ dollars.`,
        format: "LATEX",
      }),
    );

    expect(html).toContain("The price is");
    expect(html).toContain("dollars.");
    expect(html).not.toContain("katex-error");
  });

  it("supports conservative package-style aliases and legacy display environments", () => {
    const html = renderToStaticMarkup(
      React.createElement(LatexStatement, {
        statement: String.raw`\[
\abs{-3}+\norm{v}+\ceil{x}+\floor{x}+\bm{x}+\mathbbm{1}
\qquad \SI{9.8}{\metre\per\second\squared}+\dv{y}{x}
\]
\begin{eqnarray}
a&=&b\\
c&=&d
\end{eqnarray}
\begin{multline}
x_1+x_2+x_3\\
=y
\end{multline}`,
        format: "LATEX",
      }),
    );

    expect(html).toContain("statement-math-block");
    expect(html).not.toContain("katex-error");
    expect(html).not.toContain("eqnarray");
    expect(html).not.toContain("multline");
  });

  it("does not emit executable markup from hostile HTML or trusted KaTeX commands", () => {
    const html = renderToStaticMarkup(
      React.createElement(LatexStatement, {
        statement: String.raw`<img src=x onerror=alert(1)><script>alert(2)</script>
<math>\htmlClass{xss-probe}{x}+\href{javascript:alert(3)}{click}</math>`,
        format: "HTML",
      }),
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror=");
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('class="xss-probe"');
  });

  it("bounds recursive macros and isolates macro definitions between expressions", () => {
    const isolatedMacroHtml = renderToStaticMarkup(
      React.createElement(LatexStatement, {
        statement: String.raw`$\gdef\privateMacro{x}$ $\privateMacro$`,
        format: "LATEX",
      }),
    );
    const recursiveMacroHtml = renderToStaticMarkup(
      React.createElement(LatexStatement, {
        statement: String.raw`$\def\loop{\loop}\loop$`,
        format: "LATEX",
      }),
    );

    expect(isolatedMacroHtml).toContain('mathcolor="#cc0000"');
    expect(isolatedMacroHtml).toContain("\\privateMacro</mtext>");
    expect(recursiveMacroHtml).toContain("katex-error");
    expect(isolatedMacroHtml).not.toContain("<script");
    expect(recursiveMacroHtml).not.toContain("<script");
  });
});
