# Agents Kit

Shared rules and skills for Cursor and Claude Code AI coding agents.

## Structure

```
agents-kit/
├── AGENTS.md       # Rules (single source of truth)
├── skills          # Skills (single source of truth)
├── setup.sh        # Creates symlinks at ~/
├── README.md
└── .gitignore
```

After running `setup.sh`, symlinks are created at `~/`:

```
~/AGENTS.md             -> <repo>/AGENTS.md     # Cursor reads via directory walking
~/.cursor/skills        -> <repo>/skills        # Cursor user-level skills
~/.claude/CLAUDE.md     -> <repo>/AGENTS.md     # Claude Code user-level rules
~/.claude/skills        -> <repo>/skills        # Claude Code user-level skills
```

## How It Works

Instead of duplicating configuration across tool-specific directories, this kit uses **symlinks** to point each tool to a shared location:

- **`AGENTS.md`** — The single rules file. Cursor reads it directly from `~/`; Claude Code reads it via `~/.claude/CLAUDE.md`.
- **`skills/`** — The single skills directory. Both `~/.cursor/skills` and `~/.claude/skills` point here.

Edit once, both tools see the change.

## Installation

```bash
git clone <repo-url> ~/agents-kit
~/agents-kit/setup.sh
```

The repo can be cloned anywhere — `setup.sh` resolves its own location automatically.
