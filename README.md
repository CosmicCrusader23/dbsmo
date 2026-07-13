# DBS MO Training Platform

Self-paced mathematics olympiad training platform for DBS. Complete with features such as answer-only problem sets, automatic grading, progress tracking, teaching videos, solution links, feedback reports, and teacher analytics.

Statements can be rendered in Latex or HTML math tags.

## Important Docs

- [JSON import format](./docs/import-format.md)
- [Grading rules](./docs/grading.md)
- [Admin Guide](./docs/admin-guide.md)
- [Student Guide](./docs/student-guide.md)
- [Permissions Guide](./docs/permissions.md)
- [Deployment Guide](./docs/deployment.md)
- [Visual System](./docs/visual-system.md)

## PATCHNOTES

Current app version: **v0.67.0**.

Session updates from the CodeGraph/Second Brain indexing pass onward:

- Indexed the codebase with CodeGraph and created a layered Obsidian Second Brain vault under `DBSMO/Projects/dbsmo/`, including start, overview, architecture, file map, entry points, components, data/storage, common tasks, risks, and glossary notes.
- Added class deletion support and polished the class detail page so class management can remove classes directly from the admin workflow.
- Added optional problem-image support for authoring and imports:
  - GUI problem maker image uploads.
  - JSON import companion image ZIPs using the same basename as the JSON file.
  - Mass ZIP import support for nested image ZIPs.
  - Secure ZIP handling with size, path, image type, and image count validation.
  - `[[img:key]]` rendering below problem statements.
- Checked and improved the JSON dry-run/edit flow used when imported JSON has validation issues.
- Updated docs under `docs/` and refreshed the project knowledge base notes after implementation work.
- Polished the mobile/sidebar popup behavior so the sidebar sheet itself does not create an extra scroll trap after opening.
- Updated agent/project instructions to remove the Claude co-author trailer requirement for future commits.
- Fixed leaderboard role labels so staff tags show the actual role, such as Admin, Teacher, Content Editor, or Analyst.
- Reworked the standard leaderboard and average score model to use more useful mastery/weighted best-attempt ranking signals.
- Set the app version label to `v0.67.0` and added the app footer with repository and Cosmic Crusader website links.
- Fixed create/edit set problem number controls so they render as clean number inputs instead of being embedded in the circular problem badge.
- Fixed create-set preview image rendering, including HTML statement normalization preserving `[[img:key]]` tokens.
- Added Google account profile pictures as the default avatar fallback before deterministic initials, while preserving custom avatar URLs/uploads.
- Added focused tests for image-token rendering in LaTeX and HTML statements and configured Vitest to understand the app `@/` import alias.
- Kept solved sets readable while locking new submissions after a perfect-score attempt.
- Added a profile mastery heatmap between authored tasks and the set grid, using GitHub-style green intensity for days with 1-5 mastered sets.
- Added problem-set writeups with LaTeX/HTML text, image uploads, latest/top sorting, and upvote/downvote voting. Writeups are reachable from the set header beside the bookmark action and remain accessible regardless of submission status.
- Added owner/admin writeup deletion with an in-card confirmation step, plus a sidebar Writeups page for browsing latest/top writeups and searching by problem set.
- Added class announcements: teachers/admins can post messages to one or more classes, and students see targeted messages pinned at the top of the dashboard on page load.
- Switched the shared math curve loader, route-level UI reveals, and analytics chart/bar motion to Anime.js v4 while keeping reduced-motion fallbacks; stabilized the dashboard typewriter by removing the per-character text tween that caused flicker.
- Fixed mobile problem-set task cards/sidebar tap layout/dashboard account controls, added the `/classes` Announcements subtab with existing-message deletion, and normalized literal `null` display names.
- Added direct per-set Analytics buttons on both the student-facing set header for admins and the admin set editor, and made the set-editor Delete button match the other topbar action sizing.
- Fixed the mobile sidebar tap/focus jump by keeping the opened sheet geometry stable when nav items receive focus.
- Added live rendered answer previews in Practice and problem-set answer boxes, and expanded expression grading to understand common LaTeX input/keys such as `$5$`, `\sqrt{5}`, `5\sqrt{2}-7`, `\frac{1}{2}`, and `2^{1/2}`.
- Rehauled the shared visual system around hand-drawn math-notebook shapes: graph-paper surfaces, irregular ink borders, marker accents, offset control shadows, mixed `corner-shape` geometry, and progressive `border-shape` contours with conventional browser fallbacks.
- Audited and unified the non-game application routes around the same sketchbook language, including dashboard, catalog/set detail, writeups, practice, classes, leaderboard, users/profiles, settings, and admin surfaces. Added Shantell Sans for headings and controls while preserving Inter for dense content, tables, and math; FTW and Playground were intentionally excluded from the route-specific redesign.
- Audited the signed-in production problem-set page in the real Chrome session and corrected the redesign: removed percentage shape paths from tall panels, normalized compact panel headers, removed the light-blue problem statement band, switched functional surfaces to softer hand-drawn squircles, and added a fixed labeled DBSMO desktop sidebar without changing the mobile sheet behavior.

© 2026 Cosmic Crusader
