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
const MEMORY_SESSIONS = 160;
const MEMORY_MESSAGE_BYTES = 256 * 1024;
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
  readonly paths: readonly string[];
  readonly candidates: Readonly<Record<string, number>>;
  readonly evidence: readonly {
    readonly kind: string;
    readonly path: string;
    readonly line: number;
    readonly timestamp: string | null;
    readonly timeBasis: string;
    readonly callId?: string;
    readonly messageId?: string;
  }[];
}

interface ProjectSessions {
  readonly project: string | null;
  readonly count: number;
}

interface Report {
  readonly flagged: readonly FlaggedSession[];
  readonly remainder: number;
  readonly remainderPaths: readonly string[];
  readonly scanned: number;
  readonly sessions: readonly ProjectSessions[];
  readonly skippedUnknownRecords: number;
  readonly skippedUnrecognized: number;
  readonly skippedUnrecognizedPaths: readonly string[];
  readonly unreadable: number;
  readonly unreadableDirs: readonly string[];
  readonly unreadablePaths: readonly string[];
  readonly conversations: number;
  readonly sampled: readonly FlaggedSession[];
  readonly sampleOmitted: number;
  readonly telemetryRecords: number;
  readonly diagnostics: readonly { readonly kind: string; readonly path: string; readonly line: number }[];
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

function scenario(name: string, files: Readonly<Record<string, readonly unknown[]>>): string {
  const root = join(TEST_ROOT, name);
  for (const [name, records] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, records.map((record) => typeof record === "string" ? record : JSON.stringify(record)).join("\n") + "\n");
  }
  return root;
}

function codex(type: string, payload: object, timestamp = "2026-03-14T09:00:00.000Z"): object {
  return { timestamp, type, payload };
}

