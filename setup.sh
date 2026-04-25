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
  local rc=0

  if [ -d "$source" ]; then
    cp -Rf "$source"/ "$target" || rc=$?
  else
    cp -f "$source" "$target" || rc=$?
  fi
  [ $rc -eq 0 ] || return $rc
  echo "  $(basename "$target")"
}

copy_managed_file() {
  local source="$1"
  local target="$2"

  if [ -L "$target" ]; then
    rm "$target" || return 2
  fi

  copy "$source" "$target" || return 2
}

copy_managed_dir() {
  local source="$1"
  local target="$2"

  # If a managed target used to be a symlink, replace it with a real directory copy.
  if [ -L "$target" ]; then
    rm "$target" || return 2
  elif [ -d "$target" ] && [ ! -f "$target/.agents-kit" ]; then
    read -rp "  $(basename "$target") already exists in $(dirname "$target"). Overwrite? [y/N] " answer
    # Return code semantics for callers: 0=installed, 1=user declined, >=2=real failure.
    [[ "$answer" =~ ^[Yy]$ ]] || return 1
  fi

  copy "$source" "$target" || return 2
  touch "$target/.agents-kit" || return 2
}

cleanup_stale() {
  local installed_dir="$1"
  local source_dir="$2"

  for target in "$installed_dir"/*/; do
    [ -d "$target" ] || continue
    [ -f "$target/.agents-kit" ] || continue
    local name
    name="$(basename "$target")"
    if [ ! -d "$source_dir/$name" ]; then
      rm -rf "$target"
      REMOVED_COUNT=$((REMOVED_COUNT + 1))
      echo "  removed stale: $name"
    fi
  done
}

install_skills() {
  local skills_dir="$1"

  for skill in "$REPO_DIR"/skills/*/; do
    local name
    local target
    name="$(basename "$skill")"
    [[ "$name" == .* ]] && continue
    target="$skills_dir/$name"
    local rc=0
    copy_managed_dir "$skill" "$target" || rc=$?
    case $rc in
      0) INSTALLED_COUNT=$((INSTALLED_COUNT + 1)) ;;
      1) ;; # user declined overwrite — skip silently
      *) echo "ERROR: failed to install skill $name (exit $rc)" >&2; exit $rc ;;
    esac
  done

  cleanup_stale "$skills_dir" "$REPO_DIR/skills"
}

install_agent() {
  local name="$1"
  local home_dir="$2"
  local rules_filename="$3"
  local skills_dir="$home_dir/skills"
  local refs_status="installed"

  INSTALLED_COUNT=0
  REMOVED_COUNT=0

  [ -L "$skills_dir" ] && rm "$skills_dir"
  mkdir -p "$home_dir" "$skills_dir"

  echo "Installing $name adapter:"
  copy_managed_file "$REPO_DIR/AGENTS.md" "$home_dir/$rules_filename"
  install_skills "$skills_dir"
  local refs_rc=0
  copy_managed_dir "$REPO_DIR/references" "$home_dir/references" || refs_rc=$?
  case $refs_rc in
    0) ;; # installed (default refs_status)
    1) refs_status="skipped" ;;
    *) echo "ERROR: failed to install references for $name (exit $refs_rc)" >&2; exit $refs_rc ;;
  esac

  echo "  $name: $INSTALLED_COUNT skill(s) installed, $REMOVED_COUNT stale removed, references $refs_status"
}

echo "Installing shared agents kit assets:"
for entry in "${AGENTS[@]}"; do
  IFS='|' read -r name home_dir rules_filename <<< "$entry"
  install_agent "$name" "$home_dir" "$rules_filename"
done
echo "Done."
