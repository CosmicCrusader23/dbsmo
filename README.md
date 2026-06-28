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

© 2026 Cosmic Crusader
