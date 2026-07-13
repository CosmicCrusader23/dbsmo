# Hand-Drawn Visual System

DBSMO uses a math-notebook visual language built from shared CSS rather than page-specific illustrations. The current implementation is in the final `Hand-drawn shape system` section of `app/globals.css`; the public sign-in sketch markup is in `app/page.tsx`.

## Design Language

- Paper: warm graph-paper backgrounds with a dark-mode equivalent.
- Ink: high-contrast outlines and small offset shadows instead of soft floating cards.
- Markers: cyan, pink, yellow, and green accents identify states without making the interface one hue.
- Geometry: asymmetric fallback radii and mixed corner types make repeated controls feel drawn while keeping dimensions stable.
- Typography: the main interface remains Inter for scanning; only the decorative sign-in note uses a handwriting-style system-font stack.

## CSS Shape APIs

`corner-shape` changes the geometry inside a non-zero `border-radius`. DBSMO uses values such as `squircle`, `bevel`, and `scoop` on cards, actions, inputs, badges, and navigation. It is progressive enhancement because browser support is not yet universal.

`border-shape` can draw a border along a `<basic-shape>`, including `shape()`. DBSMO uses it only inside `@supports (border-shape: circle(50%))` for the decorative orbit on the sign-in page. Required content never depends on it.

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

This CSS-only change adds no deployment dependency or server step.
