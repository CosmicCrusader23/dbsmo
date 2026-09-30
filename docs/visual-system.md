# Editorial Visual System

DBSMO uses the restrained visual language of OpenAI's GPT launch pages across its working screens: generous space, large plain type, fine dividers, and a near-black palette with small warm and cool accents. The interactive Sol and Astra scenes remain the expressive moments on sign-in and the dashboard. The app-wide layer is the final `GPT-inspired editorial shell` section of `app/globals.css`; it overrides the older hand-drawn sections without changing route markup or behavior.

## Design language

- **Light:** warm off-white background, quiet white panels, dark ink, and muted blue selected states.
- **Dark:** blue-black background, charcoal panels, soft white text, subtle cool atmosphere, and a small amber accent. The existing theme toggle and stored preference still select between the two.
- **Typography:** Inter is used for display and controls as well as body text. Tight heading tracking and restrained weights give page titles their editorial scale. Shantell Sans remains loaded for legacy surfaces and game-specific interfaces.
- **Structure:** shared cards, inputs, pills, filters, and tables use one-pixel borders and regular rounded corners. Shadows and hand-drawn offsets are removed from the shared shell. Dense information keeps its existing layout and interaction.
- **Motion:** Sol and Astra remain interactive on their respective pages. Other content renders at its final position; hover and focus feedback stay subtle and respect reduced-motion preferences.

## Coverage and behavior

The shared stylesheet covers the dashboard, problem-set catalog and details, writeups, practice, classes, leaderboard, user/profile pages, settings, and admin tools. FTW and Playground keep their game-specific compositions, while inheriting the common color and type tokens where practical. The desktop sidebar remains a 64 px icon rail that expands on hover or keyboard focus; the mobile sheet keeps its current behavior.

The sign-in page retains its dark Sol field even when the user's general theme is light. The dashboard hero retains its Astra field, cream actions, and white type in both themes. These scenes stay legible against the surrounding editorial shell.

The simplified Sigma mark in `public/dbsmo-mark.svg` is shared by browser icon metadata and the public landing brand. On mobile, the closed navigation sheet is `inert` and `aria-hidden`; opening it makes page content inert, and closing it restores focus to the menu toggle. Keyboard focus remains visible on navigation and controls.

## Maintenance

1. Change the light and dark tokens together in the final editorial section of `app/globals.css`. Do not reintroduce graph-paper backgrounds, handwritten typography, staggered card borders, or broad page entrance animations into the common shell.
2. Keep the Sol and Astra selectors more specific than generic card and button selectors so a theme change does not cover the animations or reduce their contrast.
3. Keep conventional `border` and `border-radius` fallbacks before experimental `corner-shape` rules. Avoid percentage-based `border-shape` paths on variable-height panels.
4. Keep search and form focus states clear without stacking several colored outlines. Check selected filter labels and counts in both themes.
5. After shared CSS edits, inspect the public landing page and authenticated dashboard, catalog, practice, and settings screens at desktop and mobile widths. Include a tall problem set when changing panel geometry; preserve mobile card-table containment.

The editorial update adds no package, environment variable, schema change, or deployment step.
