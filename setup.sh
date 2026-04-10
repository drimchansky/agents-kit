#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# Agent configurations: name|home_dir|rules_filename
AGENTS=(
  "Claude|${HOME}/.claude|CLAUDE.md"
  "Codex|${HOME}/.codex|AGENTS.md"
)

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

copy_managed_dir() {
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
    [[ "$name" == .* ]] && continue
    target="$skills_dir/$name"
    copy_managed_dir "$skill" "$target"
  done
}

install_agent() {
  local name="$1"
  local home_dir="$2"
  local rules_filename="$3"
  local skills_dir="$home_dir/skills"

  [ -L "$skills_dir" ] && rm "$skills_dir"
  mkdir -p "$home_dir" "$skills_dir"

  echo "Installing $name adapter:"
  copy_managed_file "$REPO_DIR/AGENTS.md" "$home_dir/$rules_filename"
  install_skills "$skills_dir"
  copy_managed_dir "$REPO_DIR/references" "$home_dir/references"
}

echo "Installing shared agents kit assets:"
for entry in "${AGENTS[@]}"; do
  IFS='|' read -r name home_dir rules_filename <<< "$entry"
  install_agent "$name" "$home_dir" "$rules_filename"
done
echo "Done."
