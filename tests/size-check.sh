#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$REPO_DIR/scripts/size-check.mjs"
FIXTURES="$REPO_DIR/tests/fixtures/size-report"
TEMP_BASE="${TMPDIR:-/tmp}"
TEMP_BASE="${TEMP_BASE%/}"
TEST_ROOT="$(mktemp -d "$TEMP_BASE/agents-kit-size-check.XXXXXX")"

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
    "$TEMP_BASE"/agents-kit-size-check.*) rm -rf "$TEST_ROOT" ;;
    *) echo "Refusing to remove unexpected test root: $TEST_ROOT" >&2 ;;
  esac
}
trap cleanup EXIT

case "$TEST_ROOT" in
  "$TEMP_BASE"/agents-kit-size-check.*) ;;
  *) fail "mktemp returned an unexpected path: $TEST_ROOT" ;;
esac
[ ! -L "$TEST_ROOT" ] || fail "temporary root must not be a symlink"

command -v node >/dev/null 2>&1 || fail "node is required to run the size check"
[ -f "$SCRIPT" ] || fail "missing script: $SCRIPT"
[ -d "$FIXTURES" ] || fail "missing fixture kit: $FIXTURES"

# run <expected-status> [args...] — captures stdout/stderr and asserts the exit status, which is the
# script's contract surface: 0 clean, 1 drift, 2 could-not-run.
OUT="$TEST_ROOT/out"
ERR="$TEST_ROOT/err"
run() {
  local expected="$1"
  shift
  local status=0
  node "$SCRIPT" "$@" >"$OUT" 2>"$ERR" || status=$?
  [ "$status" -eq "$expected" ] ||
    fail "expected exit $expected, got $status for: $* $(sed -n '1,5p' "$OUT" "$ERR" 2>/dev/null | tr '\n' ' ')"
}

assert_out_contains() {
  grep -qF -- "$1" "$OUT" || fail "$2 (stdout lacks \"$1\": $(tr '\n' ' ' <"$OUT"))"
}

assert_err_contains() {
  grep -qF -- "$1" "$ERR" || fail "$2 (stderr lacks \"$1\": $(tr '\n' ' ' <"$ERR"))"
}

# A clean miniature kit of its own: the shared size-report fixture carries deliberately unresolved
# citations, which this checker refuses — that refusal has its own case against the shared fixture below.
KIT="$TEST_ROOT/kit"
mkdir -p "$KIT/skills/one-skill" "$KIT/references/workflow"
printf '# core\n' >"$KIT/CORE_RULES.md"
printf '# one-skill\n\nRead `./AGENTS.md`, then `./references/workflow/alpha.md`.\n' \
  >"$KIT/skills/one-skill/SKILL.md"
printf '# alpha\n' >"$KIT/references/workflow/alpha.md"
BASELINE="$TEST_ROOT/baseline.json"

run 2 --baseline "$BASELINE" "$KIT"
assert_err_contains "--update" "a missing baseline names the way to capture one"
pass "a check with no baseline refuses with the capture hint rather than passing vacuously"

run 0 --update --baseline "$BASELINE" "$KIT"
node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$BASELINE" ||
  fail "the written baseline is not valid JSON"
grep -qF '"one-skill"' "$BASELINE" || fail "the written baseline lacks the measured skill"
pass "--update writes a parseable baseline holding the measured skills"

run 0 --baseline "$BASELINE" "$KIT"
assert_out_contains "clean" "an unchanged kit reports clean"
pass "an unchanged kit passes against its captured baseline"

printf 'grown by a sentence the baseline never measured\n' >>"$KIT/references/workflow/alpha.md"
run 1 --baseline "$BASELINE" "$KIT"
assert_out_contains "one-skill: direct" "growth names the skill and the direct set"
assert_out_contains "one-skill: transitive" "growth names the transitive set too"
assert_out_contains "--update" "the drift summary carries the re-capture hint"
pass "a grown reference fails the check, naming each moved total"

run 0 --update --baseline "$BASELINE" "$KIT"
run 0 --baseline "$BASELINE" "$KIT"
pass "re-capturing after intended growth returns the check to clean"

mkdir -p "$KIT/skills/extra-skill"
printf '# extra-skill\n' >"$KIT/skills/extra-skill/SKILL.md"
run 1 --baseline "$BASELINE" "$KIT"
assert_out_contains "extra-skill: not in the baseline" "a new skill is drift until captured"
rm -rf "$KIT/skills/extra-skill"
pass "a skill the baseline has never seen is reported, not silently admitted"

run 0 --update --baseline "$BASELINE" "$KIT"
rm -rf "$KIT/skills/one-skill"
mkdir -p "$KIT/skills/other-skill"
printf '# other-skill\n' >"$KIT/skills/other-skill/SKILL.md"
run 1 --baseline "$BASELINE" "$KIT"
assert_out_contains "one-skill: in the baseline but not in the kit" \
  "a removed skill is drift, not a silent shrink"
pass "a baseline entry with no skill behind it is reported"

# The shared size-report fixture's unresolved citations make its totals incomplete, so both checking
# and re-capturing over it must refuse: a baseline anchored below the truth would hide real weight.
run 2 --baseline "$TEST_ROOT/dirty-baseline.json" --update "$FIXTURES"
assert_err_contains "unresolved" "the refusal names the unresolved citations"
[ ! -f "$TEST_ROOT/dirty-baseline.json" ] || fail "a refused update must write no baseline"
pass "an incompletely measured kit is refused for both check and capture"

run 2 "$TEST_ROOT"
pass "a directory that is no kit refuses rather than reporting clean"

# The cases above are miniatures; this proves the committed baseline is current for the kit itself —
# the ratchet the harness exists to hold. A failure here means a change moved the measured loads
# without re-capturing: node scripts/size-check.mjs --update .
run 0 "$REPO_DIR"
assert_out_contains "clean" "the live run reports clean"
pass "this repository matches its committed size baseline"

echo "All size-check cases passed."
