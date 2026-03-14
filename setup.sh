#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

link() {
  local source="$1"
  local target="$2"

  ln -sfn "$source" "$target"
  echo "  $target -> $source"
}

skills_dir=~/.claude/skills

# If skills dir is a symlink (e.g. from a previous setup), remove it
# so we can create a real directory with individual skill symlinks
[ -L "$skills_dir" ] && rm "$skills_dir"

mkdir -p ~/.claude "$skills_dir"

echo "Setting up symlinks:"
link "$REPO_DIR/CLAUDE.md" ~/.claude/CLAUDE.md

for skill in "$REPO_DIR"/skills/*/; do
  name="$(basename "$skill")"
  target="$skills_dir/$name"

  if [ -d "$target" ] && [ ! -L "$target" ]; then
    read -rp "  $name already exists in $skills_dir. Overwrite? [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]] || continue
    rm -rf "$target"
  fi

  if [ -L "$target" ] && [ "$(readlink "$target")" != "$skill" ]; then
    read -rp "  $name symlink exists (-> $(readlink "$target")). Overwrite? [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]] || continue
  fi

  link "$skill" "$target"
done

echo "Done."
