#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

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

skills_dir=~/.claude/skills

# If skills dir is a symlink (e.g. from a previous setup), remove it
# so we can create a real directory with individual skill copies
[ -L "$skills_dir" ] && rm "$skills_dir"

mkdir -p ~/.claude "$skills_dir"

echo "Copying files:"

# Remove old CLAUDE.md symlink from previous setup
[ -L ~/.claude/CLAUDE.md ] && rm ~/.claude/CLAUDE.md

copy "$REPO_DIR/CLAUDE.md" ~/.claude/CLAUDE.md

for skill in "$REPO_DIR"/skills/*/; do
  name="$(basename "$skill")"
  target="$skills_dir/$name"

  # Remove old symlink from previous setup
  if [ -L "$target" ]; then
    rm "$target"
  elif [ -d "$target" ] && [ ! -f "$target/.agents-kit" ]; then
    read -rp "  $name already exists in $skills_dir. Overwrite? [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]] || continue
  fi

  copy "$skill" "$target"
  touch "$target/.agents-kit"
done

echo "Done."
