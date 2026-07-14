# Hand-Drawn Visual System

DBSMO uses a math-notebook visual language built from shared CSS rather than page-specific illustrations. The implementation is in the final `Hand-drawn shape system` and `Hand-drawn route coverage` sections of `app/globals.css`; the public sign-in sketch markup is in `app/page.tsx`, and font variables are configured in `app/layout.tsx`.

## Design Language

- Paper: warm graph-paper backgrounds with a dark-mode equivalent.
- Ink: asymmetric native borders and small offset shadows create a drawn outline without adding a second rectangular frame around shaped controls.
- Markers: cyan, pink, yellow, and green accents identify states without becoming decorative underlines.
- Geometry: asymmetric squircle radii make functional cards and controls feel hand-drawn while keeping dimensions stable. Cut or mixed corners are reserved for small decorative accents.
- Typography: Shantell Sans gives headings, controls, tabs, badges, compact labels, and tabular display text a handwritten character. Inter remains the long-form body, form-entry, and math-adjacent font for scanning and accuracy.

## Route Coverage

The shared and route-specific selectors cover the dashboard, problem-set catalog and detail pages, writeups, practice, classes, leaderboard, user/profile, settings, and admin surfaces. FTW and Playground retain their existing game-specific styling and were intentionally excluded from the route audit.

Desktop and 390 px mobile visualizations were rendered from representative real class names. The production `/problem-sets/1991-ajhsme` route was also inspected in the signed-in Chrome session. The audit checks included stable header actions, horizontal containment, readable status badges, compact tables, analytics controls, announcements, writeup voting, tall problem panels, and the mobile navigation sheet. Desktop navigation is a 64 px icon rail that expands to 240 px on hover or keyboard focus; the existing off-canvas sheet remains the mobile behavior.

The simplified Sigma mark in `public/dbsmo-mark.svg` is shared by browser icon metadata and the public landing brand. The sidebar renders the matching Lucide `Sigma`, keeping the navigation icon crisp without duplicating image assets in the component.

## CSS Shape APIs

`corner-shape` changes the geometry inside a non-zero `border-radius`. DBSMO uses values such as `squircle`, `bevel`, and `scoop` on cards, actions, inputs, badges, and navigation. It is progressive enhancement because browser support is not yet universal.

`border-shape` can draw a border along a `<basic-shape>`, including `shape()`. DBSMO limits it to the sign-in orbit and bounded empty states inside `@supports (border-shape: circle(50%))`. Shared cards, controls, and panels use native borders with asymmetric radii and `corner-shape`; `border-image` is intentionally avoided because it paints a rectangular frame that does not clip consistently to squircles. Every shaped element retains an ordinary border/radius fallback.

Do not apply percentage-based `border-shape` paths to variable-height panels. On production, a problem panel over 7,000 px tall turned a 1-2% vertical path offset into a 70-140 px diagonal wedge. Tall panels, statement containers, tables, and question cards use ordinary borders with asymmetric squircle radii instead.

`clip-path` remains the fallback for decorative tape, marker strokes, and axes. It is also used where clipping is more appropriate than changing a functional box border.

Primary references:

- [MDN: `corner-shape`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/corner-shape)
- [CSS Borders and Box Decorations Level 4](https://drafts.csswg.org/css-borders/)
- [Chrome 147: `border-shape`](https://developer.chrome.com/release-notes/147)
- [MDN: `clip-path`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/clip-path)
- [MDN: `shape()`](https://developer.mozilla.org/docs/Web/CSS/basic-shape/shape)

## Maintenance Rules

1. Add or modify shared colors through the light `:root` and `html.dark` variables together.
2. Preserve conventional borders and radii before adding experimental shape properties.
3. Keep touch-target dimensions independent of transforms, clips, and decorative pseudo-elements.
4. Disable nonessential motion under `prefers-reduced-motion`.
5. Verify the public landing page and at least one dense authenticated surface at desktop and mobile widths after broad CSS changes.
6. Include a tall problem set in visual QA whenever changing shared panel geometry; checking a short mock panel is not sufficient.
7. Keep marker colors for state and emphasis; do not restore global wavy eyebrow or page-title underlines.
8. Keep search inputs borderless at rest inside their search panel and use one cyan border on focus; do not combine a colored border with a second outline ring.

The visual update adds a bundled `next/font` face but no package, environment, schema, or server-step dependency.
