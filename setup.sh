#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
HOMES=("${HOME}/.claude" "${HOME}/.codex")

install_agent() {
  local home_dir="$1"
  local skills_dir="$home_dir/skills"

  [ -L "$skills_dir" ] && rm "$skills_dir"
  mkdir -p "$skills_dir"

  echo "Installing into $home_dir:"

  # 1. Remove previously-installed agents-kit skills (anything with the .agents-kit marker).
  for target in "$skills_dir"/*/; do
    [ -d "$target" ] && [ -f "$target/.agents-kit" ] && rm -rf "$target"
  done
  [ -f "$home_dir/references/.agents-kit" ] && rm -rf "$home_dir/references"
  [ -f "$home_dir/.agents-kit-core-rules" ] && rm -f "$home_dir/CORE_RULES.md" "$home_dir/.agents-kit-core-rules"

  # 2. Copy current skills + references. Skip silently if a same-named user dir exists.
  for source in "$REPO_DIR"/skills/*/; do
    local name target
    name="$(basename "$source")"
    target="$skills_dir/$name"
    if [ -e "$target" ]; then
      echo "  skipped (not kit-managed): $name"
      continue
    fi
    # Preserve per-skill symlinks (AGENTS.md -> ../../CORE_RULES.md, references -> ../../references)
    # so they resolve to install-root siblings rather than getting bloated into per-skill copies.
    cp -R "$source" "$target"
    touch "$target/.agents-kit"
    echo "  $name"
  done

  if [ -e "$home_dir/references" ]; then
    echo "  skipped (not kit-managed): references"
  else
    cp -RfL "$REPO_DIR/references" "$home_dir/references"
    touch "$home_dir/references/.agents-kit"
    echo "  references"
  fi

  if [ -e "$home_dir/CORE_RULES.md" ]; then
    echo "  skipped (not kit-managed): CORE_RULES.md"
  else
    cp "$REPO_DIR/CORE_RULES.md" "$home_dir/CORE_RULES.md"
    touch "$home_dir/.agents-kit-core-rules"
    echo "  CORE_RULES.md"
  fi
}

for home in "${HOMES[@]}"; do
  install_agent "$home"
done
echo "Done."
