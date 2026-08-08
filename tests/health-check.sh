#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$REPO_DIR/scripts/health-check.mjs"
FIXTURES="$REPO_DIR/tests/fixtures/health"
TEMP_BASE="${TMPDIR:-/tmp}"
TEMP_BASE="${TEMP_BASE%/}"
TEST_ROOT="$(mktemp -d "$TEMP_BASE/agents-kit-health-check.XXXXXX")"

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
    "$TEMP_BASE"/agents-kit-health-check.*) rm -rf "$TEST_ROOT" ;;
    *) echo "Refusing to remove unexpected test root: $TEST_ROOT" >&2 ;;
  esac
}
trap cleanup EXIT

case "$TEST_ROOT" in
  "$TEMP_BASE"/agents-kit-health-check.*) ;;
  *) fail "mktemp returned an unexpected path: $TEST_ROOT" ;;
esac
[ ! -L "$TEST_ROOT" ] || fail "temporary root must not be a symlink"

command -v node >/dev/null 2>&1 || fail "node is required to run the health check"
[ -f "$SCRIPT" ] || fail "missing script: $SCRIPT"
[ -d "$FIXTURES/store" ] || fail "missing fixture store: $FIXTURES/store"

# A committed fixture cannot carry an old mtime, so the test stamps each folder's age at run time.
stamp_days_ago() {
  node -e '
const d = new Date(Date.now() - Number(process.argv[1]) * 86400000);
const p = (n) => String(n).padStart(2, "0");
console.log(`${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`);
' "$1"
}

age_folder() {
  local folder="$1" days="$2" stamp
  stamp="$(stamp_days_ago "$days")"
  find "$folder" -name '*.md' -exec touch -t "$stamp" {} +
}

run_check() {
  local out="$1"
  shift
  if ! node "$SCRIPT" "$@" >"$out" 2>"$out.err"; then
    sed -n '1,40p' "$out.err" >&2
    fail "health-check.mjs exited non-zero for: $*"
  fi
  node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$out" ||
    fail "stdout is not a single JSON object for: $*"
}

findings_count() {
  node -e '
const fs = require("node:fs");
const [file, check] = process.argv.slice(1);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
console.log(check ? data.findings.filter((f) => f.check === check).length : data.findings.length);
' "$1" "${2-}"
}

finding_detail() {
  node -e '
const fs = require("node:fs");
const [file, check, path] = process.argv.slice(1);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const row = data.findings.find((f) => f.check === check && f.path === path);
console.log(row ? row.detail : "");
' "$1" "$2" "$3"
}

finding_details() {
  node -e '
const fs = require("node:fs");
const [file, check, path] = process.argv.slice(1);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
console.log(
  data.findings.filter((f) => f.check === check && f.path === path).map((f) => f.detail).join(" | "),
);
' "$1" "$2" "$3"
}

finding_roots() {
  node -e '
const fs = require("node:fs");
const [file, check, path] = process.argv.slice(1);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
console.log(
  data.findings.filter((f) => f.check === check && f.path === path).map((f) => f.root ?? "").join(" | "),
);
' "$1" "$2" "$3"
}

scanned_count() {
  node -e '
const fs = require("node:fs");
console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).scanned);
' "$1"
}

unreadable_count() {
  node -e '
const fs = require("node:fs");
console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).unreadable);
' "$1"
}

unreadable_paths() {
  node -e '
const fs = require("node:fs");
console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).unreadablePaths.join(" | "));
' "$1"
}

assert_equals() {
  [ "$1" = "$2" ] || fail "$3 (expected \"$2\", got \"$1\")"
}

STORE="$TEST_ROOT/store"
cp -R "$FIXTURES/store" "$STORE"
age_folder "$STORE/stale-executing" 62
age_folder "$STORE/fresh-executing" 2
age_folder "$STORE/done-unarchived" 5
age_folder "$STORE/no-status-plan" 70
age_folder "$STORE/unknown-status" 70
age_folder "$STORE/Archive/done-archived" 400

OUT="$TEST_ROOT/default.json"
run_check "$OUT" "$STORE"
[ ! -s "$OUT.err" ] || {
  sed -n '1,40p' "$OUT.err" >&2
  fail "a readable fixture store must produce no warnings"
}
pass "a readable store scans without warnings and exits 0"

assert_equals "$(scanned_count "$OUT")" "6" "scanned task count"
assert_equals "$(unreadable_count "$OUT")" "0" "a readable store reports nothing unread"
pass "scanned counts every task folder, archived ones included"

# A value outside the vocabulary is not a lifecycle state, so the stale and archive checks both skip
# it. Silence there would hide the task permanently — the folder needs a check of its own instead.
assert_equals "$(findings_count "$OUT" unknown-status)" "1" "unknown-status finding count"
assert_equals \
  "$(finding_detail "$OUT" unknown-status store/unknown-status)" \
  "plan.md carries an unrecognized status: in progress" \
  "unknown-status detail carries the value the file actually holds"
assert_equals "$(finding_detail "$OUT" stale store/unknown-status)" "" \
  "an unclassifiable status is reported once, under its own check"
pass "a status outside the vocabulary is reported rather than silently exempted"

assert_equals "$(findings_count "$OUT" stale)" "2" "stale finding count"
assert_equals \
  "$(finding_detail "$OUT" stale store/stale-executing)" \
  "executing, 62 days stale" \
  "stale detail for store/stale-executing"
pass "a 62-day-old executing task is reported stale with its status and age"

assert_equals "$(finding_detail "$OUT" stale store/fresh-executing)" "" \
  "fresh task must not be reported stale"
pass "a 2-day-old executing task is not reported stale"

# A plan file with no parseable `**Status:**` is a different fact from a folder holding no plan,
# so the detail must name it rather than rendering the absent value.
assert_equals \
  "$(finding_detail "$OUT" stale store/no-status-plan)" \
  "no-status, 70 days stale" \
  "stale detail for a plan carrying no parseable status"
pass "a plan with no parseable status is reported stale under a named label, not an empty value"

assert_equals "$(findings_count "$OUT" done-unarchived)" "1" "done-unarchived finding count"
assert_equals \
  "$(finding_detail "$OUT" done-unarchived store/done-unarchived)" \
  "done, outside Archive/" \
  "done-unarchived detail for store/done-unarchived"
