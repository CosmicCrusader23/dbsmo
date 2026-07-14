# LaTeX Rendering Support

DBSMO renders mathematical LaTeX with KaTeX `0.17.x` in `app/problem-sets/[slug]/latex-statement.tsx`. KaTeX is a math renderer, not a full TeX document compiler, so server files, shell escape, arbitrary package loading, page layout, floats, and document output are intentionally unavailable.

## Accepted Input

- Inline math: `$...$` and `\(...\)`.
- Display math: `$$...$$` and `\[...\]`.
- Bare display environments mixed with prose, including `array`, matrix variants, `align`, `gather`, `equation`, `cases`, and `CD`.
- Chemistry through KaTeX's official `mhchem` extension, for example `$\ce{2H2 + O2 -> 2H2O}$`.
- Common shorthand macros: `\RR`, `\NN`, `\ZZ`, `\QQ`, `\CC`, and `\degree`.
- Imported image tokens such as `[[img:diagram1]]`; images remain separate from LaTeX and are served through the application's validated asset path.

## Table Compatibility

`lib/latex-compat.ts` converts these document-style environments into KaTeX `array` markup before rendering:

- `tabular`
- `tabular*`
- `tabularx`
- `longtable`

Column types `l`, `c`, `r`, `|`, and `:` are preserved. Fixed-width `p{...}`, `m{...}`, `b{...}`, and `X` columns fall back to left alignment. Repeated column specs such as `*{3}{c}` are expanded with a 50-column safety cap. `booktabs` rules (`\toprule`, `\midrule`, and `\bottomrule`) map to `\hline`; `\cline` and `\cmidrule` fall back to full rules. Basic `\multicolumn` content renders, but true spanning is not available because KaTeX arrays do not implement it.

Full-document wrappers are tolerated for imports: DBSMO extracts the content inside `\begin{document}...\end{document}` and ignores `\documentclass`, `\usepackage`, and outer centering environments. Packages named in `\usepackage` are not downloaded or executed.

## Security Limits

Rendering keeps `trust: false`, caps author-specified dimensions with `maxSize: 50`, and limits macro expansion to 1,000 steps. Commands that can load resources or inject HTML, including `\includegraphics`, `\href`, and `\htmlClass`, remain disabled. Use the problem image asset workflow instead of `\includegraphics`.

For the authoritative KaTeX command list, see [Supported Functions](https://katex.org/docs/supported) and the [Support Table](https://katex.org/docs/support_table.html).
