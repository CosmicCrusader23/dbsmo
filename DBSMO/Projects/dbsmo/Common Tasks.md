---
date: 2026-06-26
updated: 2026-07-19
type: common-tasks
tags: [project, architecture, maintenance, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: f7e0c74
---

## For future Claude

This note tells future agents where to edit [[dbsmo]] for common changes. It is source-grounded but not a substitute for re-reading the target files before modification.

## Change the Visual System

Start with the final `Hand-drawn shape system` and `Hand-drawn route coverage` sections in `app/globals.css`; they intentionally override the older 2026 refresh and light-mode rehaul sections. Shared paper/ink/marker tokens live in `:root` with dark equivalents in `html.dark`. Common panels, actions, inputs, badges, navigation, tables, analytics surfaces, and problem-set controls are grouped there (source: `app/globals.css`).

The public sign-in sketch markup lives in `app/page.tsx`. Keep it `aria-hidden` because it is decorative. Inter/Shantell Sans variables are configured in `app/layout.tsx`; do not apply the handwriting font to answer inputs, equations, or long body copy. Shared hand-drawn outlines use native borders with asymmetric radii and progressive `corner-shape`; do not restore `border-image`, because it paints rigid rectangular frames outside squircles. Update light and dark ink tokens together and test desktop plus mobile widths. Search inputs should remain borderless at rest inside the search panel and use one cyan focus border without an additional outline. Never use percentage-based `border-shape` paths on variable-height panels: a 7,000 px problem panel turns a 1% path offset into 70 px. Do not restore global wavy eyebrow/title underlines. Include a long problem set in visual QA. The current route audit excludes FTW and Playground. Implementation/support notes are in `docs/visual-system.md`.

Metric cards are deliberately neutral summary surfaces. Add new metrics with only `metric-card`; do not add `accent-*` classes or colored edge borders. Selected problem-set category counts use an opaque `--paper-raised` background and `--ink` text so both themes retain readable contrast (source: `app/globals.css`).

## Add or Change an Answer Type

Edit:

- `prisma/schema.prisma` - `AnswerType` enum if the type is persisted.
- `lib/grading.ts` - normalization and correctness logic.
- `lib/import/answer-schema.ts` and `lib/import/json-import.ts` - import validation/mapping.
- `lib/problem-set-authoring.ts` - manual authoring schema.
- `app/admin/create/page-client.tsx` and `app/admin/sets/[id]/set-edit-form.tsx` - UI answer-type options.
- `docs/grading.md` and `docs/import-format.md` - user-facing docs.
- Tests: `tests/grading.test.ts`, `tests/json-import.test.ts`, and import/authoring tests as needed.

Watch for uppercase Prisma enum values versus lowercase `lib/grading.ts` values (sources: `prisma/schema.prisma`, `lib/grading.ts`).

## Change Grading Behavior

Edit `lib/grading.ts` first. Preserve the bounded `BigInt` normalization for integers/fractions and canonical base-10 comparison for zero-tolerance decimals; converting those paths directly through `Number` can merge distinct answers above `Number.MAX_SAFE_INTEGER`. Then inspect all callers: full submission, practice submission, admin regrade, FTW solo submit, and FTW room submit (sources: `app/api/submit/route.ts`, `app/api/practice/submit/route.ts`, `app/api/admin/sets/[id]/regrade/route.ts`, `app/api/ftw/matches/[id]/submit/route.ts`, `app/api/ftw/rooms/[code]/submit/route.ts`). Add/update `tests/grading.test.ts`.

## Change Attempt Review

Start with [[Attempt Review]]. The server page and exact owner/staff authorization live in `app/attempts/[id]/page.tsx`; summary/status helpers and unit tests live in `lib/attempt-review.ts` and `tests/attempt-review.test.ts`. Entry links are spread across `app/problem-sets/[slug]/answer-grid.tsx`, `app/problem-sets/[slug]/page.tsx`, `app/dashboard/page.tsx`, `app/admin/students/[id]/page.tsx`, and `app/admin/sets/[id]/analytics/page.tsx`. Keep `/attempts/:path*` in `proxy.ts`, but do not rely on middleware for the per-attempt ownership check.

## Change LaTeX Statement Support

Edit `lib/latex-compat.ts` for source normalization, table/display conversion, and conservative compatibility macros. Edit `app/problem-sets/[slug]/latex-statement.tsx` for the escape-aware tokenizer, HTML math-tag normalization, and KaTeX security options. Keep `trust: false`, `globalGroup: false`, fresh macros per expression, and finite `maxSize`/`maxExpand` limits. Add normal syntax, production-regression, and hostile-input tests in `tests/latex-statement.test.ts`. Do not replace the tokenizer with delimiter regexes or treat `\usepackage` as permission to load code/files; document supported fallbacks in `docs/latex-support.md` (sources: named files).

## Add a Problem Set Field

Edit:

- `prisma/schema.prisma` - `ProblemSet` model.
- `lib/problem-set-authoring.ts` - manual create/patch schemas and normalization if relevant.
- `app/admin/create/page-client.tsx` - create form.
- `app/admin/sets/[id]/set-edit-form.tsx` - edit form.
- `app/api/admin/create-set/route.ts`, `app/api/admin/sets/[id]/route.ts` - persistence.
- `lib/import/json-import.ts`, `lib/import/problem-set-json-export.ts`, `docs/import-format.md` - if import/export needs the field.
- Display routes such as `app/problem-sets/page.tsx`, `app/problem-sets/[slug]/page.tsx`, or `app/dashboard/page.tsx`.
- `SETUP.md` if deploy steps or schema deployment instructions need a one-off note.

## Change Visibility Rules

Start with `lib/visibility.ts`. Then inspect every caller because visibility is enforced at multiple boundaries: catalog, set detail, submit, practice submit, and file serving (sources: `app/problem-sets/page.tsx`, `app/problem-sets/[slug]/page.tsx`, `app/api/submit/route.ts`, `app/api/practice/submit/route.ts`, `app/api/files/[id]/route.ts`).

Do not implement group restrictions as a routine visibility fix. `ProblemSet.allowedGroups` and `User.group` exist, but the classes/assignments design intentionally leaves them dormant. Enabling them is a product-policy change that needs an explicit decision, a full caller audit, and tests in `tests/visibility.test.ts` (sources: `prisma/schema.prisma`, `lib/visibility.ts`, `docs/superpowers/specs/2026-05-28-classes-and-assignments-design.md`).

## Change Permissions or Staff Access

Edit `lib/permissions.ts` for permission strings and role mappings. Also inspect `proxy.ts`, which intentionally uses `canAccessAdminArea(...)`/`admin:view` only as a broad staff gate. Preserve the exact permission check in every page/API; private profiles require `admin:users` and hidden leaderboard analytics require `admin:analytics` (sources: `proxy.ts`, `lib/permissions.ts`, `app/users/[username]/page.tsx`, `app/leaderboard/page.tsx`).

Update `docs/permissions.md` and admin/sidebar behavior in `app/site-sidebar.tsx` if the navigation surface changes.

## Add an Admin Page

Add the route under `app/admin/...`, gate it with session and `hasPermission(...)`, then add sidebar link logic in `app/site-sidebar.tsx` if it should be navigable. Add matching API under `app/api/admin/...` if the page has client-side mutations. Audit meaningful mutations through `recordAuditLog(...)` when appropriate (sources: `lib/permissions.ts`, `app/site-sidebar.tsx`, `lib/audit.ts`).

## Change Problem Set Import Format

JSON path:

- `lib/import/json-import.ts`
- `lib/import/image-assets.ts` if image/token behavior changes.
- `lib/import/image-zip.ts`, `lib/import/uploaded-image-zip.ts`, `lib/import/persist-image-assets.ts` if optional image ZIP/manual image upload behavior changes.
- `lib/import/client-zip-entry.ts` and `app/admin/import/json-zip-import-panel.tsx` for outer browser batch ZIP extraction.
- `app/admin/import/json-zip-import-panel.tsx`
- `app/admin/import/zip-import-panel.tsx`
- `app/api/admin/import/dry-run/route.ts`, `/commit/route.ts`, `/draft/route.ts`
- `app/admin/create/page-client.tsx`, `app/admin/sets/[id]/set-edit-form.tsx`, `app/api/admin/create-set/route.ts`, `app/api/admin/sets/[id]/route.ts` if import-draft/manual image handling is affected.
- `docs/import-format.md`
- `tests/json-import.test.ts`

ZIP path:

- `lib/import/manifest-schema.ts`
- `lib/import/answer-schema.ts`
- `lib/import/zip-dry-run.ts`
- `lib/import/zip-import.ts`
- `lib/import/zip-entry.ts`
- `lib/import/zip-path.ts`
- `app/admin/import/zip-import-panel.tsx`
- `tests/zip-dry-run.test.ts`

Keep compressed-body limits, central-directory preflight, and actual streamed expanded-byte limits together. Archive metadata is an optimization only; `readZipEntryBufferBounded(...)`/`readZipEntryTextBounded(...)` are the authoritative server ZIP-bomb boundary, while `readClientZipEntryBounded(...)` protects the browser batch path. Extract batch children sequentially. Stage referenced server files under a unique batch prefix and clean staged objects when the database transaction fails.

## Change File Storage

Edit `lib/storage.ts` for driver/path semantics and `lib/uploaded-pdf.ts` for PDF-specific validation. File serving behavior lives in `app/api/files/[id]/route.ts`. File serving and backup export use `readFileBufferBounded(...)`; preserve actual streamed-byte limits for both local and S3 drivers. Orphan files are intentionally unreadable, and hidden-set bypass requires `admin:content`. Add/update `tests/storage.test.ts`.

If adding a new production storage dependency or required env var, update `SETUP.md` in the same commit.

## Change Classes, Assignments, or Announcements

Edit:

- `prisma/schema.prisma` - `Class`, `ClassMember`, `Assignment`, `Announcement`.
- `lib/classes.ts` - validation/completion rules.
- `app/api/admin/classes/**` - CRUD/search/roster/assignment APIs.
- `app/api/admin/announcements/route.ts` - class-targeted announcement creation.
- `app/admin/classes/**` and `app/classes/**` - class admin UI, student/teacher class page, and announcement composer.
- `app/api/assignments/mine/route.ts`, `app/dashboard/assignments-widget.tsx`, and `app/dashboard/page.tsx` - student assignment and announcement display.
- Tests: `tests/classes.test.ts`.

Completion currently counts attempts submitted after assignment creation, independent of score/perfection (source: `lib/classes.ts`).

Class deletion is already exposed by `DELETE /api/admin/classes/[id]` and surfaced in `app/admin/classes/[id]/class-detail-client.tsx`; changing delete semantics should update `tests/classes.test.ts` and the class detail UI together.

## Change Dashboard Metrics or Analytics

Dashboard:

- `app/dashboard/page.tsx` - metrics, next set, topic scores, admin rows.
- `app/dashboard/assignments-widget.tsx` - assigned-to-you widget.
- `lib/analytics.ts` - shared analytics helpers.

Admin analytics:

- `app/admin/analytics/page.tsx`
- `app/admin/analytics/filters.tsx`
- `app/admin/analytics/trend-chart.tsx`
- `app/admin/sets/[id]/analytics/page.tsx`

Add tests around pure helper changes in `lib/analytics.ts` when possible.

## Change FTW Scoring or Room Flow

Solo FTW:

- `lib/ftw.ts`
- `app/api/ftw/matches/**`
- `app/ftw/match/[id]/match-client.tsx`
- `tests/ftw-scoring.test.ts`

Room FTW:

- `lib/ftw-room.ts`
- `lib/ftw-room-host.ts`
- `lib/ftw-locks.ts`
- `lib/ftw-room-transition.ts`
- `lib/ftw-room-server.ts`
- `app/api/ftw/rooms/**`
- `app/ftw/room/[code]/room-client.tsx`
- `tests/ftw-room-host.test.ts`, `tests/ftw-room-transition.test.ts`, `tests/ftw-scoring.test.ts`

All mutating solo and room routes serialize on the parent match/room row. Preserve that lock boundary when changing join, leave, start, submit, scoring, advance, or problem selection. Room codes must continue to use `crypto.randomInt` with the bounded, ambiguity-free alphabet.

## Change User Profile, Friends, or Leaderboard

Profile/settings:

- `app/settings/page.tsx`
- `app/api/settings/route.ts`
- `app/users/[username]/page.tsx`
- `lib/user-profile.ts`
- `app/avatar.tsx`, `lib/avatar.ts`
- `lib/auth.ts` for propagating Google `User.image` into the session.
- Pages that select user rows for avatars must include `image: true` when they want Google profile-picture fallback, then pass `image` to `Avatar`.
- Profile authored tasks are rendered in `app/users/[username]/page.tsx` from `User.createdProblemSets`; keep public visibility filtered through `isVisibleToStudent(...)` and use `hasPermission(...)` before linking staff-only analytics/manage actions.
- Profile mastery heatmap is also in `app/users/[username]/page.tsx`; it is derived from recent `Attempt` rows and should stay aligned with whatever threshold defines "mastered" elsewhere in the app.

Friends:

- `app/users/[username]/friend-button.tsx`
- `app/api/friends/[userId]/route.ts`
- `Friendship` model in `prisma/schema.prisma`

Leaderboard:

- `app/leaderboard/page.tsx`
- `User.leaderboardVisible`, `Attempt`, and `PracticeSolve` model data in `prisma/schema.prisma`

## Change Problem Set Writeups

Edit:

- `prisma/schema.prisma` - `Writeup`, `WriteupImage`, `WriteupVote`, and related `User`/`ProblemSet`/`ImportedFile` relations.
- `app/problem-sets/[slug]/writeups/page.tsx` and `app/writeups/page.tsx` - auth, visibility, initial query, latest/top sorting, and directory search.
- `app/problem-sets/[slug]/writeups/writeups-client.tsx` - composer, image selection, optimistic vote state, confirm-delete state, and feed rendering.
- `app/api/problem-sets/[id]/writeups/route.ts` - writeup creation, multipart validation, and image persistence.
- `app/api/writeups/[id]/vote/route.ts` - vote mutation and score response.
- `app/api/writeups/[id]/route.ts` and `lib/imported-file-cleanup.ts` - author/admin deletion, unreferenced metadata deletion, and best-effort backing-object cleanup.
- `lib/writeup-images.ts` and `app/api/files/[id]/route.ts` - image validation, storage, and read access.
- `docs/student-guide.md` and [[Data and Storage]] when behavior changes.

## Run Checks

For behavior changes, run:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

For schema changes, also run `npx prisma generate` and the appropriate local schema command. CI runs Postgres-backed verification with `npx prisma db push`, seed, tests, build, and browser harness smoke (source: `.github/workflows/ci.yml`).
