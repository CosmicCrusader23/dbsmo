# LaTeX Rendering Support

DBSMO renders mathematical LaTeX with KaTeX `0.17.x` in `app/problem-sets/[slug]/latex-statement.tsx`. KaTeX is a math renderer, not a full TeX document compiler, so server files, shell escape, arbitrary package loading, page layout, floats, and document output are intentionally unavailable.

## Accepted Input

- Inline math: `$...$` and `\(...\)`, including multiline content and escaped currency such as `$\$2000$`.
- Display math: `$$...$$` and `\[...\]`.
- Bare display environments mixed with prose, including `array`, matrix variants, `align`, `gather`, `equation`, `cases`, and `CD`. Delimiters and matching environments are parsed with escape awareness instead of a regular-expression split.
- Chemistry through KaTeX's official `mhchem` extension, for example `$\ce{2H2 + O2 -> 2H2O}$`.
- Common shorthand macros for blackboard symbols, paired delimiters, vectors, conjugates, elementary derivatives, angles, and text symbols. Examples include `\RR`, `\mathbbm{1}`, `\bm{x}`, `\abs{x}`, `\norm{x}`, `\ceil{x}`, `\floor{x}`, `\vect{x}`, `\dv{y}{x}`, `\degree`, `\textdollar`, and `\textpercent`.
- Safe notation aliases used by MathLive, including `\set`, `\Set`, `\rd`, `\rD`, `\scriptCapitalE`, `\gothicCapitalR`, `\imaginaryI`, `\exponentialE`, and `\differentialD`. These expand only to known KaTeX primitives.
- Basic `siunitx`-style notation such as `\SI{9.8}{\metre\per\second\squared}`, `\unit{kg}`, `\num{1000}`, and `\ang{30}`.
- Legacy contest imports that encode currency as an invalid backslash-number sequence such as `\54`; this is normalized to `\$54` before rendering.
- HTML-format imports using `<math>`, `<imath>`, and `<cmath>` tags. Their contents are converted to unambiguous TeX delimiters while all remaining HTML tags and attributes become inert text.
- Imported image tokens such as `[[img:diagram1]]`; images remain separate from LaTeX and are served through the application's validated asset path.

## Table Compatibility

`lib/latex-compat.ts` converts these document-style environments into KaTeX `array` markup before rendering:

- `tabular`
- `tabular*`
- `tabularx`
- `longtable`

Column types `l`, `c`, `r`, `|`, and `:` are preserved. Fixed-width `p{...}`, `m{...}`, `b{...}`, and `X` columns fall back to left alignment. Repeated column specs such as `*{3}{c}` are expanded with a 50-column safety cap. `booktabs` rules (`\toprule`, `\midrule`, and `\bottomrule`) map to `\hline`; `\cline` and `\cmidrule` fall back to full rules. Basic `\multicolumn` content renders, but true spanning is not available because KaTeX arrays do not implement it.

Standard optional position arguments are accepted, including `\begin{tabular}[t]{...}`, `\begin{longtable}[c]{...}`, and the position argument after the width in `tabular*`/`tabularx`. The production AJHSME archive regression suite covers the affected tables in 1987 questions 8 and 23, 1989 questions 14 and 22, 1990 question 9, and 1991 question 6.

Legacy display environments `eqnarray`, `flalign`, `multline`, and `displaymath` are downgraded to KaTeX's safe `aligned` or `gathered` environments. This preserves the equations but may not reproduce full-TeX page alignment exactly.

Full-document wrappers are tolerated for imports: DBSMO extracts the content inside `\begin{document}...\end{document}` and ignores `\documentclass`, `\usepackage`, and outer centering environments. Packages named in `\usepackage` are not downloaded or executed.

## MathLive Compatibility

MathLive is an interactive math editor with its own command dictionary; it is not a full TeX package runtime or a drop-in replacement for KaTeX. Its documented table examples use the `array` environment, which KaTeX already supports. DBSMO adds conservative aliases for MathLive's predefined notation macros when they have a direct KaTeX equivalent.

DBSMO does not attempt to copy every MathLive command. Editor operations, Compute Engine semantics, TeX programming primitives, and HTML-affecting commands do not have a safe or meaningful renderer-only translation. In particular, MathLive compatibility commands such as `\class`, `\cssId`, and `\htmlData` remain disabled along with KaTeX's trusted HTML/resource commands. Add future aliases only when they expand deterministically to existing KaTeX primitives and include both rendering and hostile-input tests.

## Security Limits

Rendering keeps `trust: false`, `globalGroup: false`, caps author-specified dimensions with `maxSize: 50`, and limits macro expansion to 1,000 steps. Each expression receives a fresh macro map, so global definitions cannot affect later expressions. Commands that can load resources or inject HTML, including `\includegraphics`, `\href`, `\htmlClass`, `\htmlId`, `\htmlStyle`, and `\htmlData`, remain disabled. Use the problem image asset workflow instead of `\includegraphics`.

TikZ/PGF, arbitrary package loading, shell escape, file reads, raw HTML injection, floats, page layout, and full-document output remain intentionally unsupported. These require a sandboxed TeX compiler rather than KaTeX and are outside the statement renderer's security boundary.

For the authoritative KaTeX command list, see [Supported Functions](https://katex.org/docs/supported) and the [Support Table](https://katex.org/docs/support_table.html).
For comparison, see MathLive's [LaTeX Commands](https://mathlive.io/mathfield/reference/commands/) and [Macros](https://mathlive.io/mathfield/guides/macros/) references.
