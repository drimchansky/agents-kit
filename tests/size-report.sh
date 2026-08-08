#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$REPO_DIR/scripts/size-report.mjs"
FIXTURES="$REPO_DIR/tests/fixtures/size-report"
TEMP_BASE="${TMPDIR:-/tmp}"
TEMP_BASE="${TEMP_BASE%/}"
TEST_ROOT="$(mktemp -d "$TEMP_BASE/agents-kit-size-report.XXXXXX")"

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
    "$TEMP_BASE"/agents-kit-size-report.*) rm -rf "$TEST_ROOT" ;;
    *) echo "Refusing to remove unexpected test root: $TEST_ROOT" >&2 ;;
  esac
}
trap cleanup EXIT

case "$TEST_ROOT" in
  "$TEMP_BASE"/agents-kit-size-report.*) ;;
  *) fail "mktemp returned an unexpected path: $TEST_ROOT" ;;
esac
[ ! -L "$TEST_ROOT" ] || fail "temporary root must not be a symlink"

command -v node >/dev/null 2>&1 || fail "node is required to run the size report"
[ -f "$SCRIPT" ] || fail "missing script: $SCRIPT"
[ -d "$FIXTURES" ] || fail "missing fixture kit: $FIXTURES"

run_report() {
  local out="$1"
  shift
  if ! node "$SCRIPT" "$@" >"$out" 2>"$out.err"; then
    sed -n '1,40p' "$out.err" >&2
    fail "size-report.mjs exited non-zero for: $*"
  fi
  node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$out" ||
    fail "stdout is not a single JSON object for: $*"
}

set_total() {
  node -e '
const fs = require("node:fs");
const [file, skill, set, field] = process.argv.slice(1);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const row = data.skills.find((s) => s.skill === skill);
console.log(row ? row[set][field] : "");
' "$1" "$2" "$3" "$4"
}

set_files() {
  node -e '
const fs = require("node:fs");
const [file, skill, set] = process.argv.slice(1);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const row = data.skills.find((s) => s.skill === skill);
console.log(row ? row[set].files.map((f) => f.path).join(" | ") : "");
' "$1" "$2" "$3"
}

file_measure() {
  node -e '
const fs = require("node:fs");
const [file, skill, set, path] = process.argv.slice(1);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const row = data.skills.find((s) => s.skill === skill);
const entry = row && row[set].files.find((f) => f.path === path);
console.log(entry ? `${entry.bytes}/${entry.approxTokens}` : "");
' "$1" "$2" "$3" "$4"
}

skills_list() {
  node -e '
const fs = require("node:fs");
console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).skills.map((s) => s.skill).join(" | "));
' "$1"
}

warnings_count() {
  node -e '
const fs = require("node:fs");
console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).warnings);
' "$1"
}

unresolved_list() {
  node -e '
const fs = require("node:fs");
console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).unresolved.join(" | "));
' "$1"
}

report_root() {
  node -e '
const fs = require("node:fs");
console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).root ?? "null");
' "$1"
}

assert_equals() {
  [ "$1" = "$2" ] || fail "$3 (expected \"$2\", got \"$1\")"
}

assert_contains() {
  case "$1" in
    *"$2"*) ;;
    *) fail "$3 (expected to contain \"$2\", got \"$1\")" ;;
  esac
}

# The fixture is a miniature kit whose files are padded to exact byte counts, so every total below is
# checkable by hand. It is copied because two cases below make a file unreadable.
KIT="$TEST_ROOT/kit"
cp -R "$FIXTURES" "$KIT"

OUT="$TEST_ROOT/kit.json"
run_report "$OUT" "$KIT"
assert_equals "$(report_root "$OUT")" "$KIT" "root is the resolved kit root"
assert_equals "$(skills_list "$OUT")" "leaf-skill | tiny-skill" "every skill holding a SKILL.md is reported"
pass "a miniature kit reports one entry per skill and exits 0"

# The direct set is the SKILL.md plus what it cites: `./AGENTS.md` counted as the kit's CORE_RULES.md,
# and one reference cited twice counted once. 500 + 200 + 400 = 1100 bytes.
assert_equals \
  "$(set_files "$OUT" tiny-skill direct)" \
  "skills/tiny-skill/SKILL.md | CORE_RULES.md | references/workflow/alpha.md" \
  "direct files for tiny-skill, in citation order"
assert_equals "$(set_total "$OUT" tiny-skill direct bytes)" "1100" "direct bytes for tiny-skill"
assert_equals "$(set_total "$OUT" tiny-skill direct approxTokens)" "275" "direct approxTokens for tiny-skill"
assert_equals "$(file_measure "$OUT" tiny-skill direct CORE_RULES.md)" "200/50" \
  "a skill's ./AGENTS.md citation is measured as the kit's CORE_RULES.md"
