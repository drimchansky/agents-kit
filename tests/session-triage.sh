#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TRIAGE="$REPO_DIR/scripts/session-triage.mjs"
FIXTURES="$REPO_DIR/tests/fixtures/sessions"
TEMP_BASE="${TMPDIR:-/tmp}"
TEMP_BASE="${TEMP_BASE%/}"
TEST_ROOT="$(mktemp -d "$TEMP_BASE/agents-kit-session-triage.XXXXXX")"

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
    "$TEMP_BASE"/agents-kit-session-triage.*) rm -rf "$TEST_ROOT" ;;
    *) echo "Refusing to remove unexpected test root: $TEST_ROOT" >&2 ;;
  esac
}
trap cleanup EXIT

case "$TEST_ROOT" in
  "$TEMP_BASE"/agents-kit-session-triage.*) ;;
  *) fail "mktemp returned an unexpected path: $TEST_ROOT" ;;
esac
[ "$TEST_ROOT" != "$HOME" ] || fail "temporary root resolved to the operator HOME"
[ ! -L "$TEST_ROOT" ] || fail "temporary root must not be a symlink"

command -v node >/dev/null 2>&1 || fail "node is required to run the session-triage tests"
[ -f "$TRIAGE" ] || fail "missing script: $TRIAGE"
[ -d "$FIXTURES" ] || fail "missing fixtures: $FIXTURES"

# Fixtures are copied so the test can set mtimes without touching the repository.
CORPUS="$TEST_ROOT/corpus"
mkdir -p "$CORPUS"
cp -R "$FIXTURES/." "$CORPUS"/

# `--since 2026-03-10` splits these: every file below is inside the window except the stale one.
touch -t 202603120900.00 "$CORPUS/claude/multi-signal.jsonl"
touch -t 202603121000.00 "$CORPUS/claude/benign-errors.jsonl"
touch -t 202603130900.00 "$CORPUS/claude/input-validation-older.jsonl"
touch -t 202603140900.00 "$CORPUS/claude/input-validation-newer.jsonl"
touch -t 202603010900.00 "$CORPUS/claude/stale-multi-signal.jsonl"
touch -t 202603150900.00 "$CORPUS/codex/aborts-and-unknown.jsonl"
touch -t 202603131200.00 "$CORPUS/codex/rejected-patch.jsonl"
touch -t 202603140900.00 "$CORPUS/malformed/not-a-session.jsonl"

OUT="$TEST_ROOT/triage.json"
ERR="$TEST_ROOT/triage.err"

run_triage() {
  local out="$1"
  local err="$2"
  shift 2
  set +e
  node "$TRIAGE" "$@" >"$out" 2>"$err"
  local status=$?
  set -e
  [ "$status" -eq 0 ] || {
    sed -n '1,40p' "$err" >&2
    fail "session-triage.mjs exited $status (the contract requires exit 0)"
  }
}

# Evaluates a JS expression against the parsed stdout JSON and prints the result.
query() {
  node -e '
    const { readFileSync } = require("node:fs");
    const report = JSON.parse(readFileSync(process.argv[1], "utf8"));
    const value = new Function("j", `return (${process.argv[2]});`)(report);
    process.stdout.write(typeof value === "string" ? value : JSON.stringify(value));
  ' "$OUT" "$1"
}

assert_query() {
  local expression="$1"
  local expected="$2"
  local label="$3"
  local actual
  actual="$(query "$expression")"
  [ "$actual" = "$expected" ] || fail "$label: expected $expected, got $actual"
  pass "$label"
}

run_triage "$OUT" "$ERR" --since 2026-03-10 --top 10 \
  "$CORPUS/claude" "$CORPUS/codex" "$CORPUS/malformed"
pass "triage exits 0 on the fixture corpus"

node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$OUT" ||
  fail "stdout is not a single JSON object"
pass "stdout parses as one JSON object"

assert_query 'Object.keys(j).sort().join(",")' \
  "flagged,remainder,remainderPaths,scanned,skippedUnknownRecords,skippedUnrecognized,skippedUnrecognizedPaths,unreadable,unreadableDirs,unreadablePaths" \
  "report carries exactly the contract keys"
assert_query 'j.unreadable' "0" "a fully readable corpus reports nothing unread"

