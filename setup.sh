#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# Agent configurations: name|home_dir|legacy_rules_filename
# `legacy_rules_filename` is only used to migrate old installs (delete the
# previously-copied global rules file). The kit no longer installs a global
# rules file — rules are loaded per-skill via the sibling AGENTS.md inside
# each skill directory.
AGENTS=(
  "Claude|${HOME}/.claude|CLAUDE.md"
  "Codex|${HOME}/.codex|AGENTS.md"
)

copy() {
  local source="$1"
  local target="$2"
  local rc=0

  if [ -d "$source" ]; then
    # -L dereferences symlinks during the recursive copy so that the
    # per-skill AGENTS.md (a relative symlink to the kit-root CORE_RULES.md)
    # materializes as a real file in the destination, instead of being
    # copied as a dangling symlink.
    cp -RfL "$source"/ "$target" || rc=$?
  else
    cp -f "$source" "$target" || rc=$?
  fi
  [ $rc -eq 0 ] || return $rc
  echo "  $(basename "$target")"
}

copy_managed_dir() {
  local source="$1"
  local target="$2"

  # If a managed target used to be a symlink, replace it with a real directory copy.
  if [ -L "$target" ]; then
    rm "$target" || return 2
  elif [ -d "$target" ]; then
    if [ -f "$target/.agents-kit" ]; then
      # Kit-managed: wipe before re-copy so files removed from source
      # don't accumulate in the install destination.
      rm -rf "$target" || return 2
    else
      # Not kit-managed (no .agents-kit marker). Replacing means deleting the
      # entire directory and its contents — including any user files inside —
      # before copying the kit's version. Require typing the full word "yes"
      # so a stray keystroke can't trigger destructive replacement.
      # No TTY → can't prompt safely. Skip with a visible log line so unattended
      # runs don't silently leave a stale non-kit-managed directory in place.
      if [ ! -t 0 ]; then
        echo "  $(basename "$target") exists in $(dirname "$target") and is not kit-managed — skipped (no TTY to confirm destructive replace)"
        return 1
      fi
      read -rp "  $(basename "$target") already exists in $(dirname "$target") and is not kit-managed. Replacing it will DELETE its entire contents (including any user files inside). Type 'yes' to confirm, anything else to skip: " answer || true
      # Return code semantics for callers: 0=installed, 1=user declined, >=2=real failure.
      [[ "$answer" == "yes" ]] || return 1
      rm -rf "$target" || return 2
    fi
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

prompt_remove_legacy_rules() {
  local home_dir="$1"
  local rules_filename="$2"
  local target="$home_dir/$rules_filename"
  local sentinel="$home_dir/.agents-kit-migration-acked"
  local answer=""

  [ -f "$target" ] || return 0
  # No TTY → can't prompt safely. Don't write the sentinel either, so the
  # next interactive run still gets a chance to ask.
  [ -t 0 ] || return 0
  # One-shot: once the user has answered (yes or no), don't ask again on
  # future setup.sh runs. Delete the sentinel to re-arm the prompt.
  [ -f "$sentinel" ] && return 0

  read -rp "  Found existing global rules file at $target. If it was installed by an earlier agents-kit, you can delete it now (the kit no longer ships one). If you wrote it yourself, keep it. Delete? [y/N] " answer || true
  if [[ "$answer" =~ ^[Yy]$ ]]; then
    rm -f "$target" && echo "  removed: $target"
  else
    echo "  kept: $target"
  fi
  : > "$sentinel"
}

install_agent() {
  local name="$1"
  local home_dir="$2"
  local legacy_rules_filename="$3"
  local skills_dir="$home_dir/skills"
  local refs_status="installed"

  INSTALLED_COUNT=0
  REMOVED_COUNT=0

  [ -L "$skills_dir" ] && rm "$skills_dir"
  mkdir -p "$home_dir" "$skills_dir"

  echo "Installing $name adapter:"
  install_skills "$skills_dir"
  local refs_rc=0
  copy_managed_dir "$REPO_DIR/references" "$home_dir/references" || refs_rc=$?
  case $refs_rc in
    0) ;; # installed (default refs_status)
    1) refs_status="skipped" ;;
    *) echo "ERROR: failed to install references for $name (exit $refs_rc)" >&2; exit $refs_rc ;;
  esac

  prompt_remove_legacy_rules "$home_dir" "$legacy_rules_filename"

  echo "  $name: $INSTALLED_COUNT skill(s) installed, $REMOVED_COUNT stale removed, references $refs_status"
}

echo "Installing shared agents kit assets:"
for entry in "${AGENTS[@]}"; do
  IFS='|' read -r name home_dir legacy_rules_filename <<< "$entry"
  install_agent "$name" "$home_dir" "$legacy_rules_filename"
done
echo "Done."
