#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SETUP="$REPO_DIR/setup.sh"
OPERATOR_HOME="$HOME"
TEMP_BASE="${TMPDIR:-/tmp}"
TEMP_BASE="${TEMP_BASE%/}"
TEST_ROOT="$(mktemp -d "$TEMP_BASE/agents-kit-setup-install.XXXXXX")"

fail() {
  echo "not ok - $*" >&2
  exit 1
}

pass() {
  echo "ok - $*"
}

cleanup() {
  [ -d "$TEST_ROOT" ] || return 0
  case "$TEST_ROOT" in
    "$TEMP_BASE"/agents-kit-setup-install.*) rm -rf "$TEST_ROOT" ;;
    *) echo "Refusing to remove unexpected test root: $TEST_ROOT" >&2 ;;
  esac
}
trap cleanup EXIT

case "$TEST_ROOT" in
  "$TEMP_BASE"/agents-kit-setup-install.*) ;;
  *) fail "mktemp returned an unexpected path: $TEST_ROOT" ;;
esac
[ "$TEST_ROOT" != "$OPERATOR_HOME" ] || fail "temporary root resolved to the operator HOME"
[ ! -L "$TEST_ROOT" ] || fail "temporary root must not be a symlink"

validate_isolated_home() {
  local candidate="$1"
  case "$candidate" in
    "$TEST_ROOT"/*) ;;
    *) fail "refusing to use HOME outside the validated test root: $candidate" ;;
  esac
  [ -d "$candidate" ] || fail "isolated HOME does not exist: $candidate"
  [ ! -L "$candidate" ] || fail "isolated HOME must not be a symlink: $candidate"
  [ "$candidate" != "$OPERATOR_HOME" ] || fail "refusing to use the operator HOME"
}

run_setup() {
  local isolated_home="$1"
  local log_file="$2"
  validate_isolated_home "$isolated_home"
  if ! HOME="$isolated_home" bash "$SETUP" >"$log_file" 2>&1; then
    sed -n '1,240p' "$log_file" >&2
    fail "setup.sh failed for isolated HOME $isolated_home"
  fi
}

assert_file() {
  [ -f "$1" ] || fail "expected file: $1"
}

assert_absent() {
  [ ! -e "$1" ] && [ ! -L "$1" ] || fail "expected path to remain absent: $1"
}

assert_same_bytes() {
  cmp -s "$1" "$2" || fail "files differ: $1 and $2"
}

verify_shared_payload() {
  local host_home="$1"
  local source name target

  assert_file "$host_home/.agents-kit-core-rules"
  assert_same_bytes "$REPO_DIR/CORE_RULES.md" "$host_home/CORE_RULES.md"
  assert_file "$host_home/references/.agents-kit"
  diff -r -x .agents-kit "$REPO_DIR/references" "$host_home/references" >/dev/null ||
    fail "installed references differ in $host_home"

  for source in "$REPO_DIR"/skills/*/; do
    name="$(basename "$source")"
    target="$host_home/skills/$name"
    assert_file "$target/.agents-kit"
    diff -r -x .agents-kit "${source%/}" "$target" >/dev/null ||
      fail "installed skill differs: $target"
  done
}

verify_agent() {
  local host_home="$1"
  local extension="$2"
  local label="$3"

  assert_file "$host_home/agents/.agents-kit-executor"
  assert_same_bytes \
    "$REPO_DIR/agents/executor.$extension" \
    "$host_home/agents/executor.$extension"
  pass "$label executor definition matches its source"
}

PRIMARY_HOME="$TEST_ROOT/primary-home"
mkdir "$PRIMARY_HOME"
run_setup "$PRIMARY_HOME" "$TEST_ROOT/clean-install.log"

verify_agent "$PRIMARY_HOME/.claude" "md" "Claude clean install"
verify_agent "$PRIMARY_HOME/.codex" "toml" "Codex clean install"
assert_absent "$PRIMARY_HOME/.claude/agents/executor.toml"
assert_absent "$PRIMARY_HOME/.codex/agents/executor.md"
pass "clean install excludes foreign native agent formats"
verify_shared_payload "$PRIMARY_HOME/.claude"
pass "Claude shared skills, references, and CORE_RULES.md install unchanged"
verify_shared_payload "$PRIMARY_HOME/.codex"
pass "Codex shared skills, references, and CORE_RULES.md install unchanged"