# A file the run could not interpret is as unread as one it could not open, and the caller advances
# its since-marker past both — so a stderr warning alone leaves it stepped over for good.
assert_query 'j.skippedUnrecognized' "1" "a jsonl whose host cannot be sniffed is counted, not only warned about"
assert_query 'j.skippedUnrecognizedPaths[0].endsWith("not-a-session.jsonl")' "true" \
  "skippedUnrecognizedPaths names it by path"

# The stale file is excluded by mtime; the other seven are scanned.
assert_query 'j.scanned' "7" "only files with mtime >= --since are scanned"

# Ranking: distinct-class count desc, then mtime desc, across both hosts.
assert_query 'j.flagged.map((f) => f.path.split("/").slice(-2).join("/")).join(" ")' \
  "claude/multi-signal.jsonl codex/aborts-and-unknown.jsonl claude/input-validation-newer.jsonl codex/rejected-patch.jsonl claude/input-validation-older.jsonl" \
  "sessions rank by distinct-class count, then recency"

assert_query 'j.flagged.map((f) => f.score).join(",")' "3,2,1,1,1" "score is the distinct-class count"
assert_query 'j.remainder' "0" "remainder is zero when top-N covers every flagged session"

assert_query 'j.flagged.some((f) => f.path.endsWith("benign-errors.jsonl"))' \
  "false" "a session with only benign is_error results is not flagged"
assert_query 'j.flagged.some((f) => f.path.endsWith("stale-multi-signal.jsonl"))' \
  "false" "a signal-bearing session older than --since is not flagged"
assert_query 'j.flagged.some((f) => f.path.endsWith("not-a-session.jsonl"))' \
  "false" "an unrecognized jsonl file is skipped rather than flagged"

assert_query 'JSON.stringify(j.flagged[0].classes)' \
  '{"permission-denial":1,"policy-block":1,"retry-loop":1}' \
  "Claude permission denial, policy block, and retry loop are classified"
assert_query 'j.flagged[0].host' "claude" "Claude host is detected from record shape"
assert_query 'j.flagged[0].mtime' "2026-03-12" "mtime is reported as YYYY-MM-DD"

assert_query 'JSON.stringify(j.flagged[1].classes)' \
  '{"api-error":1,"user-abort":2}' \
  "Codex stream error and repeated aborts are classified"
assert_query 'j.flagged[1].host' "codex" "Codex host is detected from record shape"

assert_query 'JSON.stringify(j.flagged[3].classes)' \
  '{"policy-block":2}' \
  "Codex rejected patch and rejected exec output are classified"

# A single interrupt is ordinary; only repeated aborts clear the user-abort threshold.
assert_query 'j.flagged.filter((f) => f.classes["user-abort"] !== undefined).length' \
  "1" "user-abort needs more than one interrupt in a session"

# One unknown Codex record type, one unparsable line, and a bare `null` on each host — a valid JSON
# value that survives the parse, so only the classifiers' own guard keeps it off a dereference.
assert_query 'j.skippedUnknownRecords' "4" "unknown record types, unparsable lines, and null records are counted"

grep -q "unrecognized session format" "$ERR" ||
  fail "expected a stderr warning for the unrecognized jsonl file"
pass "warnings go to stderr, not stdout"

run_triage "$OUT" "$ERR" --since 2026-03-10 --top 2 \
  "$CORPUS/claude" "$CORPUS/codex" "$CORPUS/malformed"
assert_query 'j.flagged.length' "2" "--top truncates the flagged list"
assert_query 'j.remainder' "3" "remainder counts flagged sessions beyond --top"
assert_query 'j.remainderPaths.length' "3" "remainderPaths names each flagged session beyond --top"

run_triage "$OUT" "$ERR" --since=2026-03-10 --top=2 \
  "$CORPUS/claude" "$CORPUS/codex" "$CORPUS/malformed"
assert_query 'j.flagged.length' "2" "--since= and --top= inline forms are accepted"

# `parseInt` would stop at the first non-digit and silently accept the leading run, so `2junk` would
# truncate the list to 2 rather than warning. A count is only trustworthy if the flag that set it was.
run_triage "$OUT" "$ERR" --since 2026-03-10 --top 2junk \
  "$CORPUS/claude" "$CORPUS/codex" "$CORPUS/malformed"
assert_query 'j.flagged.length' "5" "a --top carrying trailing garbage falls back to the default"
grep -q -- "--top must be a positive integer" "$ERR" ||
  fail "expected a stderr warning for a --top carrying trailing garbage"
