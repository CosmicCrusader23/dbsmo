# Suggestions

This is a concrete product and engineering backlog based on:

- the current codebase and schema
- the running UI explored with browser-harness on `http://localhost:3001`
- the current feature set documented in the student/admin guides

The goal here is not "more features" in the abstract. It is to add the next things that would improve training quality, admin throughput, and maintainability.

## Completion Status

- [x] Canonical tag registry and normalization added.
- [x] Analytics, imports, dashboard, and profile topic displays now use canonicalized tags.
- [x] JSON round-trip export added for admin problem sets.
- [x] Post-submit student coaching added with missed-topic summary, explanation reveal, and local review-later flags.
- [x] Dashboard next-step guidance added with reason labels.
- [x] Analytics filters, first/best attempt metrics, recent attempt velocity, and suspicious-question signals added.
- [x] Problem-set discovery filters added for status, media, and latest sorting.
- [x] Settings and profiles now show richer training stats.
- [x] Storage layer now has an explicit local driver boundary and safer export headers.
- [x] Reporting/query indexes added to Prisma schema and migration SQL.
- [x] Permission scaffolding added for future role expansion.
- [x] Admin tag picker, historical tag cleanup migration, and shared authoring DTO completed.
- [x] Weakest-topic sorting, teacher-recommended sorting, and richer assignment/archive IA completed.
- [x] Privacy controls, S3-compatible storage, backup/restore, async export jobs, pagination, expanded roles, and audit logs completed.
- [x] CI-integrated browser-harness E2E coverage with seeded fixtures completed.

## Highest Priority

### 2. Canonicalize topic tags everywhere

Status: completed.

Why:

- Analytics currently shows fragmented tags like `algebra` and `Algebra`.
- The UI also mixes set-level categories with per-problem topic tags, which makes analytics and practice pools noisier than they should be.

What to add:

- [x] Introduce a canonical tag registry:
  - slug
  - display label
  - type: `problem_set_category` or `practice_topic`
- [x] Normalize imported and manually created tags against that registry
- [x] Give admins a controlled tag picker with optional alias mapping

Backend work:

- [x] Refactor [lib/analytics.ts](/Users/cosmic/Documents/funni/dbsmo/lib/analytics.ts) and import flows to normalize case and aliases before data is persisted
- [x] Add a one-time migration to merge historical duplicates

### 3. Unify the content creation pipeline

Status: completed with shared authoring validation, canonical normalization, and JSON round-trip support.

Why:

- Right now the app has three partially overlapping authoring paths:
  - manual create
  - single JSON import
  - ZIP of JSON files
- That is already visible in the UI as separate admin surfaces, and it will drift over time.

What to add:

- [x] One ingestion pipeline with multiple entry points:
  - manual editor
  - JSON upload
  - batch ZIP upload
- [x] One shared validation model and one shared preview format
- [x] "Export this set as JSON" for round-trip editing

Backend work:

- [x] Reduce duplication between [app/api/admin/create-set/route.ts](/Users/cosmic/Documents/funni/dbsmo/app/api/admin/create-set/route.ts), [app/api/admin/import/dry-run/route.ts](/Users/cosmic/Documents/funni/dbsmo/app/api/admin/import/dry-run/route.ts), [app/api/admin/import/commit/route.ts](/Users/cosmic/Documents/funni/dbsmo/app/api/admin/import/commit/route.ts), and [lib/import/json-import.ts](/Users/cosmic/Documents/funni/dbsmo/lib/import/json-import.ts)
- [x] Define one internal DTO for problem set creation/update so GUI and import routes cannot diverge

## Product Improvements

### 5. Improve student feedback loops after submission

Status: completed for the current answer-grid flow.

Why:

- Students currently get correctness, score, and history, but not much coaching structure.
- For olympiad training, the next best action matters more than the raw score.

What to add:

- [x] Per-problem post-submit reveal options:
  - explanation note
  - linked solution
  - "review later" flag
- [x] "You lost marks on these topics" summary after each attempt and maybe in the dashboard (?)
- [x] Recommended next action:
  - retry now
  - switch to practice on weak topics
  - watch the linked video first

### 6. Expand analytics from static snapshots to decision tools

Status: completed as an analytics decision-tool MVP.

Why:

- The current analytics page is useful but shallow: total responses, weak topics, hardest questions.
- Teachers need trend and segmentation views, not just overall aggregates.

What to add:

- [x] Filters by student, set, topic, and date range
- [x] Cohort filter using the existing user group field
- [x] First-attempt vs best-attempt accuracy
- [x] Attempt velocity
- [x] Completion trend charts over time
- [x] "Questions with suspicious answer keys" heuristics:
  - unusually low accuracy
  - high feedback rate
  - sharp drop relative to neighboring questions

Backend work:

- [x] Avoid loading all responses into memory for analytics pages
- [x] Consider precomputed summary tables or nightly rollups once usage grows; current indexed query-level aggregation is sufficient until usage grows

## UI Improvements

### 8. Clarify the information architecture for students

Status: completed.

Why:

- The app is usable, but the distinction between `Dashboard`, `Problem Sets`, and `Practice` can still feel flat.
- Students benefit from clearer "what should I do next?" guidance.

What to add:

- [x] A stronger "Today" or "Next step" zone on the dashboard
- [x] Reason labels on recommended sets:
  - "new release"
  - "retry: scored 60%"
  - "weak topic: geometry"
- [x] A cleaner split between:
  - assigned work
  - self-practice
  - completed archive

### 9. Improve problem-set discovery and filtering

Status: completed.

Why:

- The problem-set browser already has categories, search, and bookmarks, but it still behaves like a table more than a study planner.

What to add:

- [x] Filter chips for:
  - not started
  - in progress
  - completed
  - has video
  - has PDF
- [x] Sort by latest release
- [x] Sort by your weakest topic match
- [x] Sort by teacher recommended
- [x] Save recent filters in the URL and restore them cleanly

### 10. Make settings and profiles more useful

Status: completed.

Why:

- Settings currently cover display name, avatar, and theme.
- Profiles and user pages could do more to support the training community without becoming social clutter.

What to add:

- [x] Basic personal training stats on settings/profile
- [x] Public profile sections for:
  - strongest topics
  - recent completions
  - bookmarked sets
- [x] Optional privacy controls for leaderboard/profile visibility

## Backend and Platform Improvements

### 11. Move storage and exports toward production-safe infrastructure

Status: completed with local and S3-compatible storage boundaries, backup/restore, and export jobs.

Why:

- The app still uses local disk for imported files.
- That is fine for development, but it becomes fragile for real deployment, scaling, and backup.

What to add:

- [x] Add an explicit storage driver boundary around the current local storage implementation
- [x] S3-compatible object storage abstraction
- [x] Backup and restore workflow for imported files and DB data
- [x] Safer async export jobs for larger datasets

### 12. Add stronger database and query discipline

Status: completed.

Why:

- Several current routes do whole-table or broad fetches and then compute in memory.
- That is acceptable at small scale but will become slow and harder to reason about.

What to add:

- [x] Query-level filtering for analytics
- [x] Broader query-level filtering for practice selection and user browsing
- [x] Pagination on list pages:
  - users
  - reports
  - attempts
  - problem sets once the list grows
- [x] Review indexes for common filters and joins:
  - attempts by `userId`, `problemSetId`
  - responses by `problemId`
  - feedback by `status`, `createdAt`
- [x] Add or confirm indexes for practice solves by `userId`, `problemId`

### 13. Tighten authorization and role modeling

Status: completed with expanded roles, surface permissions, and audit logs.

Why:

- The current model is basically `STUDENT` vs `ADMIN`.
- That will become limiting once teachers, assistants, and group-level permissions diverge.

What to add:

- [x] Roles such as:
  - `TEACHER`
  - `CONTENT_EDITOR`
  - `ANALYST`
- [x] Per-surface permission helper scaffolding instead of hard-coding binary admin checks everywhere
- [x] Audit logs for high-impact actions:
  - imports
  - role changes
  - set publication
  - regrades

### 14. Replace ad hoc browser scripts with integrated end-to-end coverage

Status: completed with browser-harness smoke coverage and CI wiring.

Why:

- The current browser tests are useful but not part of a stronger automated release gate.
- This project is reaching the point where auth, imports, grading, and visibility need stable regression coverage.

What to add:

- [x] Browser-harness smoke coverage in [tests/browser_harness_smoke.py](/Users/cosmic/Documents/funni/dbsmo/tests/browser_harness_smoke.py)
- [x] Playwright or equivalent end-to-end tests in CI
- [x] Seeded fixtures for:
  - student flows
  - admin import/publish flows
  - feedback lifecycle
  - visibility scheduling
