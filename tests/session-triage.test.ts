// Covers scripts/session-triage.ts: transcript triage, its six signal classes, and its ranking.
// Zero dependencies; runs under Node type stripping — too old a Node fails as a parse error, not a
// version message. Floor in AGENTS.md § The `.ts` sources are unchecked by design.
// Run: node --test tests/<name>.test.ts   ·   all five: node --test "tests/*.test.ts"

import assert from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  accessSync,
  chmodSync,
  closeSync,
  constants,
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SCRIPT = join(REPO_DIR, "scripts", "session-triage.ts");
const FIXTURES = join(TESTS_DIR, "fixtures", "sessions");

const PIPE_BUFFER_BYTES = 65536;
const EARLY_READER_BYTES = 64;
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const VOLUME_SESSIONS = 300;
const VOLUME_NAME_PADDING = 180;

const TEST_ROOT = mkdtempSync(join(tmpdir(), "agents-kit-session-triage-"));
const CORPUS = join(TEST_ROOT, "corpus");
const CLAUDE_CORPUS = join(CORPUS, "claude");
const CODEX_CORPUS = join(CORPUS, "codex");
const CODEX_RETRY_CORPUS = join(CORPUS, "codex-retry");
const MALFORMED_CORPUS = join(CORPUS, "malformed");
const ABSENT_CORPUS = join(TEST_ROOT, "absent-corpus");
const LOCKED_DIR = join(TEST_ROOT, "locked-dir");
const LOCKED_INNER = join(LOCKED_DIR, "inner");
const LOCKED_CORPUS = join(TEST_ROOT, "locked-corpus");
const LOCKED_FILE = join(LOCKED_CORPUS, "locked.jsonl");
const VOLUME_CORPUS = join(TEST_ROOT, "big-report");
const VOLUME_REPORT = join(TEST_ROOT, "big-report.json");

const MAIN_ARGS: readonly string[] = [
  "--since", "2026-03-10", "--top", "10",
  CLAUDE_CORPUS, CODEX_CORPUS, MALFORMED_CORPUS,
];
const TOP_TWO_ARGS: readonly string[] = [
  "--since", "2026-03-10", "--top", "2",
  CLAUDE_CORPUS, CODEX_CORPUS, MALFORMED_CORPUS,
];
const INLINE_FLAG_ARGS: readonly string[] = [
  "--since=2026-03-10", "--top=2",
  CLAUDE_CORPUS, CODEX_CORPUS, MALFORMED_CORPUS,
];
const TOP_GARBAGE_ARGS: readonly string[] = [
  "--since", "2026-03-10", "--top", "2junk",
  CLAUDE_CORPUS, CODEX_CORPUS, MALFORMED_CORPUS,
];
const EMPTY_WINDOW_ARGS: readonly string[] = ["--since", "2026-03-16", CLAUDE_CORPUS, CODEX_CORPUS];
const NO_SINCE_ARGS: readonly string[] = ["--top", "5", CLAUDE_CORPUS];
const UNPARSABLE_SINCE_ARGS: readonly string[] = ["--since", "not-a-date", CLAUDE_CORPUS];
const DATELESS_SINCE_ARGS: readonly string[] = ["--since", CLAUDE_CORPUS];
const RETRY_ARGS: readonly string[] = ["--since", "2026-03-10", CODEX_RETRY_CORPUS];
const ABSENT_ARGS: readonly string[] = ["--since", "2026-03-10", ABSENT_CORPUS];
const LOCKED_DIR_ARGS: readonly string[] = ["--since", "2026-03-10", LOCKED_DIR];
const LOCKED_FILE_ARGS: readonly string[] = ["--since", "2026-03-10", LOCKED_CORPUS];
const VOLUME_ARGS: readonly string[] = ["--since", "2020-01-01", "--top", "1", VOLUME_CORPUS];