pass "a --top that is not a plain integer warns and uses the default"

run_triage "$OUT" "$ERR" --since 2026-03-16 "$CORPUS/claude" "$CORPUS/codex"
assert_query 'j.scanned' "0" "a --since after every mtime scans nothing"
assert_query 'j.flagged.length' "0" "nothing is flagged when nothing is scanned"

run_triage "$OUT" "$ERR" --top 5 "$CORPUS/claude"
assert_query 'j.flagged.length' "0" "a missing --since yields an empty report"
grep -q -- "--since must be YYYY-MM-DD" "$ERR" ||
  fail "expected a stderr warning for the missing --since"
pass "a missing --since warns on stderr and still exits 0"

# Without a window nothing is walked, and the payload is otherwise byte-identical to a window that
# was walked in full and found clean. The caller gates its since-marker on `unreadable`, so leaving
# the two indistinguishable would advance the marker over transcripts nothing ever read.
assert_query 'j.unreadable' "1" "a directory left unwalked by a missing --since is counted as unread"
assert_query 'j.unreadableDirs.length' "1" "unreadableDirs names the directory the missing window skipped"

run_triage "$OUT" "$ERR" --since not-a-date "$CORPUS/claude"
assert_query 'j.scanned' "0" "an unparsable --since scans nothing"
assert_query 'j.unreadable' "1" "a directory left unwalked by an unparsable --since is counted as unread"
pass "an unparsable --since is reported in the contract, not only on stderr"

# A `--since` given no date would otherwise consume the session directory as its value, emptying
# `dirs` — so the guard above would have nothing left to report and the run would read as a clean
# walk. A value is taken only when it has the shape of a date.
run_triage "$OUT" "$ERR" --since "$CORPUS/claude"
assert_query 'j.scanned' "0" "a --since missing its date scans nothing"
assert_query 'j.unreadable' "1" "the directory a dateless --since would have swallowed is still counted"
assert_query 'j.unreadableDirs[0].endsWith("claude")' "true" \
  "the unconsumed argument is read as the session directory it is"
pass "a flag value is consumed only when it has the shape the flag wants"

# Three identical genuine failures are a retry loop; three outputs that merely quote the phrase
# mid-line — a grep hit over Codex's own sources, a diff of the classifier itself — are not. The
# corpus is kept out of the main run so its counts stay independent of these two files.
touch -t 202603140900.00 "$CORPUS/codex-retry/anchored-retry-loop.jsonl"
touch -t 202603140900.00 "$CORPUS/codex-retry/quoted-failure.jsonl"
run_triage "$OUT" "$ERR" --since 2026-03-10 "$CORPUS/codex-retry"
assert_query 'j.scanned' "2" "both retry-corpus transcripts are scanned"
assert_query 'j.flagged.length' "1" "only the genuine retry loop is flagged"
assert_query 'j.flagged[0].path.endsWith("anchored-retry-loop.jsonl")' "true" \
  "three identical line-anchored failures of one tool are a retry loop"
assert_query 'j.flagged[0].classes["retry-loop"]' "1" "the retry loop is classified as such"
assert_query 'j.flagged.some((f) => f.path.endsWith("quoted-failure.jsonl"))' "false" \
  "a failure phrase quoted mid-line is not a failure"
pass "the Codex failure markers are line-anchored, so quoted output does not read as a retry loop"

run_triage "$OUT" "$ERR" --since 2026-03-10 "$TEST_ROOT/absent-corpus"
assert_query 'j.scanned' "0" "a missing directory scans nothing"
# ENOENT is an uninstalled host, not an unread one: counting it would pin the caller's since-marker
# forever on any machine running only one of the two agents.
assert_query 'j.unreadable' "0" "a missing directory is not counted as unread"
grep -q "unreadable dir" "$ERR" || fail "expected a stderr warning for the missing directory"
pass "a missing directory warns and does not abort the run"

# A directory the run could not list hides a whole subtree. The caller gates its marker advance on
# `unreadable`, so a readdir failure that never reaches the contract loses those transcripts for good.
LOCKED_DIR="$TEST_ROOT/locked-dir"
mkdir -p "$LOCKED_DIR/inner"
cp "$CORPUS/claude/multi-signal.jsonl" "$LOCKED_DIR/inner/session.jsonl"
chmod 000 "$LOCKED_DIR/inner"
if [ -r "$LOCKED_DIR/inner" ]; then
  pass "skipped: the unlistable-directory case needs a user that chmod 000 actually stops"