pass "the direct set holds the SKILL.md, its CORE_RULES.md, and each cited reference exactly once"

# The closure adds what alpha cites (beta, gamma) and stops there: beta cites alpha back and alpha cites
# itself, so a set that counted either again would loop or double-count. 1100 + 300 + 302 = 1702 bytes.
assert_equals \
  "$(set_files "$OUT" tiny-skill transitive)" \
  "skills/tiny-skill/SKILL.md | CORE_RULES.md | references/workflow/alpha.md | references/workflow/beta.md | references/domain/gamma.md" \
  "transitive files for tiny-skill, in breadth-first order"
assert_equals "$(set_total "$OUT" tiny-skill transitive bytes)" "1702" "transitive bytes for tiny-skill"
assert_equals "$(set_total "$OUT" tiny-skill transitive approxTokens)" "426" \
  "transitive approxTokens for tiny-skill"
pass "the transitive closure follows reference citations through a cycle and counts each file once"

# 302 / 4 is exactly 75.5, so this pins the rounding direction the whole report leans on.
assert_equals "$(file_measure "$OUT" tiny-skill transitive references/domain/gamma.md)" "302/76" \
  "approxTokens rounds a half-token up"
pass "approxTokens is round(bytes / 4), including at the half-token boundary"

assert_equals "$(set_files "$OUT" leaf-skill direct)" "skills/leaf-skill/SKILL.md" \
  "direct files for a skill citing nothing"
assert_equals "$(set_files "$OUT" leaf-skill transitive)" "skills/leaf-skill/SKILL.md" \
  "transitive files for a skill citing nothing"
assert_equals "$(set_total "$OUT" leaf-skill direct bytes)" "200" "direct bytes for leaf-skill"
assert_equals "$(set_total "$OUT" leaf-skill transitive approxTokens)" "50" \
  "transitive approxTokens for leaf-skill"
pass "a skill citing no reference reports its SKILL.md alone in both sets"

# A citation naming no file contributes no bytes, so it has to reach the contract: a caller reading the
# totals alone would take a partly measured path for a complete one.
assert_equals "$(warnings_count "$OUT")" "3" "warning count for the fixture kit"
assert_equals \
  "$(unresolved_list "$OUT")" \
  "skills/tiny-skill/SKILL.md -> ./references/workflow/gone.md | references/workflow/beta.md -> ./nowhere.md | references/domain/gamma.md -> ../../../escape.md" \
  "unresolved names each citation and the file that made it"
assert_contains "$(cat "$OUT.err")" "./references/workflow/gone.md (no such file)" \
  "a dangling skill citation warns on stderr"
assert_contains "$(cat "$OUT.err")" "../../../escape.md (outside the kit root)" \
  "a citation climbing out of the kit root warns on stderr"
pass "a dangling citation is a stderr warning and a contract entry, never a crash"

# `./plan.md` names a file in the user's task folder, not a kit reference. Both fixture files carry one,
# and reporting them would give every healthy run a permanent false warning.
case "$(unresolved_list "$OUT")" in
  *plan.md*) fail "a task-folder artifact citation must not be reported unresolved" ;;
  *) ;;
esac
pass "a citation naming a task-folder role file is not reported as a broken kit citation"

OUT_ONE="$TEST_ROOT/filtered.json"
run_report "$OUT_ONE" --skill tiny-skill "$KIT"
assert_equals "$(skills_list "$OUT_ONE")" "tiny-skill" "--skill narrows the report to the named skill"
assert_equals "$(set_total "$OUT_ONE" tiny-skill direct bytes)" "1100" \
  "a filtered skill carries the same totals as an unfiltered run"
assert_equals "$(warnings_count "$OUT_ONE")" "3" "filtering does not suppress the citation warnings"
pass "--skill reports one skill's paths without changing what they measure"

OUT_TYPO="$TEST_ROOT/typo.json"
run_report "$OUT_TYPO" --skill no-such-skill "$KIT"
assert_equals "$(skills_list "$OUT_TYPO")" "" "an unmatched --skill name reports no skill"
assert_contains "$(cat "$OUT_TYPO.err")" "no such skill: no-such-skill" \
  "an unmatched --skill name warns on stderr"
pass "a typo in --skill is reported rather than read as a skill that loads nothing"

# statSync still sizes a file the process cannot open, so the bytes stay counted while the citations
# inside it go unread — the closure silently shrinks unless that gap is announced.
chmod 000 "$KIT/references/workflow/alpha.md"
if [ -r "$KIT/references/workflow/alpha.md" ]; then
  pass "skipped: the unreadable-file case needs a user that chmod 000 actually stops"
