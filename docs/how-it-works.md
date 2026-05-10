# How It Works

The kit ships the rules **with each skill** instead of as a global instructions file:

- **`CORE_RULES.md`** — The canonical, agent-neutral rules file. Lives once at the repo root and is distributed to each skill via a symlink.
- **`skills/<name>/AGENTS.md`** — A relative symlink (`../../CORE_RULES.md`) inside every **engineering-workflow** skill directory. Standalone utility skills (`proofread`, `translate`, `fact-check`) ship without this sibling and load no shared rules. The Claude Code plugin loader preserves symlinks in its cache, so they resolve at runtime; for non-plugin installs, `setup.sh` dereferences with `cp -L` and writes a real file copy into each installed skill directory. The sibling is named `AGENTS.md` so it feels native to AGENTS.md-aware tools at the consumer end.
- **`AGENTS.md`** (repo root) — Contributor-facing instructions for working on this kit. Not shipped to consumer projects.
- **`skills/<name>/SKILL.md`** — Engineering-workflow skills open with a fixed "Core Rules" directive that instructs the agent to read the sibling `./AGENTS.md` first, apply its rules for the duration of the skill, and emit `✅ Core agents-kit@<version> rules applied` as a visible confirmation before doing anything else (the version is interpolated at runtime from the **Version** line in `CORE_RULES.md`). If that line doesn't appear when invoking an engineering skill, the rules weren't loaded. Standalone utility skills omit this directive — their full guidance lives inline in `SKILL.md`.
- **No global rules file is installed.** `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` are no longer written by this kit. Rules apply only when a skill from the kit is invoked.
- **Adapters** — `setup.sh` maps the shared content into each non-plugin agent's expected directory (`~/.claude/skills/`, `~/.codex/skills/`). To add a new agent, append to the `AGENTS` array in `setup.sh`.

If you have your own skill with the same name as one in this repo, `setup.sh` will ask before overwriting it. Skills installed by this kit that are later removed from the repo will be cleaned up automatically on the next run. Your own skills are never touched.
