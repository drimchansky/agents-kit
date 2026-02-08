#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p ~/.cursor ~/.claude

ln -sfn "$REPO_DIR/AGENTS.md" ~/AGENTS.md
ln -sfn "$REPO_DIR/skills" ~/.cursor/skills
ln -sfn "$REPO_DIR/AGENTS.md" ~/.claude/CLAUDE.md
ln -sfn "$REPO_DIR/skills" ~/.claude/skills

echo "Done. Symlinks created:"
echo "  ~/AGENTS.md         -> $REPO_DIR/AGENTS.md"
echo "  ~/.cursor/skills    -> $REPO_DIR/skills"
echo "  ~/.claude/CLAUDE.md -> $REPO_DIR/AGENTS.md"
echo "  ~/.claude/skills    -> $REPO_DIR/skills"