else
  OUT_LOCKED="$TEST_ROOT/locked.json"
  run_report "$OUT_LOCKED" --skill tiny-skill "$KIT"
  assert_equals "$(set_total "$OUT_LOCKED" tiny-skill direct bytes)" "1100" \
    "an unreadable reference is still measured by size"
  assert_equals "$(set_total "$OUT_LOCKED" tiny-skill transitive bytes)" "1100" \
    "an unreadable reference contributes no citations to the closure"
  assert_contains "$(cat "$OUT_LOCKED.err")" "unresolved citation in references/workflow/alpha.md: (contents)" \
    "an unreadable reference warns on stderr"
  # The gap belongs in the contract, not only on stderr: `unresolved` is what the header ties a byte
  # total's completeness to, so a shrunken closure beside an empty `unresolved` reads as real
  # slimming. A stat-level failure already lands there; only the read-level one escaped.
  assert_contains "$(unresolved_list "$OUT_LOCKED")" "references/workflow/alpha.md -> (contents)" \
    "an unreadable reference names itself in unresolved"
  pass "a reference that cannot be opened shrinks the closure loudly, not silently"
fi
chmod 644 "$KIT/references/workflow/alpha.md"

OUT_NO_ROOT="$TEST_ROOT/no-root.json"
run_report "$OUT_NO_ROOT"
assert_equals "$(report_root "$OUT_NO_ROOT")" "null" "root is null when no kit root is given"
assert_equals "$(skills_list "$OUT_NO_ROOT")" "" "no kit root reports no skill"
[ -s "$OUT_NO_ROOT.err" ] || fail "a missing kit root must warn on stderr"
pass "a missing kit root still emits parseable JSON and warns on stderr"

OUT_FILE_ROOT="$TEST_ROOT/file-root.json"
run_report "$OUT_FILE_ROOT" "$KIT/CORE_RULES.md"
assert_equals "$(skills_list "$OUT_FILE_ROOT")" "" "a file given as the kit root reports no skill"
assert_contains "$(cat "$OUT_FILE_ROOT.err")" "not a directory" \
  "a file given as the kit root warns on stderr"
pass "a kit root that is not a directory is reported rather than walked"

OUT_EMPTY="$TEST_ROOT/empty.json"
mkdir -p "$TEST_ROOT/empty-kit"
run_report "$OUT_EMPTY" "$TEST_ROOT/empty-kit"
assert_equals "$(skills_list "$OUT_EMPTY")" "" "a kit with no skills directory reports no skill"
pass "a kit holding no skills reports an empty list rather than failing"

# Every case above redirects stdout to a file, where POSIX writes are synchronous — so none of them can
# see a report truncated at the pipe buffer. This one reads through a real pipe, and the long file names
# carry the payload past 64 KB in a few dozen skills.
BIG="$TEST_ROOT/big-kit"
node -e '
const fs = require("node:fs");
const p = require("node:path");
const root = process.argv[1];
const pad = "n".repeat(60);
const refs = [];
for (let i = 0; i < 8; i++) refs.push(`ref-${String(i).padStart(2, "0")}-${pad}.md`);
fs.mkdirSync(p.join(root, "references", "workflow"), { recursive: true });
for (const ref of refs) fs.writeFileSync(p.join(root, "references", "workflow", ref), "# ref\n");
fs.writeFileSync(p.join(root, "CORE_RULES.md"), "# core\n");
const cites = refs.map((r) => `\`./references/workflow/${r}\``).join(", ");
for (let i = 0; i < 60; i++) {
  const dir = p.join(root, "skills", `skill-${String(i).padStart(2, "0")}-${pad}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p.join(dir, "SKILL.md"), `# skill\n\nReads \`./AGENTS.md\` and ${cites}.\n`);
}
' "$BIG"

node "$SCRIPT" "$BIG" >"$TEST_ROOT/big-kit.json" 2>/dev/null
FILE_BYTES="$(wc -c < "$TEST_ROOT/big-kit.json" | tr -d ' ')"
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

# The fixtures above are miniatures; this proves the same run works over the kit the script measures.
OUT_LIVE="$TEST_ROOT/live.json"
run_report "$OUT_LIVE" "$REPO_DIR"
REPO_SKILLS="$(find "$REPO_DIR/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l | tr -d ' ')"
LIVE_SKILLS="$(node -e '
const fs = require("node:fs");
console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).skills.length);
' "$OUT_LIVE")"
assert_equals "$LIVE_SKILLS" "$REPO_SKILLS" "the live run reports one entry per skill in this repository"
pass "a run over this repository emits valid JSON covering every skill"

echo "All size-report cases passed."
