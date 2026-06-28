---
date: 2026-06-26
updated: 2026-06-28
type: architecture-overview
tags: [project, architecture, overview, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: f7e0c74
---

## For future Claude

This is the concise high-level summary for the [[dbsmo]] codebase, verified against source on 2026-06-26. It explains the product, stack, major surfaces, and where deeper notes live; use [[Architecture]], [[Entry Points]], and [[Data and Storage]] for implementation detail.

## What This Project Is

[[dbsmo]] is a self-paced mathematics olympiad training platform for DBS with answer-only problem sets, automatic grading, progress tracking, teaching videos, feedback reports, writeups, teacher/admin analytics, class assignments, imports/exports, and game-like practice modes (sources: `README.md`, `app/problem-sets/[slug]/page.tsx`, `app/problem-sets/[slug]/writeups/page.tsx`, `app/api/submit/route.ts`, `app/admin/analytics/page.tsx`, `app/admin/classes/[id]/class-detail-client.tsx`, `app/ftw/page.tsx`).

The app is implemented as a Next.js App Router application using React, TypeScript, NextAuth, Prisma, PostgreSQL, KaTeX, Zod, JSZip, csv-parse, and lucide-react (sources: `package.json`, `app/layout.tsx`, `lib/auth.ts`, `lib/db.ts`, `lib/import/zip-dry-run.ts`, `lib/grading.ts`).

## Primary User Types

- Student: signs in, views visible problem sets, submits answers, posts/reads set writeups, tracks attempts, uses practice mode, sees assignments, manages profile/privacy, and appears on leaderboard if enabled (sources: `app/dashboard/page.tsx`, `app/problem-sets/page.tsx`, `app/problem-sets/[slug]/answer-grid.tsx`, `app/problem-sets/[slug]/writeups/page.tsx`, `app/practice/page.tsx`, `app/settings/page.tsx`, `app/leaderboard/page.tsx`).
- Teacher/staff: manages classes and assignments if permissioned, sees student progress, and accesses staff views according to role permissions (sources: `lib/permissions.ts`, `app/admin/classes/page.tsx`, `app/api/admin/classes/[id]/route.ts`, `app/admin/students/page.tsx`).
- Admin/content staff: creates and edits problem sets, imports JSON/ZIP sets, exports data, handles feedback, views audit logs, and accesses all admin surfaces allowed by permissions (sources: `app/admin/create/page-client.tsx`, `app/admin/sets/[id]/set-edit-form.tsx`, `app/admin/import/page.tsx`, `app/api/admin/export-jobs/route.ts`, `app/admin/feedback/page.tsx`, `app/admin/audit/page.tsx`).

## Stack Snapshot

- Runtime/app: Next.js App Router with server components and route handlers (sources: `app/layout.tsx`, `app/api/**/route.ts`).
- Auth: NextAuth with Prisma adapter; Google provider when OAuth env vars exist; credentials provider for non-production dev bypass unless `AUTH_DEV_BYPASS=false` (source: `lib/auth.ts`).
- Database: PostgreSQL through Prisma Client and `@prisma/adapter-pg`; schema source of truth is `prisma/schema.prisma`; shared client is `lib/db.ts`.
- Validation: Zod schemas for import payloads, authoring forms, class routes, and API inputs (sources: `lib/import/json-import.ts`, `lib/import/manifest-schema.ts`, `lib/problem-set-authoring.ts`, `app/api/admin/classes/[id]/route.ts`).
- File storage: local filesystem by default under `./storage`, with an S3-compatible driver path in `lib/storage.ts`; file metadata is stored in Prisma `ImportedFile` records.
- Math rendering/grading: KaTeX is imported globally and by problem pages; grading is deterministic in `lib/grading.ts`; statement rendering is in `app/problem-sets/[slug]/latex-statement.tsx`.

## Major Product Areas

- Problem set catalog, answering, and writeups: `app/problem-sets/page.tsx`, `app/problem-sets/[slug]/page.tsx`, `app/problem-sets/[slug]/answer-grid.tsx`, `app/problem-sets/[slug]/writeups/page.tsx`, `app/problem-sets/[slug]/writeups/writeups-client.tsx`, `app/api/submit/route.ts`, `app/api/problem-sets/[id]/writeups/route.ts`, `app/api/writeups/[id]/vote/route.ts`.
- Practice mode: `app/practice/page.tsx`, `app/api/practice/tags/route.ts`, `app/api/practice/next/route.ts`, `app/api/practice/submit/route.ts`, `PracticeSolve` model in `prisma/schema.prisma`.
- Admin content authoring: `app/admin/create/page-client.tsx`, `app/admin/sets/[id]/set-edit-form.tsx`, `app/api/admin/create-set/route.ts`, `app/api/admin/sets/[id]/route.ts`, `lib/problem-set-authoring.ts`.
- Import/export: `app/admin/import/*`, `app/api/admin/import/*`, `lib/import/*`, `app/api/admin/export-jobs/route.ts`, `lib/admin-exports.ts`.
- Classes/assignments: `app/admin/classes/*`, `app/classes/page.tsx`, `app/dashboard/assignments-widget.tsx`, `app/api/admin/classes/*`, `app/api/assignments/mine/route.ts`, `lib/classes.ts`.
- Analytics/audit/feedback: `app/admin/analytics/*`, `lib/analytics.ts`, `app/admin/audit/*`, `lib/audit.ts`, `app/admin/feedback/*`, `app/api/submit/report/route.ts`.
- FTW and playground games: `app/ftw/*`, `app/api/ftw/*`, `lib/ftw.ts`, `lib/ftw-room.ts`, `lib/ftw-room-server.ts`, `lib/playground/bosses.ts`, `app/playground/*`.

## Read Next

- For how requests and data move through the app: [[Architecture]].
- For exact routes and commands: [[Entry Points]].
- For models and persisted state: [[Data and Storage]].
- For editing guidance: [[Common Tasks]].
