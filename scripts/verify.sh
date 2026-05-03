#!/usr/bin/env bash
# Run the automatable verification checks documented in AGENTS.md
# (tests 1–6). Test 7 (migration prompt) requires human interaction and
# is not covered here. Test 8 (plugin install/validate) is automated in
# .github/workflows/test-plugin-install.yml — it requires a Node toolchain
# plus the Claude Code CLI, so it lives in CI rather than this script.
#
# Run from the repo root: ./scripts/verify.sh
# CI runs the same script — keep this file as the single source of truth.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

fail() { printf '\033[31mFAIL\033[0m %s\n' "$*" >&2; exit 1; }
pass() { printf '\033[32mPASS\033[0m %s\n' "$*"; }
step() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }

step "1. Shell syntax"
bash -n setup.sh || fail "setup.sh has shell syntax errors"
bash -n scripts/verify.sh || fail "scripts/verify.sh has shell syntax errors"
pass "shell syntax"

step "2. Plugin manifests parse and contain required fields"
python3 - <<'PY' || fail "plugin manifests"
import json, sys
p = json.load(open(".claude-plugin/plugin.json"))
m = json.load(open(".claude-plugin/marketplace.json"))
required_p = {"name", "description", "version"}
required_m = {"name", "owner", "plugins"}
required_entry = {"name", "description", "source"}
missing = required_p - p.keys()
if missing:
    sys.exit(f"plugin.json missing keys: {missing}")
missing = required_m - m.keys()
if missing:
    sys.exit(f"marketplace.json missing keys: {missing}")
if not isinstance(m["plugins"], list) or not m["plugins"]:
    sys.exit("marketplace.json has no plugins")
for entry in m["plugins"]:
    missing = required_entry - entry.keys()
    if missing:
        sys.exit(f"marketplace plugin entry missing keys {missing}: {entry}")
if not any(entry["name"] == p["name"] for entry in m["plugins"]):
    sys.exit(f"marketplace.json doesn't list plugin {p['name']!r}")
PY
pass "plugin manifests"

step "3. Symlink contract"
broken=0
for link in skills/*/AGENTS.md; do
  if ! { [ -L "$link" ] && [ "$(readlink "$link")" = "../../CORE_RULES.md" ] && [ -f "$link" ]; }; then
    printf '  broken: %s\n' "$link" >&2
    broken=1
  fi
done
[ $broken -eq 0 ] || fail "one or more skill AGENTS.md symlinks are broken"
pass "symlink contract"

step "4. Directive contract"
# Engineering skills carry a sibling AGENTS.md symlink and must include the
# Core Rules directive. Standalone skills (no symlink) are exempt by design.
engineering_skills=()
for skill in skills/*/; do
  [ -L "${skill%/}/AGENTS.md" ] && engineering_skills+=("${skill%/}/SKILL.md")
done
if [ ${#engineering_skills[@]} -gt 0 ]; then
  missing=$(grep -L "## Core Rules" "${engineering_skills[@]}" || true)
  [ -z "$missing" ] || fail "SKILL.md files missing '## Core Rules' heading: $missing"
  missing=$(grep -L "✅ Core agents-kit rules applied (./AGENTS.md)" "${engineering_skills[@]}" || true)
  [ -z "$missing" ] || fail "SKILL.md files missing confirmation line: $missing"
fi
stale=$(grep -rln '\.\./\.\./AGENTS\.md' skills/ || true)
[ -z "$stale" ] || fail "stale '../../AGENTS.md' refs found: $stale"
pass "directive contract"

step "5. Fresh install layout"
fake_home="$(mktemp -d)"
trap 'rm -rf "$fake_home"' EXIT
HOME="$fake_home" ./setup.sh >/dev/null
[ ! -f "$fake_home/.claude/CLAUDE.md" ] || fail "global CLAUDE.md was written"
[ ! -f "$fake_home/.codex/AGENTS.md" ] || fail "global ~/.codex/AGENTS.md was written"
for agent in .claude .codex; do
  for skill in skills/*/; do
    # Skip standalone skills — they ship without a sibling AGENTS.md and the
    # install destination correctly has none either.
    [ -L "${skill%/}/AGENTS.md" ] || continue
    name=$(basename "$skill")
    dest="$fake_home/$agent/skills/$name/AGENTS.md"
    if ! { [ -f "$dest" ] && [ ! -L "$dest" ] && diff -q "$dest" CORE_RULES.md >/dev/null; }; then
      fail "fresh install produced bad AGENTS.md at $dest"
    fi
  done
done
pass "fresh install"

step "6. Stale-file cleanup on re-install"
canary="$fake_home/.claude/skills/explore/STALE_CANARY"
touch "$canary"
HOME="$fake_home" ./setup.sh >/dev/null
[ ! -e "$canary" ] || fail "stale file survived re-install"
pass "stale-file cleanup"

printf '\n\033[32mAll automatable checks passed.\033[0m\n'
printf 'Manual checks not covered by this script:\n'
printf '  - Test 7: migration prompt UX (interactive)\n'