// `--since 2026-03-10` splits these: every file below is inside the window except the stale one.
// The stamps are local times, because the script parses `--since` to local midnight — reading them
// as UTC would shift files across that boundary and change which ones the window selects.
const FIXTURE_MTIMES: readonly (readonly [string, string])[] = [
  [join(CLAUDE_CORPUS, "multi-signal.jsonl"), "2026-03-12T09:00:00"],
  [join(CLAUDE_CORPUS, "benign-errors.jsonl"), "2026-03-12T10:00:00"],
  [join(CLAUDE_CORPUS, "input-validation-older.jsonl"), "2026-03-13T09:00:00"],
  [join(CLAUDE_CORPUS, "input-validation-newer.jsonl"), "2026-03-14T09:00:00"],
  [join(CLAUDE_CORPUS, "stale-multi-signal.jsonl"), "2026-03-01T09:00:00"],
  [join(CODEX_CORPUS, "aborts-and-unknown.jsonl"), "2026-03-15T09:00:00"],
  [join(CODEX_CORPUS, "rejected-patch.jsonl"), "2026-03-13T12:00:00"],
  [join(MALFORMED_CORPUS, "not-a-session.jsonl"), "2026-03-14T09:00:00"],
  [join(CODEX_RETRY_CORPUS, "anchored-retry-loop.jsonl"), "2026-03-14T09:00:00"],
  [join(CODEX_RETRY_CORPUS, "quoted-failure.jsonl"), "2026-03-14T09:00:00"],
];

interface FlaggedSession {
  readonly path: string;
  readonly host: string;
  readonly mtime: string;
  readonly classes: Readonly<Record<string, number>>;
  readonly score: number;
}

interface Report {
  readonly flagged: readonly FlaggedSession[];
  readonly remainder: number;
  readonly remainderPaths: readonly string[];
  readonly scanned: number;
  readonly skippedUnknownRecords: number;
  readonly skippedUnrecognized: number;
  readonly skippedUnrecognizedPaths: readonly string[];
  readonly unreadable: number;
  readonly unreadableDirs: readonly string[];
  readonly unreadablePaths: readonly string[];
}

interface TriageProcess {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

interface TriageRun {
  readonly report: Report;
  readonly stderr: string;
}

function spawnTriage(args: readonly string[]): TriageProcess {
  const run = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER_BYTES,
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr ?? run.error?.message ?? "" };
}

function runTriage(args: readonly string[]): TriageRun {
  const run = spawnTriage(args);
  assert.strictEqual(
    run.status,
    0,
    `session-triage.ts exited ${run.status} (the contract requires exit 0) for: ${args.join(" ")}\n${run.stderr}`,
  );
  const report: Report = JSON.parse(run.stdout);
  return { report, stderr: run.stderr };
}

function flaggedNames(report: Report): string[] {
  return report.flagged.map((entry) => entry.path.split("/").slice(-2).join("/"));
}

function isFlagged(report: Report, suffix: string): boolean {
  return report.flagged.some((entry) => entry.path.endsWith(suffix));
}

function assertIncludes(haystack: string, needle: string, message: string): void {
  assert.ok(haystack.includes(needle), `${message} (expected to contain "${needle}", got "${haystack}")`);
}

function assertEndsWith(actual: string, suffix: string, message: string): void {
  assert.ok(actual.endsWith(suffix), `${message} (expected to end with "${suffix}", got "${actual}")`);
}

function isReadable(path: string): boolean {
  try {
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

// remainderPaths names every flagged session beyond --top, so a low --top over long paths is what
// pushes the payload past the 64 KB pipe buffer the two cases at the end measure against.
function writeVolumeCorpus(root: string): void {
  const padding = "x".repeat(VOLUME_NAME_PADDING);
  const line = JSON.stringify({
    type: "user",
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: "a",
          is_error: true,
          content: "Permission to use Bash has been denied.",
        },
      ],
    },
  });
  mkdirSync(root, { recursive: true });
  for (let index = 0; index < VOLUME_SESSIONS; index++) {
    writeFileSync(join(root, `session-${String(index).padStart(3, "0")}-${padding}.jsonl`), `${line}\n`);
  }
}

