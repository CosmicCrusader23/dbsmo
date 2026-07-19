---
date: 2026-06-26
updated: 2026-07-19
type: architecture
tags: [project, architecture, system-design, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: f7e0c74
---

## For future Claude

This note describes the [[dbsmo]] system architecture and data flow, with the safety-sensitive paths source-verified again on 2026-07-18. It focuses on how Next.js routes, auth, Prisma, grading, imports, storage, analytics, classes, and FTW features fit together.

## Architectural Shape

[[dbsmo]] is a monolithic Next.js App Router application: UI routes, server components, client components, and API route handlers all live under `app/`, while reusable domain logic lives under `lib/` (sources: `app/`, `app/api/`, `lib/`, `package.json`). The database boundary is centralized through `lib/db.ts`, which constructs a Prisma Client using `@prisma/adapter-pg` and requires `DATABASE_URL`.

The main architectural layers are:

- Presentation: route pages and UI components under `app/`, with shared visual state mostly in CSS and client component local state (sources: `app/layout.tsx`, `app/globals.css`, `app/site-sidebar.tsx`, `app/problem-sets/[slug]/answer-grid.tsx`).
- Route handlers: API endpoints under `app/api/` validate requests, load sessions, enforce permissions, call `lib/` functions, and persist with Prisma (sources: `app/api/submit/route.ts`, `app/api/admin/sets/[id]/route.ts`, `app/api/admin/import/commit/route.ts`, `app/api/ftw/rooms/[code]/submit/route.ts`).
- Domain modules: grading, imports, storage, visibility, permissions, classes, analytics, FTW, and exports under `lib/` (sources: `lib/grading.ts`, `lib/import/json-import.ts`, `lib/storage.ts`, `lib/visibility.ts`, `lib/permissions.ts`, `lib/classes.ts`, `lib/analytics.ts`, `lib/ftw-room-server.ts`).
- Persistence: Prisma models in `prisma/schema.prisma` with PostgreSQL backing; binary files are stored outside the database and referenced by `ImportedFile` metadata.

## Module Flow

```mermaid
flowchart TD
  User["Student / Staff / Admin"] --> App["Next.js app routes in app/"]
  App --> Auth["NextAuth session + proxy.ts"]
  Auth --> Perms["lib/permissions.ts and page/API checks"]
  App --> API["app/api route handlers"]
  API --> Domain["lib domain modules"]
  Domain --> Prisma["lib/db.ts Prisma Client"]
  Prisma --> DB["PostgreSQL schema in prisma/schema.prisma"]
  Domain --> Files["lib/storage.ts local or S3 files"]
  Files --> ImportedFile["ImportedFile metadata"]
  ImportedFile --> Prisma
```

## Auth and Authorization

Authentication is configured in `lib/auth.ts`. Google OAuth is enabled only when its credentials are set and the email domain exactly matches the configured allowlist. The credentials "Developer Bypass" provider requires `AUTH_DEV_BYPASS=true` and is always unavailable in production (sources: `lib/auth.ts`, `lib/auth-policy.ts`). Sessions use JWT strategy, but the session callback reloads the current user from Prisma; deleted/missing users produce no runtime session rather than retaining stale token authority (source: `lib/auth.ts`).

Route-level middleware in `proxy.ts` requires a token for `/admin`, `/dashboard`, and `/problem-sets`, and uses `admin:view` as the broad staff boundary for `/admin` (sources: `proxy.ts`, `lib/permissions.ts`). This is only the first gate: every admin page and API checks its exact permission via `hasPermission(...)` (sources: `app/api/admin/sets/[id]/route.ts`, `app/api/admin/export-jobs/route.ts`, `app/api/admin/classes/[id]/route.ts`).

Private profile bypass requires `admin:users`; hidden leaderboard analytics require `admin:analytics`. These narrower checks must not be replaced with a generic staff-role test (sources: `app/users/[username]/page.tsx`, `app/users/page.tsx`, `app/leaderboard/page.tsx`).

Role mutations acquire a global PostgreSQL advisory transaction lock and re-read the actor's current role before updating the target. This prevents two administrators from concurrently revoking each other's authority after both passed a stale preflight (source: `app/api/admin/users/[id]/role/route.ts`).

## Problem Set Flow

Problem set browsing starts at `app/problem-sets/page.tsx`, which loads all sets, filters visibility for non-admin users through `isVisibleToStudent(...)`, computes attempts, bookmarks, assignments, recommendations, weak-topic metrics, media filters, status filters, category filters, and pagination (sources: `app/problem-sets/page.tsx`, `lib/visibility.ts`, `lib/problem-tags.ts`, `lib/problem-set-order.ts`).

Problem detail is handled by `app/problem-sets/[slug]/page.tsx`. It loads the set, problems, files, assets, creator, bookmarks, and previous attempts; non-admin users only see visible sets. The page chooses inline statement rendering when every problem has statement text, otherwise it falls back to PDF/file presentation (source: `app/problem-sets/[slug]/page.tsx`).

The answer grid is client-side and posts to `/api/submit`. It autosaves draft answers to `localStorage`, stores "review later" state in `localStorage`, supports feedback report submission, clears autosave after successful submission, and blocks answer entry/submission controls when a perfect attempt locks the set while keeping problem statements visible (source: `app/problem-sets/[slug]/answer-grid.tsx`).

Submission is persisted in `app/api/submit/route.ts`: it reads bounded JSON, validates through `lib/submission.ts`, checks visibility, grades through `gradeAnswer(...)`, and creates the `Attempt`/`Response` records in a serializable transaction with bounded retries. Perfect-score locking and attempt numbering are decided inside that transaction so concurrent submissions cannot bypass them (sources: `app/api/submit/route.ts`, `lib/submission.ts`, `lib/grading.ts`).

## Writeup Flow

Problem-set writeups are a separate readable/community surface at `/problem-sets/[slug]/writeups`, linked from the set header next to bookmarks. The server page requires auth, verifies set visibility for students, loads writeups with authors/images/votes, and sorts by newest or top score (source: `app/problem-sets/[slug]/writeups/page.tsx`). The sidebar `/writeups` directory lists latest/top writeups across visible sets and supports problem-set-focused search (source: `app/writeups/page.tsx`).

The client feed posts multipart form data to `POST /api/problem-sets/[id]/writeups`, supports LaTeX/HTML bodies and up to four images, renders bodies through `LatexStatement`, sends vote mutations to `POST /api/writeups/[id]/vote`, and shows a confirm-delete control for author/admin deletion through `DELETE /api/writeups/[id]` (sources: `app/problem-sets/[slug]/writeups/writeups-client.tsx`, `app/api/problem-sets/[id]/writeups/route.ts`, `app/api/writeups/[id]/vote/route.ts`, `app/api/writeups/[id]/route.ts`).

Writeup images reuse the existing storage/file-serving boundary: `lib/writeup-images.ts` validates and stores image bytes under collision-resistant keys, `WriteupImage` ties the resulting `ImportedFile` to the writeup, and `app/api/files/[id]/route.ts` grants access if the related problem set is visible or the requester has `admin:content` (sources: `lib/writeup-images.ts`, `prisma/schema.prisma`, `app/api/files/[id]/route.ts`).

## Grading Flow

`lib/grading.ts` is the deterministic grading engine. It normalizes exact, integer, decimal, fraction, set, multiple, and expression answers. Integer/fraction reduction uses bounded `BigInt` work, and zero-tolerance decimals use a canonical base-10 identity so values above `Number.MAX_SAFE_INTEGER` do not collapse together (source: `lib/grading.ts`). It is used by normal submissions, practice submissions, admin regrade, FTW solo, and FTW room submissions (source: CodeGraph callers for `gradeAnswer`, plus `app/api/submit/route.ts`, `app/api/practice/submit/route.ts`, `app/api/admin/sets/[id]/regrade/route.ts`, `app/api/ftw/matches/[id]/submit/route.ts`, `app/api/ftw/rooms/[code]/submit/route.ts`).

## Import and Authoring Flow

Manual/admin authoring uses `lib/problem-set-authoring.ts` for slug validation, uploaded PDF payload schema, create/patch schemas, problem normalization, answer-key splitting, and duplicate problem-number checks (source: `lib/problem-set-authoring.ts`). The admin edit route updates problem set metadata and replaces/updates/deletes child problems inside a Prisma transaction (source: `app/api/admin/sets/[id]/route.ts`).

JSON import uses `lib/import/json-import.ts`: it validates a bounded problem-set JSON payload, supports import dry-run, import commit, and import-to-editor draft, normalizes statement format and answer types, validates assets, persists problem sets/problems, and can replace an existing set while preserving its ID/order path where applicable. Image bytes are staged first and attached to locked set/file metadata in the same database transaction; rollback removes staged objects and successful replacement cleans unreferenced objects best-effort (sources: `lib/import/json-import.ts`, `lib/import/persist-image-assets.ts`, `lib/problem-set-locks.ts`, `lib/imported-file-cleanup.ts`).

ZIP import uses `lib/import/zip-dry-run.ts` and `lib/import/zip-import.ts`: it checks signature/compressed size/entry count, blocks absolute/traversal/overlong paths, reads strict UTF-8 manifest/CSV through `lib/import/zip-entry.ts`, bounds actual inflated bytes instead of trusting archive metadata, and validates schema/row/file totals before persistence. Referenced objects are staged one at a time under a random batch prefix and removed if metadata creation fails. The browser JSON batch panel applies its own compressed/entry/per-file/aggregate limits and extracts sequentially through `lib/import/client-zip-entry.ts` before sending each child to the same server validators (sources: `lib/import/zip-dry-run.ts`, `lib/import/zip-import.ts`, `lib/import/zip-entry.ts`, `lib/import/client-zip-entry.ts`, `lib/import/zip-path.ts`, `lib/import/manifest-schema.ts`, `lib/import/answer-schema.ts`, `app/admin/import/json-zip-import-panel.tsx`).

## Storage Flow

Binary files are represented in Prisma by `ImportedFile` and stored under storage keys. `lib/storage.ts` supports local filesystem storage by default and an S3-compatible request-signing path when `STORAGE_DRIVER=s3` (source: `lib/storage.ts`). Uploaded PDFs are validated as base64 `data:application/pdf` URLs with a 25 MB limit and saved through `storeUploadedPdf(...)` (source: `lib/uploaded-pdf.ts`).

File downloads are served by `app/api/files/[id]/route.ts`, which checks narrow file relations, allows `admin:content` or users who can see at least one related set, and denies orphan files. It reads through `readFileBufferBounded(...)`; the response verifies stored size/checksum and uses safe MIME plus `nosniff`/sandbox headers (sources: `app/api/files/[id]/route.ts`, `lib/storage.ts`).

## Classes, Assignment, and Announcement Flow

Classes and assignments are persisted by `Class`, `ClassMember`, and `Assignment` models; class messages use `Announcement` linked to one or more `Class` rows (source: `prisma/schema.prisma`). Admin class detail APIs call `loadAuthorizedClass(...)` to require `admin:users`, restrict non-admin teachers to their own class, and compute assignment completion from attempts after assignment creation using `buildCompletionMap(...)` (sources: `app/api/admin/classes/[id]/route.ts`, `lib/classes.ts`).

The student dashboard includes `AssignmentsWidget`, which fetches `/api/assignments/mine`, then shows up to five assigned problem sets. The API computes completion/problem counts in one bounded SQL query and preserves incomplete-first, nearer-due-date ordering (sources: `app/dashboard/assignments-widget.tsx`, `app/api/assignments/mine/route.ts`). Practice tags similarly use bounded database aggregation rather than loading every unsolved problem (source: `app/api/practice/tags/route.ts`).

Announcements are created from `/classes` through `AnnouncementComposer` and `POST /api/admin/announcements`; non-admin teachers can target only their own classes. `DashboardPage` reads announcements for classes where the current user is a member and renders them above the hero on each page load; there is no realtime push or polling (sources: `app/classes/announcement-composer.tsx`, `app/api/admin/announcements/route.ts`, `app/dashboard/page.tsx`).

## Analytics, Audit, Export

Analytics helpers in `lib/analytics.ts` compute topic accuracy, score buckets, question stats, CSV escaping, and the shared [[Performance Analytics|Performance Profile]]. The profile is derived from best attempts on currently visible sets and is not persisted, preventing stale ratings after attempts, regrades, or visibility changes (sources: `lib/analytics.ts`, `prisma/schema.prisma`). Admin analytics pages and charts render filtered attempts/completions/averages with UI filters and an SVG trend chart; the leaders table uses the same evidence-aware profile as the dashboard and leaderboard (sources: `app/admin/analytics/page.tsx`, `app/admin/analytics/filters.tsx`, `app/admin/analytics/trend-chart.tsx`).

Audit logs are stored in `AuditLog` and written through `recordAuditLog(...)` for meaningful admin actions such as set updates/deletes and export jobs (sources: `prisma/schema.prisma`, `lib/audit.ts`, `app/api/admin/sets/[id]/route.ts`, `app/api/admin/export-jobs/route.ts`).

Export jobs are synchronous API work persisted as `ExportJob` records. They reserve a bounded/cooldown-controlled job, build paginated and size-capped CSV or backup JSON, store a capped payload, and mark the job completed/failed. CSV values neutralize spreadsheet formulas; direct/job/set downloads reject cross-site browser GETs. Backup restore validates body, record, decoded-byte, checksum, relation, and storage-key limits (sources: `app/api/admin/export-jobs/route.ts`, `lib/admin-exports.ts`, `lib/admin-export-safety.ts`, `lib/analytics.ts`, `lib/http-body.ts`).

## FTW and Playground Flow

FTW solo mode creates `FtwMatch` and `FtwAnswer` records and scores answers by correctness plus elapsed time (sources: `lib/ftw.ts`, `app/api/ftw/matches/route.ts`, `app/api/ftw/matches/[id]/problem/route.ts`, `app/api/ftw/matches/[id]/submit/route.ts`, `prisma/schema.prisma`).

FTW rooms use `FtwRoom`, `FtwRoomPlayer`, `FtwRoomProblem`, and `FtwRoomAnswer`. Room codes use `crypto.randomInt`; host transfer/close behavior is pure logic in `lib/ftw-room-host.ts`; canonical transitions live in `lib/ftw-room-transition.ts`/`lib/ftw-room-server.ts`. Every mutating solo/room route serializes on its parent row through `lib/ftw-locks.ts`; the client continues to poll in `app/ftw/room/[code]/room-client.tsx` (sources: named files).

Playground boss battles are a separate client/game surface driven by static boss definitions in `lib/playground/bosses.ts` and a localStorage trophy key in `app/playground/[slug]/battle.tsx`; it is not backed by Prisma in the inspected paths (sources: `lib/playground/bosses.ts`, `app/playground/[slug]/battle.tsx`).

## Key Design Decisions Inferred From Source

- The app favors route-handler/domain-module locality over a separate service layer; API handlers often combine auth, validation, transactions, and response shaping (confidence: high; sources: `app/api/*/route.ts`, `lib/*`).
- `prisma db push` is the documented deployment path, not migrations, even though migration files exist in `prisma/migrations/` (confidence: high; sources: `SETUP.md`, `prisma/migrations/`).
- File bytes are intentionally outside the database, while DB rows retain storage keys, metadata, and relations to problem sets/assets (confidence: high; sources: `lib/storage.ts`, `prisma/schema.prisma`, `app/api/files/[id]/route.ts`).
- Practice mode uses one durable solve record per user/problem and only counts correct answers (confidence: high; sources: `PracticeSolve` in `prisma/schema.prisma`, `app/api/practice/submit/route.ts`).
