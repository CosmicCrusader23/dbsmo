---
date: 2026-06-26
updated: 2026-06-28
type: project-index
tags:
  - project
  - architecture
  - dbsmo
  - index
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: f7e0c74
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

## Fast Orientation

- [[dbsmo]] is a Next.js App Router app for DBS mathematics olympiad practice with problem sets, automatic answer grading, practice mode, class assignments, analytics, imports/exports, feedback, and FTW game modes (sources: `README.md`, `app/`, `lib/`, `prisma/schema.prisma`).
- The database is PostgreSQL via Prisma Client with the Prisma PG adapter; the shared client is exported from `lib/db.ts`, and the schema lives in `prisma/schema.prisma`.
- Authentication uses NextAuth with Google OAuth plus a non-production credentials bypass unless disabled; route protection starts in `proxy.ts` and continues in API/page-level checks (sources: `lib/auth.ts`, `proxy.ts`, `lib/permissions.ts`).
- Most business logic sits in `lib/`: grading, visibility, permissions, imports, storage, FTW scoring, classes, analytics, and exports.
- Main UI routes live under `app/`; API handlers live under `app/api/`.
- Current import notes include optional same-name image ZIPs for JSON imports, per-problem image uploads in the problem maker, and tolerant JSON editor drafts (sources: `lib/import/json-import.ts`, `lib/import/image-zip.ts`, `app/admin/create/page-client.tsx`).
- Current profile/community notes include authored tasks, a mastery heatmap, and problem-set writeups with image uploads, voting, deletion, and the `/writeups` directory page (sources: `app/users/[username]/page.tsx`, `app/problem-sets/[slug]/writeups/page.tsx`, `app/problem-sets/[slug]/writeups/writeups-client.tsx`, `app/writeups/page.tsx`, `prisma/schema.prisma`).

## Source Inspection Basis

This vault was built from:

- CodeGraph exploration of repo structure, routes, APIs, components, auth, imports, FTW, analytics, and data flow.
- Deterministic architecture scan via `DBSMO/.codex/scripts/architect_scan.py --path /Users/cosmic/Documents/funni/dbsmo`.
- Targeted reads of `package.json`, `README.md`, `prisma/schema.prisma`, `proxy.ts`, key `app/` routes/components, key `app/api/` handlers, and key `lib/` modules.

## Staleness Note

The original scan reported git commit `f7e0c74` with a dirty worktree. Treat the writeups/profile notes as source-verified as of 2026-06-28, but re-run CodeGraph or inspect source before editing behavior.
