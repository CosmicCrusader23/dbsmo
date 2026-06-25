---
date: 2026-06-26
updated: 2026-06-26
type: risks
tags: [project, architecture, risks, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: f7e0c74
---

## For future Claude
This note captures fragile or confusing areas in [[dbsmo]] discovered while mapping the codebase on 2026-06-26. Treat these as investigation leads before editing; verify in source because the worktree was dirty at scan time.

## Admin Permission Mismatch

`proxy.ts` redirects any non-`ADMIN` user away from `/admin`, but `lib/permissions.ts` grants admin-style permissions to `TEACHER`, `CONTENT_EDITOR`, and `ANALYST`. Admin pages/APIs use `hasPermission(...)`, but middleware may prevent those roles from reaching `/admin` pages at all. This is a high-impact behavior mismatch if staff roles are meant to use admin surfaces (sources: `proxy.ts`, `lib/permissions.ts`, `app/site-sidebar.tsx`).

## Group Visibility Exists in Schema But Not Helper

`ProblemSet.allowedGroups` and `User.group` exist, and `getUserGroups(...)` exists in `lib/auth-server.ts`, but the inspected `isVisibleToStudent(...)` checks only status and visible window. If future work assumes group restrictions are enforced, verify or implement them explicitly (sources: `prisma/schema.prisma`, `lib/visibility.ts`, `lib/auth-server.ts`).

## Schema Deployment Uses `db push`

`SETUP.md` documents `prisma db push`, not migrations, for VPS deployment. Migration files exist in `prisma/migrations/`, but the deploy runbook says `db push` is the live flow. Be careful with destructive schema changes; `db push` can prompt on destructive changes and is not the same as a committed migration workflow (sources: `SETUP.md`, `prisma/migrations/`).

## Storage Driver Has S3 Path But Needs Full Env

`lib/storage.ts` supports `STORAGE_DRIVER=s3`, but S3 mode requires `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optional `S3_REGION`. Existing setup docs only show local/default storage in the inspected section. If enabling S3, update `SETUP.md` and verify backup/file-serving behavior (sources: `lib/storage.ts`, `SETUP.md`).

## Imported Image Schema Error Message Mentions SVG

`lib/import/image-assets.ts` allows png/jpeg/gif/webp and rejects SVG by omission, but the Zod message says "png/jpeg/gif/webp/svg+xml." That message conflicts with the supported MIME set and `docs/import-format.md`, which says SVG is not accepted (sources: `lib/import/image-assets.ts`, `docs/import-format.md`).

## Settings File Contains Suspicious Literal `2`

`app/settings/page.tsx` has a visible stray `2` immediately after a closing `</div>` in the typewriter settings area in the inspected source. It may be intentional text, a typo, or a rendering bug; verify before modifying settings UI (source: `app/settings/page.tsx`).

## Full-Set Perfect Score Locks Further Attempts

`POST /api/submit` blocks new attempts if any previous attempt has `score === maxScore`; `ProblemSetPage` passes `lockedAttemptNumber` to `AnswerGrid`. Any change to attempt/retake semantics needs to update both server logic and UI messaging (sources: `app/api/submit/route.ts`, `app/problem-sets/[slug]/page.tsx`, `app/problem-sets/[slug]/answer-grid.tsx`).

## Practice Completion Counts Only Correct Answers

Practice mode records `PracticeSolve` only for correct answers and has a unique `(userId, problemId)` constraint. Duplicate correct submissions are silently treated as already counted; incorrect attempts are not persisted. This affects analytics expectations for practice mode (sources: `app/api/practice/submit/route.ts`, `prisma/schema.prisma`).

## Assignment Completion Ignores Score

`buildCompletionMap(...)` marks assignment completion by the first attempt after assignment creation, not by passing threshold or perfect score. This is probably intended as "attempted/completed once", but it is easy to misread as "solved" (sources: `lib/classes.ts`, `app/api/admin/classes/[id]/route.ts`).

## Export Jobs Are Not Background Jobs

`POST /api/admin/export-jobs` creates a `RUNNING` job, builds the CSV/backup payload synchronously inside the request, then marks it completed or failed. Do not assume queue/worker semantics unless you add them (source: `app/api/admin/export-jobs/route.ts`).

## Large Files and Avatar Data URLs

PDF upload limit is 25 MB (`lib/uploaded-pdf.ts`), ZIP import limit is 50 MB (`lib/import/zip-dry-run.ts`), JSON import limit is 5 MB per docs/source path, image assets are 4 MB each/50 max (`lib/import/image-assets.ts`), and profile avatar URL/data URL max is 700,000 characters while UI says under 512 KB (sources: named files, `docs/import-format.md`, `app/api/settings/route.ts`, `app/settings/page.tsx`).

## Route Handlers Often Duplicate Auth Checks

Middleware is not the only authorization layer. Many route handlers independently load session/current user and check role/permissions/visibility. When changing auth semantics, search callers and route handlers rather than editing only `proxy.ts` or `lib/auth.ts` (sources: `app/api/submit/route.ts`, `app/api/admin/sets/[id]/route.ts`, `app/api/files/[id]/route.ts`, `app/api/admin/classes/[id]/route.ts`).

## Generated and External Files

Do not edit `.next/`, `node_modules/`, `.codegraph/`, `generated/`, `dist/`, or `out` during normal work. `AGENTS.md` explicitly says to ignore generated folders unless needed; CodeGraph data itself is in `.codegraph/` and should be treated as navigation aid, not source (sources: `AGENTS.md`, repo structure).

## Worktree Was Dirty at Scan Time

The deterministic architect scan reported commit `f7e0c74` and `dirty: true`. These notes are source-verified as of the scan, but a later agent must inspect `git status` and current files before editing (source: `DBSMO/.codex/scripts/architect_scan.py` output on 2026-06-26).