else
  run_triage "$OUT" "$ERR" --since 2026-03-10 "$LOCKED_DIR"
  assert_query 'j.unreadable' "1" "a directory that cannot be listed counts as unread"
  assert_query 'j.unreadableDirs[0].endsWith("inner")' "true" "unreadableDirs names it by path"
  pass "an unlistable directory reaches the contract, not only stderr"
fi
chmod 755 "$LOCKED_DIR/inner"

# A transcript the run could not read must be named, not silently dropped: the caller advances its
# since-marker past this window, so an unread file would otherwise never be looked at again.
LOCKED="$TEST_ROOT/locked-corpus"
mkdir -p "$LOCKED"
cp "$CORPUS/claude/multi-signal.jsonl" "$LOCKED/locked.jsonl"
chmod 000 "$LOCKED/locked.jsonl"
if [ -r "$LOCKED/locked.jsonl" ]; then
  pass "skipped: the unreadable-file case needs a user that chmod 000 actually stops"
else
  run_triage "$OUT" "$ERR" --since 2026-03-10 "$LOCKED"
  assert_query 'j.unreadable' "1" "a transcript that cannot be read is counted"
  assert_query 'j.unreadablePaths[0].endsWith("locked.jsonl")' "true" "unreadablePaths names it by path"
  assert_query 'j.scanned' "1" "an unreadable transcript still counts as scanned"
  assert_query 'j.flagged.length' "0" "an unreadable transcript is not flagged"
  pass "an unreadable transcript is reported in the contract, not only on stderr"
fi
chmod 644 "$LOCKED/locked.jsonl"

# Every case above redirects stdout to a file, where POSIX writes are synchronous — so none of them
# can see a report truncated at the pipe buffer. remainderPaths names every flagged session beyond
# --top, so a low --top over long paths is what pushes the payload past 64 KB.
BIG="$TEST_ROOT/big-report"
node -e '
const fs = require("node:fs");
const p = require("node:path");
const pad = "x".repeat(180);
const line = JSON.stringify({
  type: "user",
  message: {
    content: [
      { type: "tool_result", tool_use_id: "a", is_error: true, content: "Permission to use Bash has been denied." },
    ],
  },
});
fs.mkdirSync(process.argv[1], { recursive: true });
for (let i = 0; i < 300; i++) {
  fs.writeFileSync(p.join(process.argv[1], `session-${String(i).padStart(3, "0")}-${pad}.jsonl`), line + "\n");
}
' "$BIG"

node "$TRIAGE" --since 2020-01-01 --top 1 "$BIG" >"$TEST_ROOT/big-report.json" 2>/dev/null
FILE_BYTES="$(wc -c < "$TEST_ROOT/big-report.json" | tr -d ' ')"
[ "$FILE_BYTES" -gt 65536 ] ||
  fail "the volume fixture must exceed the 64 KB pipe buffer to be a real test (got $FILE_BYTES)"
PIPED_BYTES="$(node "$TRIAGE" --since 2020-01-01 --top 1 "$BIG" 2>/dev/null | wc -c | tr -d ' ')"
[ "$PIPED_BYTES" -eq "$FILE_BYTES" ] ||
  fail "piped report size must match the file-redirected size (piped $PIPED_BYTES, file $FILE_BYTES)"
node "$TRIAGE" --since 2020-01-01 --top 1 "$BIG" 2>/dev/null |
  node -e 'let d="";process.stdin.on("data",(c)=>(d+=c)).on("end",()=>{JSON.parse(d)})' ||
  fail "a report larger than the pipe buffer must survive the pipe intact"
pass "a report over 64 KB parses when read through a pipe, not only from a file"

set +e
node "$TRIAGE" --since 2020-01-01 --top 1 "$BIG" 2>/dev/null | head -c 64 >/dev/null
early_status=${PIPESTATUS[0]}
set -e
[ "$early_status" -eq 0 ] ||
  fail "a reader that closes the pipe early must leave the exit status at 0 (got $early_status)"
pass "an early-closing reader does not turn into a non-zero exit"

echo "All session triage cases passed."
