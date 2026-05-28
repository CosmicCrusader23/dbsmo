# CENTRAL.md — Working notes and orientation

Living doc kept by Claude across sessions. Update after each big change. If you're picking up cold: read this top-to-bottom, then `git log --oneline -20`, then dive in.

## Project shape

DBSMO is a Next.js 15 (App Router) Postgres+Prisma platform for self-paced math olympiad training at Diocesan Boys' School. Everything is server-rendered by default; a handful of `"use client"` components handle interactive UI (typewriter greeting, theme toggle, answer grid, FTW match).

Stack: Next.js, NextAuth (Google + dev bypass), Prisma, KaTeX for math, Lucide icons, Vitest. No Tailwind — single 5k-line `app/globals.css`.

## Where things live

- `app/` — routes. Server components unless marked `"use client"`. Admin under `app/admin/*`.
- `app/api/**/route.ts` — REST handlers.
- `lib/` — shared logic: `auth.ts`, `db.ts` (Prisma singleton), `grading.ts`, `permissions.ts`, `visibility.ts`, `analytics.ts`, plus the `import/` ZIP+JSON pipeline.
- `prisma/schema.prisma` — single source of truth for the data model.
- `tests/` — Vitest specs for grading, tags, ordering, visibility, import.
- `app/globals.css` — all styles. Light mode at the top (`:root`), dark via `@media` and `html.dark`.

## Conventions

- Page files do their own `getServerSession` + permission gate; no shared middleware.
- Permission keys in `lib/permissions.ts` — `admin:view`, `admin:content`, etc. Use `hasPermission(role, key)`.
- LaTeX statements rendered through `<LatexStatement>` (KaTeX auto-render).
- Answer normalisation lives in `grading.ts`; do not roll your own comparison.
- CSS variables drive theming. Add new colors as variables in `:root` AND in dark overrides — both. Don't hard-code hex outside `globals.css`.

## What's currently in flight

### Now (this session)

- **Classes + assignments** — teacher creates a class, picks students by username, assigns published problem sets with optional due dates. Three new tables (`Class`, `ClassMember`, `Assignment`). Permissions reuse `admin:users`. Completion derived live from `Attempt.submittedAt > assignment.createdAt` — never denormalized. Teacher routes under `/admin/classes`. Student surface = dashboard widget + new "Class" filter chip on `/problem-sets` (kept distinct from the pre-existing `assigned` tab which means "bestScore < 100"). Spec/plan in `docs/superpowers/{specs,plans}/2026-05-28-classes-and-assignments-*.md`.
- **FTW (Alcumus For The Win) mode** — speed-based timed problem race against the clock. Single-player + real multiplayer rooms with join codes (5-char, ambiguous chars stripped). Routes under `/ftw`, schema additions `FtwMatch`/`FtwAnswer` (solo) and `FtwRoom`/`FtwRoomPlayer`/`FtwRoomProblem`/`FtwRoomAnswer` (multi). Polling-based realtime (1.5s tick on `/state`); host starts; scoreboard advances when all answered or timer expires. Sidebar entry on dashboard.
- **Light-mode rehaul** — current light theme reads as flat AI-generated. Goals: warmer paper-white background, deliberate ink colors, fewer purple/cyan washes, pink reserved as accent (matches dark). Keep dark+pink as-is.
- **Less AI vibe** — copy passes (no eyebrow soup, no "hero panel" walls of cards), tighter spacing, fewer gradients. Keep the typewriter greeting unchanged.
- **JSON import fixes** — see `lib/import/`. Hardened: case-insensitive `answerType` (ZIP path), full row-failure surfacing instead of silent drop, file-storage rollback when transaction fails, sequence warnings list missing numbers, manifest difficulty bumped to 1–10 to match spec.

### Next (after the above lands)

- `/simplify` pass on the codebase. *Done — practice-page inline styles moved to CSS classes.*
- Sweep for dead code and CSS leaves now that several features have rotated through.
- Consider WebSocket/SSE for room realtime if the polling overhead becomes a problem (current cost: ~1 SQL round-trip per second per connected player).

## Testing locally

```bash
npm run typecheck   # tsc --noEmit
npm run lint
npm run test        # vitest
npm run build       # next build (catches CSS/JSX issues at scale)
npm run dev         # next dev — open http://localhost:3000
```

`npm run dev` may fail without `DATABASE_URL`. Pages that hit Prisma will 500; static routes still render. `next build` runs without DB.

## Git protocol for this repo

- Push checkpoints to `origin/main` after each big milestone (user has bypass perms enabled and asked for this).
- Use HEREDOC commit messages, two short paragraphs max.
- Never `--no-verify`, never amend pushed commits, never force-push.

## Recovery

If a file goes missing:
```bash
git fetch origin
git checkout origin/main -- <path>
```
Then read the file, reconcile with what's in memory, keep going.

## Deploy

VPS deploy is documented in `SETUP.md` (npm + pm2 + nginx + certbot + cron backups). After a code push, the redeploy flow on the VPS is `git pull → npm ci → npx prisma migrate deploy → npm run build → pm2 reload dbsmo`.

## Open questions / followups

- Room realtime is poll-based (1.5s). Fine for a classroom; would migrate to SSE/WebSockets if scale warrants. The DB does the locking via `advanceRoomIfDue`, which is the canonical way to advance — call it from `state` and `submit`.
- `lib/storage.deleteFile` is best-effort on rollback; an orphan-sweeper job would catch any leaks.
- Migration: schema gained `FtwRoom*` models. Run `npx prisma migrate dev --name add_ftw_rooms` on dev, commit `prisma/migrations/`, then `npx prisma migrate deploy` on the VPS.
- `/api/practice/tags` is referenced from `practice/page.tsx` but I haven't reviewed it; check before touching.
- `globals.css` has a "2026 refresh" overlay starting around line 2175 — overrides earlier rules. The light-mode rehaul lives at the very tail (post-confetti keyframes). Edit there for visual changes, not the top.
