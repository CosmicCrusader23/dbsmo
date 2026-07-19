---
date: 2026-07-19
updated: 2026-07-19
type: feature
tags: [project, architecture, attempts, grading, ui, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: 271402e
---

## Purpose

`/attempts/[id]` is the durable review for one submitted `Attempt`. Its information architecture follows a competitive-programming submission page: a compact identity/verdict header, score metrics, and dense per-question rows that expand into grading detail. It uses the shared DBSMO paper/ink visual system rather than copying another product's branding (source: `app/attempts/[id]/page.tsx`, `app/globals.css`).

## Authorization

- The current user can review an attempt when `Attempt.userId` matches their database user ID.
- Staff with `admin:analytics` can review another user's attempt. This currently covers Admin, Teacher, and Analyst according to `lib/permissions.ts`.
- Unknown and unauthorized attempt IDs both call `notFound()` so the route does not disclose whether another student's submission exists.
- `proxy.ts` includes `/attempts/:path*` as the broad signed-in boundary, but the page query remains authoritative (sources: `app/attempts/[id]/page.tsx`, `proxy.ts`, `lib/permissions.ts`).

## Data Display

The page loads `Attempt`, its `User`, `ProblemSet` assets/problem file, and `Response.problem` records. Rows are sorted by `Problem.number`. The summary shows verdict, score, percentage, correct count, skipped count, and duration. An expanded row shows:

- problem statement and `[[img:key]]` assets through `LatexStatement`;
- raw submitted answer and a normalized answer when grading changed its representation;
- deduplicated `Problem.answerKey` plus `Problem.acceptedAnswers` rendered with KaTeX;
- `Response.pointsAwarded` against `Problem.points`, `Response.graderNote`, topic tags, and `Problem.explanationNote`;
- links back to the set/question, the set's writeups, and the original problem file when present.

Sources: `app/attempts/[id]/page.tsx`, `lib/attempt-review.ts`, `app/problem-sets/[slug]/latex-statement.tsx`, `prisma/schema.prisma`.

## Entry Points

- Immediate submit result and solved-set lock: `app/problem-sets/[slug]/answer-grid.tsx`.
- Five most recent attempts on a set: `app/problem-sets/[slug]/page.tsx`.
- Student dashboard history: `app/dashboard/page.tsx`.
- Staff student history: `app/admin/students/[id]/page.tsx`.
- Per-set recent attempts: `app/admin/sets/[id]/analytics/page.tsx`.

## Testing

Pure behavior is covered by `tests/attempt-review.test.ts`; solved-lock review-link output is covered by `tests/answer-grid.test.ts`. The 2026-07-19 Chrome QA used an isolated local Postgres database and verified immediate review navigation, correct/incorrect/skipped rows, row expansion, accepted-answer math, light/dark rendering, set-history discovery, absence of horizontal overflow, and cross-student 404 behavior.

Related: [[Components]], [[Data and Storage]], [[Entry Points]], [[Common Tasks]], [[Risks and Pitfalls]].
