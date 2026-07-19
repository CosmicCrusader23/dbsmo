---
date: 2026-06-26
updated: 2026-07-19
type: risks
tags: [project, architecture, risks, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: f7e0c74
---

## For future Claude

This note captures fragile or confusing areas in [[dbsmo]]. Treat these as investigation leads before editing; the safety-sensitive sections were source-verified again on 2026-07-18.

## Admin Permission Layers

`proxy.ts` now uses `admin:view` as the broad staff gate, matching `TEACHER`, `CONTENT_EDITOR`, and `ANALYST` role mappings. It is intentionally not the authoritative permission check: every page and API must still require its exact permission. Private-profile bypass uses `admin:users`; hidden leaderboard analytics uses `admin:analytics` (sources: `proxy.ts`, `lib/permissions.ts`, `app/users/[username]/page.tsx`, `app/leaderboard/page.tsx`).

Role changes serialize under the `dbsmo-role-update` advisory lock and re-check the actor in the transaction. Preserve both the self-demotion denial and transactional current-role check; an outer session check alone is vulnerable to concurrent cross-demotion (source: `app/api/admin/users/[id]/role/route.ts`).

## Group Visibility Exists in Schema But Not Helper

`ProblemSet.allowedGroups` and `User.group` exist, but `isVisibleToStudent(...)` intentionally checks only publication status and the visible window. The classes/assignments design explicitly leaves group visibility dormant. Do not silently enforce `allowedGroups`; that is a product-policy change requiring an explicit decision and a full caller audit (sources: `prisma/schema.prisma`, `lib/visibility.ts`, `docs/superpowers/specs/2026-05-28-classes-and-assignments-design.md`).

## Schema Deployment Uses `db push`

`SETUP.md` documents `prisma db push`, not migrations, for VPS deployment. Migration files exist in `prisma/migrations/`, but the deploy runbook says `db push` is the live flow. Be careful with destructive schema changes; `db push` can prompt on destructive changes and is not the same as a committed migration workflow (sources: `SETUP.md`, `prisma/migrations/`).

## Storage Driver Has S3 Path But Needs Full Env

`lib/storage.ts` supports `STORAGE_DRIVER=s3`, but S3 mode requires `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optional `S3_REGION`. File serving and backup export share `readFileBufferBounded(...)`, which enforces actual streamed-byte limits for local and S3 objects. Keep the environment documentation and both read paths aligned (sources: `lib/storage.ts`, `lib/admin-exports.ts`, `SETUP.md`).

## Image Import Keys Are Derived From Filenames

Optional image ZIP imports derive asset keys from image filenames by lowercasing the basename and replacing unsafe characters. Files like `Geom Number 1.png` and `geom-number-1.webp` can collide after normalization; duplicates are rejected. Problem-level JSON refs such as `imageRef: "geomnumber1.png"` are converted the same way and must match a supplied inline/ZIP/manual image asset (sources: `lib/import/image-assets.ts`, `lib/import/image-zip.ts`, `lib/import/json-import.ts`).

## Full-Set Perfect Score Locks Further Attempts

`POST /api/submit` blocks new attempts if any previous attempt has `score === maxScore`; the check and next attempt number are computed inside a serializable transaction with bounded retries. `ProblemSetPage` passes the locked attempt ID/number to `AnswerGrid` so the student can still review that saved submission. The locked UI must still render problem statements/PDF context and only remove answer entry/submission controls. Any change to attempt/retake semantics needs to update both server logic and UI messaging (sources: `app/api/submit/route.ts`, `lib/submission.ts`, `app/problem-sets/[slug]/page.tsx`, `app/problem-sets/[slug]/answer-grid.tsx`).

## Attempt Reviews Expose Answer Keys

`/attempts/[id]` intentionally shows accepted answers and explanations after submission. Its database join therefore handles assessment-sensitive data. Preserve both checks in `app/attempts/[id]/page.tsx`: ordinary users must own the `Attempt`, and non-owners must have `admin:analytics`. Keep unauthorized IDs on the same `notFound()` path as missing IDs, and do not move answer keys into a client API without an equivalent exact authorization boundary (sources: `app/attempts/[id]/page.tsx`, `lib/permissions.ts`, [[Attempt Review]]).

Writeups intentionally remain accessible even when submissions are locked or the user has not submitted. Do not reuse submission-lock logic to hide `/problem-sets/[slug]/writeups`; only normal auth and set visibility should gate that page (sources: `app/problem-sets/[slug]/writeups/page.tsx`, `app/api/problem-sets/[id]/writeups/route.ts`).

Writeup deletion is allowed only for the author or an admin. After the writeup relation is removed, `cleanupUnreferencedImportedFiles(...)` deletes unreferenced metadata before best-effort storage cleanup, avoiding live metadata that points at a missing object. Process crashes/storage outages can still leave physical orphans, so an offline sweeper remains useful (sources: `app/api/writeups/[id]/route.ts`, `lib/imported-file-cleanup.ts`).

## Practice Completion Counts Only Correct Answers

Practice mode records `PracticeSolve` only for correct answers and has a unique `(userId, problemId)` constraint. Duplicate correct submissions are silently treated as already counted; incorrect attempts are not persisted. This affects analytics expectations for practice mode (sources: `app/api/practice/submit/route.ts`, `prisma/schema.prisma`).

## Assignment Completion Ignores Score

`buildCompletionMap(...)` and `/api/assignments/mine` mark assignment completion by the first attempt after assignment creation, not by passing threshold or perfect score. This is intended as "attempted/completed once", but it is easy to misread as "solved". The student endpoint is capped at 500 ordered assignments and reports `truncated` if the pathological cap is reached (sources: `lib/classes.ts`, `app/api/admin/classes/[id]/route.ts`, `app/api/assignments/mine/route.ts`).

## Export Jobs Are Not Background Jobs

`POST /api/admin/export-jobs` creates a reserved `RUNNING` job, builds a paginated/capped CSV or backup payload synchronously inside the request, then marks it completed or failed. Per-user cooldown and payload caps prevent unbounded duplicate work, but there is still no queue/worker. Export download GETs reject cross-site browser requests; preserve that Fetch Metadata/Origin boundary when adding another expensive or stateful GET (sources: `app/api/admin/export-jobs/route.ts`, `lib/admin-export-safety.ts`, `lib/admin-exports.ts`, `lib/http-body.ts`).

## Large Files and Avatar Data URLs

PDF upload limit is 25 MB (`lib/uploaded-pdf.ts`), legacy problem-set ZIP import is 50 MB compressed with 50 MB per referenced file/100 MB referenced total actual expansion (`lib/import/zip-dry-run.ts`, `lib/import/zip-entry.ts`), JSON import is hard-capped at 5 MB, and image ZIP is capped by compressed and actual expanded bytes (`lib/import/image-zip.ts`). The browser batch wrapper is capped at 120 MB compressed, 250 entries/100 JSON files, and 110 MB total extracted, with 5 MB JSON/100 MB nested-ZIP child limits (`app/admin/import/json-zip-import-panel.tsx`, `lib/import/client-zip-entry.ts`). Image assets are 4 MB each/50 max with a 100 MB aggregate cap (`lib/import/image-assets.ts`), writeup images are 5 MB each and max 4 per post (`lib/writeup-images.ts`), and profile avatar URL/data URL max is 700,000 characters while UI says under 512 KB. API raw bodies are bounded while streaming; preserve transport, archive-expansion, decoded-content, record-count, and output limits together (sources: named files, `lib/http-body.ts`, `app/api/settings/route.ts`).

## KaTeX Is Not a TeX Compiler

`LatexStatement` renders math with KaTeX and a bounded compatibility pass; it does not execute arbitrary `\usepackage` declarations or compile full documents. `lib/latex-compat.ts` converts supported table/document forms, including optional table position arguments, but true `\multicolumn` spanning and arbitrary package features remain unavailable. MathLive's editor commands, Compute Engine semantics, TeX programming primitives, and HTML-affecting commands must not be copied wholesale into the renderer; only deterministic aliases to known KaTeX primitives are appropriate. Keep the escape-aware tokenizer, `trust: false`, `globalGroup: false`, per-expression macro cloning, `maxSize`, and `maxExpand` protections when expanding support, because statements and writeups are user-controlled. Do not render source HTML directly: HTML-format imports are intentionally reduced to math delimiters plus React-escaped text (sources: `app/problem-sets/[slug]/latex-statement.tsx`, `lib/latex-compat.ts`, `tests/latex-statement.test.ts`, `docs/latex-support.md`).

## Route Handlers Often Duplicate Auth Checks

Middleware is not the only authorization layer. Route handlers independently load session/current user and check exact role/permission/visibility. They also use `readJsonBody(...)` or `readFormDataBody(...)` rather than unbounded `request.json()`/`request.formData()`. When changing auth or body semantics, search all callers and route handlers rather than editing only `proxy.ts`, `lib/auth.ts`, or one endpoint (sources: `lib/http-body.ts`, `app/api/submit/route.ts`, `app/api/admin/sets/[id]/route.ts`, `app/api/files/[id]/route.ts`).

## Generated and External Files

Do not edit `.next/`, `node_modules/`, `.codegraph/`, `generated/`, `dist/`, or `out` during normal work. `AGENTS.md` explicitly says to ignore generated folders unless needed; CodeGraph data itself is in `.codegraph/` and should be treated as navigation aid, not source (sources: `AGENTS.md`, repo structure).

## Experimental CSS Shape Support

The final visual-system blocks in `app/globals.css` use `corner-shape` across shared surfaces and guarded `border-shape: shape(...)` only on bounded empty states and the landing orbit. These APIs are not uniformly supported, so functional boxes must keep their asymmetric ordinary-border/radius fallback. Do not add `border-image` to rounded functional surfaces: it does not clip consistently to squircles and previously produced a second rigid grey rectangle around controls in both themes. Never put a percentage-based shape path on a variable-height panel: production exposed a 7,000 px problem panel where a 1-2% Y offset became a 70-140 px diagonal wedge. Do not move layout, hit targets, or required content into a shape-dependent clipped region. Keep dark structural border tokens quieter than text and interactive-state colors, and do not restore global wavy eyebrow/title underlines. Shantell Sans is intentionally limited to display/control text; broadening it to body copy or math hurts legibility (sources: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `docs/visual-system.md`).

## Original Architecture Scan Was Dirty

The deterministic architect scan reported commit `f7e0c74` and `dirty: true`. The safety-sensitive paths were rechecked with CodeGraph and source inspection on 2026-07-18, but a later agent must still inspect `git status` and current files before editing (source: `DBSMO/.codex/scripts/architect_scan.py` output on 2026-06-26).
