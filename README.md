# DBS MO Training Platform

Self-paced mathematics olympiad training platform for DBS. Complete with features such as answer-only problem sets, automatic grading, progress tracking, teaching videos, solution links, feedback reports, and teacher analytics.

## Important Docs
- [JSON import format](./docs/import-format.md)
- [Grading rules](./docs/grading.md)
- [Admin Guide](./docs/admin-guide.md)
- [Student Guide](./docs/student-guide.md)

## AMC/AIME conversion helper
- Convert `amc_aime/*_questions.txt` + `*_solutions.txt` into JSON import files with:
  - `npm run convert:amc-aime`
- Output defaults to `amc_aime/json/` and includes `conversion-report.json` for unresolved answers.
- Useful flags:
  - `npm run convert:amc-aime -- --strict` to only write sets with complete answers.
  - `npm run convert:amc-aime -- --include-solutions` to include first-solution text in each problem.
