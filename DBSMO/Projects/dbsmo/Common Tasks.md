---
date: 2026-06-26
updated: 2026-06-26
type: common-tasks
tags: [project, architecture, maintenance, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: f7e0c74
---

## For future Claude
This note tells future agents where to edit [[dbsmo]] for common changes. It is source-grounded but not a substitute for re-reading the target files before modification.

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

Edit `lib/grading.ts` first. Then inspect all callers: full submission, practice submission, admin regrade, FTW solo submit, and FTW room submit (sources: `app/api/submit/route.ts`, `app/api/practice/submit/route.ts`, `app/api/admin/sets/[id]/regrade/route.ts`, `app/api/ftw/matches/[id]/submit/route.ts`, `app/api/ftw/rooms/[code]/submit/route.ts`). Add/update `tests/grading.test.ts`.

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

If implementing group restrictions, note that `ProblemSet.allowedGroups` and `User.group` exist, but the inspected `isVisibleToStudent(...)` does not use groups (sources: `prisma/schema.prisma`, `lib/visibility.ts`). Add tests in `tests/visibility.test.ts`.

## Change Permissions or Staff Access

Edit `lib/permissions.ts` for permission strings and role mappings. Also inspect `proxy.ts`, because it currently redirects any non-`ADMIN` role from `/admin` even though `TEACHER`, `CONTENT_EDITOR`, and `ANALYST` have admin permissions in `lib/permissions.ts` (sources: `proxy.ts`, `lib/permissions.ts`).

Update `docs/permissions.md` and admin/sidebar behavior in `app/site-sidebar.tsx` if the navigation surface changes.

## Add an Admin Page

Add the route under `app/admin/...`, gate it with session and `hasPermission(...)`, then add sidebar link logic in `app/site-sidebar.tsx` if it should be navigable. Add matching API under `app/api/admin/...` if the page has client-side mutations. Audit meaningful mutations through `recordAuditLog(...)` when appropriate (sources: `lib/permissions.ts`, `app/site-sidebar.tsx`, `lib/audit.ts`).

## Change Problem Set Import Format

JSON path:

- `lib/import/json-import.ts`
- `lib/import/image-assets.ts` if image/token behavior changes.
- `lib/import/image-zip.ts`, `lib/import/uploaded-image-zip.ts`, `lib/import/persist-image-assets.ts` if optional image ZIP/manual image upload behavior changes.
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
- `lib/import/zip-path.ts`
- `app/admin/import/zip-import-panel.tsx`
- `tests/zip-dry-run.test.ts`

## Change File Storage

Edit `lib/storage.ts` for driver/path semantics and `lib/uploaded-pdf.ts` for PDF-specific validation. File serving behavior lives in `app/api/files/[id]/route.ts`. Backup export reads files through `readFileBuffer(...)` in `lib/admin-exports.ts`. Add/update `tests/storage.test.ts`.

If adding a new production storage dependency or required env var, update `SETUP.md` in the same commit.

## Change Classes or Assignments

Edit:

- `prisma/schema.prisma` - `Class`, `ClassMember`, `Assignment`.
- `lib/classes.ts` - validation/completion rules.
- `app/api/admin/classes/**` - CRUD/search/roster/assignment APIs.
- `app/admin/classes/**` - admin UI.
- `app/api/assignments/mine/route.ts` and `app/dashboard/assignments-widget.tsx` - student assignment display.
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
- `lib/ftw-room-server.ts`
- `app/api/ftw/rooms/**`
- `app/ftw/room/[code]/room-client.tsx`
- `tests/ftw-room-host.test.ts`, `tests/ftw-scoring.test.ts`

## Change User Profile, Friends, or Leaderboard

Profile/settings:

- `app/settings/page.tsx`
- `app/api/settings/route.ts`
- `app/users/[username]/page.tsx`
- `lib/user-profile.ts`
- `app/avatar.tsx`, `lib/avatar.ts`
- `lib/auth.ts` for propagating Google `User.image` into the session.
- Pages that select user rows for avatars must include `image: true` when they want Google profile-picture fallback, then pass `image` to `Avatar`.

Friends:

- `app/users/[username]/friend-button.tsx`
- `app/api/friends/[userId]/route.ts`
- `Friendship` model in `prisma/schema.prisma`

Leaderboard:

- `app/leaderboard/page.tsx`
- `User.leaderboardVisible`, `Attempt`, and `PracticeSolve` model data in `prisma/schema.prisma`

## Run Checks

For behavior changes, run:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

For schema changes, also run `npx prisma generate` and the appropriate local schema command. CI runs Postgres-backed verification with `npx prisma db push`, seed, tests, build, and browser harness smoke (source: `.github/workflows/ci.yml`).