before(() => {
  // Fixtures are copied so the mtimes above can be set without touching the repository.
  cpSync(FIXTURES, CORPUS, { recursive: true });
  for (const [path, stamp] of FIXTURE_MTIMES) {
    const when = new Date(stamp);
    utimesSync(path, when, when);
  }
  mkdirSync(LOCKED_INNER, { recursive: true });
  copyFileSync(join(CLAUDE_CORPUS, "multi-signal.jsonl"), join(LOCKED_INNER, "session.jsonl"));
  chmodSync(LOCKED_INNER, 0o000);
  mkdirSync(LOCKED_CORPUS, { recursive: true });
  copyFileSync(join(CLAUDE_CORPUS, "multi-signal.jsonl"), LOCKED_FILE);
  chmodSync(LOCKED_FILE, 0o000);
  writeVolumeCorpus(VOLUME_CORPUS);
});

after(() => {
  // A directory left at mode 000 cannot be listed, so the recursive remove below would fail on it
  // while the unlistable-directory case's lock is still in place.
  chmodSync(LOCKED_INNER, 0o755);
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

test("triage exits 0 on the fixture corpus", () => {
  const run = spawnTriage(MAIN_ARGS);
  assert.strictEqual(run.status, 0, `the contract requires exit 0\n${run.stderr}`);
});

test("stdout parses as one JSON object", () => {
  const parsed: unknown = JSON.parse(spawnTriage(MAIN_ARGS).stdout);
  assert.ok(
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed),
    "the whole of stdout must parse as a single JSON object",
  );
});

test("report carries exactly the contract keys", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.deepStrictEqual(
    Object.keys(report).sort(),
    [
      "flagged",
      "remainder",
      "remainderPaths",
      "scanned",
      "skippedUnknownRecords",
      "skippedUnrecognized",
      "skippedUnrecognizedPaths",
      "unreadable",
      "unreadableDirs",
      "unreadablePaths",
    ],
    "the report holds the contract keys and nothing else",
  );
});

test("a fully readable corpus reports nothing unread", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.strictEqual(report.unreadable, 0, "nothing in the fixture corpus goes unread");
});

// A file the run could not interpret is as unread as one it could not open, and the caller advances
// its since-marker past both — so a stderr warning alone leaves it stepped over for good.
test("a jsonl whose host cannot be sniffed is counted, not only warned about", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.strictEqual(report.skippedUnrecognized, 1, "the malformed corpus contributes one skipped file");
});

test("skippedUnrecognizedPaths names it by path", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.strictEqual(report.skippedUnrecognizedPaths.length, 1, "one path is named");
  assertEndsWith(
    report.skippedUnrecognizedPaths[0],
    "not-a-session.jsonl",
    "the skipped file is named by path",
  );
});

test("only files with mtime >= --since are scanned", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.strictEqual(report.scanned, 7, "the stale file is excluded by mtime; the other seven are scanned");
});

test("sessions rank by distinct-class count, then recency", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.deepStrictEqual(
    flaggedNames(report),
    [
      "claude/multi-signal.jsonl",
      "codex/aborts-and-unknown.jsonl",
      "claude/input-validation-newer.jsonl",
      "codex/rejected-patch.jsonl",
      "claude/input-validation-older.jsonl",
    ],
    "distinct-class count desc, then mtime desc, across both hosts",
  );
});

test("score is the distinct-class count", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.deepStrictEqual(
    report.flagged.map((entry) => entry.score),
    [3, 2, 1, 1, 1],
    "each score counts the classes that met their threshold",
  );
});

test("remainder is zero when top-N covers every flagged session", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.strictEqual(report.remainder, 0, "--top 10 covers all five flagged sessions");
});

test("a session with only benign is_error results is not flagged", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.ok(!isFlagged(report, "benign-errors.jsonl"), "mere failure presence never flags a session");
});

