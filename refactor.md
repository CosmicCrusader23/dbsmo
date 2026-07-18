# Safety and Refactor Progress

## Goals

- Fix exploitable or incorrect behavior without changing the UI, feature set, or database schema.
- Put hard bounds around untrusted input, archive expansion, storage reads, exports, and expensive queries.
- Make authorization, concurrency, and storage ownership rules explicit and reusable.
- Preserve current behavior with focused regression tests plus the full project checks.

## Completed Work

- [x] Navigated the live repository with CodeGraph and reconciled it with the Obsidian project notes before editing.
- [x] Replaced unbounded API JSON and multipart parsing with streamed, route-specific body limits and schemas.
- [x] Hardened Google-domain auth, made the developer bypass explicit and non-production-only, and invalidated sessions for deleted users.
- [x] Aligned staff routing, page access, API permissions, private-profile visibility, leaderboard visibility, and file access with the documented permission model.
- [x] Serialized submissions, friendships, problem-set mutations, regrades, FTW matches, and FTW room transitions where concurrent requests could violate invariants.
- [x] Made integer, decimal, and fraction grading precision-safe for large values while preserving accepted decimal spellings and tolerance behavior.
- [x] Added cryptographically generated FTW room codes with bounded lengths.
- [x] Staged uploaded/imported objects under collision-resistant keys, attached metadata transactionally, and added compensating cleanup for failed or replaced writes.
- [x] Enforced local/S3 storage configuration, traversal protection, bounded streaming reads, stored-size/checksum verification, safe download MIME/header handling, and orphan-file denial.
- [x] Bounded JSON/image/legacy/browser-batch ZIP import by compressed bytes, actual expanded bytes, entry counts, record sizes, decoded asset totals, and schema field lengths; archive text decoding is strict UTF-8 and browser extraction is sequential.
- [x] Paginated and capped CSV/backup exports and restores, escaped spreadsheet formulas, rate-limited synchronous export jobs, and rejected cross-site browser export requests.
- [x] Replaced several unbounded application-side scans with bounded SQL aggregation/count/skip queries while preserving ordering and response shape used by the UI.
- [x] Removed infrastructure-error disclosure from public API responses while retaining server-side logging.
- [x] Pinned floating dependencies, upgraded the framework to its patched release, added response security headers, and documented production environment/proxy limits.
- [x] Updated `CENTRAL.md`, `SETUP.md`, deployment/permission docs, and the Obsidian project brain with the verified architecture and remaining operational caveats.

## Verification

- [x] `npm run typecheck` passes.
- [x] `npm run lint` passes with no warnings.
- [x] `npm test -- --run` passes: 29 files, 195 tests.
- [x] `npm run build` passes with Next.js 16.2.10.
- [x] `npm audit` and `npm audit --omit=dev` report zero vulnerabilities.
- [x] `git diff --check` passes.
- [x] No Prisma schema, stylesheet, layout, or visual-system files were changed by this safety pass; the batch import client retains the same UI and workflow.

## Remaining Operational Follow-ups

- A periodic orphan-object sweeper would cover process crashes or storage outages that occur between metadata and best-effort compensation.
- FTW room realtime remains polling-based; move to SSE/WebSockets only if classroom-scale polling becomes material.
