# Install on Codex CLI

```bash
# From the repo root, after running `bash scripts/build.sh --platform codex-cli`:
# Copy (or symlink) the built tree into your vault root:
cp -R dist/codex-cli/. /path/to/your/vault/
```

Then in your vault:

- `AGENTS.md` is the operating manual Codex reads at session start.
- `.codex/commands/*.md` are the command bodies the AI follows when a
  matching trigger fires.
- `.codex/scripts/` holds the Python helpers invoked by the research
  toolkit commands. Run them via `uv run -m scripts.research.<name>`.

Start Codex CLI from the vault root.