test("a signal-bearing session older than --since is not flagged", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.ok(!isFlagged(report, "stale-multi-signal.jsonl"), "the window excludes it before it is classified");
});

test("an unrecognized jsonl file is skipped rather than flagged", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.ok(!isFlagged(report, "not-a-session.jsonl"), "a file with no sniffable host is never classified");
});

test("Claude permission denial, policy block, and retry loop are classified", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.deepStrictEqual(
    report.flagged[0].classes,
    { "permission-denial": 1, "policy-block": 1, "retry-loop": 1 },
    "the three Claude signals of the top-ranked session",
  );
});

test("Claude host is detected from record shape", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.strictEqual(report.flagged[0].host, "claude", "host comes from record shape, not path");
});

test("mtime is reported as YYYY-MM-DD", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.strictEqual(report.flagged[0].mtime, "2026-03-12", "the mtime set for multi-signal.jsonl");
});

test("Codex stream error and repeated aborts are classified", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.deepStrictEqual(
    report.flagged[1].classes,
    { "api-error": 1, "user-abort": 2 },
    "the two Codex signals of the second-ranked session",
  );
});

test("Codex host is detected from record shape", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.strictEqual(report.flagged[1].host, "codex", "host comes from record shape, not path");
});

test("Codex rejected patch and rejected exec output are classified", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.deepStrictEqual(
    report.flagged[3].classes,
    { "policy-block": 2 },
    "both Codex rejections land in one class",
  );
});

test("user-abort needs more than one interrupt in a session", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.strictEqual(
    report.flagged.filter((entry) => Object.hasOwn(entry.classes, "user-abort")).length,
    1,
    "only the session with two interrupts carries the class",
  );
});

// One unknown Codex record type, one unparsable line, and a bare `null` on each host — a valid JSON
// value that survives the parse, so only the classifiers' own guard keeps it off a dereference.
test("unknown record types, unparsable lines, and null records are counted", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.strictEqual(report.skippedUnknownRecords, 4, "every uninterpretable record is tallied");
});

test("warnings go to stderr, not stdout", () => {
  const run = spawnTriage(MAIN_ARGS);
  assertIncludes(run.stderr, "unrecognized session format", "the unrecognized file warns on stderr");
  assert.ok(
    !run.stdout.includes("unrecognized session format"),
    "no warning may reach stdout, which carries the JSON contract alone",
  );
});

test("--top truncates the flagged list", () => {
  const { report } = runTriage(TOP_TWO_ARGS);
  assert.strictEqual(report.flagged.length, 2, "--top 2 keeps the two highest-ranked sessions");
});

test("remainder counts flagged sessions beyond --top", () => {
  const { report } = runTriage(TOP_TWO_ARGS);
  assert.strictEqual(report.remainder, 3, "three of the five flagged sessions fall outside --top 2");
});

test("remainderPaths names each flagged session beyond --top", () => {
  const { report } = runTriage(TOP_TWO_ARGS);
  assert.strictEqual(report.remainderPaths.length, 3, "the truncated sessions are named, not only counted");
});

test("--since= and --top= inline forms are accepted", () => {
  const { report } = runTriage(INLINE_FLAG_ARGS);
  assert.strictEqual(report.flagged.length, 2, "the inline forms carry the same values as the separated ones");
});

// `parseInt` would stop at the first non-digit and silently accept the leading run, so `2junk` would
// truncate the list to 2 rather than warning. A count is only trustworthy if the flag that set it was.
test("a --top carrying trailing garbage falls back to the default", () => {
  const { report } = runTriage(TOP_GARBAGE_ARGS);
  assert.strictEqual(report.flagged.length, 5, "the default --top 10 covers all five flagged sessions");
});

test("a --top that is not a plain integer warns and uses the default", () => {
  const { stderr } = runTriage(TOP_GARBAGE_ARGS);
  assertIncludes(stderr, "--top must be a positive integer", "the rejected value is reported on stderr");
});

test("a --since after every mtime scans nothing", () => {
  const { report } = runTriage(EMPTY_WINDOW_ARGS);
  assert.strictEqual(report.scanned, 0, "every fixture mtime falls before 2026-03-16");
});