TOML_PYTHON=""
for candidate in python3 python3.14 python3.13 python3.12 python3.11; do
  if command -v "$candidate" >/dev/null 2>&1 &&
    "$candidate" -c 'import tomllib' >/dev/null 2>&1; then
    TOML_PYTHON="$candidate"
    break
  fi
done
if [ -n "$TOML_PYTHON" ]; then
  "$TOML_PYTHON" -c \
    'import sys, tomllib; tomllib.load(open(sys.argv[1], "rb"))' \
    "$PRIMARY_HOME/.codex/agents/executor.toml"
  pass "installed Codex executor TOML parses"
else
  pass "Codex executor TOML parse skipped because no compatible Python is available"
fi

if command -v codex >/dev/null 2>&1; then
  DOCTOR_LOG="$TEST_ROOT/codex-doctor-summary.log"
  set +e
  CODEX_HOME="$PRIMARY_HOME/.codex" \
    codex --strict-config doctor --summary >"$DOCTOR_LOG" 2>&1
  DOCTOR_STATUS=$?
  set -e

  DOCTOR_CONFIG_LINE="$(
    awk '
      $0 == "Configuration" { in_configuration = 1; next }
      in_configuration && /config[[:space:]]+loaded/ { print; exit }
    ' "$DOCTOR_LOG"
  )"
  case "$DOCTOR_CONFIG_LINE" in
    *"✓ config"*)
      pass "Codex strict-config doctor reports a valid configuration (exit $DOCTOR_STATUS only reflects environmental diagnostics)"
      ;;
    *"⚠ config"*)
      DOCTOR_DETAIL_LOG="$TEST_ROOT/codex-doctor-detail.log"
      set +e
      CODEX_HOME="$PRIMARY_HOME/.codex" \
        codex --strict-config doctor --no-color --ascii >"$DOCTOR_DETAIL_LOG" 2>&1
      set -e
      if grep -Eiq \
        'malformed agent|agent role definition|custom[- ]agent.*(error|invalid|malformed)' \
        "$DOCTOR_DETAIL_LOG"; then
        sed -n '1,240p' "$DOCTOR_DETAIL_LOG" >&2
        fail "Codex doctor reported a custom-agent error"
      fi
      pass "Codex strict-config doctor reports no configuration or custom-agent errors"
      ;;
    *)
      sed -n '1,240p' "$DOCTOR_LOG" >&2
      fail "Codex strict-config doctor did not report a valid configuration"
      ;;
  esac
else
  pass "Codex strict-config doctor skipped because codex is unavailable"
fi

printf '%s\n' 'stale managed Claude definition' \
  >"$PRIMARY_HOME/.claude/agents/executor.md"
printf '%s\n' 'stale managed Codex definition' \
  >"$PRIMARY_HOME/.codex/agents/executor.toml"
printf '%s\n' 'stale managed skill' \
  >"$PRIMARY_HOME/.claude/skills/translate/SKILL.md"
printf '%s\n' 'stale managed skill' \
  >"$PRIMARY_HOME/.codex/skills/translate/SKILL.md"
printf '%s\n' 'stale managed reference' \
  >"$PRIMARY_HOME/.claude/references/workflow/executor-contract.md"
printf '%s\n' 'stale managed reference' \
  >"$PRIMARY_HOME/.codex/references/workflow/executor-contract.md"
printf '%s\n' 'stale managed core rules' \
  >"$PRIMARY_HOME/.claude/CORE_RULES.md"
printf '%s\n' 'stale managed core rules' \
  >"$PRIMARY_HOME/.codex/CORE_RULES.md"

run_setup "$PRIMARY_HOME" "$TEST_ROOT/managed-reinstall.log"
verify_agent "$PRIMARY_HOME/.claude" "md" "Claude managed reinstall"
verify_agent "$PRIMARY_HOME/.codex" "toml" "Codex managed reinstall"
verify_shared_payload "$PRIMARY_HOME/.claude"
verify_shared_payload "$PRIMARY_HOME/.codex"
pass "managed reinstall refreshes the unchanged shared payload"

mkdir "$PRIMARY_HOME/.claude/skills/retired-fixture" \
  "$PRIMARY_HOME/.codex/skills/retired-fixture"
