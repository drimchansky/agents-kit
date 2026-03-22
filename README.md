# Agents Kit

My skills for Claude Code.

## Structure

```
agents-kit/
├── CLAUDE.md              # Core rules (behavior overrides)
├── skills/                # Shared skills
├── setup.sh               # Copies files to ~/.claude
└── README.md
```

After running `setup.sh`, files are copied to `~/.claude/`:

```
~/.claude/CLAUDE.md
~/.claude/skills/_typescript/
~/.claude/skills/code-review/
...                              # one directory per skill
```

## How It Works

The kit has two parts:

- **`CLAUDE.md`** — Behavioral overrides that aren't part of Claude's defaults (scope matching, git constraints, dependency rules). Loaded into every conversation.
- **`skills/`** — Each skill is copied individually into `~/.claude/skills/`. This lets you keep your own skills alongside the ones from this repo. Skills prefixed with `_` are auto-applied by convention (see `CLAUDE.md`).

**Note:** If you have your own skill with the same name as one in this repo, `setup.sh` will ask before overwriting it.

## Workflow

The skills follow a natural development workflow:

1. **Understand** — `/explore` — Explore how something works — code, libraries, APIs, concepts, or architecture. Also use before planning to surface constraints, blast radius, and known alternatives.
2. **Plan** — `/design` or `/refactor` — Break down a task into steps, compare approaches, and define scope before coding
3. **Build** — `/implement` — Write production-quality code following project patterns
4. **Review** — `/code-review` — Check for bugs, impact, and adherence to project patterns
5. **Verify** — `/verify` — Verify a reported issue is real, identify root cause, and assess severity

You don't need to use every step — pick whichever skills fit the task at hand.

## Installation

```bash
git clone git@github.com:drimchansky/agents-kit.git
~/agents-kit/setup.sh
```

The repo can be cloned anywhere — `setup.sh` resolves its own location automatically.

To update later:

```bash
cd ~/agents-kit && git pull
./setup.sh
```
