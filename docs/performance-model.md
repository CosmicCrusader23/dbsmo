# Performance Model

DBSMO summarizes a student's standard problem-set performance with a derived **Performance Profile**. The profile replaces the old points-weighted best average, which allowed long sets and very small samples to dominate comparisons.

The source of truth is `computePerformanceProfile(...)` in `lib/analytics.ts`. It is calculated from currently visible published problem sets and is not persisted, so a new attempt or visibility change is reflected immediately.

## Inputs

1. Ignore attempts with no possible marks.
2. Convert each valid attempt to a percentage capped to `0-100`.
3. Keep the best percentage for each problem set. Retrying cannot lower the profile and repeated attempts cannot inflate breadth.
4. Give each set equal weight. A 60-mark test does not outweigh a 10-mark set simply because it contains more marks.

## Profile Fields

| Field             | Meaning                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Best-set average  | Arithmetic mean of the best percentage on each attempted visible set.                               |
| Proficiency       | Best-set average shrunk toward a 50% prior worth three sets, reducing one-result leaderboard jumps. |
| Breadth           | `100 × sqrt(attempted visible sets / total visible sets)`.                                          |
| Consistency floor | Lower quartile of best-set percentages, also shrunk toward a 50% three-set prior.                   |
| Mastery rate      | Percentage of attempted visible sets with a best score of at least 80%.                             |
| Evidence          | `Limited` for 1-4 sets, `Developing` for 5-14, and `Established` for 15 or more.                    |
| Mastery Index     | `65% proficiency + 20% breadth + 15% consistency floor`.                                            |

The Mastery Index is shown with one decimal place to reduce ranking ties. It remains a comparative training signal, not a grade.

## Product Surfaces

- Dashboard and settings show Mastery Index as the primary summary and best-set average as a supporting measure (`app/dashboard/page.tsx`, `app/settings/page.tsx`, `app/api/settings/route.ts`).
- Profiles expose Mastery Index, best-set average, consistency floor, mastery rate, and visible sets tried (`app/users/[username]/page.tsx`).
- The standard leaderboard sorts by Mastery Index by default and offers best-set average as an alternate order (`app/leaderboard/page.tsx`).
- Staff student lists/details and the analytics leader table use the same helper (`app/admin/students/page.tsx`, `app/admin/students/[id]/page.tsx`, `app/admin/analytics/page.tsx`).
- Student CSV exports include every profile component and evidence level (`lib/admin-exports.ts`).

Per-set analytics still uses ordinary percentages because all rows there refer to the same set; the cross-set weighting problem does not apply.

## Validation

Run:

```bash
npm run simulate:performance
```

The deterministic simulation creates 100 students across 100 sets with varied ability, participation, set difficulty, set length, noise, and retries (`scripts/simulate-performance-model.ts`). The July 19, 2026 calibration produced:

- Spearman latent-ability/Mastery-Index correlation: `0.980`.
- Distinct Mastery Index values: `89/100` students.
- Ability-decile mean indices: `37.5 -> 40.5 -> 46.3 -> 51.1 -> 59.2 -> 63.5 -> 71.5 -> 76.0 -> 81.0 -> 85.9`.
- One perfect set: `52.0` with limited evidence.
- Sixty steady 80% sets: `78.3` with established evidence.

The simulation fails if correlation drops below `0.85`, fewer than 80 students receive distinct values, or one perfect set outranks broad steady performance. Unit coverage for best-attempt collapse, equal set weighting, zero-mark attempts, confidence shrinkage, breadth, and consistency is in `tests/analytics.test.ts`.
