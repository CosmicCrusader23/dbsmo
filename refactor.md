# Refactor Progress

## Goals

- Fix broken functions.
- Reduce cybersecurity risk without changing current website behavior.
- Refactor touched code for readability.
- Verify with local tests and browser-harness.

## Progress

- [x] Mapped project structure and stack.
- [x] Identified existing worktree change: deleted screenshot, left untouched.
- [x] Started security audit of auth, upload/import, file serving, and HTML/math rendering paths.
- [x] Capture baseline test results: lint/typecheck pass; unit tests fail because JSON dry-run requires `DATABASE_URL`.
- [x] Apply focused security/readability fixes.
- [x] Run lint, typecheck, unit tests.
- [x] Verify local website with browser-harness.

## Findings To Address

- [x] Developer credentials bypass remains dev-only and now has an explicit `AUTH_DEV_BYPASS=false` opt-out.
- [x] Local storage path handling enforces that storage keys cannot escape the configured storage root.
- [x] ZIP import paths reject absolute paths and parent-directory traversal before files are saved.
- [x] File download headers avoid header injection and add `X-Content-Type-Options: nosniff`.
- [x] JSON dry-run no longer initializes Prisma when no database URL is configured.
- [x] Practice APIs no longer expose or grade problems from scheduled/expired sets for students.
- [x] Admin create/update APIs validate slugs and duplicate problem numbers before writing.

## Verification

- [x] `npm run lint` passes with the existing two `<img>` warnings.
- [x] `npm run typecheck` passes.
- [x] `npm test` passes: 5 files, 29 tests.
- [x] `npm run build` passes after allowing the Google Fonts fetch.
- [x] browser-harness verified landing page, dev credentials login, dashboard, admin import, problem sets, practice tags API, admin export API, and hardened 4xx API responses on `http://localhost:3001`.
