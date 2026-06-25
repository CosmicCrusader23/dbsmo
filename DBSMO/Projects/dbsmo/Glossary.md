---
date: 2026-06-26
updated: 2026-06-26
type: glossary
tags: [project, glossary, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: f7e0c74
---

## For future Claude
This is the [[dbsmo]] glossary. Terms are source-grounded from code/docs inspected on 2026-06-26; use it to resolve naming before editing routes, models, or UI.

## Terms

- `DBSMO` / [[dbsmo]] - DBS mathematics olympiad training platform (sources: `README.md`, `app/layout.tsx` metadata).
- `ProblemSet` - a collection of ordered answer-only problems with slug/title/status/visibility/tags/files/video/assets/assignments (source: `prisma/schema.prisma`).
- `Problem` - a question within a `ProblemSet`, with statement, answer key/type, accepted answers, tags, points, and optional explanation (source: `prisma/schema.prisma`).
- `Attempt` - one full submission of a problem set by a user, with score/max score/attempt number/duration (source: `prisma/schema.prisma`, `app/api/submit/route.ts`).
- `Response` - one graded answer within an `Attempt`, storing raw answer, normalized answer, correctness, and points (source: `prisma/schema.prisma`).
- `PracticeSolve` - durable record that a user correctly solved a practice problem; unique per user/problem (source: `prisma/schema.prisma`, `app/api/practice/submit/route.ts`).
- `AnswerType` - persisted answer classification: `EXACT`, `INTEGER`, `DECIMAL`, `FRACTION`, `SET`, `MULTIPLE`, `EXPRESSION` (source: `prisma/schema.prisma`).
- `gradeAnswer` - central deterministic grading function in `lib/grading.ts`.
- `contentFormat` / `ProblemContentFormat` - statement rendering mode: `LATEX` or `HTML` (sources: `prisma/schema.prisma`, `lib/problem-content-format.ts`).
- `LatexStatement` - UI renderer for problem statements/explanations and asset tokens (source: `app/problem-sets/[slug]/latex-statement.tsx`).
- `topicTags` - tags on problem sets and problems. Set-level tags categorize catalog; per-problem tags drive practice pools (sources: `docs/import-format.md`, `lib/problem-tags.ts`).
- `CANONICAL_TAGS` - standard tag list/aliases for category normalization (source: `lib/problem-tags.ts`).
- `visibleFrom` / `visibleTo` - optional release/expiry window for a problem set (sources: `prisma/schema.prisma`, `lib/visibility.ts`).
- `allowedGroups` - string-array field on `ProblemSet`; present in schema but not enforced by inspected `isVisibleToStudent(...)` (sources: `prisma/schema.prisma`, `lib/visibility.ts`).
- `ImportedFile` - database metadata for stored binary files such as PDFs/images; actual bytes live in local/S3 storage (sources: `prisma/schema.prisma`, `lib/storage.ts`).
- `ProblemSetAsset` - keyed inline image asset relation for problem set statements/solutions, referenced with `[[img:key]]` tokens (sources: `prisma/schema.prisma`, `lib/import/image-assets.ts`).
- `JSON import` - admin import path for complete problem set JSON payloads (sources: `lib/import/json-import.ts`, `docs/import-format.md`).
- `ZIP import` - admin import path with `manifest.yml`, `answers.csv`, PDF files, and validation/dry-run (sources: `lib/import/zip-dry-run.ts`, `lib/import/zip-import.ts`, `examples/mo-set-001/*`).
- `Import draft` - JSON import converted into editable create-set form draft (sources: `lib/import/json-draft-storage.ts`, `app/admin/create/page-client.tsx`).
- `FeedbackReport` - student/admin report about wrong answer key, solution, typo, unclear problem, or other issue (source: `prisma/schema.prisma`).
- `AuditLog` - admin action log written by `recordAuditLog(...)` (sources: `prisma/schema.prisma`, `lib/audit.ts`).
- `ExportJob` - stored export request/result for students CSV, attempts CSV, or backup JSON (sources: `prisma/schema.prisma`, `app/api/admin/export-jobs/route.ts`).
- `Class` - teacher-owned student grouping (source: `prisma/schema.prisma`).
- `ClassMember` - join table between class and student (source: `prisma/schema.prisma`).
- `Assignment` - class-to-problem-set assignment with optional due date (source: `prisma/schema.prisma`).
- `buildCompletionMap` - helper that marks assignment completion based on attempts after assignment creation (source: `lib/classes.ts`).
- `FTW` - game mode with solo matches and multiplayer rooms. Meaning is not expanded in inspected source; treat expansion as unknown/TBD (sources: `app/ftw/*`, `lib/ftw.ts`, `lib/ftw-room.ts`; confidence: high for feature, unknown for abbreviation expansion).
- `FtwMatch` / `FtwAnswer` - solo FTW state models (source: `prisma/schema.prisma`).
- `FtwRoom` / `FtwRoomPlayer` / `FtwRoomProblem` / `FtwRoomAnswer` - multiplayer FTW state models (source: `prisma/schema.prisma`).
- `roomScore` - multiplayer FTW scoring function with base and speed points (source: `lib/ftw-room.ts`).
- `scoreFromElapsed` - solo FTW scoring function based on elapsed time and correctness (source: `lib/ftw.ts`).
- `Developer Bypass` - non-production NextAuth credentials provider enabled unless `AUTH_DEV_BYPASS=false` (source: `lib/auth.ts`).
- `admin:content`, `admin:users`, `admin:analytics`, etc. - permission strings mapped from roles in `lib/permissions.ts`.
- `db push` - documented deployment schema update command (`npx prisma db push`) rather than migration deploy (source: `SETUP.md`).
- `CodeGraph` - repo navigation index under `.codegraph/`, used before broad search per `AGENTS.md`.
