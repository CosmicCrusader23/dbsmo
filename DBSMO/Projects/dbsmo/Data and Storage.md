---
date: 2026-06-26
updated: 2026-07-18
type: data-storage
tags: [project, architecture, data, storage, prisma, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: f7e0c74
---

## For future Claude

This note documents [[dbsmo]] data models, storage mechanisms, APIs, and state flows; grading, imports, storage, assignments, exports, and FTW safety paths were source-verified again on 2026-07-18. Read this before changing schema, grading, imports, storage, class assignments, or FTW state.

## Database Boundary

Prisma schema lives in `prisma/schema.prisma`. The app uses PostgreSQL with Prisma Client and `@prisma/adapter-pg`; the shared client is exported as `prisma` from `lib/db.ts` and requires `DATABASE_URL` at initialization. `prisma/seed.ts` also uses Prisma PG adapter and requires `DATABASE_URL`.

Deployment docs currently use `npx prisma db push` and `npx prisma generate`, not `prisma migrate deploy`, even though migration files exist (sources: `SETUP.md`, `prisma/migrations/`).

## Core Models

- `User`: NextAuth user plus app profile fields: Google `image`, display name, custom avatar URL, role, group, visibility flags, theme, greeting settings, login timestamps, and relations to attempts, feedback, files, problem sets, bookmarks, friendships, practice solves, audit/export jobs, FTW, and classes (source: `prisma/schema.prisma`). The shared `Avatar` component prefers custom `avatarUrl`, then Google `image`, then deterministic initials (sources: `app/avatar.tsx`, `lib/avatar.ts`).
- `ProblemSet`: slug/title/description/order/status/visibility windows/group restrictions/tags/difficulty/video/files/creator plus problems, attempts, feedback, bookmarks, assets, and assignments (source: `prisma/schema.prisma`).
- `Problem`: problem-set child with integer `number`, statement, `ProblemContentFormat`, answer key/type/accepted answers/case sensitivity/explanation/tags/points; unique per `(problemSetId, number)` (source: `prisma/schema.prisma`).
- `Tests` is a canonical problem-set category tag. It does not change storage: test papers are still represented as 60 `Problem` rows, and `AnswerGrid` groups those rows visually into 20 problems × 3 levels on tagged sets (sources: `lib/problem-tags.ts`, `app/problem-sets/[slug]/page.tsx`, `app/problem-sets/[slug]/answer-grid.tsx`).
- `Attempt` and `Response`: full problem-set attempt totals and per-problem raw/normalized answers, correctness, and awarded points (source: `prisma/schema.prisma`).
- `PracticeSolve`: unique `(userId, problemId)` record for correct practice solves (source: `prisma/schema.prisma`).
- `FeedbackReport`: user-submitted issue report tied to set and optional problem, with type/status/admin note/resolution time (source: `prisma/schema.prisma`).
- `ImportedFile` and `ProblemSetAsset`: file metadata and inline image assets keyed by `(problemSetId, key)` (source: `prisma/schema.prisma`).
- `Writeup`, `WriteupImage`, and `WriteupVote`: problem-set discussion/solution posts. `Writeup` belongs to a `ProblemSet` and `User`, stores title/body/content format; `WriteupImage` links uploaded image `ImportedFile` records to a writeup; `WriteupVote` is unique per `(writeupId, userId)` with value `-1` or `1` enforced by migration check constraint (sources: `prisma/schema.prisma`, `prisma/migrations/20260628090000_add_writeups/migration.sql`).
- `AuditLog` and `ExportJob`: admin activity and export artifacts (source: `prisma/schema.prisma`).
- `Friendship`: one-way requester/receiver pair with unique constraint (source: `prisma/schema.prisma`).
- `Class`, `ClassMember`, `Assignment`, `Announcement`: teacher-owned classes, roster membership, assigned problem sets, and class-targeted dashboard announcements. `Announcement` is linked to one or more classes through Prisma's implicit class relation table (source: `prisma/schema.prisma`, `prisma/migrations/20260629110000_add_announcements/migration.sql`).
- `FtwMatch`, `FtwAnswer`, `FtwRoom`, `FtwRoomPlayer`, `FtwRoomProblem`, `FtwRoomAnswer`: solo and multiplayer FTW state (source: `prisma/schema.prisma`).
- `Account`, `Session`, `VerificationToken`: NextAuth adapter models (source: `prisma/schema.prisma`).

## Visibility and Access Data Flow

`isVisibleToStudent(...)` returns true only for `PUBLISHED` sets whose optional `visibleFrom`/`visibleTo` include the current time (source: `lib/visibility.ts`). Non-admin users are filtered through this helper in catalog, problem detail, submission, practice, and file-serving paths (sources: `app/problem-sets/page.tsx`, `app/problem-sets/[slug]/page.tsx`, `app/api/submit/route.ts`, `app/api/practice/submit/route.ts`, `app/api/files/[id]/route.ts`).

`allowedGroups` exists on `ProblemSet` and `getUserGroups(...)` exists in `lib/auth-server.ts`, but the inspected visibility helper does not check `allowedGroups`. Treat group-based visibility as not implemented in the inspected path unless a later source check shows otherwise (sources: `prisma/schema.prisma`, `lib/visibility.ts`, `lib/auth-server.ts`; confidence: high for inspected code).

## Submission and Attempt Flow

`POST /api/submit`:

1. Loads NextAuth session and validates request body with Zod.
2. Loads problem set and problems by ID.
3. Loads current user and rejects non-admin access when set is not student-visible.
4. Finds previous attempts and blocks new submission if a perfect attempt already exists.
5. Grades each answer with `gradeAnswer(...)`.
6. Creates one `Attempt` and many `Response` records in a transaction.
7. Returns attempt number, score, percentage, and per-problem result summary.

Sources: `app/api/submit/route.ts`, `lib/grading.ts`, `prisma/schema.prisma`.

## Grading Data

`AnswerType` exists as a Prisma enum with uppercase values (`EXACT`, `INTEGER`, `DECIMAL`, `FRACTION`, `SET`, `MULTIPLE`, `EXPRESSION`), while `lib/grading.ts` uses lowercase string types and callers map/lowercase Prisma values before grading. Integer/fraction normalization uses bounded `BigInt`; exact decimals use canonical digit/exponent identity before any bounded tolerance fallback. `lib/math-input.ts` strips math delimiters and converts common LaTeX forms like `$5$`, `\sqrt{5}`, `\frac{1}{2}`, braced powers, and `\pi` before expression evaluation (sources: `prisma/schema.prisma`, `lib/grading.ts`, `lib/math-input.ts`, `app/api/submit/route.ts`, `app/api/practice/submit/route.ts`).

Graded responses store both raw and normalized answers in `Response`, which supports later review/export/regrade (sources: `prisma/schema.prisma`, `app/api/submit/route.ts`). Admin regrading is exposed at `app/api/admin/sets/[id]/regrade/route.ts`.

## Practice Data Flow

Practice tags are derived from unsolved problems in published visible sets. `GET /api/practice/tags` performs a bounded PostgreSQL aggregation, keeps tags with count greater than 10, prepends `"Endless"`, and returns current practice score (`PracticeSolve` count) (source: `app/api/practice/tags/route.ts`).

`GET /api/practice/next` requires a normalized tag, finds unsolved problems from visible published sets, filters by tag unless tag is endless, randomly picks one, and returns it (source: `app/api/practice/next/route.ts`).

`POST /api/practice/submit` grades one problem and creates `PracticeSolve` only if correct. Unique-constraint errors are swallowed for duplicate solves; other Prisma errors are logged (source: `app/api/practice/submit/route.ts`, `lib/prisma-errors.ts`).

## Import Data Flow

JSON import schema accepts top-level metadata, `statementFormat`, visibility windows, topic tags, difficulty, video URL, inline `images`, optional same-name image ZIP uploads, and at least one problem (source: `lib/import/json-import.ts`). It accepts `answerKey` or `answer`, accepts lowercase or uppercase answer types through answer schemas, normalizes statement format, handles accepted answers, maps `solution`/`explanationNote` into `Problem.explanationNote`, and appends `[[img:key]]` tokens for per-problem image refs so images render below statements (sources: `lib/import/json-import.ts`, `docs/import-format.md`).

Image assets are declared as base64 image records, uploaded through the manual problem maker GUI, or supplied by optional image ZIPs. `lib/import/image-assets.ts` enforces lowercase key pattern, supported mime types, max 50 images, max 4 MB each, a 100 MB aggregate decoded cap, data URL/base64 decoding, and magic-byte matching; SVG is not accepted by the source code. `lib/import/image-zip.ts` enforces compressed and actual expanded limits, unsafe-path/entry-count rejection, duplicate-key rejection, supported-image magic bytes, and folder/direct image layouts (sources: `lib/import/image-assets.ts`, `lib/import/image-zip.ts`, `lib/import/zip-entry.ts`, `lib/import/uploaded-image-zip.ts`).

ZIP import uses `manifest.yml`/`manifest.yaml`, `answers.csv`, and problem/solution file references. It blocks absolute/traversal/overlong paths, limits entries and schema/CSV records, decodes metadata as strict UTF-8, and uses streamed actual-byte limits for inflated entries rather than trusting central-directory sizes. Referenced files are staged under a random batch prefix before transactional metadata creation (sources: `lib/import/zip-dry-run.ts`, `lib/import/zip-import.ts`, `lib/import/zip-entry.ts`, `lib/import/manifest-schema.ts`, `lib/import/answer-schema.ts`, `lib/import/zip-path.ts`). The JSON batch upload UI (`app/admin/import/json-zip-import-panel.tsx`) can unpack a bounded parent ZIP containing `.json` files plus same-basename nested image `.zip` files; it rejects unsafe/ambiguous paths and extracts children sequentially through `lib/import/client-zip-entry.ts` before sending each pair through the server JSON import APIs.

JSON import drafts are stored client/session-side through `lib/import/json-draft-storage.ts` and consumed by `app/admin/create/page-client.tsx` when creating/editing from import draft. Draft creation has a tolerant parser path so fixable schema errors, such as string problem numbers or missing answer keys, can still open in the editor with issues shown (sources: `lib/import/json-import.ts`, `lib/import/json-draft-storage.ts`, `app/admin/create/page-client.tsx`).

Image asset persistence is centralized in `lib/import/persist-image-assets.ts`. It stages bytes under unique keys, then attaches `ImportedFile` and `ProblemSetAsset` rows in the caller's locked transaction. Failed database work discards staged objects; successful replacement removes unreferenced metadata/backing objects best-effort (sources: `lib/import/persist-image-assets.ts`, `lib/problem-set-locks.ts`, `lib/imported-file-cleanup.ts`).

## File Storage

`lib/storage.ts` sets the storage root to `process.env.LOCAL_STORAGE_ROOT ?? "./storage"` and driver to `process.env.STORAGE_DRIVER ?? "local"`. It fails closed for unknown drivers, validates storage keys to prevent absolute paths, null bytes, or `..`, resolves local paths under the root, creates directories on save, and can sign S3-compatible GET/PUT/DELETE requests when fully configured (source: `lib/storage.ts`).

`storeUploadedPdf(...)` accepts only `data:application/pdf;base64,...`, enforces non-empty and <= 25 MB, sanitizes filename, hashes content, saves bytes through `saveFile(...)`, and creates `ImportedFile` metadata (source: `lib/uploaded-pdf.ts`).

`GET /api/files/[id]` allows reads only with `admin:content` or if the file is related to a visible problem set through `problemFileFor`, `solutionFileFor`, asset, or writeup-image relations; orphan files are denied. It reads local/S3 objects with `readFileBufferBounded(...)`, verifies stored size/checksum, and returns only safe inline MIME types; everything else is an attachment with private caching, `nosniff`, and CSP sandbox headers (sources: `app/api/files/[id]/route.ts`, `lib/storage.ts`).

Writeup image uploads use `lib/writeup-images.ts`. The helper accepts only PNG, JPEG, GIF, or WebP images up to 5 MB each, validates magic bytes, sanitizes filenames, stores bytes under collision-resistant `writeups/{problemSetId}/{writeupId}/...` keys, writes `ImportedFile`, and creates `WriteupImage` rows. `/api/files/[id]` includes writeup-image relations in its visibility check so images follow the same visible-set/content-staff boundary (sources: `lib/writeup-images.ts`, `app/api/problem-sets/[id]/writeups/route.ts`, `app/api/files/[id]/route.ts`).

## Writeup Flow

`GET /problem-sets/[slug]/writeups` is a server route that requires a signed-in user, loads the problem set and visible access state, fetches writeups with authors/images/votes, and sorts by `latest` or `top` according to the `sort` query param (source: `app/problem-sets/[slug]/writeups/page.tsx`).

`POST /api/problem-sets/[id]/writeups` accepts multipart form data with `title`, `body`, `contentFormat`, and optional `images`. It requires at least text or one image, caps title/body/image count, verifies set visibility, creates the writeup, then stores up to four validated images. If image persistence fails after writeup creation, the route deletes the writeup before returning an error (source: `app/api/problem-sets/[id]/writeups/route.ts`).

`POST /api/writeups/[id]/vote` accepts `value` `-1`, `0`, or `1`. It verifies session and set visibility, deletes the current user's vote for `0`, otherwise upserts the vote, and returns the updated score and current user's vote (source: `app/api/writeups/[id]/vote/route.ts`).

`DELETE /api/writeups/[id]` verifies session, set visibility, and author/admin ownership before deleting the writeup. `WriteupImage` and `WriteupVote` rows cascade; `cleanupUnreferencedImportedFiles(...)` removes unreferenced `ImportedFile` metadata before best-effort backing-object cleanup (sources: `app/api/writeups/[id]/route.ts`, `lib/imported-file-cleanup.ts`).

## Classes and Assignments

Class detail authorization requires session, `admin:users`, class existence, and for non-admin users `cls.teacherId === userId` (source: `app/api/admin/classes/[id]/route.ts`). The class detail UI exposes roster/assignment mutation and class deletion through the same route family (source: `app/admin/classes/[id]/class-detail-client.tsx`). Completion is calculated by `buildCompletionMap(...)`: each class member starts null, attempts count only if submitted after assignment creation, and the earliest qualifying attempt is stored (source: `lib/classes.ts`).

Assignment data shown to students comes from `/api/assignments/mine`, which computes completion and problem counts in one bounded SQL query and preserves incomplete-first/due-date ordering. `AssignmentsWidget` renders the first five results (source: `app/dashboard/assignments-widget.tsx`, `app/api/assignments/mine/route.ts`).

Class announcements are created through `POST /api/admin/announcements`, which requires `admin:users`; non-admin teachers can target only classes where they are `teacherId`. `/classes?tab=announcements` renders `AnnouncementComposer`, lists existing related announcements, and deletes messages through `DELETE /api/admin/announcements/[id]` for admins or the announcement author. `app/dashboard/page.tsx` loads announcements for classes where the current user is a member, ordered newest first and pinned above the dashboard hero (sources: `app/api/admin/announcements/route.ts`, `app/api/admin/announcements/[id]/route.ts`, `app/classes/announcement-composer.tsx`, `app/classes/delete-announcement-button.tsx`, `app/classes/page.tsx`, `app/dashboard/page.tsx`).

## Exports and Backups

`buildStudentsCsv()` exports student name/email/group/sets attempted/average score/attempt count. `buildAttemptsCsv()` exports attempt rows. Both neutralize formula-leading spreadsheet cells. `buildBackupJson()` exports problem sets in import JSON shape and safely restorable imported-file relations/content. All three paginate database reads and enforce row/output/file caps; download routes reject cross-site browser GETs (sources: `lib/admin-exports.ts`, `lib/admin-export-safety.ts`, `lib/analytics.ts`, `lib/http-body.ts`).

`ExportJob` stores job status, type, requester, filename, MIME type, payload, error, creation/completion times. The API reserves one bounded/cooldown-controlled job, builds synchronously, and stores a capped JSON payload; it is not a worker queue (sources: `app/api/admin/export-jobs/route.ts`, `lib/admin-export-safety.ts`, `prisma/schema.prisma`).

## FTW Data

Solo FTW uses `FtwMatch` and `FtwAnswer`. Scoring constants are in `lib/ftw.ts`: 10 problems per match, 45 second limit, 6 max points per problem; score is zero if incorrect and otherwise decreases with elapsed time (source: `lib/ftw.ts`, `prisma/schema.prisma`).

Room FTW uses separate models and scoring constants in `lib/ftw-room.ts`: room default total 10, default limit 45,000 ms, base 2 points plus speed points up to 8 for correct answers. Room codes use cryptographic randomness; host/room transitions are deterministic in `lib/ftw-room-host.ts` and `lib/ftw-room-transition.ts`; due advancement and random candidate selection are in `lib/ftw-room-server.ts`. Mutating solo/room routes serialize through parent-row locks in `lib/ftw-locks.ts` (sources: named files).

## Client-Side State

Durable browser-local state:

- Answer drafts: `mo-draft-${problemSetId}` in `AnswerGrid`.
- Review-later marks: `mo-review-${problemSetId}` in `AnswerGrid`.
- Theme: `mo-theme` read by `app/layout.tsx` and settings/theme controls.
- Typewriter settings: `mo-typewriter-settings` in `app/settings/page.tsx`.
- Playground trophies: `localStorage` via `trophyKey(...)` in `app/playground/[slug]/battle.tsx`.

These are not mirrored to Prisma except settings fields patched through `/api/settings` (sources: named files).
