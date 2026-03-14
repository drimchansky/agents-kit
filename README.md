# Agents Kit

My skills for Claude Code.

## Structure

```
agents-kit/
├── CLAUDE.md              # Core rules (behavior overrides)
├── skills/                # Shared skills
├── setup.sh               # Creates symlinks
└── README.md
```

After running `setup.sh`, symlinks are created:

```
~/.claude/CLAUDE.md              -> <repo>/CLAUDE.md
~/.claude/skills/_typescript/    -> <repo>/skills/_typescript/
~/.claude/skills/code-review/    -> <repo>/skills/code-review/
...                              # one symlink per skill
```

## How It Works

The kit has two parts:

- **`CLAUDE.md`** — Behavioral overrides that aren't part of Claude's defaults (scope matching, git constraints, dependency rules). Loaded into every conversation.
- **`skills/`** — Each skill is symlinked individually into `~/.claude/skills/`. This lets you keep your own skills alongside the ones from this repo. Skills prefixed with `_` are auto-applied by convention (see `CLAUDE.md`).

**Note:** If a skill with the same name already exists in `~/.claude/skills/`, `setup.sh` will ask before overwriting.

## Installation

```bash
git clone git@github.com:drimchansky/agents-kit.git
~/agents-kit/setup.sh
```

The repo can be cloned anywhere — `setup.sh` resolves its own location automatically.

To update later:

```bash
cd ~/agents-kit && git pull
```

No need to re-run `setup.sh` — symlinks point to the repo, so pulling updates the skills in place.
