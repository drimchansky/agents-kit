#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
HOMES=("${HOME}/.claude" "${HOME}/.codex")
skipped_homes=0

install_agent() {
  local home_dir="$1"
  local skills_dir="$home_dir/skills"

  # Kit skills resolve ./AGENTS.md and ./references via symlinks to install-root
  # siblings; with user-owned copies in place every installed skill would resolve
  # into non-kit content, so refuse the whole home instead of installing broken.
  local conflict=""
  [ -e "$home_dir/references" ] && [ ! -f "$home_dir/references/.agents-kit" ] && conflict="references/"
  if [ -e "$home_dir/CORE_RULES.md" ] && [ ! -f "$home_dir/.agents-kit-core-rules" ]; then
    conflict="${conflict:+$conflict and }CORE_RULES.md"
  fi
  if [ -n "$conflict" ]; then
    echo "Skipping $home_dir: user-owned $conflict found — kit skills resolve ./references and ./AGENTS.md against install-root copies, so installing would leave every kit skill broken. Move it aside and rerun." >&2
    skipped_homes=1
    return 0
  fi

  # Early kit versions symlinked the whole skills dir at this repo; remove only
  # links owned by the repo (or dangling leftovers). A user-managed symlink is
  # kept — the install follows it, same as installing into a real user dir.
  if [ -L "$skills_dir" ]; then
    case "$(readlink "$skills_dir")" in
      "$REPO_DIR" | "$REPO_DIR"/*) rm "$skills_dir" ;;
      *) [ -e "$skills_dir" ] || rm "$skills_dir" ;;
    esac
  fi
  mkdir -p "$skills_dir"

  echo "Installing into $home_dir:"

  # 1. Remove previously-installed agents-kit skills (anything with the .agents-kit marker).
  for target in "$skills_dir"/*/; do
    [ -d "$target" ] && [ -f "$target/.agents-kit" ] && rm -rf "$target"
  done
  [ -f "$home_dir/references/.agents-kit" ] && rm -rf "$home_dir/references"
  [ -f "$home_dir/.agents-kit-core-rules" ] && rm -f "$home_dir/CORE_RULES.md" "$home_dir/.agents-kit-core-rules"

  # 2. Copy current skills + references. Skip silently if a same-named user dir
  #    exists. Markers go in before the copy so an interrupted run leaves a
  #    marked partial that step 1 cleans up on the next run.
  for source in "$REPO_DIR"/skills/*/; do
    local name target
    name="$(basename "$source")"
    target="$skills_dir/$name"
    if [ -e "$target" ]; then
      echo "  skipped (not kit-managed): $name"
      continue
    fi
    mkdir "$target"
    touch "$target/.agents-kit"
    # Preserve per-skill symlinks (AGENTS.md -> ../../CORE_RULES.md, references -> ../../references)
    # so they resolve to install-root siblings rather than getting bloated into per-skill copies.
    cp -R "$source"/. "$target"/
    echo "  $name"
  done

  mkdir "$home_dir/references"
  touch "$home_dir/references/.agents-kit"
  cp -RfL "$REPO_DIR/references"/. "$home_dir/references"/
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
      if [ -e "$target" ]; then
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
