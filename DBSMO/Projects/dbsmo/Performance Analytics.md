---
date: 2026-07-19
updated: 2026-07-19
type: domain-model
tags: [project, analytics, scoring, leaderboard, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
---

## For future Claude

This is the source-grounded orientation note for cross-set student scoring in [[dbsmo]]. Verify formulas in `lib/analytics.ts` before changing behavior; use `docs/performance-model.md` for the user-facing explanation and rerun the deterministic simulation after any calibration change.

## Purpose

[[dbsmo]] uses a derived `PerformanceProfile` rather than one points-weighted average or a persisted rating. `computePerformanceProfile(...)` collapses retries to the best percentage per visible published set and returns the same metrics for dashboard, profile, settings, leaderboard, staff analytics, and exports (source: `lib/analytics.ts`).

This is deliberately calculated at read time. Persisting the index would make it stale when attempts are regraded or a problem set becomes visible/hidden; there is no new Prisma model or migration (sources: `lib/analytics.ts`, `prisma/schema.prisma`).

## Model

- Best-set average: equal-weight arithmetic mean of each set's best percentage. Maximum marks do not change a set's influence (source: `lib/analytics.ts`).
- Proficiency: best-set score total plus a 50% prior worth three sets, divided by attempted sets plus three. This controls tiny samples (source: `lib/analytics.ts`).
- Breadth: `100 × sqrt(attempted sets / visible sets)`, capped naturally by using at least the attempted-set count as denominator (source: `lib/analytics.ts`).
- Consistency floor: lower quartile of best-set percentages, smoothed with the same 50% three-set prior (source: `lib/analytics.ts`).
- Mastery rate: percentage of attempted sets at 80% or above (source: `lib/analytics.ts`).
- Mastery Index: `65% proficiency + 20% breadth + 15% consistency floor`, rounded to one decimal (source: `lib/analytics.ts`).
- Evidence: none, limited (1-4 sets), developing (5-14), or established (15+) (source: `lib/analytics.ts`).

## Surfaces

The primary student summary is Mastery Index; best-set average and the other components remain visible so the result is explainable (sources: `app/dashboard/page.tsx`, `app/users/[username]/page.tsx`, `app/settings/page.tsx`, `app/api/settings/route.ts`).

Standard leaderboard ranking defaults to Mastery Index and can alternatively sort by best-set average. Admin student tables/detail, filtered analytics leaders, and student CSV exports call the same helper instead of reimplementing the formula (sources: `app/leaderboard/page.tsx`, `app/admin/students/page.tsx`, `app/admin/students/[id]/page.tsx`, `app/admin/analytics/page.tsx`, `lib/admin-exports.ts`).

Per-set averages and timeline averages remain ordinary percentages because they compare attempts within one set or time bucket, not differently sized sets (sources: `app/admin/sets/[id]/analytics/page.tsx`, `app/admin/analytics/page.tsx`).

## Validation

`npm run simulate:performance` runs `scripts/simulate-performance-model.ts`, a deterministic 100-student × 100-set cohort with varied latent ability, participation, set difficulty/length, retries, and noise. The 2026-07-19 calibration produced `0.980` Spearman ability/index correlation, 89 distinct values among 100 students, monotonically increasing ability-decile averages, a `52.0` index for one perfect set, and `78.3` for sixty steady 80% sets. The script fails below `0.85` correlation, below 80 distinct values, or if the one-result profile outranks broad performance (source: `scripts/simulate-performance-model.ts`).

Unit tests cover best-attempt collapse, equal set weight, invalid attempts, confidence shrinkage, breadth, and lower-quartile consistency (source: `tests/analytics.test.ts`). User-facing details are also in `docs/performance-model.md`.

## Change Guidance

Change weights, priors, thresholds, or rounding only in `lib/analytics.ts`; then update `tests/analytics.test.ts`, run `npm run simulate:performance`, and record changed calibration results in this note and `docs/performance-model.md`. Do not add a stored score without a complete invalidation/recalculation design (sources: named files).
