#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
HOMES=("${HOME}/.claude" "${HOME}/.codex")
skipped_homes=0

# A symlinked skills dir is kit-owned (safe to reclaim) if it points at an absolute
# .../skills whose parent is a kit checkout (setup.sh + CORE_RULES.md + references/).
# Recognizes an early-kit self-link left behind by a since-moved clone.
is_moved_kit_clone() {
  case "$1" in /*) ;; *) return 1 ;; esac
  [ "$(basename "$1")" = "skills" ] || return 1
  local parent
  parent="$(dirname "$1")"
  [ -f "$parent/setup.sh" ] && [ -f "$parent/CORE_RULES.md" ] && [ -d "$parent/references" ]
}

install_agent() {
  local home_dir="$1"
  local skills_dir="$home_dir/skills"

  # Kit skills resolve ./AGENTS.md and ./references via symlinks to install-root
  # siblings; with user-owned copies in place every installed skill would resolve
  # into non-kit content, so refuse the whole home instead of installing broken.
  local conflict=""
  if [ -L "$home_dir/references" ] || { [ -e "$home_dir/references" ] && [ ! -f "$home_dir/references/.agents-kit" ]; }; then
    conflict="references/"
  fi
  if [ -L "$home_dir/CORE_RULES.md" ] || { [ -e "$home_dir/CORE_RULES.md" ] && [ ! -f "$home_dir/.agents-kit-core-rules" ]; }; then
    conflict="${conflict:+$conflict and }CORE_RULES.md"
  fi
  if [ -n "$conflict" ]; then
    echo "Skipping $home_dir: user-owned $conflict found — kit skills resolve ./references and ./AGENTS.md against install-root copies, so installing would leave every kit skill broken. Move it aside and rerun." >&2
    skipped_homes=1
    return 0
  fi

  # Kit skills carry ../../ relative links (AGENTS.md, references) that resolve only
  # when skills/ is a real directory in $home_dir. A symlinked skills_dir is reclaimed
  # when it's kit-owned — this repo, a dangling leftover, or a since-moved clone — and
  # refused otherwise: installing through a user's symlink would dangle every per-skill link.
  if [ -L "$skills_dir" ]; then
    local link_target
    link_target="$(readlink "$skills_dir")"
    case "$link_target" in
      "$REPO_DIR" | "$REPO_DIR"/*)
        rm "$skills_dir" ;;
      *)
        if [ ! -e "$skills_dir" ]; then
          rm "$skills_dir"
        elif is_moved_kit_clone "$link_target"; then
          rm "$skills_dir"
        else
          echo "Skipping $home_dir: $skills_dir is a symlink to $link_target — kit skills keep ../../ relative links that resolve only when skills/ is a real directory in $home_dir. Move it aside (or make skills/ a real dir) and rerun." >&2
          skipped_homes=1
          return 0
        fi ;;
    esac
  fi
  mkdir -p "$skills_dir"

  echo "Installing into $home_dir:"

  # 1. Remove previously-installed agents-kit skills (anything with the .agents-kit marker).
  #    Sweep leftover staging dirs first, so an interrupt before the atomic mv self-heals.
  for stale in "$skills_dir"/.agents-kit-staging.* "$home_dir"/.agents-kit-references.staging.*; do
    [ -d "$stale" ] && rm -rf "$stale"
  done
  for target in "$skills_dir"/*/; do
    [ -L "${target%/}" ] && continue   # never follow a symlinked entry (rm -rf would hit its target)
    [ -d "$target" ] && [ -f "$target/.agents-kit" ] && rm -rf "$target"
  done
  [ -f "$home_dir/references/.agents-kit" ] && rm -rf "$home_dir/references"
  [ -f "$home_dir/.agents-kit-core-rules" ] && rm -f "$home_dir/CORE_RULES.md" "$home_dir/.agents-kit-core-rules"

  # 2. Copy current skills + references. Skip a same-named user dir. Each item is built
  #    under a hidden .agents-kit-staging.* dir with its marker inside, then atomically
  #    renamed into place, so the visible path is never present-but-unmarked; an
  #    interrupted run leaves only a staging dir, swept in step 1.
  for source in "$REPO_DIR"/skills/*/; do
    local name target staging
    name="$(basename "$source")"
    target="$skills_dir/$name"
    if [ -e "$target" ] || [ -L "$target" ]; then
      echo "  skipped (not kit-managed): $name"
      continue
    fi
    # Preserve per-skill symlinks (AGENTS.md -> ../../CORE_RULES.md, references -> ../../references)
    # with cp -R (no -L) so they resolve to install-root siblings rather than bloating into copies.
    staging="$skills_dir/.agents-kit-staging.$$-$name"
    rm -rf "$staging"
    mkdir "$staging"
    touch "$staging/.agents-kit"
    cp -R "$source"/. "$staging"/
    mv "$staging" "$target"
    echo "  $name"
  done

  # Same staging + atomic-rename pattern as skills; references/ is symlink-free, so
  # cp -RfL (materialize any links) stays correct here.
  local ref_staging="$home_dir/.agents-kit-references.staging.$$"
  rm -rf "$ref_staging"
  mkdir "$ref_staging"
  touch "$ref_staging/.agents-kit"
  cp -RfL "$REPO_DIR/references"/. "$ref_staging"/
  mv "$ref_staging" "$home_dir/references"
  echo "  references"

  touch "$home_dir/.agents-kit-core-rules"
  cp "$REPO_DIR/CORE_RULES.md" "$home_dir/CORE_RULES.md"
  echo "  CORE_RULES.md"

  # 3. Agent definitions — Claude Code only: the kit ships Claude-format .md definitions.
  #    Codex's agents surface (~/.codex/agents/*.toml) would need its own TOML definition.
  if [ "$(basename "$home_dir")" = ".claude" ]; then
    local agents_dir="$home_dir/agents"
    mkdir -p "$agents_dir"
    for marker in "$agents_dir"/.agents-kit-*; do
      [ -f "$marker" ] || continue
      rm -f "$agents_dir/${marker##*.agents-kit-}.md" "$marker"
    done
    for source in "$REPO_DIR"/agents/*.md; do
      local name target
      name="$(basename "$source" .md)"
      target="$agents_dir/$name.md"
      if [ -e "$target" ] || [ -L "$target" ]; then
        echo "  skipped (not kit-managed): agents/$name"
        continue
      fi
      touch "$agents_dir/.agents-kit-$name"
      cp "$source" "$target"
      echo "  agents/$name"
    done
  fi
}

for home in "${HOMES[@]}"; do
  install_agent "$home"
done
if [ "$skipped_homes" -ne 0 ]; then
  echo "Done, but skipped homes were left uninstalled (see above)." >&2
  exit 1
fi
echo "Done."
