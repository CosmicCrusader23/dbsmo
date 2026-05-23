# AGENTS.md

Rules for any AI agent working in this repo. Loaded into context every session.

## Git checkpoints — push to origin/main after every meaningful milestone

The user has bypass perms enabled and asks for this explicitly. After each finished feature, fix, or refactor:

```bash
git add -A
git commit -m "<short msg>" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push origin main
```

What counts as a checkpoint:
- A feature that builds, lints, and passes tests.
- A bug fix that resolves a reported issue.
- A doc-only change once it's coherent.
- After running `/simplify` or any large refactor.

What doesn't:
- Half-finished work that doesn't compile.
- WIP scratch files.

Never `--no-verify`, never amend pushed commits, never force-push.

## Update SETUP.md whenever you change anything that affects VPS deploy

`SETUP.md` is the runbook the user follows on the production VPS (npm + pm2 + nginx + Postgres). If your change requires the user to do *anything new* on the server, update SETUP.md in the **same commit** as the change. Examples that require a SETUP.md edit:

- Schema change → add the migration step (`npx prisma migrate deploy` is already documented; if you add seed data or one-off fixups, document those).
- New environment variable → add it to the `.env` block, with what it's for.
- New system dependency (e.g. Redis, ImageMagick, ffmpeg) → add an `apt-get install` line.
- New build step or postinstall hook.
- New port, new nginx route, new cron job.
- New Node major version requirement.
- Anything that changes the redeploy flow in section 6.

If your change has no deploy impact, leave SETUP.md alone.

## CENTRAL.md is the cross-session orientation doc

Keep its "What's currently in flight" and "Open questions / followups" sections accurate. When you finish something listed in flight, move it out. When you discover a follow-up, write it down.

## Recovery

If a file is missing or corrupted:

```bash
git fetch origin
git checkout origin/main -- <path>
```

Then read it, reconcile, continue.
