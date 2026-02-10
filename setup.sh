#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

link() {
  local source="$1"
  local target="$2"

  ln -sfn "$source" "$target"
  echo "  $target -> $source"
}

mkdir -p ~/.cursor ~/.claude

echo "Setting up symlinks:"
link "$REPO_DIR/AGENTS.md" ~/AGENTS.md             # Cursor reads via directory walking
link "$REPO_DIR/AGENTS.md" ~/.claude/CLAUDE.md     # Claude Code core rules
link "$REPO_DIR/skills" ~/.claude/skills           # Claude Code skills
link "$REPO_DIR/skills" ~/.cursor/skills           # Cursor skills
echo "Done."
