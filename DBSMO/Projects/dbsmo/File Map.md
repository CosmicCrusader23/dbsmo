---
date: 2026-06-26
updated: 2026-06-28
type: file-map
tags: [project, architecture, file-map, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: f7e0c74
---

## For future Claude

This is a folder/file guide for [[dbsmo]], verified with CodeGraph and `rg --files` on 2026-06-26. Use this before broad searching; generated folders such as `.next`, `generated`, `node_modules`, and `.codegraph` are intentionally not described as source.

## Root Files

- `package.json` - scripts and dependency manifest. Important scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:seed`, `convert:amc-aime` (source: `package.json`).
- `README.md` - short product description and links to docs (source: `README.md`).
- `SETUP.md` - VPS deployment runbook using npm, PM2, nginx, PostgreSQL, `prisma generate`, and `prisma db push` (source: `SETUP.md`).
- `AGENTS.md` - repo-level AI instructions, including CodeGraph-first navigation and checkpoint policy (source: `AGENTS.md`).
- `CENTRAL.md` - cross-session orientation doc that should be kept current when work changes in-flight status (source: `CENTRAL.md`).
- `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `tsconfig.json`, `prisma.config.ts` - framework/tool configuration (sources: named files).
- `proxy.ts` - NextAuth middleware/proxy protection for admin/dashboard/problem-set paths (source: `proxy.ts`).

## `app/` Routes and UI

- `app/layout.tsx`, `app/anime-route-effects.tsx` - root layout, Inter font, KaTeX CSS, theme bootstrap script, sidebar shell, mobile nav toggle, route-level Anime.js reveal effects, and global body wrapper (sources: named files).
- `app/globals.css` - dominant styling for app shells and components (source: `app/globals.css`).
- `app/page.tsx`, `app/login/page.tsx`, `app/dashboard/page.tsx` - landing/login/dashboard surfaces (sources: named files).
- `app/site-sidebar.tsx`, `app/site-sidebar-nav.tsx`, `app/global-mobile-nav.tsx` - authenticated sidebar links and mobile nav behavior (sources: named files).
- `app/auth-button.tsx`, `app/avatar.tsx`, `app/theme-toggle.tsx`, `app/typewriter-greeting.tsx` - shared app UI atoms/widgets (sources: named files).
- `app/problem-sets/` - catalog, problem-set detail page, answering grid, bookmarking, writeups, LaTeX/HTML statement rendering (sources: `app/problem-sets/page.tsx`, `app/problem-sets/[slug]/page.tsx`, `app/problem-sets/[slug]/answer-grid.tsx`, `app/problem-sets/[slug]/latex-statement.tsx`, `app/problem-sets/[slug]/bookmark-button.tsx`, `app/problem-sets/[slug]/writeups/page.tsx`).
- `app/writeups/page.tsx` - global writeups directory with latest/top tabs and problem-set search (source: route file).
- `app/practice/page.tsx` - practice-mode client surface backed by `/api/practice/*` (source: `app/practice/page.tsx`).
- `app/classes/page.tsx` and `app/classes/announcement-composer.tsx` - student-facing classes route plus teacher/admin class-announcement composer (sources: named files).
- `app/users/`, `app/leaderboard/page.tsx`, `app/settings/page.tsx` - public/user profile, friends, promotion UI, leaderboard, and account settings (sources: named files).
- `app/ftw/` - solo and multiplayer FTW pages and clients (sources: `app/ftw/page.tsx`, `app/ftw/lobby-form.tsx`, `app/ftw/match/[id]/match-client.tsx`, `app/ftw/room/[code]/room-client.tsx`).
- `app/playground/` - boss-battle playground pages and client battle UI (sources: `app/playground/page.tsx`, `app/playground/hub.tsx`, `app/playground/[slug]/page.tsx`, `app/playground/[slug]/battle.tsx`).
- `app/admin/` - admin/staff surfaces for analytics, audit, classes, content creation, feedback, import, set management, and students (sources: `app/admin/**`).

## `app/api/` Route Handlers

- `app/api/auth/[...nextauth]/route.ts` - NextAuth route entry (source: route file).
- `app/api/submit/route.ts`, `app/api/submit/report/route.ts` - full problem-set submission and student feedback report creation (sources: named files).
- `app/api/practice/*` - practice tags, next problem, and answer submission (sources: `app/api/practice/tags/route.ts`, `app/api/practice/next/route.ts`, `app/api/practice/submit/route.ts`).
- `app/api/problem-sets/[id]/bookmark/route.ts` - bookmark create/delete for current user (source: route file).
- `app/api/problem-sets/[id]/writeups/route.ts`, `app/api/writeups/[id]/vote/route.ts`, and `app/api/writeups/[id]/route.ts` - writeup creation, voting, and author/admin deletion for visible problem sets (sources: route files).
- `app/api/files/[id]/route.ts` - authenticated file streaming with related-set visibility checks and CSP headers (source: route file).
- `app/api/settings/route.ts` - profile settings read/update, display name/avatar/privacy/theme/greeting settings (source: route file).
- `app/api/friends/[userId]/route.ts` - friend toggle endpoint used by profile UI (source: route file).
- `app/api/assignments/mine/route.ts` - current student's assignments for dashboard widget (source: route file).
- `app/api/admin/announcements/route.ts` - teacher/admin creation endpoint for class-targeted announcements (source: route file).
- `app/api/admin/**` - admin/staff APIs for backup, classes, content, imports, exports, feedback, role changes, and set editing/regrading/export (sources: `app/api/admin/**`).
- `app/api/ftw/**` - FTW solo matches and room lifecycle/state/submit endpoints (sources: `app/api/ftw/**`).

## `lib/` Domain Modules

- `lib/db.ts` - shared Prisma Client with Prisma PG adapter (source: `lib/db.ts`).
- `lib/auth.ts`, `lib/auth-server.ts` - NextAuth configuration and server helpers (sources: named files).
- `lib/permissions.ts` - role-to-permission mapping and `hasPermission` helper (source: `lib/permissions.ts`).
- `lib/grading.ts`, `lib/math-input.ts` - deterministic answer normalization and grading engine plus math-input helpers for stripping delimiters, converting common LaTeX forms, and rendering practice answer previews (sources: named files).
- `lib/visibility.ts` - student visibility/status helpers for problem sets (source: `lib/visibility.ts`).
- `lib/problem-tags.ts`, `lib/problem-content-format.ts`, `lib/problem-set-order.ts`, `lib/problem-set-authoring.ts` - problem metadata normalization, ordering, and authoring validation (sources: named files).
- `lib/import/` - JSON/ZIP import validation, manifest and answer schemas, image asset handling, optional image ZIP parsing, ZIP path safety, JSON draft storage, image asset persistence, and JSON export conversion (sources: `lib/import/**`).
- `lib/storage.ts`, `lib/uploaded-pdf.ts`, `lib/writeup-images.ts` - local/S3 storage, uploaded PDF handling, and validated writeup image storage (sources: named files).
- `lib/analytics.ts`, `lib/admin-exports.ts`, `lib/audit.ts` - analytics computations, export builders, and audit log writes (sources: named files).
- `lib/classes.ts` - class name validation and assignment completion mapping (source: `lib/classes.ts`).
- `lib/ftw.ts`, `lib/ftw-room.ts`, `lib/ftw-room-host.ts`, `lib/ftw-room-server.ts` - FTW scoring, room scoring, host transition, and room progression (sources: named files).
- `lib/playground/bosses.ts` plus images in `lib/playground/` - static boss battle content/assets (source: `lib/playground/*`).
- `lib/user-profile.ts`, `lib/avatar.ts`, `lib/prisma-errors.ts` - small shared helpers (sources: named files).

## `prisma/`

- `prisma/schema.prisma` - database schema for users, auth tables, friendships, problem sets/problems, attempts/responses, feedback, files/assets, writeups/votes, audit logs, export jobs, FTW solo/rooms, and classes/assignments/announcements.
- `prisma/seed.ts` - demo admin/student/problem set/feedback seeding via Prisma Client and Prisma PG adapter.
- `prisma/migrations/` - existing SQL migration files, but deployment docs currently instruct `prisma db push` rather than `prisma migrate deploy` (sources: `prisma/migrations/*`, `SETUP.md`).

## `docs/`

- `docs/import-format.md` - JSON import format, answer types, statement formats, practice tag behavior, and image asset rules.
- `docs/grading.md` - human-readable grading rules and regrading expectations.
- `docs/permissions.md` - permission strings and role mapping, with `lib/permissions.ts` named as source of truth.
- `docs/admin-guide.md`, `docs/student-guide.md`, `docs/deployment.md` - user/admin/deployment guides.
- `docs/superpowers/` - planning/spec notes for classes and assignments.

## `tests/`

- TypeScript/Vitest tests: grading, imports, storage, problem-set order/tags, visibility, classes, FTW scoring/host, ZIP dry-run, JSON import (sources: `tests/*.test.ts`).
- Python browser harness tests: `tests/browser_*.py`, `tests/browser_harness_smoke.py`; CI compiles and runs browser harness smoke through Chrome (source: `.github/workflows/ci.yml`).

## `scripts/`

- `scripts/convert-amc-aime-to-json.mjs` - converts AMC/AIME scraped text files into JSON import payloads plus a conversion report (source: script file).

## Data/Asset Directories

- `public/` - public logo assets. `dbsmo-mark.svg` is the simplified Sigma favicon/landing mark; `logo.png` and `proposedlogo.png` are retained legacy assets.
- `storage/` - local file storage root for imported PDFs/assets in development/default local mode (sources: `lib/storage.ts`, `storage/imports/*`).
- `examples/` - example ZIP-style import package with manifest, answers, problems PDF, and solution PDF (sources: `examples/mo-set-001/*`).

## Ignore/Generated Areas

- `.next/`, `node_modules/`, `generated/`, `.codegraph/`, `dist/`, `out/` are generated or external and should not be edited for normal app work (source: repo structure and `AGENTS.md` ignore guidance).
