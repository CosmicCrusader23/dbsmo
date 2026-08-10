---
date: 2026-06-26
updated: 2026-08-10
type: project-index
tags:
  - project
  - architecture
  - dbsmo
  - index
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: working-tree-2026-08-10
---

## For future Claude

This is the starting index for the [[dbsmo]] codebase knowledge base, generated from CodeGraph plus targeted source inspection on 2026-06-26. Use it to jump into the right focused note before reading source directly; source paths are included in the linked notes.

## Core Notes

- [[Overview]] - what the app is, its main users, stack, and product surface.
- [[Architecture]] - system design, request/data flow, module boundaries, and dependency map.
- [[Entry Points]] - app routes, API routes, scripts, CI, auth gate, and startup flow.
- [[Data and Storage]] - Prisma models, storage drivers, file serving, imports, grading, attempts, practice, classes, and FTW data.
- [[Components]] - key UI components and where they are rendered.
- [[File Map]] - folder/file guide for app, lib, Prisma, tests, docs, and storage.
- [[Common Tasks]] - where to edit for likely future changes.
- [[Risks and Pitfalls]] - fragile or confusing areas to avoid breaking.
- [[Glossary]] - project-specific terms and abbreviations.
- [[Attempt Review]] - saved submission review UI, authorization, data flow, and entry points.
- [[Submissions]] - per-set recent submission directory, friends/name filters, pagination, and answer privacy.
- [[Performance Analytics]] - shared Mastery Index, component metrics, validation, and change guidance.
- [[Asymptote and Multiple Choice]] - diagram sandbox, variable choices, image-backed options, authoring/import flow, and deploy constraints.

## Fast Orientation

- [[dbsmo]] is a Next.js App Router app for DBS mathematics olympiad practice with problem sets, automatic answer grading, practice mode, class assignments, analytics, imports/exports, feedback, and FTW game modes (sources: `README.md`, `app/`, `lib/`, `prisma/schema.prisma`).
- The database is PostgreSQL via Prisma Client with the Prisma PG adapter; the shared client is exported from `lib/db.ts`, and the schema lives in `prisma/schema.prisma`.
- Authentication uses NextAuth with exact-domain Google OAuth plus a credentials bypass that requires an explicit `AUTH_DEV_BYPASS=true` outside production. Route protection starts with the broad boundary in `proxy.ts` and continues with exact API/page permissions (sources: `lib/auth.ts`, `lib/auth-policy.ts`, `proxy.ts`, `lib/permissions.ts`).
- Most business logic sits in `lib/`: grading, visibility, permissions, imports, storage, FTW scoring, classes, analytics, and exports.
- Main UI routes live under `app/`; API handlers live under `app/api/`.
- Current import notes include optional same-name image ZIPs for JSON imports, per-problem image uploads in the problem maker, tolerant JSON editor drafts, and explicit all-file batch dry-run/publish/upload actions with compressed/actual-expanded archive limits (sources: `lib/import/json-import.ts`, `lib/import/image-zip.ts`, `lib/import/zip-dry-run.ts`, `app/admin/create/page-client.tsx`, `app/admin/import/json-zip-import-panel.tsx`).
- Current class/community notes include authored tasks, a mastery heatmap, problem-set writeups with image uploads/voting/deletion, and class announcements pinned on dashboards (sources: `app/users/[username]/page.tsx`, `app/problem-sets/[slug]/writeups/page.tsx`, `app/writeups/page.tsx`, `app/classes/announcement-composer.tsx`, `app/dashboard/page.tsx`, `prisma/schema.prisma`).
- Saved submissions have a perfect-solve/staff-gated [[Attempt Review]] plus a redacted per-set [[Submissions]] directory with 20-row pagination, friends/name filters, and score/verdict visibility (sources: `app/attempts/[id]/page.tsx`, `app/problem-sets/[slug]/submissions/page.tsx`, `app/problem-sets/[slug]/answer-grid.tsx`, `app/dashboard/page.tsx`).
- Cross-set student metrics use the shared evidence-aware [[Performance Analytics]] model; Mastery Index combines proficiency, breadth, and a consistency floor while keeping best-set average/mastery rate visible (sources: `lib/analytics.ts`, `app/leaderboard/page.tsx`).
- Authoring and imports support sandboxed Asymptote-to-PNG diagrams plus `MULTIPLE_CHOICE` problems with two to 20 LaTeX/image-capable choices; see [[Asymptote and Multiple Choice]] (sources: `lib/asymptote.ts`, `lib/problem-set-authoring.ts`, `lib/import/json-import.ts`, `app/admin/problem-authoring-controls.tsx`).
- The 2026-08-10 shared UI audit verified primary signed-in routes at desktop and 390 px mobile widths. Current responsive invariants include unframed Settings rows around labelled native controls, a cardified mobile Students table, a stable mobile menu toggle, and Anime.js v4 caret easing without deprecation warnings (sources: `app/settings/page.tsx`, `app/settings/sidebar-settings.tsx`, `app/typewriter-greeting.tsx`, `app/globals.css`, `tests/browser_harness_smoke.py`).

## Source Inspection Basis

This vault was built from:

- CodeGraph exploration of repo structure, routes, APIs, components, auth, imports, FTW, analytics, and data flow.
- Deterministic architecture scan via `DBSMO/.codex/scripts/architect_scan.py --path /Users/cosmic/Documents/funni/dbsmo`.
- Targeted reads of `package.json`, `README.md`, `prisma/schema.prisma`, `proxy.ts`, key `app/` routes/components, key `app/api/` handlers, and key `lib/` modules.

## Staleness Note

The original scan reported git commit `f7e0c74` with a dirty worktree. Auth, API bounds, imports/storage, submissions, exports, profiles, and FTW concurrency were source-verified again on 2026-07-18. Shared route structure, Settings/sidebar behavior, responsive Students layout, and the global shell were source-verified on 2026-08-10 using CodeGraph, direct inspection, and production browser smoke tests; still verify current source before editing behavior.
