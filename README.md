# Agents Kit

Shared rules and skills for Cursor and Claude Code AI coding agents.

## Structure

```
agents-kit/
├── AGENTS.md              # Core rules (agent behavior, workflow)
├── rules/
│   ├── claude             # Claude Code modular rules (~/.claude/rules/)
│   └── cursor             # Cursor modular rules (~/.cursor/rules/)
├── skills/                # Shared skills for both tools
├── setup.sh               # Creates symlinks
└── README.md
```

After running `setup.sh`, symlinks are created:

```
~/AGENTS.md          -> <repo>/AGENTS.md          # Cursor reads via directory walking
~/.claude/CLAUDE.md  -> <repo>/AGENTS.md          # Claude Code core rules
~/.claude/rules      -> <repo>/rules/claude       # Claude Code modular rules
~/.claude/skills     -> <repo>/skills             # Claude Code skills
~/.cursor/rules      -> <repo>/rules/cursor       # Cursor modular rules
~/.cursor/skills     -> <repo>/skills             # Cursor skills
```

## How It Works

The kit has three parts:

- **`AGENTS.md`** — Core agent behavior rules (decision making, communication, workflow). Loaded into every conversation.
- **`rules/`** — Modular rules for code style and language conventions. Each tool reads from its own format: plain `.md` for Claude Code, `.mdc` with YAML frontmatter for Cursor. Loaded contextually based on file type.
- **`skills/`** — Shared skills directory. Both `~/.cursor/skills` and `~/.claude/skills` point here.

Edit once, both tools see the change.

**Note:** `setup.sh` uses `ln -sfn`, which will overwrite existing symlinks or files at the target paths. If you have custom rules in `~/.cursor/rules` or `~/.claude/rules`, back them up first or move them into this repo.

## Installation

```bash
git clone <repo-url> ~/agents-kit
~/agents-kit/setup.sh
```

The repo can be cloned anywhere — `setup.sh` resolves its own location automatically.