touch "$PRIMARY_HOME/.claude/skills/retired-fixture/.agents-kit" \
  "$PRIMARY_HOME/.codex/skills/retired-fixture/.agents-kit"
printf '%s\n' 'retired managed skill' \
  >"$PRIMARY_HOME/.claude/skills/retired-fixture/SKILL.md"
printf '%s\n' 'retired managed skill' \
  >"$PRIMARY_HOME/.codex/skills/retired-fixture/SKILL.md"

run_setup "$PRIMARY_HOME" "$TEST_ROOT/retired-skill.log"
assert_absent "$PRIMARY_HOME/.claude/skills/retired-fixture"
assert_absent "$PRIMARY_HOME/.codex/skills/retired-fixture"
verify_shared_payload "$PRIMARY_HOME/.claude"
verify_shared_payload "$PRIMARY_HOME/.codex"
pass "reinstall removes a marker-owned skill dropped from the source set"

mkdir "$TEST_ROOT/snapshots"
mkdir "$PRIMARY_HOME/.claude/skills/retired-fixture" \
  "$PRIMARY_HOME/.codex/skills/retired-fixture"
printf '%s\n' 'user-owned retired-name skill' \
  >"$PRIMARY_HOME/.claude/skills/retired-fixture/SKILL.md"
printf '%s\n' 'user-owned retired-name skill' \
  >"$PRIMARY_HOME/.codex/skills/retired-fixture/SKILL.md"
cp "$PRIMARY_HOME/.claude/skills/retired-fixture/SKILL.md" \
  "$TEST_ROOT/snapshots/claude-user-retired.md"
cp "$PRIMARY_HOME/.codex/skills/retired-fixture/SKILL.md" \
  "$TEST_ROOT/snapshots/codex-user-retired.md"

run_setup "$PRIMARY_HOME" "$TEST_ROOT/user-owned-skill.log"
assert_same_bytes \
  "$TEST_ROOT/snapshots/claude-user-retired.md" \
  "$PRIMARY_HOME/.claude/skills/retired-fixture/SKILL.md"
assert_absent "$PRIMARY_HOME/.claude/skills/retired-fixture/.agents-kit"
pass "Claude unmarked user-owned skill directory is byte-preserved"
assert_same_bytes \
  "$TEST_ROOT/snapshots/codex-user-retired.md" \
  "$PRIMARY_HOME/.codex/skills/retired-fixture/SKILL.md"
assert_absent "$PRIMARY_HOME/.codex/skills/retired-fixture/.agents-kit"
pass "Codex unmarked user-owned skill directory is byte-preserved"

