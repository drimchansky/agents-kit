#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_HOME="${HOME}/.claude"
CODEX_HOME="${HOME}/.codex"

copy() {
  local source="$1"
  local target="$2"

  if [ -d "$source" ]; then
    cp -Rf "$source"/ "$target"
  else
    cp -f "$source" "$target"
  fi
  echo "  $(basename "$target")"
}

copy_managed_file() {
  local source="$1"
  local target="$2"

  if [ -L "$target" ]; then
    rm "$target"
  fi

  copy "$source" "$target"
}

copy_skill_dir() {
  local source="$1"
  local target="$2"

  # If a managed target used to be a symlink, replace it with a real directory copy.
  if [ -L "$target" ]; then
    rm "$target"
  elif [ -d "$target" ] && [ ! -f "$target/.agents-kit" ]; then
    read -rp "  $(basename "$target") already exists in $(dirname "$target"). Overwrite? [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]] || return 0
  fi

  copy "$source" "$target"
  touch "$target/.agents-kit"
}

install_skills() {
  local skills_dir="$1"

  for skill in "$REPO_DIR"/skills/*/; do
    local name
    local target
    name="$(basename "$skill")"
    target="$skills_dir/$name"
    copy_skill_dir "$skill" "$target"
  done
}

install_claude() {
  local skills_dir="$CLAUDE_HOME/skills"

  [ -L "$skills_dir" ] && rm "$skills_dir"
  mkdir -p "$CLAUDE_HOME" "$skills_dir"

  echo "Installing Claude adapter:"
  copy_managed_file "$REPO_DIR/AGENTS.md" "$CLAUDE_HOME/CLAUDE.md"
  install_skills "$skills_dir"
}

install_codex() {
  local skills_dir="$CODEX_HOME/skills"

  [ -L "$skills_dir" ] && rm "$skills_dir"
  mkdir -p "$CODEX_HOME" "$skills_dir"

  echo "Installing Codex adapter:"
  copy_managed_file "$REPO_DIR/AGENTS.md" "$CODEX_HOME/AGENTS.md"
  install_skills "$skills_dir"
}

echo "Installing shared agents kit assets:"
install_claude
install_codex
echo "Done."