pass "a done task outside Archive/ is reported with its status"

assert_equals "$(finding_detail "$OUT" done-unarchived store/Archive/done-archived)" "" \
  "archived task must not be reported done-unarchived"
assert_equals "$(finding_detail "$OUT" stale store/Archive/done-archived)" "" \
  "archived task must not be reported stale"
assert_equals "$(findings_count "$OUT")" "4" "total finding count"
pass "an archived task produces no findings"

# Findings alone would read clean over a task the run never opened, so incomplete coverage has to be
# a fact in the contract rather than a line on stderr the caller is never told to look at.
UNREADABLE="$TEST_ROOT/unreadable-store"
mkdir -p "$UNREADABLE/locked-task"
cp "$STORE/fresh-executing/plan.md" "$UNREADABLE/locked-task/plan.md"
chmod 000 "$UNREADABLE/locked-task/plan.md"
if [ -r "$UNREADABLE/locked-task/plan.md" ]; then
  pass "skipped: the unreadable-file case needs a user that chmod 000 actually stops"
else
  OUT_UNREADABLE="$TEST_ROOT/unreadable.json"
  run_check "$OUT_UNREADABLE" "$UNREADABLE"
  assert_equals "$(unreadable_count "$OUT_UNREADABLE")" "1" "a task file that cannot be read is counted"
  # The field is the caller's coverage list, and it holds the absolute path rather than the
  # basename-prefixed display shape a finding's `path` carries: findings are attributed by their
  # absolute `root`, so a gap has to be attributable the same way once two roots share a basename.
  assert_equals "$(unreadable_paths "$OUT_UNREADABLE")" "$UNREADABLE/locked-task/plan.md" \
    "unreadablePaths names the file by absolute path"
  assert_equals "$(findings_count "$OUT_UNREADABLE" unknown-status)" "0" \
    "an unreadable status file is not classified as an unknown lifecycle value"
  pass "an unreadable task file reaches the contract, not only stderr"
fi
chmod 644 "$UNREADABLE/locked-task/plan.md"

# A directory the walk cannot list hides every task beneath it, so it belongs in the contract — once.
# The listing that classifies a folder is the one the recursion reuses; listing it a second time
# would report a single gap twice and inflate the count the caller reads as coverage.
LOCKED_DIR="$TEST_ROOT/unreadable-tree"
mkdir -p "$LOCKED_DIR/area/locked-task"
cp "$STORE/fresh-executing/plan.md" "$LOCKED_DIR/area/locked-task/plan.md"
chmod 000 "$LOCKED_DIR/area/locked-task"
if [ -r "$LOCKED_DIR/area/locked-task" ]; then
  pass "skipped: the unreadable-directory case needs a user that chmod 000 actually stops"
else
  OUT_LOCKED_DIR="$TEST_ROOT/unreadable-dir.json"
  run_check "$OUT_LOCKED_DIR" "$LOCKED_DIR"
  assert_equals "$(unreadable_count "$OUT_LOCKED_DIR")" "1" \
    "a directory that cannot be listed is counted once, not once per walk pass"
  assert_equals "$(unreadable_paths "$OUT_LOCKED_DIR")" "$LOCKED_DIR/area/locked-task" \
    "unreadablePaths names the directory by absolute path, once"
  pass "an unlistable directory reaches the contract exactly once"
fi
chmod 755 "$LOCKED_DIR/area/locked-task"

# A root argument that exists but is not a directory contributed nothing to the walk. Reported only
# on stderr it would read as a clean root, since the caller treats `scanned` as a floor solely while
# `unreadable` is non-zero — the same failure `unreadablePaths` was added to close.
NOT_A_DIR="$TEST_ROOT/not-a-dir.md"
printf 'not a store\n' > "$NOT_A_DIR"
OUT_NOT_DIR="$TEST_ROOT/not-a-dir.json"
run_check "$OUT_NOT_DIR" "$NOT_A_DIR"
assert_equals "$(scanned_count "$OUT_NOT_DIR")" "0" "a root that is not a directory walks nothing"
assert_equals "$(unreadable_count "$OUT_NOT_DIR")" "1" \
  "a root that is not a directory is counted as uncovered"
assert_equals "$(unreadable_paths "$OUT_NOT_DIR")" "$NOT_A_DIR" \
  "unreadablePaths names the root that could not be walked"
pass "a root that exists but is not a directory reaches the contract, not only stderr"

OUT_BOUNDARY="$TEST_ROOT/boundary.json"
run_check "$OUT_BOUNDARY" --stale-days 62 "$STORE"
assert_equals "$(findings_count "$OUT_BOUNDARY" stale)" "2" "stale count at the age boundary"
pass "--stale-days reports a task whose age equals the threshold"

OUT_HIGH="$TEST_ROOT/high-threshold.json"
run_check "$OUT_HIGH" --stale-days=90 "$STORE"
assert_equals "$(findings_count "$OUT_HIGH" stale)" "0" "stale count above the age boundary"
assert_equals "$(findings_count "$OUT_HIGH" done-unarchived)" "1" \
  "done-unarchived count is independent of --stale-days"
pass "--stale-days raises the threshold without affecting the archive check"

# `scripts` was pruned at every depth to skip a store's helper directory — but isTaskDir already
# rejects a folder holding no role file, so the prune only ever cost a real task its scan.
NAMED="$TEST_ROOT/named-scripts"
mkdir -p "$NAMED/scripts"
cp "$STORE/fresh-executing/plan.md" "$NAMED/scripts/plan.md"
OUT_NAMED="$TEST_ROOT/named-scripts.json"
run_check "$OUT_NAMED" "$NAMED"
assert_equals "$(scanned_count "$OUT_NAMED")" "1" "a task folder named scripts is scanned like any other"
pass "a directory's name no longer decides whether the task inside it exists"

