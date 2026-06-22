# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Two other docs are required reading for full context. Don't duplicate them — read them before non-trivial work:

- `AGENTS.md` — git checkpoint policy, SETUP.md update rule, file recovery.
- `CENTRAL.md` — cross-session orientation, what's currently in flight, open follow-ups, and the schema-migration note. Update this file when work lands.

`SETUP.md` is the production VPS runbook. Edit it in the **same commit** as any change that affects deploy (new env var, new system dep, schema change, new port/route, new build step). See AGENTS.md.

## Commands

```bash
npm run dev          # next dev — http://localhost:3000 (DB-backed pages 500 without DATABASE_URL)
npm run build        # next build — catches CSS/JSX issues at scale; runs without DB
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run test         # vitest run
npm run test:watch   # vitest watch
npx vitest run tests/grading.test.ts        # single test file
npx vitest run -t "fraction grading"        # filter by test name
npm run prisma:generate                     # regen client after schema.prisma edits
npm run db:seed                             # ts-node prisma/seed.ts
```

This repo uses `prisma db push` (not `migrate dev`) on the VPS — see SETUP.md §7. Locally, `npx prisma db push` is the same pattern.

## Architecture

**Stack:** Next.js 15 App Router · NextAuth (Google + dev bypass) · Prisma + Postgres · KaTeX · Lucide · Vitest. **No Tailwind** — a single `app/globals.css` (~5k lines) drives all theming via CSS variables.

### Server-first, no shared middleware

Pages are server components by default. Each route does its own `getServerSession(authOptions)` and `hasPermission(role, key)` gate at the top — there is no global middleware doing this. When adding a route, copy the auth/permission preamble from a sibling.

`"use client"` is reserved for actually-interactive UI (typewriter greeting, theme toggle, FTW match client, playground battle). Keep client components small and lift data fetching to the parent server component.

### Permissions

`lib/permissions.ts` defines a small set of keys (`admin:view`, `admin:content`, `admin:users`, `admin:analytics`, `admin:feedback`, `admin:audit`, `admin:export`, `admin:roles`). Roles map to permission lists; gate with `hasPermission(role, key)`. Never check role strings directly.

### Grading (single source of truth)

All answer comparison goes through `lib/grading.ts`. `AnswerType` is `exact | integer | decimal | fraction | set | multiple | expression`. The `expression` type evaluates both sides numerically with a tolerance. Do not roll your own answer comparison — extend `grading.ts` and add a test in `tests/grading.test.ts`.

### Problem rendering

Statements come back as either `LATEX` or `HTML` (per-problem `contentFormat`). Render through `<LatexStatement>` (KaTeX auto-render) — never inject statement HTML directly.

### FTW (multiplayer rooms)

Three layers worth knowing:

- `lib/ftw-room.ts` — pure helpers (`roomScore`, `generateRoomCode`, score caps).
- `lib/ftw-room-server.ts` — the canonical advance machinery. **`advanceRoomIfDue(roomId)` is the only correct way to advance a round.** Both `/state` (GET) and `/submit` (POST) call it. It locks the round, applies deferred score increments in a single transaction, and either reveals (multi-player) or auto-picks the next problem (solo).
- Round scoring is **deferred until lock** so the live scoreboard can't leak correctness mid-round. Per-player `isCorrect`/`points` are also nulled on `/state` until the round locks. If you change the submit path, preserve this — it is a designed gameplay invariant, not a bug.
- Realtime is poll-based (1.5s tick on `/state`). Migrating to SSE/WebSockets is open in CENTRAL.md if scale warrants.

### Playground (boss rush)

`/playground` is a self-contained mini-game.

- `lib/playground/bosses.ts` — single config file. Add a boss by appending to `BOSSES`. Each boss has `phases[]`, each phase has `pattern: BulletPattern`, `density`, `speed`, taunts/challenge dialogue, and `integrals: Integral[]` (a **pool** — one is picked at random per fight so memorizing answers doesn't cheese the boss).
- Boss artwork lives **next to `bosses.ts`** in `lib/playground/`, imported via `next/image` static imports and resolved with `src(img)` — no `public/` copies.
- New attack patterns: extend the `BulletPattern` union and add a `case` to the spawn switch in `app/playground/[slug]/battle.tsx` and the bullet-render switch in the same file. Patterns currently shipped: `spiral | wave | sweep | rain | blaster | bones | homing | orbit | cross`.
- Trophies persist via `localStorage` keyed `dbsmo:trophy:<userId>:<slug>` — keyed by user so a different account on the same browser doesn't inherit wins. Plumb `userId` through `PlaygroundHub` and `BossBattle` if you fork those.

### Imports / authoring pipeline

`lib/import/` ingests JSON and ZIP problem-set bundles. Format spec: `docs/import-format.md`. Hardened paths: case-insensitive `answerType` (ZIP), full row-failure surfacing, file-storage rollback when the transaction fails, sequence warnings list missing numbers. Don't silently drop rows.

### Styling

All styles in `app/globals.css`. Light values in `:root`, dark via `@media (prefers-color-scheme: dark)` and `html.dark` overrides. **Add new colors as variables in both** — don't hard-code hex outside this file. A "2026 refresh" overlay starts ~line 2175 and overrides earlier rules; light-mode rehaul lives at the very tail (post-confetti keyframes). Visual edits go there, not the top.

### Database

Single Prisma client via `lib/db.ts` (singleton pattern). Schema is the only source of truth — `prisma/schema.prisma`. Run `prisma generate` after every schema edit (locally) and on every deploy that touches the schema (VPS — pm2 loads the client once at startup, so a stale client surfaces as "Unknown field" 500s, see SETUP.md §10).

## Conventions

- **Path alias:** `@/*` → repo root (see `tsconfig.json`). Use `@/lib/...`, `@/app/...`.
- **Tests** live in `tests/*.test.ts`, Node environment, included automatically. Vitest does not pick up `.spec.ts`.
- **No barrel files**: import from concrete paths (`@/lib/grading`, not `@/lib`).
- **Comments**: write only when the *why* is non-obvious (an invariant, a constraint, a workaround). Don't narrate what the code does.
- **CSS additions** belong with sibling rules in `globals.css`; if you find yourself reaching for inline styles, that's a signal to add a class instead.

## Gotchas

- `prisma db push` is the migration story for this repo (not `migrate dev`). See SETUP.md §7. CENTRAL.md may reference `migrate deploy` historically — `db push` is current.
- The pm2 process must `prisma generate` *before* `pm2 reload` whenever `schema.prisma` changes — otherwise the running process keeps the old client.
- `DATABASE_URL` missing → DB-backed pages 500 in dev; static routes still render. `next build` works without DB.
- The mobile sidebar uses a window CustomEvent (`dbsmo:mobile-nav-close`) for cross-component coordination — don't manipulate the toggle's class directly.

---

# Behavioral guidelines

To reduce common LLM coding mistakes. Bias toward caution over speed; for trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
