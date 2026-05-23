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

- **FTW (Alcumus For The Win) mode** — speed-based timed problem race against the clock. Single-player first; friends-async leaderboard. Scoring rewards fast correct answers (AoPS-style: max points decay with elapsed time). Routes under `/ftw`, schema additions `FtwMatch`/`FtwAnswer`. Gets a sidebar entry.
- **Light-mode rehaul** — current light theme reads as flat AI-generated. Goals: warmer paper-white background, deliberate ink colors, fewer purple/cyan washes, pink reserved as accent (matches dark). Keep dark+pink as-is.
- **Less AI vibe** — copy passes (no eyebrow soup, no "hero panel" walls of cards), tighter spacing, fewer gradients. Keep the typewriter greeting unchanged.

### Next (after the above lands)

- `/simplify` pass on the codebase.
- Sweep for dead code and CSS leaves now that several features have rotated through.

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

## Open questions / followups

- Realtime multiplayer FTW would need Pusher / WebSockets — out of scope for now. Async friend matches first.
- `/api/practice/tags` is referenced from `practice/page.tsx` but I haven't reviewed it; check before touching.
- `globals.css` has a "2026 refresh" overlay starting around line 2175 — overrides earlier rules. Edit there for visual changes, not the top.