# `.agents` is the one dotted directory the walk enters: the canonical root sits inside it, so
# pruning it by the general dotted rule cost a registered project root every task it holds —
# silently, since an unwalked root and an empty one report identically.
PROJECT="$TEST_ROOT/project-root"
mkdir -p "$PROJECT/.agents/tasks" "$PROJECT/.git"
cp -R "$STORE/fresh-executing" "$PROJECT/.agents/tasks/nested-task"
cp "$STORE/fresh-executing/plan.md" "$PROJECT/.git/plan.md"
OUT_PROJECT="$TEST_ROOT/project-root.json"
run_check "$OUT_PROJECT" "$PROJECT"
assert_equals "$(scanned_count "$OUT_PROJECT")" "1" \
  "a project root reaches the tasks under its .agents/tasks"
pass "the canonical root is found from a project root, while every other dotted name stays pruned"

SECOND_ROOT="$TEST_ROOT/second/store"
mkdir -p "$SECOND_ROOT"
cp -R "$STORE/done-unarchived" "$SECOND_ROOT/done-unarchived"
OUT_MULTI="$TEST_ROOT/multi-root.json"
run_check "$OUT_MULTI" "$STORE" "$SECOND_ROOT"
assert_equals "$(scanned_count "$OUT_MULTI")" "7" "scanned count across two roots"
assert_equals "$(findings_count "$OUT_MULTI" done-unarchived)" "2" \
  "done-unarchived count across two roots"
assert_equals \
  "$(finding_detail "$OUT_MULTI" done-unarchived store/done-unarchived)" \
  "done, outside Archive/" \
  "done-unarchived detail from the second root"
assert_equals \
  "$(finding_roots "$OUT_MULTI" done-unarchived store/done-unarchived)" \
  "$STORE | $SECOND_ROOT" \
  "same-basename findings retain their resolved task roots"
pass "findings from same-basename roots remain unambiguous through the root field"

ANCHORS="$TEST_ROOT/anchors"
cp -R "$FIXTURES/anchors" "$ANCHORS"
# This root exercises the durability checks, so every folder stays fresh and the age check is quiet.
age_folder "$ANCHORS" 1

OUT_ANCHORS="$TEST_ROOT/anchors.json"
run_check "$OUT_ANCHORS" "$ANCHORS"
[ ! -s "$OUT_ANCHORS.err" ] || {
  sed -n '1,40p' "$OUT_ANCHORS.err" >&2
  fail "the anchor fixtures must produce no warnings"
}
assert_equals "$(scanned_count "$OUT_ANCHORS")" "14" "scanned count for the anchor fixtures"

assert_equals "$(findings_count "$OUT_ANCHORS" dead-anchor)" "5" "dead-anchor finding count"
assert_equals \
  "$(finding_detail "$OUT_ANCHORS" dead-anchor anchors/dead-anchor)" \
  "Step 2: anchor not found: #step-2--never-written in ./result.md" \
  "dead-anchor detail for an unresolvable anchor"
pass "a checked step whose anchor is missing from the result file is reported, a resolving one is not"

assert_equals \
  "$(finding_detail "$OUT_ANCHORS" dead-anchor anchors/missing-link)" \
  "Step 1: checked step missing result link" \
  "dead-anchor detail for a step with no result link"
pass "a checked step with no result link is reported; a checkpoint checkbox is not a step"

assert_equals \
  "$(finding_detail "$OUT_ANCHORS" dead-anchor anchors/missing-target)" \
  "Step 1: link target missing: ./gone.result.md#step-1--vanished" \
  "dead-anchor detail for a link whose file is gone"
pass "a checked step linking a file the folder does not hold is reported"

assert_equals \
  "$(finding_detail "$OUT_ANCHORS" dead-anchor anchors/anchorless-result)" \
  "Step 1: result link missing anchor: ./result.md" \
  "dead-anchor detail for an anchorless result link"
assert_equals \
  "$(finding_detail "$OUT_ANCHORS" dead-anchor anchors/plan-local-result)" \
  "Step 1: result link missing file target: #step-1--plan-local-evidence" \
  "dead-anchor detail for a plan-local result link"
pass "checked-step evidence must name both the result file and a concrete result heading"

assert_equals "$(findings_count "$OUT_ANCHORS" goal-id)" "3" "goal-id finding count"
# CommonMark accepts `-`, `*` and `+` as list markers, so a goals file written with asterisks is a
# goals file: the ID lint has to see those bullets rather than skipping them into silence.
assert_equals \
  "$(finding_details "$OUT_ANCHORS" goal-id anchors/bad-goal-ids)" \
  "duplicate goal ID G1 in goals.md | malformed goal ID in goals.md: - Goal three — no ID assigned | malformed goal ID in goals.md: * Goal four — an asterisk bullet, no ID" \
  "goal-id details for the malformed and duplicate IDs"
pass "a duplicate and malformed G-IDs are reported across bullet markers; a valid ID and an (external) token are not"

assert_equals "$(findings_count "$OUT_ANCHORS" no-current-state)" "3" "no-current-state finding count"
assert_equals \
  "$(finding_detail "$OUT_ANCHORS" no-current-state anchors/no-current-state)" \
  'blocked result.md has no "## Current state" block' \
  "no-current-state detail for a blocked result"
pass "a live result with no ## Current state block is reported"

# A heading inside a fenced block is illustrative markdown, not the section — the same rule the
# anchor scan already applies, so the liveness check must not be satisfied by an example.
assert_equals \
  "$(finding_detail "$OUT_ANCHORS" no-current-state anchors/fenced-current-state)" \
  'executing result.md has no "## Current state" block' \
  "no-current-state detail for a result whose only block sits in a fence"
pass "a ## Current state heading inside a code fence does not satisfy the liveness check"

# A boolean fence flag inverts on the inner opener of a nested block, handing the scan back the
# illustrative heading it was meant to skip. Closing a fence takes the opener's own marker and length.
assert_equals \
  "$(finding_detail "$OUT_ANCHORS" no-current-state anchors/nested-fence)" \
  'executing result.md has no "## Current state" block' \
  "no-current-state detail for a result whose only block sits in a nested fence"
pass "a three-backtick example inside a four-backtick fence does not toggle scanning back on"

# The status scan reads the same file as the anchor and liveness scans, so it owes them the same rule:
# task-layout.md § One task, one flat folder puts the status header outside fenced or quoted content.
assert_equals "$(finding_detail "$OUT_ANCHORS" done-unarchived anchors/fenced-status)" "" \
  "a **Status:** line inside a fence must not be read as the plan's own"
