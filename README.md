# Agents Kit

Shared rules and skills for Cursor and Claude Code AI coding agents.

## Structure

```
agents-kit/
├── AGENTS.md              # Core rules (agent behavior, workflow)
├── skills/                # Shared skills for both tools
├── setup.sh               # Creates symlinks
└── README.md
```

After running `setup.sh`, symlinks are created:

```
~/AGENTS.md          -> <repo>/AGENTS.md          # Cursor reads via directory walking
~/.claude/CLAUDE.md  -> <repo>/AGENTS.md          # Claude Code core rules
~/.claude/skills     -> <repo>/skills             # Claude Code skills
~/.cursor/skills     -> <repo>/skills             # Cursor skills
```

## How It Works

The kit has two parts:

- **`AGENTS.md`** — Core agent behavior rules (decision making, communication, workflow). Loaded into every conversation.
- **`skills/`** — Shared skills directory. Both `~/.cursor/skills` and `~/.claude/skills` point here. Each skill is a `SKILL.md` file with optional supporting files. Skills prefixed with `_` are auto-applied by convention (see `AGENTS.md`).

Edit once, both tools see the change.

**Note:** `setup.sh` uses `ln -sfn`, which will overwrite existing symlinks or files at the target paths. If you have custom skills in `~/.cursor/skills` or `~/.claude/skills`, back them up first or move them into this repo.

## Installation

```bash
git clone <repo-url> ~/agents-kit
~/agents-kit/setup.sh
```

The repo can be cloned anywhere — `setup.sh` resolves its own location automatically.
