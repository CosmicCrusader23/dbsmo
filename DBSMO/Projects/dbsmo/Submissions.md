---
date: 2026-08-05
updated: 2026-08-12
type: feature
tags: [project, submissions, attempts, privacy, ui, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: working-tree-2026-08-12
---

## For future Claude

This note documents the per-problem-set [[Submissions]] directory and its answer-visibility boundary. Verify the route and helpers against source before changing privacy or pagination.

## User Surface

`/problem-sets/[slug]` places a **Submissions** action next to the theme control. `/problem-sets/[slug]/submissions` shows the newest attempts for that visible set, twenty per page, with:

- Everyone or Friends scope, where Friends is derived from the signed-in user's `Friendship` rows and includes the viewer's own attempts;
- bounded display-name search using the `q` query parameter;
- attempt number, submitter, timestamp, verdict, raw score/max score, and percentage;
- responsive desktop table and mobile stacked rows;
- previous/next pagination links that preserve the current search and scope.

Sources: `app/problem-sets/[slug]/page.tsx`, `app/problem-sets/[slug]/submissions/page.tsx`, `prisma/schema.prisma`, `app/globals.css`.

## Privacy Boundary

The list query selects only attempt summary fields and display-safe user identity. It does not select `Response` rows, raw answers, normalized answers, or answer keys. Scores and verdicts are available to authenticated users who can view the set.

`/attempts/[id]` is the detailed answer review. Ownership does not bypass the shared `canViewSubmissionAnswers(...)` rule: a non-staff viewer needs an exact perfect attempt for the same set, while `admin:analytics` can review directly. Non-staff viewers opening another user's attempt must also be looking at a currently visible set. Unknown and unauthorized IDs use the same `notFound()` path, and sensitive `Response.problem` data is queried only after this check. This prevents a table link or guessed attempt ID from becoming an answer leak.

Attempts from users with `leaderboardVisible=false` remain in totals and pagination so public score activity is not distorted, but their name, avatar, and profile link are replaced with an anonymous identity for ordinary viewers. Profile links independently respect `profileVisible` (sources: `app/problem-sets/[slug]/submissions/page.tsx`, `lib/submissions.ts`).

Sources: `app/problem-sets/[slug]/submissions/page.tsx`, `app/attempts/[id]/page.tsx`, `lib/submissions.ts`, `lib/permissions.ts`, `lib/visibility.ts`.

## Change Guidance

Keep `SUBMISSIONS_PAGE_SIZE` at a bounded value and preserve the explicit field selection. If a new filter is added, apply it to the `count` and page query together, cap free-text input, preserve hidden `leaderboardVisible` users as anonymous for non-staff viewers, and add a test to `tests/submissions.test.ts`. No Prisma migration is required: existing `Attempt`, `Response`, and `Friendship` models provide the data.

Related: [[Attempt Review]], [[Data and Storage]], [[Entry Points]], [[Risks and Pitfalls]], [[Common Tasks]].