pass "a fenced status example is illustrative markdown, not a lifecycle state"

assert_equals "$(finding_detail "$OUT_ANCHORS" dead-anchor anchors/compacted-tombstone)" "" \
  "an anchor named by a ## Compacted tombstone bullet must resolve"
pass "a step link whose section a Compacted stub tombstones is documented state, not a dead anchor"

assert_equals "$(finding_details "$OUT_ANCHORS" dead-anchor anchors/Archive/archived-violations)" "" \
  "an archived checked step with no result link must stay silent"
assert_equals "$(finding_details "$OUT_ANCHORS" goal-id anchors/Archive/archived-violations)" "" \
  "an archived duplicate G-ID must stay silent"
assert_equals "$(finding_detail "$OUT_ANCHORS" no-current-state anchors/Archive/archived-violations)" "" \
  "an archived live result without ## Current state must stay silent"
pass "archived folders are exempt from the content checks"

assert_equals "$(findings_count "$OUT_ANCHORS")" "11" "total finding count for the anchor fixtures"
pass "an archived folder and a legacy done result without ## Current state produce no findings"

assert_equals "$(findings_count "$OUT_ANCHORS" oversized-result)" "0" \
  "oversized-result count at the default threshold"
OUT_SIZE="$TEST_ROOT/result-size.json"
run_check "$OUT_SIZE" --result-max-kb 1 "$ANCHORS"
assert_equals "$(findings_count "$OUT_SIZE" oversized-result)" "1" \
  "oversized-result count at a lowered threshold"
assert_equals \
  "$(finding_detail "$OUT_SIZE" oversized-result anchors/oversized-result)" \
  "result.md is 1.6 KB, over the 1 KB compaction trigger" \
  "oversized-result detail carries the actual size"
assert_equals "$(finding_detail "$OUT_SIZE" oversized-result anchors/Archive/archived-violations)" "" \
  "an archived oversized result must stay silent even at a lowered threshold"
pass "--result-max-kb reports a result over the given trigger and stays quiet at the default"

INSTALLS="$TEST_ROOT/installs"
mkdir "$INSTALLS"
cp -R "$FIXTURES/installs/kit" "$INSTALLS/kit"
# A home's own directory name selects the agent format setup.sh installs, so each lands under its
# host name. Finder droppings would read as real drift, so only the committed states remain.
cp -R "$FIXTURES/installs/claude-home" "$INSTALLS/.claude"
cp -R "$FIXTURES/installs/codex-home" "$INSTALLS/.codex"
find "$INSTALLS" -name .DS_Store -delete
# .DS_Store is gitignored, so the OS-artifact pair is written here rather than committed: differing
# on both sides, which is the state setup.sh's recursive copy plus a later Finder visit produces.
# The dotfile beside it differs the same way and must still be reported — the check skips OS
# artifacts by name, and a rule that skipped every dotted name would drop real kit content.
printf 'kit-side finder state\n' > "$INSTALLS/kit/references/.DS_Store"
printf 'install-side finder state\n' > "$INSTALLS/.claude/references/.DS_Store"
printf 'kit\n' > "$INSTALLS/kit/references/.keeprc"
printf 'install\n' > "$INSTALLS/.claude/references/.keeprc"
# A skill and an agent added to the kit but never deployed. Neither carries a marker anywhere, so
# only the kit-side pass can see them — and it must stay off the categories a home doesn't take,
# which is why the agents-only codex home below reports nothing for either.
mkdir -p "$INSTALLS/kit/skills/never-deployed"
printf 'new\n' > "$INSTALLS/kit/skills/never-deployed/SKILL.md"
printf 'new\n' > "$INSTALLS/kit/agents/never-deployed.md"

OUT_INSTALLS="$TEST_ROOT/installs.json"
run_check "$OUT_INSTALLS" --installs "$INSTALLS/kit" "$INSTALLS/.claude" "$INSTALLS/.codex"
[ ! -s "$OUT_INSTALLS.err" ] || {
  sed -n '1,40p' "$OUT_INSTALLS.err" >&2
  fail "readable install fixtures must produce no warnings"
}
assert_equals "$(scanned_count "$OUT_INSTALLS")" "5" "scanned count of marker-owned items"
assert_equals "$(findings_count "$OUT_INSTALLS" install-drift)" "19" "install-drift finding count"
assert_equals \
  "$(finding_detail "$OUT_INSTALLS" install-drift .claude/CORE_RULES.md)" \
  "differs from kit source" \
  "install-drift detail for an edited CORE_RULES.md"
assert_equals \
  "$(finding_detail "$OUT_INSTALLS" install-drift .claude/skills/kept-skill/SKILL.md)" \
  "differs from kit source" \
  "install-drift detail for an edited installed skill file"
assert_equals \
  "$(finding_detail "$OUT_INSTALLS" install-drift .claude/skills/kept-skill/dropped.md)" \
  "missing in install" \
  "install-drift detail for a kit file absent from the install"
assert_equals \
  "$(finding_detail "$OUT_INSTALLS" install-drift .claude/skills/kept-skill/extra.md)" \
  "extra in install" \
  "install-drift detail for an installed file absent from the kit"
assert_equals \
  "$(finding_detail "$OUT_INSTALLS" install-drift .claude/agents/kept-agent.md)" \
  "differs from kit source" \
  "install-drift detail for an edited Markdown agent definition"
assert_equals \
  "$(finding_detail "$OUT_INSTALLS" install-drift .codex/agents/kept-agent.toml)" \
  "differs from kit source" \
  "install-drift detail for an edited TOML agent definition"
pass "--installs reports each differing, missing, and extra path, per home and native agent format"

assert_equals "$(finding_detail "$OUT_INSTALLS" install-drift .claude/skills/user-skill/SKILL.md)" "" \
  "an unmarked skill must not be compared"
assert_equals "$(finding_detail "$OUT_INSTALLS" install-drift .claude/agents/user-agent.md)" "" \
  "an unmarked agent file must not be compared"
pass "an item without its ownership marker is not kit-managed and produces no findings"

