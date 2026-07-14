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

- No active half-finished feature after the current mobile/classes/animations update lands.

### Recently landed

- **Hand-drawn visual system** — `app/globals.css` now provides paper/ink design tokens, graph-paper backgrounds, asymmetric squircle cards and controls, marker-color accents, irregular badges/tabs, and stable two-pass SVG ink borders. Global wavy eyebrow/title underlines were removed so the hand-drawn character lives in the outlines instead. A signed-in production Chrome audit of `/problem-sets/1991-ajhsme` caught and removed percentage shape paths from variable-height panels, fixed oversized panel-header geometry, and removed the blue statement band. Desktop navigation is again a 64 px icon rail that expands to 240 px on hover/focus, while mobile retains the stable off-canvas sheet. The simplified Sigma in `public/dbsmo-mark.svg` is shared by favicon metadata and the landing brand. `app/layout.tsx` loads Shantell Sans for display/control text while Inter remains the body and math font. Route-specific coverage was visually audited across dashboard, problem catalog/detail, writeups, practice, classes, leaderboard, users/profiles, settings, and admin surfaces; FTW and Playground were intentionally excluded. Unsupported browsers retain ordinary border/radius fallbacks; details are in `docs/visual-system.md`.
- **Mobile/classes cleanup** — fixed mobile `/problem-sets` hiding task rows by restoring the responsive card table, stabilized the mobile sidebar grid to avoid icon reflow on tap/focus, and made dashboard auth/actions render as a compact mobile account card. `/classes` now has a teacher/admin `Announcements` subtab that lists existing class messages and supports author/admin deletion. Display-name fallbacks now treat literal `"null"`/`"undefined"` strings as empty via `lib/display-name.ts`.
- **Mobile sidebar focus fix** — mobile sidebar sheet geometry now remains stable under `:hover`, `:focus`, and `:focus-within`, preventing the nav grid from jumping upward when a mobile tap focuses one of the upper links (source: `app/globals.css`).
- **Answer previews and LaTeX grading** — Practice and problem-set answer boxes now render a small KaTeX preview above the input using `mathInputToTex(...)`. `lib/grading.ts` normalizes math delimiters and common LaTeX forms through `lib/math-input.ts`, so expression answers and answer keys can use `$...$`, `\sqrt{...}`, coefficients before functions like `5\sqrt{2}-7`, `\frac{...}{...}`, braced powers, and `\pi`.
- **Expanded LaTeX statement support** — KaTeX is upgraded to `0.17.x`, the official `mhchem` extension enables `\ce{...}`, and `lib/latex-compat.ts` converts document wrappers plus `tabular`, `tabular*`, `tabularx`, and `longtable` into safe KaTeX-compatible arrays. Bare display environments render when mixed with prose. Rendering keeps `trust: false`, `maxSize: 50`, and `maxExpand: 1000`; full TeX document compilation and resource-loading commands remain unsupported. See `docs/latex-support.md`.
- **Legacy LaTeX currency compatibility** — imported contest statements using full-LaTeX `\textdollar` or invalid currency sequences such as `\54` now render through bounded aliases in `lib/latex-compat.ts`; escaped row breaks remain unchanged.
- **Anime.js animation pass** — the shared `MathCurveLoader` now drives SVG path drawing, rotation, and dot pulses with Anime.js v4 instead of CSS keyframes, `AnimeRouteEffects` adds reduced-motion-aware route reveal animations for key panels/rows/actions, and analytics surfaces use `AnalyticsMotion` plus animated `TrendChart` path/dots for growing bars and drawn charts. `TypewriterGreeting` keeps the existing typed/deleted text state machine and only animates the caret, avoiding per-character text tween flicker. Dependency: `animejs` in `package.json`.
- **Per-set analytics access** — admins can open `/admin/sets/[id]/analytics` directly from the student-facing problem set header and the admin set editor; the editor delete action uses full-size topbar button sizing while the list keeps compact row actions.
- **Problem-set writeups** — `/problem-sets/[slug]/writeups` lets signed-in users post LaTeX/HTML solution notes with up to four images, then sort by latest/top and upvote/downvote posts. Authors can delete their own writeups with confirmation; admins can delete any writeup. `/writeups` is the sidebar directory for latest/top writeups and problem-set search. Persistence uses new `Writeup`, `WriteupImage`, and `WriteupVote` Prisma models plus `lib/writeup-images.ts`; image bytes are stored through the existing storage layer and streamed via `/api/files/[id]`.
- **Class announcements** — teachers/admins post title/body announcements from `/classes` to one or more classes. `Announcement` persists the message with an implicit class relation; `POST /api/admin/announcements` enforces `admin:users` and teacher ownership. Dashboard loads targeted announcements fresh on page render and pins them above the hero.
- **Profile mastery heatmap** — `app/users/[username]/page.tsx` now renders a GitHub-style yearly heatmap between authored tasks and the set grid. It counts days where the profile user mastered one or more sets with best-day intensity capped at 5.
- **Authored tasks cap** — profile authored tasks initially show five rows with a client-side show-more affordance.

### Next

- Consider WebSocket/SSE for FTW room realtime if the polling overhead becomes a problem (current cost: ~1 SQL round-trip per second per connected player).

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
- Migration: schema gained `Writeup`, `WriteupImage`, and `WriteupVote` models in `prisma/migrations/20260628090000_add_writeups/`. Deploy needs the normal Prisma migration step before the app starts serving writeup routes.
- Migration: schema gained `Announcement` and `_AnnouncementToClass` in `prisma/migrations/20260629110000_add_announcements/`. Deploy needs the normal Prisma migration step before the app starts serving class announcement routes.
- `/api/practice/tags` is referenced from `practice/page.tsx` but I haven't reviewed it; check before touching.
- `globals.css` has a "2026 refresh" overlay starting around line 2175 and two final hand-drawn override sections at the tail. Edit the tail for visual changes and preserve the fallback-before-experimental-property ordering.
- Never use percentage-based `border-shape` paths on variable-height content. Keep shape paths to bounded decorative surfaces and test shared panel changes against a tall problem set.
