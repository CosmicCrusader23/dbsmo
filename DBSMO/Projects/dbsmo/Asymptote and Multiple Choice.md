---
date: 2026-08-04
updated: 2026-08-04
type: feature-architecture
tags: [project, architecture, authoring, security, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
---

## Purpose

This note covers two related authoring additions: server-rendered Asymptote diagrams and variable-length multiple-choice questions. They meet in the existing problem image pipeline, because generated diagrams and choice images both become keyed `ProblemSetAsset` records referenced with `[[img:key]]` (sources: `lib/asymptote.ts`, `lib/import/image-assets.ts`, `prisma/schema.prisma`). See [[Architecture]], [[Data and Storage]], and [[Risks and Pitfalls]] for surrounding boundaries.

## Asymptote Flow

Staff enter source in the shared control at `app/admin/problem-authoring-controls.tsx` or place complete `<asy>...</asy>` blocks in JSON statements. `app/api/admin/asymptote/render/route.ts` provides authorized manual preview; create/edit routes and `lib/import/json-import.ts` also compile any still-embedded blocks server-side so clients cannot bypass conversion. `renderEmbeddedAsymptoteStatements(...)` deduplicates source by SHA-256-derived key, returns validated PNG assets, and rewrites each block to `[[img:asy-...]]` (sources: `lib/asymptote.ts`, `app/api/admin/create-set/route.ts`, `app/api/admin/sets/[id]/route.ts`).

Production Linux launches `/usr/bin/asy` through `prlimit` and bubblewrap. The sandbox unshares network/process namespaces, exposes only read-only runtime/TeX/font trees, gives the compiler one disposable writable work directory, and combines Asymptote `-safe` with CPU/address-space/file/process/descriptor/wall/workspace limits. Output must be one valid PNG within 4 MB, 4096 px per side, and 16 million pixels. `ASYMPTOTE_ENABLED=true` is an explicit opt-in after host dependencies are installed; otherwise the route fails closed. macOS `sandbox-exec` support is only a local-development convenience, not a production boundary (sources: `lib/asymptote.ts`, `SETUP.md`, `docs/asymptote.md`).

Uncertainty: Linux bubblewrap behavior is covered by command construction, tests, and the deploy verification recipe, but the 2026-08-04 local live render ran on macOS because that was the available host. Production must run the documented PM2-user smoke test before enabling the feature (source: `SETUP.md`).

## Multiple-Choice Flow

`AnswerType.MULTIPLE_CHOICE` and `Problem.options String[]` are persisted in `prisma/schema.prisma`. Authoring validation requires two to 20 non-empty unique options and an `answerKey` equal to one option. The GUI permits adding/removing options, selecting the correct radio, rendering LaTeX, and attaching an image to any option. Standard sets, compact Tests cells, and Practice all render radios instead of free-response fields (sources: `lib/problem-set-authoring.ts`, `app/admin/problem-authoring-controls.tsx`, `app/problem-sets/[slug]/answer-grid.tsx`, `app/practice/page.tsx`).

JSON accepts string options or `{ "text": "...", "imageRef": "file.png" }` objects. `correctOption` is a 1-based index and is preferred when an image token would make a literal answer key awkward. Image files use the same top-level inline asset or same-name companion ZIP rules as statement images. Export emits `options` plus `correctOption`; backup export retains raw options (sources: `lib/import/json-import.ts`, `lib/import/problem-set-json-export.ts`, `lib/admin-exports.ts`, `docs/import-format.md`).

Grading compares the exact case-sensitive stored option. The browser submits the stored option string, while server grading remains authoritative. `MULTIPLE` remains the older free-response mode for alternate accepted answers and must not be conflated with `MULTIPLE_CHOICE` (sources: `lib/grading.ts`, `docs/grading.md`).

## Change Checklist

- Schema/migration: `prisma/schema.prisma`, `prisma/migrations/20260804090000_add_multiple_choice/migration.sql`.
- Authoring: `app/admin/problem-authoring-controls.tsx`, create/edit clients and API routes, `lib/problem-set-authoring.ts`.
- Import/export: `lib/import/json-import.ts`, `lib/import/json-draft-storage.ts`, `lib/import/problem-set-json-export.ts`, `lib/admin-exports.ts`.
- Student UI: `app/problem-sets/[slug]/answer-grid.tsx`, `app/practice/page.tsx`, Practice API routes.
- Grading callers: `lib/grading.ts`, Practice, FTW match, and FTW room answer-type maps.
- Security/deploy: `lib/asymptote.ts`, `app/api/admin/asymptote/render/route.ts`, `SETUP.md`, `docs/asymptote.md`.
- Verification: `tests/asymptote.test.ts`, `tests/problem-set-authoring.test.ts`, `tests/json-import.test.ts`, `tests/grading.test.ts`, then typecheck/lint/test/build.