assert_equals "$(finding_detail "$OUT_INSTALLS" install-drift .claude/references/sample.md)" "" \
  "an identical reference file must not be reported"
assert_equals "$(finding_detail "$OUT_INSTALLS" install-drift .claude/references/nested/deep.md)" "" \
  "an identical nested reference file must not be reported"
assert_equals "$(finding_detail "$OUT_INSTALLS" install-drift .claude/skills/kept-skill/AGENTS.md)" "" \
  "a symlink with the same target on both sides must not be reported"
pass "byte-identical files and matching symlinks are silent"

assert_equals "$(finding_detail "$OUT_INSTALLS" install-drift .claude/references/.DS_Store)" "" \
  "an OS artifact differing on both sides must not be reported"
assert_equals \
  "$(finding_detail "$OUT_INSTALLS" install-drift .claude/references/.keeprc)" \
  "differs from kit source" \
  "a non-artifact dotfile differing on both sides is still reported"
pass "OS artifacts are skipped by name, and a kit dotfile beside one stays comparable"

assert_equals \
  "$(finding_detail "$OUT_INSTALLS" install-drift .claude/skills/never-deployed/SKILL.md)" \
  "missing in install" \
  "a kit skill that was never deployed is reported"
assert_equals \
  "$(finding_detail "$OUT_INSTALLS" install-drift .claude/agents/never-deployed.md)" \
  "missing in install" \
  "a kit agent that was never deployed is reported"
assert_equals \
  "$(finding_detail "$OUT_INSTALLS" install-drift .codex/skills/never-deployed/SKILL.md)" \
  "missing in install" \
  "a partially installed home is reported missing a kit skill even without skill markers"
assert_equals \
  "$(finding_detail "$OUT_INSTALLS" install-drift .codex/references/sample.md)" \
  "missing in install" \
  "a partially installed home is reported missing shared references"
assert_equals \
  "$(finding_detail "$OUT_INSTALLS" install-drift .codex/CORE_RULES.md)" \
  "missing in install" \
  "a partially installed home is reported missing CORE_RULES.md"
assert_equals "$(finding_detail "$OUT_INSTALLS" install-drift .claude/skills/user-skill/SKILL.md)" "" \
  "a kit-named skill the home owns unmarked is present, so it is never reported missing"
pass "never-deployed kit payloads are reported in every home setup.sh has partially installed"

# Every installed skill resolves ./AGENTS.md and ./references into the two install-root shared
# payloads, so an unmarked one is not a private file the way an unmarked skill is — it is what all of
# them load, and setup.sh refuses the whole home over it. Skipping it silently reported a home as
# clean while every kit skill ran on a file the kit does not own.
CONFLICT_HOME="$INSTALLS/conflict/.claude"
mkdir -p "$CONFLICT_HOME/skills/kept-skill" "$CONFLICT_HOME/references"
touch "$CONFLICT_HOME/skills/kept-skill/.agents-kit"
cp "$INSTALLS/kit/skills/kept-skill/SKILL.md" "$CONFLICT_HOME/skills/kept-skill/SKILL.md"
printf 'MY OWN RULES\n' > "$CONFLICT_HOME/CORE_RULES.md"
printf 'mine\n' > "$CONFLICT_HOME/references/sample.md"
OUT_CONFLICT="$TEST_ROOT/conflict-install.json"
run_check "$OUT_CONFLICT" --installs "$INSTALLS/kit" "$CONFLICT_HOME"
assert_equals \
  "$(finding_detail "$OUT_CONFLICT" install-drift .claude/CORE_RULES.md)" \
  "present but not kit-owned — every kit skill resolves into it; move it aside and rerun setup.sh" \
  "an unmarked CORE_RULES.md is reported rather than treated as the user's business"
assert_equals \
  "$(finding_detail "$OUT_CONFLICT" install-drift .claude/references)" \
  "present but not kit-owned — every kit skill resolves into it; move it aside and rerun setup.sh" \
  "an unmarked references/ is reported the same way"
pass "an unmarked shared payload is a conflict, not a clean home"

# An ownership marker the run cannot stat is not evidence the item is the user's. Read as unowned it
# dropped a whole kit-managed skill from the comparison while `unreadable` stayed zero, so the caller
# was told a deploy was clean over an item nothing compared.
LOCKED_SKILL="$INSTALLS/locked/.claude"
mkdir -p "$LOCKED_SKILL/skills/kept-skill"
touch "$LOCKED_SKILL/skills/kept-skill/.agents-kit"
printf 'drifted\n' > "$LOCKED_SKILL/skills/kept-skill/SKILL.md"
chmod 000 "$LOCKED_SKILL/skills/kept-skill"
if [ -r "$LOCKED_SKILL/skills/kept-skill" ]; then
  pass "skipped: the unreadable-marker case needs a user that chmod 000 actually stops"
else
  OUT_LOCKED_SKILL="$TEST_ROOT/locked-skill.json"
  run_check "$OUT_LOCKED_SKILL" --installs "$INSTALLS/kit" "$LOCKED_SKILL"
  assert_equals "$(scanned_count "$OUT_LOCKED_SKILL")" "1" \
    "a skill whose marker cannot be read still counts as an item compared"
  case "$(unreadable_count "$OUT_LOCKED_SKILL")" in
    0) fail "an unreadable ownership marker must reach the contract, not be read as user-owned" ;;
  esac
  case "$(unreadable_paths "$OUT_LOCKED_SKILL")" in
    *"$LOCKED_SKILL/skills/kept-skill/.agents-kit"*) ;;
    *) fail "unreadablePaths must name the marker that could not be stat'd" ;;
  esac
  pass "an unreadable ownership marker is a coverage gap, not proof the item is the user's"
fi
chmod 755 "$LOCKED_SKILL/skills/kept-skill"

