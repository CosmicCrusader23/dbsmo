---
date: 2026-06-26
updated: 2026-06-28
type: entry-points
tags: [project, architecture, routes, apis, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: f7e0c74
---

## For future Claude

This note lists the important [[dbsmo]] entry points: app routes, API routes, scripts, auth gates, CI, and startup/deploy flow. It is route-inventory dense; use [[Architecture]] for behavioral explanation and [[Common Tasks]] for where to edit.

## Startup and Commands

Commands are declared in `package.json`:

- `npm run dev` - starts Next.js dev server (`next dev`).
- `npm run build` - production build (`next build`).
- `npm run start` - production server (`next start`).
- `npm run lint` - ESLint over repo.
- `npm run typecheck` - TypeScript no-emit check.
- `npm run test` / `npm run test:watch` - Vitest.
- `npm run prisma:generate`, `npm run prisma:migrate`, `npm run db:seed` - Prisma generation/migration-dev/seed commands.
- `npm run convert:amc-aime` - runs `scripts/convert-amc-aime-to-json.mjs`.

Deployment flow is documented in `SETUP.md`: install dependencies, run `npx prisma generate`, run `npx prisma db push`, build, then reload PM2 (source: `SETUP.md`). CI uses Node 22, Postgres 16, `npx prisma db push`, seed, lint, typecheck, tests, build, and browser-harness smoke (source: `.github/workflows/ci.yml`).

## Auth Gate

- `app/api/auth/[...nextauth]/route.ts` exposes NextAuth.
- `lib/auth.ts` configures providers, session callback, JWT callback, allowed email domains, allowed email exceptions, and dev bypass.
- `proxy.ts` protects `/admin/:path*`, `/dashboard`, `/dashboard/:path*`, and `/problem-sets/:path*`; it requires a token and redirects non-ADMIN users away from `/admin`.
- `lib/permissions.ts` defines finer admin permissions used inside pages/APIs.

## Public/Auth App Routes

- `/` - landing/sign-in surface (source: `app/page.tsx`).
- `/login` - login route (source: `app/login/page.tsx`).
- `/dashboard` - authenticated dashboard with pinned class announcements, set progress, topic metrics, admin metrics, assignments widget, auth/profile/theme controls (source: `app/dashboard/page.tsx`, `app/dashboard/assignments-widget.tsx`).
- `/settings` - client account settings: display name, avatar URL/upload, Google profile-picture fallback, privacy flags, theme, typewriter settings (source: `app/settings/page.tsx`, `app/api/settings/route.ts`).
- `/leaderboard` - leaderboard view with avatars/rank badges (source: `app/leaderboard/page.tsx`).
- `/users` and `/users/[username]` - user list/profile, friend button, admin promote user button, authored tasks table above the set/problem progress grid (sources: `app/users/page.tsx`, `app/users/[username]/page.tsx`, `app/users/[username]/friend-button.tsx`, `app/users/[username]/promote-user-button.tsx`).

## Problem Set and Practice Routes

- `/problem-sets` - browse/filter/sort problem sets with recommendations, assignments/bookmarks/practice views, media/status/category filters, search, and pagination (source: `app/problem-sets/page.tsx`).
- `/problem-sets/[slug]` - set detail and answer entry, with inline statements or PDF fallback and file/video/solution display (source: `app/problem-sets/[slug]/page.tsx`).
- `/problem-sets/[slug]/writeups` - set writeup feed/composer with latest/top sorting, image attachments, and voting (sources: `app/problem-sets/[slug]/writeups/page.tsx`, `app/problem-sets/[slug]/writeups/writeups-client.tsx`).
- `/writeups` - global writeups directory from the sidebar with latest/top views and problem-set search (source: `app/writeups/page.tsx`).
- `/practice` - practice-mode UI backed by tags/next/submit APIs (source: `app/practice/page.tsx`).
- `/classes` - student-facing class route plus teacher/admin subtabs for class lists and announcement management (sources: `app/classes/page.tsx`, `app/classes/announcement-composer.tsx`, `app/classes/delete-announcement-button.tsx`).

## Game Routes

- `/ftw` - FTW lobby for topic selection, solo match, host room, or join room (source: `app/ftw/page.tsx`, `app/ftw/lobby-form.tsx`).
- `/ftw/match/[id]` - solo FTW match client (source: `app/ftw/match/[id]/page.tsx`, `app/ftw/match/[id]/match-client.tsx`).
- `/ftw/room/[code]` - multiplayer FTW room client (source: `app/ftw/room/[code]/page.tsx`, `app/ftw/room/[code]/room-client.tsx`).
- `/playground` and `/playground/[slug]` - boss-battle playground using static boss data/assets (sources: `app/playground/page.tsx`, `app/playground/hub.tsx`, `app/playground/[slug]/page.tsx`, `app/playground/[slug]/battle.tsx`, `lib/playground/bosses.ts`).

## Admin App Routes

- `/admin/sets` - set management list with direct view, per-set analytics, JSON export, and delete actions (source: `app/admin/sets/page.tsx`).
- `/admin/sets/[id]` - set detail/edit page and `SetEditForm` client (sources: `app/admin/sets/[id]/page.tsx`, `app/admin/sets/[id]/set-edit-form.tsx`).
- `/admin/sets/[id]/analytics` - per-set analytics, gated by `admin:analytics` (source: `app/admin/sets/[id]/analytics/page.tsx`).
- `/admin/create` - create set manually or from import draft (sources: `app/admin/create/page.tsx`, `app/admin/create/page-client.tsx`).
- `/admin/import` - JSON/ZIP import panels (sources: `app/admin/import/page.tsx`, `app/admin/import/json-zip-import-panel.tsx`, `app/admin/import/zip-import-panel.tsx`).
- `/admin/classes`, `/admin/classes/new`, `/admin/classes/[id]` - class index, class creation form, class roster/assignment detail (sources: `app/admin/classes/page.tsx`, `app/admin/classes/new/page.tsx`, `app/admin/classes/new/new-class-form.tsx`, `app/admin/classes/[id]/page.tsx`, `app/admin/classes/[id]/class-detail-client.tsx`).
- `/admin/students`, `/admin/students/[id]` - student list/detail (sources: `app/admin/students/page.tsx`, `app/admin/students/[id]/page.tsx`).
- `/admin/analytics` - global analytics dashboard, filters, trend chart (sources: `app/admin/analytics/page.tsx`, `app/admin/analytics/filters.tsx`, `app/admin/analytics/trend-chart.tsx`).
- `/admin/feedback` - feedback review table/actions (sources: `app/admin/feedback/page.tsx`, `app/admin/feedback/feedback-table.tsx`, `app/admin/feedback/feedback-actions.tsx`).
- `/admin/audit` - audit log view and filters (sources: `app/admin/audit/page.tsx`, `app/admin/audit/audit-filters.tsx`).

## Student/User API Routes

- `POST /api/submit` - validates and grades a full problem-set attempt, creates `Attempt` and `Response` records (source: `app/api/submit/route.ts`).
- `POST /api/submit/report` - creates feedback reports from answer grid (source: `app/api/submit/report/route.ts`).
- `GET /api/practice/tags` - returns practice tags where unsolved published problems by tag count exceed 10, plus `"Endless"` and practice score (source: `app/api/practice/tags/route.ts`).
- `GET /api/practice/next?tag=...` - returns a random unsolved visible published problem for tag or endless (source: `app/api/practice/next/route.ts`).
- `POST /api/practice/submit` - grades one practice problem, records `PracticeSolve` only on correct answers, returns current practice score if correct (source: `app/api/practice/submit/route.ts`).
- `PUT/DELETE /api/problem-sets/[id]/bookmark` - create/remove current user's bookmark (source: `app/api/problem-sets/[id]/bookmark/route.ts`).
- `POST /api/problem-sets/[id]/writeups` - create a writeup with LaTeX/HTML text and optional image uploads for a visible set (source: `app/api/problem-sets/[id]/writeups/route.ts`).
- `POST /api/writeups/[id]/vote` - upvote, downvote, or clear the current user's vote on a visible writeup (source: `app/api/writeups/[id]/vote/route.ts`).
- `DELETE /api/writeups/[id]` - delete a visible writeup when the requester is the author or an admin; associated uploaded image files are deleted best-effort (source: `app/api/writeups/[id]/route.ts`).
- `GET/PATCH /api/settings` - read/update profile settings and privacy flags (source: `app/api/settings/route.ts`).
- `PATCH /api/friends/[userId]` - toggle friend relationship (source: `app/api/friends/[userId]/route.ts`).
- `GET /api/files/[id]` - authenticated file streaming for PDFs/images with visibility checks (source: `app/api/files/[id]/route.ts`).
- `GET /api/assignments/mine` - current student's assignment list (source: `app/api/assignments/mine/route.ts`).

## Admin API Routes

- `POST /api/admin/create-set` - create manual problem set, including PDF and problem image uploads (source: `app/api/admin/create-set/route.ts`).
- `GET/PATCH/DELETE /api/admin/sets/[id]` - fetch/update/delete set; patch can update metadata, upload PDF/images, and replace/update/delete problems transactionally (source: `app/api/admin/sets/[id]/route.ts`).
- `POST /api/admin/sets/[id]/regrade` - regrade existing responses after answer changes (source: `app/api/admin/sets/[id]/regrade/route.ts`).
- `GET /api/admin/sets/[id]/export` - export a set as JSON import format (source: `app/api/admin/sets/[id]/export/route.ts`).
- `POST /api/admin/import/dry-run`, `POST /api/admin/import/commit`, `POST /api/admin/import/draft` - JSON import validation, commit, and editor draft paths; each accepts an optional same-basename image ZIP through `imageZip` form data (sources: `app/api/admin/import/*`, `lib/import/*`).
- `GET/POST /api/admin/export-jobs`, `GET /api/admin/export-jobs/[id]`, `GET /api/admin/export` - CSV/backup export job and direct export endpoints (sources: `app/api/admin/export-jobs/route.ts`, `app/api/admin/export-jobs/[id]/route.ts`, `app/api/admin/export/route.ts`, `lib/admin-exports.ts`).
- `GET/POST /api/admin/backup` - backup endpoints (source: `app/api/admin/backup/route.ts`).
- `GET/POST/PATCH/DELETE /api/admin/classes...` - class CRUD, roster mutation, assignment mutation, search endpoints (sources: `app/api/admin/classes/**`, `lib/classes.ts`).
- `POST /api/admin/announcements` - create a class-targeted announcement for one or more teacher-owned classes, or any class for admins (source: `app/api/admin/announcements/route.ts`).
- `DELETE /api/admin/announcements/[id]` - delete an announcement; admins can delete any announcement, teachers can delete announcements they authored (source: `app/api/admin/announcements/[id]/route.ts`).
- `PATCH/DELETE /api/admin/feedback/[id]`, `PATCH /api/admin/feedback` - feedback status/admin-note changes (sources: `app/api/admin/feedback/**`).
- `PATCH /api/admin/users/[id]/role` - role change endpoint (source: `app/api/admin/users/[id]/role/route.ts`).

## FTW API Routes

- `POST /api/ftw/matches` - create solo FTW match (source: `app/api/ftw/matches/route.ts`).
- `GET /api/ftw/matches/[id]/problem` - serve current/next solo FTW problem (source: `app/api/ftw/matches/[id]/problem/route.ts`).
- `POST /api/ftw/matches/[id]/submit` - grade solo FTW answer and score elapsed time (source: `app/api/ftw/matches/[id]/submit/route.ts`).
- `POST /api/ftw/rooms` - create multiplayer room (source: `app/api/ftw/rooms/route.ts`).
- `POST /api/ftw/rooms/[code]/join`, `/leave`, `/start`, `/advance`, `/submit`; `GET /api/ftw/rooms/[code]/state` - room lifecycle and polling state endpoints (sources: `app/api/ftw/rooms/[code]/**`, `lib/ftw-room-server.ts`, `lib/ftw-room-host.ts`).

## Non-Web Entry Points

- `prisma/seed.ts` - seeds demo admin/student/problem set/feedback and requires `DATABASE_URL`.
- `scripts/convert-amc-aime-to-json.mjs` - command-line text-to-JSON import converter with `--input`, `--output`, `--strict`, and `--include-solutions` flags.
- `.github/workflows/ci.yml` - CI verification pipeline and browser harness smoke entry.