test("nothing is flagged when nothing is scanned", () => {
  const { report } = runTriage(EMPTY_WINDOW_ARGS);
  assert.strictEqual(report.flagged.length, 0, "an empty window flags nothing");
});

test("a missing --since yields an empty report", () => {
  const { report } = runTriage(NO_SINCE_ARGS);
  assert.strictEqual(report.flagged.length, 0, "no window means no walk, so nothing is flagged");
});

test("a missing --since warns on stderr and still exits 0", () => {
  const { stderr } = runTriage(NO_SINCE_ARGS);
  assertIncludes(stderr, "--since must be YYYY-MM-DD", "the missing window is reported on stderr");
});

// Without a window nothing is walked, and the payload is otherwise byte-identical to a window that
// was walked in full and found clean. The caller gates its since-marker on `unreadable`, so leaving
// the two indistinguishable would advance the marker over transcripts nothing ever read.
test("a directory left unwalked by a missing --since is counted as unread", () => {
  const { report } = runTriage(NO_SINCE_ARGS);
  assert.strictEqual(report.unreadable, 1, "the unwalked directory counts as unread");
});

test("unreadableDirs names the directory the missing window skipped", () => {
  const { report } = runTriage(NO_SINCE_ARGS);
  assert.deepStrictEqual(report.unreadableDirs, [CLAUDE_CORPUS], "the skipped directory is named, not only counted");
});

test("an unparsable --since scans nothing", () => {
  const { report } = runTriage(UNPARSABLE_SINCE_ARGS);
  assert.strictEqual(report.scanned, 0, "a value that fails to parse leaves no window to walk");
});

test("a directory left unwalked by an unparsable --since is counted as unread", () => {
  const { report } = runTriage(UNPARSABLE_SINCE_ARGS);
  assert.strictEqual(report.unreadable, 1, "the unwalked directory counts as unread");
});

test("an unparsable --since is reported in the contract, not only on stderr", () => {
  const { report, stderr } = runTriage(UNPARSABLE_SINCE_ARGS);
  assert.deepStrictEqual(report.unreadableDirs, [CLAUDE_CORPUS], "the JSON names the directory that went unwalked");
  assertIncludes(stderr, "--since must be YYYY-MM-DD", "stderr carries the warning as well");
});

// A `--since` given no date would otherwise consume the session directory as its value, emptying
// `dirs` — so the guard above would have nothing left to report and the run would read as a clean
// walk. A value is taken only when it has the shape of a date.
test("a --since missing its date scans nothing", () => {
  const { report } = runTriage(DATELESS_SINCE_ARGS);
  assert.strictEqual(report.scanned, 0, "there is still no window to walk");
});

test("the directory a dateless --since would have swallowed is still counted", () => {
  const { report } = runTriage(DATELESS_SINCE_ARGS);
  assert.strictEqual(report.unreadable, 1, "the directory survived the flag and is reported unread");
});

test("the unconsumed argument is read as the session directory it is", () => {
  const { report } = runTriage(DATELESS_SINCE_ARGS);
  assertEndsWith(report.unreadableDirs[0], "claude", "the argument reached the positional branch");
});

test("a flag value is consumed only when it has the shape the flag wants", () => {
  const { stderr } = runTriage(DATELESS_SINCE_ARGS);
  assertIncludes(
    stderr,
    `--since must be YYYY-MM-DD (got ${JSON.stringify(CLAUDE_CORPUS)})`,
    "the directory is reported as the rejected value rather than consumed as one",
  );
});

// Three identical genuine failures are a retry loop; three outputs that merely quote the phrase
// mid-line — a grep hit over Codex's own sources, a diff of the classifier itself — are not. The
// corpus is kept out of the main run so its counts stay independent of these two files.
test("both retry-corpus transcripts are scanned", () => {
  const { report } = runTriage(RETRY_ARGS);
  assert.strictEqual(report.scanned, 2, "both transcripts fall inside the window");
});