# setup.sh marks a staging dir before it finishes copying into it, so an interrupted install leaves
# one behind. Comparing it reported phantom paths the next setup.sh run deletes on its own, and its
# item count suppressed the single never-installed line a first interrupted install should get.
STAGING_HOME="$INSTALLS/staging/.claude"
mkdir -p "$STAGING_HOME/skills/.agents-kit-staging.4242-kept-skill"
touch "$STAGING_HOME/skills/.agents-kit-staging.4242-kept-skill/.agents-kit"
printf 'half-copied\n' > "$STAGING_HOME/skills/.agents-kit-staging.4242-kept-skill/SKILL.md"
OUT_STAGING="$TEST_ROOT/staging-install.json"
run_check "$OUT_STAGING" --installs "$INSTALLS/kit" "$STAGING_HOME"
assert_equals "$(scanned_count "$OUT_STAGING")" "0" "a leftover staging dir is not counted as an installed item"
assert_equals "$(findings_count "$OUT_STAGING" install-drift)" "1" \
  "a home holding only a staging dir reports the never-installed line, not one finding per file"
assert_equals \
  "$(finding_detail "$OUT_STAGING" install-drift .claude)" \
  "no kit markers — never installed" \
  "an interrupted first install is one fact about the home"
pass "a leftover staging dir is an interrupted install, not drift to reconcile"

# skills/ is copied link-preserving so each skill's AGENTS.md and references resolve to the
# install-root originals. A copy that materialized them holds identical bytes, so only the link-ness
# difference itself shows the loss — ~1,500 duplicated files per home otherwise reporting clean.
MATERIALIZED="$INSTALLS/materialized/.claude"
mkdir -p "$MATERIALIZED/skills/kept-skill"
touch "$MATERIALIZED/skills/kept-skill/.agents-kit"
cp "$INSTALLS/kit/skills/kept-skill/SKILL.md" "$MATERIALIZED/skills/kept-skill/SKILL.md"
cp -L "$INSTALLS/kit/skills/kept-skill/AGENTS.md" "$MATERIALIZED/skills/kept-skill/AGENTS.md"
OUT_MATERIALIZED="$TEST_ROOT/materialized-install.json"
run_check "$OUT_MATERIALIZED" --installs "$INSTALLS/kit" "$MATERIALIZED"
assert_equals \
  "$(finding_detail "$OUT_MATERIALIZED" install-drift .claude/skills/kept-skill/AGENTS.md)" \
  "symlink replaced by a copy" \
  "a kit symlink materialized into a regular copy is drift, not a copy-mode difference"
pass "the two sides disagreeing on link-ness is reported rather than compared through the link"

PARTIAL_HOME="$INSTALLS/partial/.claude"
mkdir -p "$PARTIAL_HOME"
touch "$PARTIAL_HOME/.agents-kit-core-rules"
cp "$INSTALLS/kit/CORE_RULES.md" "$PARTIAL_HOME/CORE_RULES.md"
OUT_PARTIAL="$TEST_ROOT/partial-install.json"
run_check "$OUT_PARTIAL" --installs "$INSTALLS/kit" "$PARTIAL_HOME"
assert_equals \
  "$(finding_detail "$OUT_PARTIAL" install-drift .claude/skills/never-deployed/SKILL.md)" \
  "missing in install" \
  "a core-only partial install is reported missing skills"
assert_equals \
  "$(finding_detail "$OUT_PARTIAL" install-drift .claude/references/sample.md)" \
  "missing in install" \
  "a core-only partial install is reported missing references"
assert_equals \
  "$(finding_detail "$OUT_PARTIAL" install-drift .claude/agents/never-deployed.md)" \
  "missing in install" \
  "a core-only partial install is reported missing native agents"
pass "one surviving kit marker proves setup.sh ran, so absent payload categories are drift"

FRESH="$TEST_ROOT/fresh"
mkdir -p "$FRESH/.claude"
OUT_FRESH="$TEST_ROOT/fresh.json"
run_check "$OUT_FRESH" --installs "$INSTALLS/kit" "$FRESH/.claude"
assert_equals "$(findings_count "$OUT_FRESH" install-drift)" "1" "finding count for a never-installed home"
assert_equals \
  "$(finding_detail "$OUT_FRESH" install-drift .claude)" \
  "no kit markers — never installed" \
  "a home with no markers reports one line, not one per kit file"
assert_equals "$(scanned_count "$OUT_FRESH")" "0" "scanned count for a never-installed home"
pass "a home setup.sh never installed into is reported once rather than flooding"

# The unmarked shared payload is why setup.sh refuses this home, so it rides on the never-installed
# line instead of stacking a second finding beside it: two lines would break the one-fact-per-home
# rendering the caller keys on, and dropping it would leave the refusal with no reason attached.
BLOCKED_FRESH="$TEST_ROOT/blocked-fresh/.claude"
mkdir -p "$BLOCKED_FRESH"
printf 'MY OWN RULES\n' > "$BLOCKED_FRESH/CORE_RULES.md"
OUT_BLOCKED_FRESH="$TEST_ROOT/blocked-fresh.json"
run_check "$OUT_BLOCKED_FRESH" --installs "$INSTALLS/kit" "$BLOCKED_FRESH"
assert_equals "$(findings_count "$OUT_BLOCKED_FRESH" install-drift)" "1" \
  "a never-installed home blocked by its own shared payload is still one finding"
assert_equals \
  "$(finding_detail "$OUT_BLOCKED_FRESH" install-drift .claude)" \
  "no kit markers — never installed; CORE_RULES.md present but not kit-owned — move aside and rerun setup.sh" \
  "the one line names the payload blocking the install"
assert_equals "$(scanned_count "$OUT_BLOCKED_FRESH")" "0" \
  "a blocked never-installed home compares nothing"
pass "the conflict that blocks a never-installed home rides on its one line"

OUT_ABSENT="$TEST_ROOT/absent-home.json"
run_check "$OUT_ABSENT" --installs "$INSTALLS/kit" "$TEST_ROOT/absent/.claude"
assert_equals "$(findings_count "$OUT_ABSENT" install-drift)" "1" \
  "finding count for an absent install home"
assert_equals \
  "$(finding_detail "$OUT_ABSENT" install-drift .claude)" \
  "no kit markers — never installed" \
  "an absent install home is classified as uninstalled"
assert_equals "$(unreadable_count "$OUT_ABSENT")" "0" \
  "an absent install home is not an unreadable coverage gap"
pass "a missing install home reports the documented uninstalled state"