COLLIDING_SKILL=""
for source in "$REPO_DIR"/skills/*/; do
  [ -d "$source" ] || continue
  COLLIDING_SKILL="$(basename "$source")"
  break
done
[ -n "$COLLIDING_SKILL" ] || fail "no source skill available for the collision case"

rm -rf "$PRIMARY_HOME/.claude/skills/$COLLIDING_SKILL" \
  "$PRIMARY_HOME/.codex/skills/$COLLIDING_SKILL"
mkdir "$PRIMARY_HOME/.claude/skills/$COLLIDING_SKILL" \
  "$PRIMARY_HOME/.codex/skills/$COLLIDING_SKILL"
printf '%s\n' 'user-owned live-name skill' \
  >"$PRIMARY_HOME/.claude/skills/$COLLIDING_SKILL/SKILL.md"
printf '%s\n' 'user-owned live-name skill' \
  >"$PRIMARY_HOME/.codex/skills/$COLLIDING_SKILL/SKILL.md"
cp "$PRIMARY_HOME/.claude/skills/$COLLIDING_SKILL/SKILL.md" \
  "$TEST_ROOT/snapshots/claude-user-live.md"
cp "$PRIMARY_HOME/.codex/skills/$COLLIDING_SKILL/SKILL.md" \
  "$TEST_ROOT/snapshots/codex-user-live.md"

run_setup "$PRIMARY_HOME" "$TEST_ROOT/live-name-collision.log"
SKIP_COUNT="$(
  awk -v skill="  skipped (not kit-managed): $COLLIDING_SKILL" '
    $0 == skill { count++ }
    END { print count + 0 }
  ' "$TEST_ROOT/live-name-collision.log"
)"
[ "$SKIP_COUNT" -eq 2 ] ||
  fail "expected both skill-name collisions to be reported skipped"
assert_same_bytes \
  "$TEST_ROOT/snapshots/claude-user-live.md" \
  "$PRIMARY_HOME/.claude/skills/$COLLIDING_SKILL/SKILL.md"
assert_absent "$PRIMARY_HOME/.claude/skills/$COLLIDING_SKILL/.agents-kit"
assert_same_bytes \
  "$TEST_ROOT/snapshots/codex-user-live.md" \
  "$PRIMARY_HOME/.codex/skills/$COLLIDING_SKILL/SKILL.md"
assert_absent "$PRIMARY_HOME/.codex/skills/$COLLIDING_SKILL/.agents-kit"
[ "$(find "$PRIMARY_HOME/.claude/skills/$COLLIDING_SKILL" -mindepth 1 | wc -l)" -eq 1 ] ||
  fail "setup.sh leaked content into the user-owned Claude $COLLIDING_SKILL directory"
[ "$(find "$PRIMARY_HOME/.codex/skills/$COLLIDING_SKILL" -mindepth 1 | wc -l)" -eq 1 ] ||
  fail "setup.sh leaked content into the user-owned Codex $COLLIDING_SKILL directory"
pass "an unmarked directory at a live skill name is reported, preserved, and never entered"

rm -rf "$PRIMARY_HOME/.claude/skills/$COLLIDING_SKILL" \
  "$PRIMARY_HOME/.codex/skills/$COLLIDING_SKILL"
run_setup "$PRIMARY_HOME" "$TEST_ROOT/live-name-recovery.log"
verify_shared_payload "$PRIMARY_HOME/.claude"
verify_shared_payload "$PRIMARY_HOME/.codex"
pass "removing the user directory lets the kit skill reinstall marked"

rm "$PRIMARY_HOME/.claude/agents/.agents-kit-executor"
rm "$PRIMARY_HOME/.codex/agents/.agents-kit-executor"
printf '%s\n' 'user-owned Claude executor' \
  >"$PRIMARY_HOME/.claude/agents/executor.md"
printf '%s\n' 'user-owned Codex executor' \
  >"$PRIMARY_HOME/.codex/agents/executor.toml"
printf '%s\n' 'unrelated Claude agent' \
  >"$PRIMARY_HOME/.claude/agents/reviewer.md"
printf '%s\n' 'unrelated Codex agent' \
  >"$PRIMARY_HOME/.codex/agents/reviewer.toml"
cp "$PRIMARY_HOME/.claude/agents/executor.md" \
  "$TEST_ROOT/snapshots/claude-executor.md"
cp "$PRIMARY_HOME/.codex/agents/executor.toml" \
  "$TEST_ROOT/snapshots/codex-executor.toml"
cp "$PRIMARY_HOME/.claude/agents/reviewer.md" \
  "$TEST_ROOT/snapshots/claude-reviewer.md"
cp "$PRIMARY_HOME/.codex/agents/reviewer.toml" \
  "$TEST_ROOT/snapshots/codex-reviewer.toml"

run_setup "$PRIMARY_HOME" "$TEST_ROOT/user-collision.log"
SKIP_COUNT="$(
  awk '
    index($0, "skipped (not kit-managed): agents/executor") { count++ }
    END { print count + 0 }
  ' "$TEST_ROOT/user-collision.log"
)"
[ "$SKIP_COUNT" -eq 2 ] ||
  fail "expected both native executor collisions to be reported skipped"
assert_same_bytes \
  "$TEST_ROOT/snapshots/claude-executor.md" \
  "$PRIMARY_HOME/.claude/agents/executor.md"
assert_absent "$PRIMARY_HOME/.claude/agents/.agents-kit-executor"
pass "Claude unmarked executor collision is reported and byte-preserved"
assert_same_bytes \
  "$TEST_ROOT/snapshots/codex-executor.toml" \
  "$PRIMARY_HOME/.codex/agents/executor.toml"
assert_absent "$PRIMARY_HOME/.codex/agents/.agents-kit-executor"
pass "Codex unmarked executor collision is reported and byte-preserved"
assert_same_bytes \
  "$TEST_ROOT/snapshots/claude-reviewer.md" \
  "$PRIMARY_HOME/.claude/agents/reviewer.md"
pass "unrelated Claude agent remains byte-preserved"
assert_same_bytes \
  "$TEST_ROOT/snapshots/codex-reviewer.toml" \
  "$PRIMARY_HOME/.codex/agents/reviewer.toml"
pass "unrelated Codex agent remains byte-preserved"

run_setup "$PRIMARY_HOME" "$TEST_ROOT/user-collision-reinstall.log"
SKIP_COUNT="$(
  awk '
    index($0, "skipped (not kit-managed): agents/executor") { count++ }
    END { print count + 0 }
  ' "$TEST_ROOT/user-collision-reinstall.log"
)"
[ "$SKIP_COUNT" -eq 2 ] ||
  fail "expected both native executor collisions to remain skipped on reinstall"
assert_same_bytes \
  "$TEST_ROOT/snapshots/claude-executor.md" \
  "$PRIMARY_HOME/.claude/agents/executor.md"
assert_absent "$PRIMARY_HOME/.claude/agents/.agents-kit-executor"
assert_same_bytes \
  "$TEST_ROOT/snapshots/codex-executor.toml" \
  "$PRIMARY_HOME/.codex/agents/executor.toml"
assert_absent "$PRIMARY_HOME/.codex/agents/.agents-kit-executor"
assert_same_bytes \
  "$TEST_ROOT/snapshots/claude-reviewer.md" \
  "$PRIMARY_HOME/.claude/agents/reviewer.md"
assert_same_bytes \
  "$TEST_ROOT/snapshots/codex-reviewer.toml" \
  "$PRIMARY_HOME/.codex/agents/reviewer.toml"
pass "native collisions and unrelated agents remain byte-preserved on reinstall"

rm "$PRIMARY_HOME/.claude/agents/executor.md"
rm "$PRIMARY_HOME/.codex/agents/executor.toml"
touch "$PRIMARY_HOME/.claude/agents/.agents-kit-executor"
touch "$PRIMARY_HOME/.codex/agents/.agents-kit-executor"
run_setup "$PRIMARY_HOME" "$TEST_ROOT/orphan-marker.log"
verify_agent "$PRIMARY_HOME/.claude" "md" "Claude orphan-marker recovery"
verify_agent "$PRIMARY_HOME/.codex" "toml" "Codex orphan-marker recovery"
assert_same_bytes \
  "$TEST_ROOT/snapshots/claude-reviewer.md" \
  "$PRIMARY_HOME/.claude/agents/reviewer.md"
assert_same_bytes \
  "$TEST_ROOT/snapshots/codex-reviewer.toml" \
  "$PRIMARY_HOME/.codex/agents/reviewer.toml"
pass "orphan recovery leaves unrelated native agents unchanged"

CONFLICT_HOME="$TEST_ROOT/conflict-home"
mkdir -p "$CONFLICT_HOME/.claude/references" "$CONFLICT_HOME/.codex"
printf '%s\n' 'user-owned Claude references' \
  >"$CONFLICT_HOME/.claude/references/user.txt"
printf '%s\n' 'user-owned Codex core rules' \
  >"$CONFLICT_HOME/.codex/CORE_RULES.md"
cp "$CONFLICT_HOME/.claude/references/user.txt" \
  "$TEST_ROOT/snapshots/conflict-claude-references.txt"
cp "$CONFLICT_HOME/.codex/CORE_RULES.md" \
  "$TEST_ROOT/snapshots/conflict-codex-core-rules.md"
validate_isolated_home "$CONFLICT_HOME"
if HOME="$CONFLICT_HOME" bash "$SETUP" >"$TEST_ROOT/conflict.log" 2>&1; then
  fail "setup.sh should reject homes with user-owned shared-root conflicts"
fi
assert_same_bytes \
  "$TEST_ROOT/snapshots/conflict-claude-references.txt" \
  "$CONFLICT_HOME/.claude/references/user.txt"
assert_same_bytes \
  "$TEST_ROOT/snapshots/conflict-codex-core-rules.md" \
  "$CONFLICT_HOME/.codex/CORE_RULES.md"
assert_absent "$CONFLICT_HOME/.claude/skills"
assert_absent "$CONFLICT_HOME/.claude/agents"
assert_absent "$CONFLICT_HOME/.codex/skills"
assert_absent "$CONFLICT_HOME/.codex/agents"
pass "whole-home conflict safeguards preserve both native homes without partial installation"

echo "All setup installation cases passed."