before(() => {
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
      "conversations",
      "diagnostics",
      "flagged",
      "remainder",
      "remainderPaths",
      "sampleOmitted",
      "sampled",
      "scanned",
      "sessions",
      "skippedUnknownRecords",
      "skippedUnrecognized",
      "skippedUnrecognizedPaths",
      "telemetryRecords",
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

test("the sessions array counts the scanned transcripts of each project", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.deepStrictEqual(
    report.sessions,
    [
      { project: null, count: 4 },
      { project: "/fixture", count: 2 },
      { project: "/fixture/claude-project", count: 1 },
    ],
    "both Codex transcripts carry /fixture, one Claude transcript carries its own cwd, and the rest — the cwd-less Claude transcripts and the unsniffable file — fall to null",
  );
});

test("the session counts sum to scanned", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.strictEqual(
    report.sessions.reduce((total, entry) => total + entry.count, 0),
    report.scanned,
    "every scanned transcript lands in exactly one project bucket, scored or not",
  );
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

test("selection recency ignores evidence below its classification threshold", () => {
  const root = scenario("retained-recency", {
    "a.jsonl": [
      codex("session_meta", { id: "recency-a" }),
      codex("response_item", { type: "function_call_output", call_id: "invalid-a", output: "InputValidationError: synthetic argument" }, "2026-03-11T09:00:00.000Z"),
      codex("event_msg", { type: "turn_aborted", turn_id: "abort-a" }, "2026-03-15T09:00:00.000Z"),
    ],
    "b.jsonl": [
      codex("session_meta", { id: "recency-b" }),
      codex("response_item", { type: "function_call_output", call_id: "invalid-b", output: "InputValidationError: synthetic argument" }, "2026-03-13T09:00:00.000Z"),
    ],
  });
  const top = runTriage(["--since", "2026-03-10", "--top", "1", root]).report;
  assertEndsWith(top.flagged[0].path, "b.jsonl", "the newer retained failure ranks first");
  assert.deepStrictEqual(top.remainderPaths, [join(root, "a.jsonl")]);
  const full = runTriage(["--since", "2026-03-10", root]).report;
  const older = full.flagged.find(({ path }) => path.endsWith("a.jsonl"));
  assert.deepStrictEqual(older?.classes, { "input-validation": 1 });
  assert.deepStrictEqual(older?.evidence.map(({ kind, timestamp }) => ({ kind, timestamp })), [
    { kind: "input-validation", timestamp: "2026-03-11T09:00:00.000Z" },
  ]);
});

test("qualifying abort evidence still contributes selection recency", () => {
  const root = scenario("qualifying-recency", {
    "a.jsonl": [
      codex("session_meta", { id: "qualifying-a" }),
      codex("response_item", { type: "function_call_output", output: "InputValidationError: synthetic argument" }, "2026-03-11T09:00:00.000Z"),
      codex("event_msg", { type: "turn_aborted", turn_id: "abort-a1" }, "2026-03-14T09:00:00.000Z"),
      codex("event_msg", { type: "turn_aborted", turn_id: "abort-a2" }, "2026-03-15T09:00:00.000Z"),
    ],
    "b.jsonl": [
      codex("session_meta", { id: "qualifying-b" }),
      codex("response_item", { type: "function_call_output", output: "InputValidationError: synthetic argument" }, "2026-03-13T09:00:00.000Z"),
      codex("event_msg", { type: "error" }, "2026-03-14T12:00:00.000Z"),
    ],
  });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.deepStrictEqual(report.flagged.map(({ score }) => score), [2, 2]);
  assertEndsWith(report.flagged[0].path, "a.jsonl", "the qualifying aborts retain their latest timestamp");
  assert.deepStrictEqual(report.flagged[0].classes, { "input-validation": 1, "user-abort": 2 });
  assert.strictEqual(report.flagged[0].evidence.at(-1)?.timestamp, "2026-03-15T09:00:00.000Z");
});

test("undated retained evidence uses its file modification time for selection recency", () => {
  const root = scenario("undated-recency", {
    "a.jsonl": [codex("session_meta", { id: "undated-recency-a" }), { type: "response_item", payload: { type: "function_call_output", output: "InputValidationError: synthetic argument" } }],
    "b.jsonl": [codex("session_meta", { id: "undated-recency-b" }), codex("response_item", { type: "function_call_output", output: "InputValidationError: synthetic argument" }, "2026-03-13T09:00:00.000Z")],
  });
  for (const [name, timestamp] of [["a.jsonl", "2026-03-15T09:00:00.000Z"], ["b.jsonl", "2026-03-16T09:00:00.000Z"]]) {
    const when = new Date(timestamp);
    utimesSync(join(root, name), when, when);
  }
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assertEndsWith(report.flagged[0].path, "a.jsonl", "undated evidence uses mtime while dated evidence uses record time");
  assert.strictEqual(report.flagged[0].evidence[0].timestamp, null);
  assert.strictEqual(report.flagged[0].evidence[0].timeBasis, "file-mtime");
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

test("Codex rejected patch and corresponding output count one rejected operation", () => {
  const { report } = runTriage(MAIN_ARGS);
  assert.deepStrictEqual(
    report.flagged[3].classes,
    { "policy-block": 1 },
    "the patch event and tool output describe the same call",
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

test("a missing directory is not counted as unread", () => {
  const { report } = runTriage(ABSENT_ARGS);
  assert.strictEqual(report.unreadable, 0, "an absent corpus is not work that went undone");
});

test("a missing directory warns and does not abort the run", () => {
  const { stderr } = runTriage(ABSENT_ARGS);
  assertIncludes(stderr, "unreadable dir", "the absent directory is reported on stderr");
});

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

test("an unreadable transcript counts against the null project", (t: TestContext) => {
  if (isReadable(LOCKED_FILE)) {
    t.skip("the unreadable-file case needs a user that chmod 000 actually stops");
    return;
  }
  const { report } = runTriage(LOCKED_FILE_ARGS);
  assert.deepStrictEqual(
    report.sessions,
    [{ project: null, count: 1 }],
    "a file that never opened still occupies its place in the window",
  );
});

test("an unreadable transcript is reported in the contract, not only on stderr", (t: TestContext) => {
  if (isReadable(LOCKED_FILE)) {
    t.skip("the unreadable-file case needs a user that chmod 000 actually stops");
    return;
  }
  const { stderr } = runTriage(LOCKED_FILE_ARGS);
  assertIncludes(stderr, "unreadable file", "stderr carries the warning as well");
});

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

for (const grouped of [false, true]) test(`large message bodies fit an artificial 32 MiB heap cap across ${grouped ? "one conversation" : "independent conversations"}`, () => {
  const name = grouped ? "memory-grouped" : "memory-independent";
  const padding = "x".repeat(MEMORY_MESSAGE_BYTES);
  const root = join(TEST_ROOT, name);
  for (let index = 0; index < MEMORY_SESSIONS; index++) {
    scenario(name, { [`session-${index}.jsonl`]: [
      codex("session_meta", { id: grouped ? "memory-shared" : `memory-${index}`, cwd: "/fixture/memory" }),
      codex("event_msg", { type: "user_message", message: `Synthetic memory request ${index}. ${padding}` }),
    ] });
  }
  const run = spawnSync("sh", [
    "-c", 'ulimit -c 0\nexec "$@"', "session-triage-memory",
    process.execPath, "--max-old-space-size=32", SCRIPT, "--since", "2026-03-10", root,
  ], { cwd: root, encoding: "utf8", maxBuffer: MAX_BUFFER_BYTES, timeout: 30000 });
  assert.strictEqual(run.status, 0, `the artificial heap cap must permit this bounded corpus (${run.signal})\n${run.stderr}`);
  const report: Report = JSON.parse(run.stdout);
  assert.strictEqual(report.scanned, MEMORY_SESSIONS);
  assert.strictEqual(report.conversations, grouped ? 1 : MEMORY_SESSIONS);
  assert.deepStrictEqual(report.flagged, []);
  assert.strictEqual(report.sampled.length, grouped ? 1 : 3);
  assert.strictEqual(report.sampleOmitted, grouped ? 0 : MEMORY_SESSIONS - 3);
});

test("compact user comparisons preserve exact pairing and normalized request thresholds", () => {
  const root = scenario("compact-user-comparisons", {
    "normalized.jsonl": [
      codex("session_meta", { id: "compact-normalized" }),
      codex("event_msg", { type: "user_message", message: "Continue with the synthetic task." }),
      codex("response_item", { type: "message", role: "user", content: [{ type: "input_text", text: " CONTINUE   with the synthetic task. " }] }),
    ],
    "short.jsonl": [
      codex("session_meta", { id: "compact-short" }),
      codex("event_msg", { type: "user_message", message: "Go" }),
      codex("event_msg", { type: "user_message", message: "Go" }),
    ],
  });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.strictEqual(report.flagged.length, 1);
  assert.deepStrictEqual(report.flagged[0].candidates, { "repeated-request": 1, "user-intervention": 2 });
  assert.deepStrictEqual(report.flagged[0].evidence.map(({ line }) => line), [2, 3, 3]);
  assert.strictEqual(report.sampled.length, 1);
  assertEndsWith(report.sampled[0].path, "short.jsonl", "short requests remain below the repeated-request threshold");
});

test("direct rejection blocks retain source lines and one operation is counted once", () => {
  const rejection = "This action was rejected due to unacceptable risk.\nReason: synthetic prohibited operation.";
  const root = scenario("rejection-provenance", {
    "direct.jsonl": [
      codex("session_meta", { id: "direct" }),
      codex("response_item", { type: "function_call", call_id: "blocked", name: "apply_patch" }),
      codex("event_msg", { type: "patch_apply_end", call_id: "blocked", success: false, stderr: rejection }),
      codex("response_item", { type: "custom_tool_call_output", call_id: "blocked", output: [{ type: "input_text", text: rejection }] }),
    ],
  });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.deepStrictEqual(report.flagged[0].classes, { "policy-block": 1 });
  assert.deepStrictEqual(report.flagged[0].evidence.map(({ line, callId, timestamp }) => ({ line, callId, timestamp })), [
    { line: 3, callId: "blocked", timestamp: "2026-03-14T09:00:00.000Z" },
    { line: 4, callId: "blocked", timestamp: "2026-03-14T09:00:00.000Z" },
  ]);
});

test("successful reads quoting rejection or validation text do not assert fresh failures", () => {
  const quote = "This action was rejected due to unacceptable risk.\nReason: old output.\nInputValidationError: old output";
  const root = scenario("successful-quotes", {
    "read.jsonl": [
      codex("session_meta", { id: "read" }),
      codex("response_item", { type: "function_call_output", call_id: "read1", output: [{ type: "input_text", text: JSON.stringify({ exit_code: 0, output: quote }) }] }),
      codex("response_item", { type: "function_call_output", call_id: "read2", output: "Process exited with code 0\nOutput:\n" + quote }),
      codex("response_item", { type: "function_call_output", call_id: "read3", output: "source.ts:12:InputValidationError: quoted; rejected due to unacceptable risk" }),
    ],
  });
  assert.deepStrictEqual(runTriage(["--since", "2026-03-10", root]).report.flagged, []);
});

test("outer failure statuses survive quoted success text and JSON", () => {
  const failure = "AssertionError: expected output to contain:";
  const success = "Process exited with code 0";
  const outputs: Record<string, unknown> = {
    control: `Process exited with code 1\nOutput:\n${failure}`,
    quoted: `Process exited with code 1\nOutput:\n${failure}\n${success}`,
    alias: `Exit code: 1\nOutput:\n${failure}\nExit code: 0`,
    multipart: [
      { type: "input_text", text: "Wall time: 0.01 seconds\nProcess exited with code 1\nOutput:" },
      { type: "input_text", text: `${failure}\n${success}` },
    ],
    json: `Process exited with code 1\nOutput:\n${JSON.stringify({ exit_code: 0, output: failure })}`,
    "multipart-json": [
      { type: "input_text", text: "Wall time: 0.01 seconds\nProcess exited with code 1\nOutput:" },
      { type: "input_text", text: JSON.stringify({ exit_code: 0, output: failure }) },
    ],
    structured: { exit_code: 1, output: `${failure}\n${success}` },
    "structured-json": JSON.stringify({ exitCode: 1, output: `${failure}\n${success}` }),
    "transport-json": [
      { type: "input_text", text: "Wall time: 0.01 seconds\nOutput:" },
      { type: "input_text", text: JSON.stringify({ exit_code: 1, output: `${failure}\n${success}` }) },
    ],
  };
  const files = Object.fromEntries(Object.entries(outputs).map(([name, output]) => [`${name}.jsonl`, [
    codex("session_meta", { id: `outer-status-${name}` }),
    ...[1, 2, 3].flatMap((index) => [
      codex("response_item", { type: "function_call", call_id: `${name}-${index}`, name: "exec_command" }),
      codex("response_item", { type: "function_call_output", call_id: `${name}-${index}`, output }),
    ]),
  ]]));
  const root = scenario("outer-failure-status", files);
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.deepStrictEqual(
    Object.fromEntries(report.flagged.map(({ path, classes }) => [path.split("/").at(-1), classes])),
    Object.fromEntries(Object.keys(outputs).map((name) => [`${name}.jsonl`, { "retry-loop": 1 }])),
  );
});

test("outer success statuses protect outputs quoting old process failures", () => {
  const failure = "Process exited with code 1\nOutput:\nAssertionError: synthetic old failure";
  const outputs: readonly unknown[] = [
    `Process exited with code 0\nOutput:\n${failure}`,
    `Exit code: 0\nOutput:\n${failure}`,
    { exit_code: 0, output: failure },
    JSON.stringify({ exitCode: 0, output: failure }),
    [
      { type: "input_text", text: "Wall time: 0.01 seconds\nProcess exited with code 0\nOutput:" },
      { type: "input_text", text: failure },
    ],
  ];
  const root = scenario("outer-success-status", Object.fromEntries(outputs.map((output, index) => [`${index}.jsonl`, [
    codex("session_meta", { id: `outer-success-${index}` }),
    ...[1, 2, 3].map((call) => codex("response_item", { type: "function_call_output", call_id: `success-${call}`, output })),
  ]])));
  assert.deepStrictEqual(runTriage(["--since", "2026-03-10", root]).report.flagged, []);
});

test("event dates exclude old incidents in recently modified files and preserve boundary call context", () => {
  const root = scenario("event-window", {
    "old.jsonl": [
      codex("session_meta", { id: "old" }),
      codex("event_msg", { type: "error" }, "2026-03-01T09:00:00.000Z"),
      codex("event_msg", { type: "turn_aborted" }, "2026-03-01T09:00:01.000Z"),
      codex("event_msg", { type: "turn_aborted" }, "2026-03-01T09:00:02.000Z"),
    ],
    "boundary.jsonl": [
      codex("session_meta", { id: "boundary" }),
      codex("response_item", { type: "function_call", call_id: "boundary-call", name: "exec_command" }, "2026-03-09T23:00:00.000Z"),
      codex("response_item", { type: "function_call_output", call_id: "boundary-call", output: "InputValidationError: synthetic invalid argument" }),
    ],
  });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.strictEqual(report.flagged.length, 1);
  assertEndsWith(report.flagged[0].path, "boundary.jsonl", "only the in-window incident is selected");
  assert.strictEqual(report.flagged[0].evidence[0].callId, "boundary-call");
});

for (const host of ["claude", "codex"] as const) {
  const sessionId = `request-window-${host}`;
  const meta = host === "codex" ? [codex("session_meta", { id: sessionId })] : [];
  const sinceMs = new Date(2026, 2, 10).getTime();
  const atBoundary = (offsetMs: number) => new Date(sinceMs + offsetMs).toISOString();
  const userRecord = (messageId: string, timestamp: string, text: string) => host === "claude"
    ? { type: "user", sessionId, uuid: messageId, timestamp, message: { content: text } }
    : codex("event_msg", { type: "user_message", message_id: messageId, message: text }, timestamp);

  test(`${host} repeated requests compare the immediately preceding unique request before --since`, () => {
    const text = "Build this synthetic fixture.";
    const root = scenario(`request-window-boundary-${host}`, {
      "a-current.jsonl": [...meta, userRecord("current", atBoundary(0), text)],
      "b-history.jsonl": [
        ...meta,
        userRecord("history-1", atBoundary(-3), "Continue with the historical task."),
        userRecord("history-2", atBoundary(-2), "Continue with the historical task."),
        userRecord("previous", atBoundary(-1), text),
      ],
    });
    const { report } = runTriage(["--since", "2026-03-10", root]);
    assert.strictEqual(report.scanned, 2);
    assert.strictEqual(report.conversations, 1);
    assert.strictEqual(report.flagged.length, 1);
    assert.deepStrictEqual(report.flagged[0].candidates, { "repeated-request": 1 });
    assert.deepStrictEqual(report.flagged[0].evidence, [{
      kind: "repeated-request", path: join(root, "a-current.jsonl"), line: meta.length + 1,
      timestamp: atBoundary(0), timeBasis: "record", messageId: "current",
    }]);
    assert.deepStrictEqual(report.sampled, []);
  });

  test(`${host} historical parent requests emit no candidates or sampling activity after --since`, () => {
    const text = "Continue with the historical task.";
    const root = scenario(`request-window-history-only-${host}`, {
      "old-only.jsonl": [
        ...meta,
        userRecord("history-1", atBoundary(-2), text),
        userRecord("history-2", atBoundary(-1), text),
      ],
    });
    const { report } = runTriage(["--since", "2026-03-10", root]);
    assert.strictEqual(report.scanned, 1);
    assert.strictEqual(report.conversations, 1);
    assert.deepStrictEqual(report.flagged, []);
    assert.deepStrictEqual(report.sampled, []);
    assert.strictEqual(report.sampleOmitted, 0);
  });
}

test("telemetry, malformed, unknown and uncertain timestamps have distinct diagnostics", () => {
  const root = scenario("diagnostics", {
    "uncertain.jsonl": [
      codex("session_meta", { id: "uncertain" }),
      { type: "token_usage_record", token_count: 12 },
      { type: "event_msg", payload: { type: "error" } },
      codex("event_msg", { type: "stream_error" }, "invalid-date"),
      { type: "future_record" },
      null,
      "{broken",
    ],
    "claude.jsonl": [{ type: "user", timestamp: "2026-03-14T09:00:00.000Z", message: { content: "Hello." } }, { type: "api-request-blob" }],
    "malformed.jsonl": ["{broken too"],
  });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.strictEqual(report.telemetryRecords, 2);
  assert.strictEqual(report.skippedUnknownRecords, 4);
  assert.deepStrictEqual(report.diagnostics.filter((entry) => entry.path.endsWith("uncertain.jsonl")).map((entry) => [entry.kind, entry.line]), [
    ["undated", 3], ["invalid-timestamp", 4], ["unknown", 5], ["malformed", 6], ["malformed", 7],
  ]);
  assert.deepStrictEqual(report.flagged[0].evidence.map((entry) => entry.timeBasis), ["file-mtime", "file-mtime"]);
});

test("explicit Codex thread relationships group paths without copied history or inherited IDs multiplying signals", () => {
  const rejection = "This action was rejected due to unacceptable risk.\nReason: synthetic prohibited operation.";
  const root = scenario("codex-family", {
    "parent.jsonl": [
      codex("session_meta", { id: "parent", cwd: "/fixture" }, "2026-03-14T08:00:00.000Z"),
      codex("event_msg", { type: "user_message", message: "No ticket", id: "user1" }, "2026-03-14T08:01:00.000Z"),
      codex("response_item", { type: "function_call_output", call_id: "parent-call", output: rejection }, "2026-03-14T08:02:00.000Z"),
    ],
    "child.jsonl": [
      codex("session_meta", { id: "child", session_id: "parent", source: { subagent: { thread_spawn: { parent_thread_id: "parent" } } } }, "2026-03-14T09:00:00.000Z"),
      codex("session_meta", { id: "parent" }, "2026-03-14T08:00:00.000Z"),
      codex("event_msg", { type: "user_message", message: "No ticket", id: "user1" }, "2026-03-14T08:01:00.000Z"),
      codex("response_item", { type: "function_call_output", call_id: "parent-call", output: rejection }, "2026-03-14T08:02:00.000Z"),
      codex("event_msg", { type: "user_message", message: "Continue with the delegated task." }),
      codex("response_item", { type: "function_call_output", call_id: "child-call", output: rejection }),
    ],
    "grandchild.jsonl": [codex("session_meta", { id: "grandchild", parent_thread_id: "child" }), codex("event_msg", { type: "error", id: "child-error" })],
    "unknown-a.jsonl": [codex("session_meta", { session_id: "parent" })],
    "unknown-b.jsonl": [codex("session_meta", { session_id: "parent" })],
  });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.strictEqual(report.scanned, 5);
  assert.strictEqual(report.conversations, 3);
  assert.strictEqual(report.flagged.length, 1);
  assert.strictEqual(report.flagged[0].paths.length, 3);
  assert.deepStrictEqual(report.flagged[0].classes, { "api-error": 1, "policy-block": 2 });
  assert.deepStrictEqual(report.flagged[0].candidates, { "user-intervention": 1 });
  assert.strictEqual(report.sampled.length, 0);
  assert.strictEqual(report.diagnostics.filter((entry) => entry.kind === "identity-uncertain").length, 2);
  const truncated = runTriage(["--since", "2026-03-10", "--top", "1", root]).report;
  assert.strictEqual(truncated.remainder, 0);
});

test("Claude sidechains group by explicit agent identity and directory relationships", () => {
  const user = { type: "user", sessionId: "claude-root", uuid: "same-user", timestamp: "2026-03-14T08:00:00.000Z", message: { content: "Any open questions?" } };
  const root = scenario("claude-family", {
    "claude-root.jsonl": [user],
    "claude-root/subagents/agent-a.jsonl": [{ ...user, isSidechain: true, agentId: "a" }, { type: "system", isSidechain: true, sessionId: "claude-root", agentId: "a", timestamp: "2026-03-14T09:00:00.000Z", preventedContinuation: true }],
    "claude-root/subagents/agent-b.jsonl": [{ type: "user", timestamp: "2026-03-14T09:00:00.000Z", message: { content: "Continue." } }],
  });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.strictEqual(report.conversations, 1);
  assert.strictEqual(report.flagged[0].paths.length, 3);
  assert.deepStrictEqual(report.flagged[0].candidates, { "user-intervention": 1 });
  assert.deepStrictEqual(report.flagged[0].classes, { "policy-block": 1 });
});

test("copied user prefixes preserve conversation repeats across both file orders", () => {
  const first = { type: "user", sessionId: "ordered-users", uuid: "user-1", timestamp: "2026-03-14T09:00:00.000Z", message: { content: "Build this synthetic fixture." } };
  const second = { ...first, uuid: "user-2", timestamp: "2026-03-14T09:05:00.000Z" };
  for (const reversed of [false, true]) {
    const root = scenario(`copied-user-order-${reversed}`, {
      "a.jsonl": reversed ? [first, second] : [first],
      "b.jsonl": reversed ? [first] : [first, second],
    });
    const { report } = runTriage(["--since", "2026-03-10", root]);
    assert.strictEqual(report.conversations, 1);
    assert.strictEqual(report.flagged.length, 1);
    assert.deepStrictEqual(report.flagged[0].candidates, { "repeated-request": 1 });
    assert.deepStrictEqual(report.flagged[0].evidence.map(({ path, line, messageId }) => ({ path, line, messageId })), [
      { path: join(root, reversed ? "a.jsonl" : "b.jsonl"), line: 2, messageId: "user-2" },
    ]);
  }
});

test("conversation repeats follow chronological users rather than concatenated files", () => {
  const first = { type: "user", sessionId: "interleaved-users", uuid: "user-1", timestamp: "2026-03-14T09:00:00.000Z", message: { content: "Build this synthetic fixture." } };
  const root = scenario("interleaved-user-order", {
    "a.jsonl": [first, { ...first, uuid: "user-3", timestamp: "2026-03-14T09:10:00.000Z" }],
    "b.jsonl": [{ ...first, uuid: "user-2", timestamp: "2026-03-14T09:05:00.000Z", message: { content: "Inspect the other synthetic fixture." } }],
  });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.strictEqual(report.conversations, 1);
  assert.deepStrictEqual(report.flagged, []);
  assert.strictEqual(report.sampled.length, 1);
});

test("undated conversation users have deterministic file-time and physical fallbacks", () => {
  const first = { type: "user", sessionId: "undated-users", uuid: "user-1", message: { content: "Build this synthetic fixture." } };
  const root = scenario("undated-user-order", {
    "a.jsonl": [first],
    "b.jsonl": [first, { ...first, uuid: "user-2" }],
  });
  const when = new Date("2026-03-14T09:00:00.000Z");
  for (const name of ["a.jsonl", "b.jsonl"]) utimesSync(join(root, name), when, when);
  const args = ["--since", "2026-03-10", root];
  const { report } = runTriage(args);
  assert.strictEqual(report.conversations, 1);
  assert.deepStrictEqual(report.flagged[0]?.candidates, { "repeated-request": 1 });
  assert.deepStrictEqual(report.flagged[0].evidence.map(({ path, line, timeBasis, timestamp }) => ({ path, line, timeBasis, timestamp })), [
    { path: join(root, "b.jsonl"), line: 2, timeBasis: "file-mtime", timestamp: null },
  ]);
  assert.deepStrictEqual(report, runTriage(args).report);
});

test("real user interventions and repeated requests are candidates without treating injections or duplicate representations as users", () => {
  const root = scenario("conversation-candidates", {
    "user.jsonl": [
      codex("session_meta", { id: "users" }),
      codex("response_item", { type: "message", role: "user", content: [{ type: "input_text", text: "No ticket" }] }),
      codex("event_msg", { type: "user_message", message: "No ticket" }),
      codex("event_msg", { type: "user_message", message: "Build the synthetic fixture." }),
      codex("event_msg", { type: "user_message", message: "Build the synthetic fixture." }),
    ],
    "injected.jsonl": [codex("session_meta", { id: "injected" }), codex("response_item", { type: "message", role: "user", content: [{ type: "input_text", text: "# AGENTS.md instructions\nNo ticket. Continue." }] })],
    "claude.jsonl": [{ type: "user", sessionId: "claude-users", timestamp: "2026-03-14T09:00:00.000Z", message: { content: [{ type: "text", text: "Any open questions?" }] } }],
  });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.strictEqual(report.flagged.length, 2);
  const users = report.flagged.find((entry) => entry.path.endsWith("user.jsonl"));
  assert.deepStrictEqual(users?.classes, {});
  assert.deepStrictEqual(users?.candidates, { "repeated-request": 1, "user-intervention": 1 });
  assert.strictEqual(report.sampled.length, 0);
});

test("an otherwise unflagged parent conversation sample is deterministic, separately bounded and accounts for omissions", () => {
  const files: Record<string, object[]> = {};
  for (let index = 0; index < 6; index++) files[`parent-${index}.jsonl`] = [codex("session_meta", { id: `parent-${index}` }), codex("event_msg", { type: "user_message", message: `Build synthetic fixture ${index}.` })];
  files["child.jsonl"] = [codex("session_meta", { id: "child-sample", parent_thread_id: "parent-0" }), codex("event_msg", { type: "user_message", message: "Continue." })];
  files["tool-only.jsonl"] = [codex("session_meta", { id: "tool-only" })];
  const root = scenario("sample", files);
  const args = ["--since", "2026-03-10", "--top", "1", root];
  const { report } = runTriage(args);
  assert.strictEqual(report.flagged.length, 0);
  assert.strictEqual(report.sampled.length, 3);
  assert.strictEqual(report.sampleOmitted, 3);
  assert.deepStrictEqual(report.sampled, runTriage(args).report.sampled);
  assert.strictEqual(report.conversations, 7);
  const withChild = report.sampled.find((entry) => entry.paths.some((path) => path.endsWith("parent-0.jsonl")));
  assert.strictEqual(withChild?.paths.length, 2);
});

test("unreviewed candidate coverage includes every member path of a grouped conversation", () => {
  const root = scenario("grouped-remainder", {
    "first.jsonl": [codex("session_meta", { id: "first" }), codex("event_msg", { type: "error" }), codex("event_msg", { type: "user_message", message: "No ticket." })],
    "second.jsonl": [codex("session_meta", { id: "second" }), codex("event_msg", { type: "error" })],
    "child.jsonl": [codex("session_meta", { id: "second-child", parent_thread_id: "second" })],
  });
  const { report } = runTriage(["--since", "2026-03-10", "--top", "1", root]);
  assert.strictEqual(report.remainder, 1);
  assert.deepStrictEqual(report.remainderPaths, [join(root, "child.jsonl"), join(root, "second.jsonl")]);
});

test("malformed known record shapes and identities remain visible without joining a parent", () => {
  const root = scenario("malformed-shapes", {
    "parent.jsonl": [codex("session_meta", { id: "shape-parent" })],
    "uncertain.jsonl": [codex("session_meta", { parent_thread_id: "shape-parent" }), codex("event_msg", {}), { type: "response_item", payload: "bad" }, codex("event_msg", { type: "user_message", message: "Continue." })],
    "claude.jsonl": [{ type: "user", sessionId: "shape-claude", message: { content: 42 } }],
  });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.strictEqual(report.conversations, 3);
  assert.strictEqual(report.skippedUnknownRecords, 3);
  assert.strictEqual(report.diagnostics.filter(({ kind }) => kind === "malformed").length, 3);
  assert.deepStrictEqual(report.flagged, []);
  assert.deepStrictEqual(report.sampled, []);
});

test("stable tool IDs deduplicate copied retry sequences while preserving their evidence paths", () => {
  const records = [1, 2, 3].flatMap((index) => [
    { type: "assistant", sessionId: "resumed", uuid: `assistant-${index}`, timestamp: "2026-03-14T09:00:00.000Z", message: { content: [{ type: "tool_use", id: `tool-${index}`, name: "Read" }] } },
    { type: "user", sessionId: "resumed", uuid: `result-${index}`, timestamp: "2026-03-14T09:00:00.000Z", message: { content: [{ type: "tool_result", tool_use_id: `tool-${index}`, is_error: true, content: "Missing file" }] } },
  ]);
  const root = scenario("stable-retries", { "a.jsonl": records, "b.jsonl": records });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.strictEqual(report.conversations, 1);
  assert.deepStrictEqual(report.flagged[0].classes, { "retry-loop": 1 });
  assert.strictEqual(report.flagged[0].evidence.length, 2);
  assert.ok(report.flagged[0].evidence.every(({ callId }) => callId === "tool-3"));
});

test("transport metadata in a separate text block preserves genuine rejection and validation envelopes", () => {
  const root = scenario("transport-blocks", {
    "blocked.jsonl": [
      codex("session_meta", { id: "transport-blocked" }),
      codex("response_item", { type: "function_call_output", call_id: "blocked-call", output: [
        { type: "input_text", text: "Wall time: 2.5436 seconds\nOutput:" },
        { type: "input_text", text: "This action was rejected due to unacceptable risk.\nReason: synthetic prohibited operation." },
      ] }),
      codex("response_item", { type: "function_call_output", call_id: "invalid-call", output: [
        { type: "input_text", text: "Wall time: 0.001 seconds\nOutput:" },
        { type: "input_text", text: "InputValidationError: synthetic invalid argument" },
      ] }),
    ],
  });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.strictEqual(report.flagged.length, 1);
  assert.deepStrictEqual(report.flagged[0].classes, { "input-validation": 1, "policy-block": 1 });
  assert.deepStrictEqual(report.flagged[0].evidence.map(({ line, callId }) => ({ line, callId })), [
    { line: 2, callId: "blocked-call" }, { line: 3, callId: "invalid-call" },
  ]);
});

test("transport metadata does not hide successful nested envelopes quoting old failures", () => {
  const quote = "This action was rejected due to unacceptable risk.\nReason: historic output.\nInputValidationError: historic output";
  const root = scenario("transport-quotes", {
    "quoted.jsonl": [
      codex("session_meta", { id: "transport-quoted" }),
      codex("response_item", { type: "function_call_output", call_id: "quoted-call", output: [
        { type: "input_text", text: "Wall time: 2.5436 seconds\nOutput:" },
        { type: "input_text", text: JSON.stringify({ exit_code: 0, output: quote }) },
      ] }),
      codex("response_item", { type: "function_call_output", call_id: "quoted-header", output: [
        { type: "input_text", text: "Wall time: 2.5436 seconds\nProcess exited with code 0\nOutput:" },
        { type: "input_text", text: quote },
      ] }),
    ],
  });
  assert.deepStrictEqual(runTriage(["--since", "2026-03-10", root]).report.flagged, []);
});

test("mixed Codex user representations pair per message and preserve later response-only turns", () => {
  const root = scenario("mixed-users", {
    "mixed.jsonl": [
      codex("session_meta", { id: "mixed-users" }),
      codex("event_msg", { type: "user_message", message: "Old synthetic task." }, "2026-03-01T09:00:00.000Z"),
      codex("response_item", { type: "message", role: "user", content: [{ type: "input_text", text: "No ticket." }] }, "2026-03-14T09:00:01.000Z"),
      codex("event_msg", { type: "user_message", message: "No ticket." }, "2026-03-14T09:00:01.001Z"),
      codex("response_item", { type: "message", role: "user", content: [{ type: "input_text", text: "Continue with the synthetic task." }] }, "2026-03-14T10:00:00.000Z"),
      codex("response_item", { type: "message", role: "user", content: [{ type: "input_text", text: "Continue with the synthetic task." }] }, "2026-03-14T11:00:00.000Z"),
    ],
    "response-only.jsonl": [
      codex("session_meta", { id: "old-event" }),
      codex("event_msg", { type: "user_message", message: "Old synthetic task." }, "2026-03-01T09:00:00.000Z"),
      codex("response_item", { type: "message", role: "user", content: [{ type: "input_text", text: "Any open questions?" }] }),
    ],
  });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.strictEqual(report.flagged.length, 2);
  const mixed = report.flagged.find(({ path }) => path.endsWith("mixed.jsonl"));
  assert.deepStrictEqual(mixed?.candidates, { "repeated-request": 1, "user-intervention": 3 });
  assert.deepStrictEqual(mixed?.evidence.filter(({ kind }) => kind === "user-intervention").map(({ line }) => line), [4, 5, 6]);
});

test("distinct identical user turns retain activity while stable message or turn IDs pair representations", () => {
  const task = [{ type: "input_text", text: "Continue with the synthetic task." }];
  const root = scenario("user-pairs", {
    "paired.jsonl": [
      codex("session_meta", { id: "paired-users" }),
      codex("event_msg", { type: "user_message", message: "Continue with the synthetic task.", message_id: "message1" }),
      codex("turn_context", { model: "synthetic" }),
      codex("response_item", { type: "message", role: "user", content: task, message_id: "message1" }),
      codex("event_msg", { type: "user_message", message: "Continue with the synthetic task.", turn_id: "turn2" }),
      codex("turn_context", { model: "synthetic" }),
      codex("response_item", { type: "message", role: "user", content: task, turn_id: "turn2" }),
      codex("response_item", { type: "message", role: "user", content: task, turn_id: "turn3" }),
      codex("event_msg", { type: "user_message", message: "Continue with the synthetic task.", turn_id: "turn4" }),
    ],
  });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.deepStrictEqual(report.flagged[0].candidates, { "repeated-request": 3, "user-intervention": 4 });
});

for (const acrossFiles of [false, true]) {
  const placement = acrossFiles ? "across grouped files" : "within one file";
  test(`copied Codex user pairs inherit response message IDs ${placement}`, () => {
    const text = "Build this synthetic fixture.";
    const pair = [
      codex("event_msg", { type: "user_message", message: text }),
      codex("response_item", { type: "message", role: "user", content: [{ type: "input_text", text }], message_id: "user-1" }, "2026-03-14T09:00:00.001Z"),
    ];
    const meta = codex("session_meta", { id: "copied-user-pairs" });
    const root = scenario(`copied-user-pairs-${acrossFiles}`, acrossFiles ? {
      "a.jsonl": [meta, ...pair], "b.jsonl": [meta, ...pair],
    } : { "a.jsonl": [meta, ...pair, ...pair] });
    const { report } = runTriage(["--since", "2026-03-10", root]);
    assert.deepStrictEqual(report.flagged, []);
    assert.strictEqual(report.conversations, 1);
    assert.strictEqual(report.sampled.length, 1);
    assert.deepStrictEqual(report.sampled[0].paths, acrossFiles ? [join(root, "a.jsonl"), join(root, "b.jsonl")] : [join(root, "a.jsonl")]);
  });

  test(`paired Codex response IDs preserve distinct candidates and event evidence ${placement}`, () => {
    const text = "Continue with the synthetic task.";
    const pairs = ["user-1", "user-1", "user-2"].map((messageId) => [
      codex("event_msg", { type: "user_message", message: text }),
      codex("response_item", { type: "message", role: "user", content: [{ type: "input_text", text }], message_id: messageId }, "2026-03-14T09:00:00.001Z"),
    ]);
    const meta = codex("session_meta", { id: "candidate-user-pairs" });
    const root = scenario(`candidate-user-pairs-${acrossFiles}`, acrossFiles ? {
      "a.jsonl": [meta, ...pairs[0]], "b.jsonl": [meta, ...pairs[1], ...pairs[2]],
    } : { "a.jsonl": [meta, ...pairs.flat()] });
    const { report } = runTriage(["--since", "2026-03-10", root]);
    assert.strictEqual(report.flagged.length, 1);
    assert.deepStrictEqual(report.flagged[0].candidates, { "repeated-request": 1, "user-intervention": 2 });
    const first = { path: join(root, "a.jsonl"), line: 2, timestamp: "2026-03-14T09:00:00.000Z", timeBasis: "record", messageId: "user-1" };
    const second = { ...first, path: join(root, acrossFiles ? "b.jsonl" : "a.jsonl"), line: acrossFiles ? 4 : 6, messageId: "user-2" };
    assert.deepStrictEqual(report.flagged[0].evidence, [
      { kind: "user-intervention", ...first },
      { kind: "user-intervention", ...second },
      { kind: "repeated-request", ...second },
    ]);
  });
}

test("conflicting message IDs stay distinct before turn and adjacency pairing", () => {
  const text = "Build this synthetic fixture.";
  const cases = [
    { name: "conflicting-turn", event: { message_id: "first-message", turn_id: "shared-turn" }, response: { message_id: "second-message", turn_id: "shared-turn" }, timestamp: "2026-03-14T09:01:00.000Z" },
    { name: "conflicting-adjacent", event: { message_id: "first-message" }, response: { message_id: "second-message" }, timestamp: "2026-03-14T09:00:00.001Z" },
    { name: "shared-message", event: { message_id: "same-message", turn_id: "first-turn" }, response: { message_id: "same-message", turn_id: "second-turn" }, timestamp: "2026-03-14T09:01:00.000Z" },
    { name: "shared-turn", event: { turn_id: "shared-turn" }, response: { turn_id: "shared-turn" }, timestamp: "2026-03-14T09:01:00.000Z" },
    { name: "one-message-id", event: { message_id: "first-message", turn_id: "shared-turn" }, response: { turn_id: "shared-turn" }, timestamp: "2026-03-14T09:01:00.000Z" },
    { name: "adjacent", event: {}, response: {}, timestamp: "2026-03-14T09:00:00.001Z" },
  ];
  const root = scenario("message-id-conflicts", Object.fromEntries(cases.map(({ name, event, response, timestamp }) => [`${name}.jsonl`, [
    codex("session_meta", { id: name }),
    codex("event_msg", { type: "user_message", message: text, ...event }),
    codex("response_item", { type: "message", role: "user", content: [{ type: "input_text", text }], ...response }, timestamp),
  ]])));
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.deepStrictEqual(
    Object.fromEntries(report.flagged.map(({ path, candidates }) => [path.split("/").at(-1), candidates])),
    {
      "conflicting-adjacent.jsonl": { "repeated-request": 1 },
      "conflicting-turn.jsonl": { "repeated-request": 1 },
    },
  );
  assert.strictEqual(report.conversations, cases.length);
  assert.strictEqual(report.sampled.length, 3);
  assert.strictEqual(report.sampleOmitted, 1);
});

test("housekeeping-only commands do not qualify for sampling while actual skill and task requests do", () => {
  const root = scenario("housekeeping", {
    "housekeeping.jsonl": [
      { type: "user", sessionId: "housekeeping", timestamp: "2026-03-14T09:00:00.000Z", message: { content: "<command-name>/clear</command-name>\n<command-message>clear</command-message>\n<command-args></command-args>" } },
      { type: "user", sessionId: "housekeeping", timestamp: "2026-03-14T09:00:01.000Z", message: { content: "/model;" } },
      { type: "user", sessionId: "housekeeping", timestamp: "2026-03-14T09:00:02.000Z", message: { content: "/model" } },
      { type: "user", sessionId: "housekeeping", timestamp: "2026-03-14T09:00:03.000Z", message: { content: "<local-command-stdout>Set model to synthetic-model</local-command-stdout>" } },
    ],
    "skill.jsonl": [{ type: "user", sessionId: "skill", timestamp: "2026-03-14T09:00:00.000Z", message: { content: "<command-name>/maintain</command-name>\n<command-message>maintain</command-message>\n<command-args></command-args>" } }],
    "task.jsonl": [codex("session_meta", { id: "substantive-task" }), codex("event_msg", { type: "user_message", message: "Build the synthetic fixture." })],
  });
  const { report } = runTriage(["--since", "2026-03-10", root]);
  assert.deepStrictEqual(report.flagged, []);
  assert.deepStrictEqual(report.sampled.map(({ path }) => path.split("/").at(-1)), ["skill.jsonl", "task.jsonl"]);
});