# Every case above redirects stdout to a file, where POSIX writes are synchronous — so none of them
# can see a report truncated at the pipe buffer. This one reads through a real pipe, and the long
# folder names get the payload past 64 KB in a few hundred findings rather than a few thousand.
BIG="$TEST_ROOT/big-report"
node -e '
const fs = require("node:fs");
const p = require("node:path");
const pad = "x".repeat(180);
for (let i = 0; i < 250; i++) {
  const dir = p.join(process.argv[1], `task-${String(i).padStart(3, "0")}-${pad}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p.join(dir, "plan.md"), "# t\n\n**Status:** executing\n\n## Step 1 — do\n\n- [x] d ([result](./result.md#absent))\n");
  fs.writeFileSync(p.join(dir, "result.md"), "# r\n\n**Status:** executing\n\n## Current state\n\n_Updated:_ 2026-01-01\n");
}
' "$BIG"

node "$SCRIPT" "$BIG" >"$TEST_ROOT/big-report.json" 2>/dev/null
FILE_BYTES="$(wc -c < "$TEST_ROOT/big-report.json" | tr -d ' ')"
[ "$FILE_BYTES" -gt 65536 ] ||
  fail "the volume fixture must exceed the 64 KB pipe buffer to be a real test (got $FILE_BYTES)"
PIPED_BYTES="$(node "$SCRIPT" "$BIG" 2>/dev/null | wc -c | tr -d ' ')"
assert_equals "$PIPED_BYTES" "$FILE_BYTES" "piped report size must match the file-redirected size"
node "$SCRIPT" "$BIG" 2>/dev/null |
  node -e 'let d="";process.stdin.on("data",(c)=>(d+=c)).on("end",()=>{JSON.parse(d)})' ||
  fail "a report larger than the pipe buffer must survive the pipe intact"
pass "a report over 64 KB parses when read through a pipe, not only from a file"

set +e
node "$SCRIPT" "$BIG" 2>/dev/null | head -c 64 >/dev/null
early_status=${PIPESTATUS[0]}
set -e
assert_equals "$early_status" "0" "a reader that closes the pipe early must leave the exit status at 0"
pass "an early-closing reader does not turn into a non-zero exit"

# duplicate-slug spans roots and is the only check that sees archived folders, so it needs a
# two-root fixture: one active/active collision, one active/archived, and a slug unique to each
# root that must stay silent. Peers are named by absolute directory — a compact display path is
# prefixed by its root's basename alone, which two roots can share.
DUP_A="$TEST_ROOT/dup-a"
DUP_B="$TEST_ROOT/dup-b"
for d in "$DUP_A/add-csv-export" "$DUP_B/add-csv-export" "$DUP_A/only-here" "$DUP_B/Archive/only-here" "$DUP_A/unique-a" "$DUP_B/unique-b"; do
  mkdir -p "$d"
  printf '# t\n\n**Status:** to-do\n' >"$d/plan.md"
done

OUT_DUP="$TEST_ROOT/duplicate-slug.json"
run_check "$OUT_DUP" "$DUP_A" "$DUP_B"

assert_equals "$(findings_count "$OUT_DUP" duplicate-slug)" "4" "duplicate-slug finding count"
pass "a slug in two roots reports once per colliding folder, not once per collision"

assert_equals \
  "$(finding_detail "$OUT_DUP" duplicate-slug dup-a/add-csv-export)" \
  "slug \"add-csv-export\" also at $DUP_B/add-csv-export" \
  "active/active collision detail names the peer by absolute path"
assert_equals \
  "$(finding_detail "$OUT_DUP" duplicate-slug dup-b/add-csv-export)" \
  "slug \"add-csv-export\" also at $DUP_A/add-csv-export" \
  "the peer's own finding names it back"
pass "each side of a collision is actionable from its own finding"

assert_equals \
  "$(finding_detail "$OUT_DUP" duplicate-slug dup-a/only-here)" \
  "slug \"only-here\" also at $DUP_B/Archive/only-here (archived)" \
  "an archived peer is reported and labelled archived"
assert_equals \
  "$(finding_detail "$OUT_DUP" duplicate-slug dup-b/Archive/only-here)" \
  "slug \"only-here\" (archived) also at $DUP_A/only-here" \
  "the archived folder gets its own finding despite the archive exemption"
pass "duplicate-slug sees archived folders, because a bare slug still falls back into Archive/"

assert_equals "$(finding_detail "$OUT_DUP" duplicate-slug dup-a/unique-a)" "" \
  "a slug unique to its root is not reported"
assert_equals "$(finding_detail "$OUT_DUP" duplicate-slug dup-b/unique-b)" "" \
  "a slug unique to the other root is not reported"
pass "a globally unique slug stays silent"

OUT_DUP_ONE="$TEST_ROOT/duplicate-slug-single-root.json"
run_check "$OUT_DUP_ONE" "$DUP_A"
assert_equals "$(findings_count "$OUT_DUP_ONE" duplicate-slug)" "0" \
  "single-root run reports no duplicate-slug"
pass "a root whose slugs are all distinct stays silent, with no cross-root state leaking in"

# Uniqueness is global, not per-parent: the walk is recursive, so one root can hold the same slug
# under two area directories (references/workflow/task-layout.md § The root registry).
DUP_C="$TEST_ROOT/dup-c"
for d in "$DUP_C/area-a/nested-dup" "$DUP_C/area-b/nested-dup"; do
  mkdir -p "$d"
  printf '# t\n\n**Status:** to-do\n' >"$d/plan.md"
done

OUT_DUP_NESTED="$TEST_ROOT/duplicate-slug-nested.json"
run_check "$OUT_DUP_NESTED" "$DUP_C"
assert_equals "$(findings_count "$OUT_DUP_NESTED" duplicate-slug)" "2" \
  "nested same-root collision finding count"
assert_equals \
  "$(finding_detail "$OUT_DUP_NESTED" duplicate-slug dup-c/area-a/nested-dup)" \
  "slug \"nested-dup\" also at $DUP_C/area-b/nested-dup" \
  "a within-root collision names its peer"
pass "two area directories of one root collide — uniqueness is global, not per-parent"

# A root repeated, or nested inside one already walked, must not be walked twice: that doubled
# `scanned` and every finding, and made each folder report itself as its own collision peer.
OUT_DUP_REPEAT="$TEST_ROOT/duplicate-slug-repeat.json"
run_check "$OUT_DUP_REPEAT" "$DUP_C" "$DUP_C"
assert_equals "$(scanned_count "$OUT_DUP_REPEAT")" "2" "a repeated root is walked once"
assert_equals "$(findings_count "$OUT_DUP_REPEAT" duplicate-slug)" "2" \
  "a repeated root does not double the collision findings"

OUT_DUP_OVERLAP="$TEST_ROOT/duplicate-slug-overlap.json"
run_check "$OUT_DUP_OVERLAP" "$DUP_C" "$DUP_C/area-a"
assert_equals "$(scanned_count "$OUT_DUP_OVERLAP")" "2" \
  "a root nested inside one already walked is skipped"
assert_equals "$(findings_count "$OUT_DUP_OVERLAP" duplicate-slug)" "2" \
  "an overlapping root adds no self-collision"
pass "an overlapping root argument is skipped rather than reported as a folder colliding with itself"

# Containment is tested one way only by the case above: the guard asks whether a root sits inside
# one already walked, so passing the inner root first would leave the outer one to walk it again.
OUT_DUP_REV="$TEST_ROOT/duplicate-slug-overlap-reversed.json"
run_check "$OUT_DUP_REV" "$DUP_C/area-a" "$DUP_C"
assert_equals "$(scanned_count "$OUT_DUP_REV")" "2" \
  "a root containing one already walked is skipped too"
assert_equals "$(findings_count "$OUT_DUP_REV" duplicate-slug)" "2" \
  "argument order does not decide whether the overlap is caught"
pass "overlap detection is order-independent"

# canonicalRoot resolves with realpathSync.native, which returns the spelling the filesystem holds;
# the JS implementation returns the caller's own, so two case-spellings of one root canonicalize
# differently and the containment guard above misses — both are walked, `scanned` doubles, and every
# folder reports itself as its own collision peer. The divergence exists only on a case-insensitive
# volume, so the case is probed for rather than assumed, like the chmod cases above.
mkdir "$TEST_ROOT/case-probe"
if [ ! -d "$TEST_ROOT/CASE-PROBE" ]; then
  pass "skipped: the root case-collision case needs a case-insensitive volume"
else
  OUT_DUP_CASE="$TEST_ROOT/duplicate-slug-case.json"
  run_check "$OUT_DUP_CASE" "$DUP_C" "$TEST_ROOT/DUP-C"
  assert_equals "$(scanned_count "$OUT_DUP_CASE")" "2" \
    "a root respelled in another case is walked once"
  assert_equals "$(findings_count "$OUT_DUP_CASE" duplicate-slug)" "2" \
    "a case-respelled root adds no self-collision"
  assert_equals "$(unreadable_count "$OUT_DUP_CASE")" "0" \
    "both spellings resolve, so neither is a coverage gap"
  pass "two case-spellings of one root are one root"
fi

# parseArgs peeks a flag's separate value and consumes it only once it validates, so a root spelled
# after a dateless flag is not swallowed. The other half of that trade: a rejected value re-enters
# the roots only when it names something on disk, or a typo would report as store the sweep did not
# see — the twin of the shape test tests/session-triage.sh runs.
OUT_FLAG_ROOT="$TEST_ROOT/flag-value-root.json"
run_check "$OUT_FLAG_ROOT" --stale-days "$STORE"
assert_equals "$(scanned_count "$OUT_FLAG_ROOT")" "6" \
  "a root spelled after a valueless flag is still walked"
assert_equals "$(unreadable_count "$OUT_FLAG_ROOT")" "0" \
  "the root a valueless flag would have swallowed is not a coverage gap"

OUT_FLAG_JUNK="$TEST_ROOT/flag-value-junk.json"
run_check "$OUT_FLAG_JUNK" --stale-days 20KB "$STORE"
assert_equals "$(scanned_count "$OUT_FLAG_JUNK")" "6" \
  "a malformed flag value leaves the roots after it alone"
assert_equals "$(unreadable_count "$OUT_FLAG_JUNK")" "0" \
  "a malformed flag value is not reported as store the sweep did not see"

# `resolve("")` is the process directory, so an empty value re-entering the roots would walk the
# caller's own checkout as a task store.
OUT_FLAG_EMPTY="$TEST_ROOT/flag-value-empty.json"
run_check "$OUT_FLAG_EMPTY" --result-max-kb "" "$STORE"
assert_equals "$(scanned_count "$OUT_FLAG_EMPTY")" "6" \
  "an empty flag value does not add the process directory as a root"
assert_equals "$(unreadable_count "$OUT_FLAG_EMPTY")" "0" \
  "an empty flag value is not a coverage gap"
pass "a rejected flag value re-enters the roots only when it names something on disk"

# A `-`-prefixed argument is the one value neither numeric flag can ever take, and it can never
# become a root either — the option, `--`, and unknown-option branches all intercept it first. So
# consuming one only ever loses a flag: swallowing `--installs` turns the install comparison into a
# task walk over the kit and the home, with nothing in the JSON to say the probe never ran.
OUT_FLAG_FLAG="$TEST_ROOT/flag-value-flag.json"
run_check "$OUT_FLAG_FLAG" --stale-days --installs "$INSTALLS/kit" "$FRESH/.claude"
assert_equals "$(findings_count "$OUT_FLAG_FLAG" install-drift)" "1" \
  "a flag spelled where a flag value belongs still reaches the argument walk"
assert_equals \
  "$(finding_detail "$OUT_FLAG_FLAG" install-drift .claude)" \
  "no kit markers — never installed" \
  "the install probe runs as asked rather than degrading to a task walk"
pass "a value that can never be a value is never consumed"

OUT_NO_ROOT="$TEST_ROOT/no-root.json"
run_check "$OUT_NO_ROOT"
assert_equals "$(findings_count "$OUT_NO_ROOT")" "0" "finding count with no root given"
assert_equals "$(scanned_count "$OUT_NO_ROOT")" "0" "scanned count with no root given"
[ -s "$OUT_NO_ROOT.err" ] || fail "a missing root argument must warn on stderr"
pass "a missing root argument still emits parseable JSON and warns on stderr"

echo "All health-check cases passed."