test("only the genuine retry loop is flagged", () => {
  const { report } = runTriage(RETRY_ARGS);
  assert.strictEqual(report.flagged.length, 1, "one of the two transcripts carries a signal");
});

test("three identical line-anchored failures of one tool are a retry loop", () => {
  const { report } = runTriage(RETRY_ARGS);
  assertEndsWith(report.flagged[0].path, "anchored-retry-loop.jsonl", "the flagged transcript is the anchored one");
});

test("the retry loop is classified as such", () => {
  const { report } = runTriage(RETRY_ARGS);
  assert.strictEqual(report.flagged[0].classes["retry-loop"], 1, "the run of three failures bumps retry-loop once");
});

test("a failure phrase quoted mid-line is not a failure", () => {
  const { report } = runTriage(RETRY_ARGS);
  assert.ok(!isFlagged(report, "quoted-failure.jsonl"), "quoted output carries no signal");
});

test("the Codex failure markers are line-anchored, so quoted output does not read as a retry loop", () => {
  const { report } = runTriage(RETRY_ARGS);
  assert.strictEqual(report.skippedUnrecognized, 0, "the quoted transcript sniffed as a Codex session");
  assert.strictEqual(report.remainder, 0, "it was classified and left unflagged, not truncated away");
});

test("a missing directory scans nothing", () => {
  const { report } = runTriage(ABSENT_ARGS);
  assert.strictEqual(report.scanned, 0, "there is nothing behind the path to walk");
});

// ENOENT is an uninstalled host, not an unread one: counting it would pin the caller's since-marker
// forever on any machine running only one of the two agents.
test("a missing directory is not counted as unread", () => {
  const { report } = runTriage(ABSENT_ARGS);
  assert.strictEqual(report.unreadable, 0, "an absent corpus is not work that went undone");
});

test("a missing directory warns and does not abort the run", () => {
  const { stderr } = runTriage(ABSENT_ARGS);
  assertIncludes(stderr, "unreadable dir", "the absent directory is reported on stderr");
});

// A directory the run could not list hides a whole subtree. The caller gates its marker advance on
// `unreadable`, so a readdir failure that never reaches the contract loses those transcripts for good.
test("a directory that cannot be listed counts as unread", (t: TestContext) => {
  if (isReadable(LOCKED_INNER)) {
    t.skip("the unlistable-directory case needs a user that chmod 000 actually stops");
    return;
  }
  const { report } = runTriage(LOCKED_DIR_ARGS);
  assert.strictEqual(report.unreadable, 1, "the unlistable directory counts as unread");
});

test("unreadableDirs names it by path", (t: TestContext) => {
  if (isReadable(LOCKED_INNER)) {
    t.skip("the unlistable-directory case needs a user that chmod 000 actually stops");
    return;
  }
  const { report } = runTriage(LOCKED_DIR_ARGS);
  assertEndsWith(report.unreadableDirs[0], "inner", "the unlistable directory is named, not only counted");
});

test("an unlistable directory reaches the contract, not only stderr", (t: TestContext) => {
  if (isReadable(LOCKED_INNER)) {
    t.skip("the unlistable-directory case needs a user that chmod 000 actually stops");
    return;
  }
  const { report, stderr } = runTriage(LOCKED_DIR_ARGS);
  assertIncludes(stderr, "unreadable dir", "stderr carries the warning as well");
  assert.strictEqual(report.scanned, 0, "the subtree behind the failed listing was never reached");
});

// A transcript the run could not read must be named, not silently dropped: the caller advances its
// since-marker past this window, so an unread file would otherwise never be looked at again.
test("a transcript that cannot be read is counted", (t: TestContext) => {
  if (isReadable(LOCKED_FILE)) {
    t.skip("the unreadable-file case needs a user that chmod 000 actually stops");
    return;
  }
  const { report } = runTriage(LOCKED_FILE_ARGS);
  assert.strictEqual(report.unreadable, 1, "the unreadable transcript counts as unread");
});

