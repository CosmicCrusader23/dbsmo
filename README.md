# DBS MO Training Platform

Self-paced mathematics olympiad training platform for answer-only problem sets, automatic grading, progress tracking, teaching videos, solution links, feedback reports, and teacher analytics.

## Current State

This repository has the initial application scaffold:

- Next.js + TypeScript app shell.
- Project theme based on `plan.md`.
- Student dashboard and problem-set UI mock.
- Admin ZIP import wizard UI shell.
- Prisma data model.
- Grading utility with unit tests.
- Import and grading documentation.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run prisma:generate
```

## Important Docs
- [JSON import format](./docs/import-format.md)
- [Grading rules](./docs/grading.md)
- [Admin Guide](./docs/admin-guide.md)
- [Student Guide](./docs/student-guide.md)
