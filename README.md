# Agents Kit

Shared instructions and skills for Claude Code, Codex, and other coding agents.

## Structure

```
agents-kit/
├── AGENTS.md              # Shared rules (canonical source)
├── skills/                # Shared skills
├── setup.sh               # Installs Claude and Codex assets
└── README.md
```

After running `setup.sh`, the installer updates agent-specific locations:

```
~/.claude/CLAUDE.md
~/.claude/skills/_typescript/
~/.claude/skills/code-review/
~/.codex/AGENTS.md
~/.codex/skills/_typescript/
~/.codex/skills/code-review/
...                              # one directory per skill
```

## How It Works

The kit has two shared parts plus agent adapters:

- **`AGENTS.md`** — The canonical, agent-neutral rules file. Codex can use it directly from the repo root, and Claude receives a copied `CLAUDE.md` generated from the same content.
- **`skills/`** — Shared skills copied into each supported agent's skill directory. This lets you keep local agent-specific skills alongside the ones from this repo.
- **Adapters** — `setup.sh` maps the shared content into each agent's expected home directory and naming conventions.

**Note:** If you have your own skill with the same name as one in this repo, `setup.sh` will ask before overwriting it.

## Workflow

The skills follow a natural development workflow:

1. **Understand** — `explore` — Explore how something works: code, libraries, APIs, concepts, or architecture. Also use before planning to surface constraints, blast radius, and known alternatives.
2. **Plan** — `design` or `refactor` — Break down a task into steps, compare approaches, and define scope before coding.
3. **Build** — `implement` — Write production-quality code following project patterns.
4. **Review** — `code-review` — Check for bugs, impact, and adherence to project patterns.
5. **Verify** — `verify` — Verify a reported issue is real, identify root cause, and assess severity.

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