test("unreadablePaths names it by path", (t: TestContext) => {
  if (isReadable(LOCKED_FILE)) {
    t.skip("the unreadable-file case needs a user that chmod 000 actually stops");
    return;
  }
  const { report } = runTriage(LOCKED_FILE_ARGS);
  assertEndsWith(report.unreadablePaths[0], "locked.jsonl", "the unreadable transcript is named, not only counted");
});

test("an unreadable transcript still counts as scanned", (t: TestContext) => {
  if (isReadable(LOCKED_FILE)) {
    t.skip("the unreadable-file case needs a user that chmod 000 actually stops");
    return;
  }
  const { report } = runTriage(LOCKED_FILE_ARGS);
  assert.strictEqual(report.scanned, 1, "the walk reached it, so the window covered it");
});

test("an unreadable transcript is not flagged", (t: TestContext) => {
  if (isReadable(LOCKED_FILE)) {
    t.skip("the unreadable-file case needs a user that chmod 000 actually stops");
    return;
  }
  const { report } = runTriage(LOCKED_FILE_ARGS);
  assert.strictEqual(report.flagged.length, 0, "nothing was classified out of a file that never opened");
});

test("an unreadable transcript is reported in the contract, not only on stderr", (t: TestContext) => {
  if (isReadable(LOCKED_FILE)) {
    t.skip("the unreadable-file case needs a user that chmod 000 actually stops");
    return;
  }
  const { stderr } = runTriage(LOCKED_FILE_ARGS);
  assertIncludes(stderr, "unreadable file", "stderr carries the warning as well");
});

// Every case above reads stdout through spawnSync's own drained pipe or a file, so none of them can
// see a report truncated at the pipe buffer.
test("a report over 64 KB parses when read through a pipe, not only from a file", () => {
  const target = openSync(VOLUME_REPORT, "w");
  try {
    const redirected = spawnSync(process.execPath, [SCRIPT, ...VOLUME_ARGS], {
      stdio: ["ignore", target, "ignore"],
    });
    assert.strictEqual(redirected.status, 0, "the file-redirected volume run must exit 0");
  } finally {
    closeSync(target);
  }
  const fileBytes = statSync(VOLUME_REPORT).size;
  assert.ok(
    fileBytes > PIPE_BUFFER_BYTES,
    `the volume fixture must exceed the 64 KB pipe buffer to be a real test (got ${fileBytes})`,
  );

  const piped = spawnSync(process.execPath, [SCRIPT, ...VOLUME_ARGS], {
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: MAX_BUFFER_BYTES,
  });
  assert.strictEqual(piped.status, 0, "the piped volume run must exit 0");
  assert.strictEqual(piped.stdout.length, fileBytes, "piped report size must match the file-redirected size");
  const report: Report = JSON.parse(piped.stdout.toString("utf8"));
  assert.strictEqual(
    report.remainderPaths.length,
    VOLUME_SESSIONS - 1,
    "a report larger than the pipe buffer must survive the pipe intact",
  );
});

test("an early-closing reader does not turn into a non-zero exit", async () => {
  const reader = spawn("head", ["-c", String(EARLY_READER_BYTES)], { stdio: ["pipe", "ignore", "ignore"] });
  assert.ok(reader.stdin, "the early-closing reader must expose a piped stdin");
  // The reader's read end is the subject's only one, and it closes while a report this far over the
  // pipe buffer still has bytes to write — point this at a corpus the reader can drain and the
  // subject finishes before any EPIPE, leaving the always-zero exit contract unexercised.
  const subject = spawn(process.execPath, [SCRIPT, ...VOLUME_ARGS], {
    stdio: ["ignore", reader.stdin, "ignore"],
  });
  const [code, signal] = await once(subject, "exit");
  reader.stdin.destroy();
  assert.deepStrictEqual(
    [code, signal],
    [0, null],
    "a reader that closes the pipe early must leave the exit status at 0",
  );
});
