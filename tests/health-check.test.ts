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
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { after, before, test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SCRIPT = join(REPO_DIR, "scripts", "health-check.ts");
const FIXTURES = join(TESTS_DIR, "fixtures", "health");
const DAY_MS = 86_400_000;
const PIPE_BUFFER_BYTES = 65536;
const EARLY_READER_BYTES = 64;
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const VOLUME_TASKS = 250;
const VOLUME_NAME_PADDING = 180;
const MARKER = ".agents-kit";
const CORE_RULES_MARKER = ".agents-kit-core-rules";
const STAGING_PREFIX = ".agents-kit-staging.";
const TEST_ROOT = mkdtempSync(join(tmpdir(), "agents-kit-health-check-"));
const STORE = join(TEST_ROOT, "store");
const UNREADABLE_STORE = join(TEST_ROOT, "unreadable-store");
const UNREADABLE_FILE = join(UNREADABLE_STORE, "locked-task", "plan.md");
const LOCKED_TREE = join(TEST_ROOT, "unreadable-tree");
const LOCKED_TASK_DIR = join(LOCKED_TREE, "area", "locked-task");
const NOT_A_DIR = join(TEST_ROOT, "not-a-dir.md");
const NAMED_SCRIPTS = join(TEST_ROOT, "named-scripts");
const PROJECT_ROOT = join(TEST_ROOT, "project-root");
const SECOND_ROOT = join(TEST_ROOT, "second", "store");
const ANCHORS = join(TEST_ROOT, "anchors");
const BUDGETS = join(TEST_ROOT, "budgets");
const LEGACY_CONTEXT = join(TEST_ROOT, "legacy-context");
const INSTALLS = join(TEST_ROOT, "installs");
const KIT = join(INSTALLS, "kit");
const CLAUDE_HOME = join(INSTALLS, ".claude");
const CODEX_HOME = join(INSTALLS, ".codex");
const CONFLICT_HOME = join(INSTALLS, "conflict", ".claude");
const LOCKED_SKILL_HOME = join(INSTALLS, "locked", ".claude");
const LOCKED_SKILL = join(LOCKED_SKILL_HOME, "skills", "kept-skill");
const STAGING_HOME = join(INSTALLS, "staging", ".claude");
const MATERIALIZED_HOME = join(INSTALLS, "materialized", ".claude");
const PARTIAL_HOME = join(INSTALLS, "partial", ".claude");
const FRESH_HOME = join(TEST_ROOT, "fresh", ".claude");
const BLOCKED_FRESH_HOME = join(TEST_ROOT, "blocked-fresh", ".claude");
const ABSENT_HOME = join(TEST_ROOT, "absent", ".claude");
const VOLUME_STORE = join(TEST_ROOT, "big-report");
const VOLUME_REPORT = join(TEST_ROOT, "big-report.json");
const DUP_A = join(TEST_ROOT, "dup-a");
const DUP_B = join(TEST_ROOT, "dup-b");
const DUP_C = join(TEST_ROOT, "dup-c");
const DUP_C_RESPELLED = join(TEST_ROOT, "DUP-C");
const CASE_PROBE = join(TEST_ROOT, "case-probe");
const CASE_PROBE_RESPELLED = join(TEST_ROOT, "CASE-PROBE");
const STORE_ARGS: readonly string[] = [STORE];
const ANCHORS_ARGS: readonly string[] = [ANCHORS];
const BUDGETS_ARGS: readonly string[] = [BUDGETS];
const LOWERED_BUDGET_ARGS: readonly string[] = ["--task-max-kb", "1", "--record-max-kb", "1", BUDGETS];
const LEGACY_CONTEXT_ARGS: readonly string[] = [LEGACY_CONTEXT];
const INSTALLS_ARGS: readonly string[] = ["--installs", KIT, CLAUDE_HOME, CODEX_HOME];
const DUP_ARGS: readonly string[] = [DUP_A, DUP_B];
const VOLUME_ARGS: readonly string[] = [VOLUME_STORE];
const TO_DO_PLAN = "# t\n\n**Status:** to-do\n";
const VOLUME_PLAN =
  "# t\n\n**Status:** executing\n\n## Step 1 — do\n\n- [x] d ([result](./result.md#absent))\n";
const VOLUME_RESULT = "# r\n\n## Current state\n\n_Updated:_ 2026-01-01\n";

const DAYS_PAST_STALE = 70;
const DAYS_WITHIN_STALE = 2;

const FIXTURE_AGE_DAYS: readonly (readonly [string, number])[] = [
  [join(STORE, "stale-executing"), 62],
  [join(STORE, "fresh-executing"), DAYS_WITHIN_STALE],
  [join(STORE, "done-unarchived"), DAYS_PAST_STALE],
  [join(STORE, "no-status-plan"), DAYS_PAST_STALE],
  [join(STORE, "unknown-status"), DAYS_PAST_STALE],
  [join(STORE, "Archive", "done-archived"), 400],
  [join(STORE, "Backlog", "parked-todo"), DAYS_PAST_STALE],
  [ANCHORS, DAYS_WITHIN_STALE],
  [BUDGETS, DAYS_WITHIN_STALE],
  [LEGACY_CONTEXT, DAYS_WITHIN_STALE],
];

interface Finding {
  readonly check: string;
  readonly path: string;
  readonly detail: string;
  readonly root?: string;
}

interface Report {
  readonly findings: readonly Finding[];
  readonly scanned: number;
  readonly unreadable: number;
  readonly unreadablePaths: readonly string[];
}

interface CheckRun {
  readonly report: Report;
  readonly stderr: string;
}

function runCheck(args: readonly string[]): CheckRun {
  const run = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER_BYTES,
  });
  assert.strictEqual(
    run.status,
    0,
    `health-check.ts exited ${run.status} (the contract requires exit 0) for: ${args.join(" ")}\n` +
      `${run.stderr ?? run.error?.message ?? ""}`,
  );
  const report: Report = JSON.parse(run.stdout);
  return { report, stderr: run.stderr };
}

function findingCount(report: Report, check?: string): number {
  return check === undefined
    ? report.findings.length
    : report.findings.filter((entry) => entry.check === check).length;
}

function findingDetail(report: Report, check: string, path: string): string {
  return report.findings.find((entry) => entry.check === check && entry.path === path)?.detail ?? "";
}

function findingDetails(report: Report, check: string, path: string): string[] {
  return report.findings
    .filter((entry) => entry.check === check && entry.path === path)
    .map((entry) => entry.detail);
}

function findingRoots(report: Report, check: string, path: string): string[] {
  return report.findings
    .filter((entry) => entry.check === check && entry.path === path)
    .map((entry) => entry.root ?? "");
}

function isReadable(path: string): boolean {
  try {
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function copyFixture(from: string, to: string): void {
  cpSync(from, to, { recursive: true, verbatimSymlinks: true });
}

function ageFolder(folder: string, days: number): void {
  const when = new Date(Date.now() - days * DAY_MS);
  for (const entry of readdirSync(folder, { recursive: true, encoding: "utf8" })) {
    if (entry.endsWith(".md")) {
      const file = join(folder, entry);
      utimesSync(file, when, when);
    }
  }
}

function writeTaskFolder(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "plan.md"), TO_DO_PLAN);
}

function deleteFinderDroppings(root: string): void {
  for (const entry of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    if (basename(entry) === ".DS_Store") rmSync(join(root, entry), { force: true });
  }
}

function writeVolumeStore(root: string): void {
  const padding = "x".repeat(VOLUME_NAME_PADDING);
  for (let index = 0; index < VOLUME_TASKS; index++) {
    const dir = join(root, `task-${String(index).padStart(3, "0")}-${padding}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "plan.md"), VOLUME_PLAN);
    writeFileSync(join(dir, "result.md"), VOLUME_RESULT);
  }
}

function writeInstallFixtures(): void {
  mkdirSync(INSTALLS, { recursive: true });
  copyFixture(join(FIXTURES, "installs", "kit"), KIT);

  copyFixture(join(FIXTURES, "installs", "claude-home"), CLAUDE_HOME);
  copyFixture(join(FIXTURES, "installs", "codex-home"), CODEX_HOME);
  deleteFinderDroppings(INSTALLS);

  writeFileSync(join(KIT, "references", ".DS_Store"), "kit-side finder state\n");
  writeFileSync(join(CLAUDE_HOME, "references", ".DS_Store"), "install-side finder state\n");
  writeFileSync(join(KIT, "references", ".keeprc"), "kit\n");
  writeFileSync(join(CLAUDE_HOME, "references", ".keeprc"), "install\n");

  mkdirSync(join(KIT, "skills", "never-deployed"), { recursive: true });
  writeFileSync(join(KIT, "skills", "never-deployed", "SKILL.md"), "new\n");
  writeFileSync(join(KIT, "agents", "never-deployed.md"), "new\n");

  mkdirSync(join(CONFLICT_HOME, "skills", "kept-skill"), { recursive: true });
  mkdirSync(join(CONFLICT_HOME, "references"), { recursive: true });
  writeFileSync(join(CONFLICT_HOME, "skills", "kept-skill", MARKER), "");
  copyFileSync(
    join(KIT, "skills", "kept-skill", "SKILL.md"),
    join(CONFLICT_HOME, "skills", "kept-skill", "SKILL.md"),
  );
  writeFileSync(join(CONFLICT_HOME, "CORE_RULES.md"), "MY OWN RULES\n");
  writeFileSync(join(CONFLICT_HOME, "references", "sample.md"), "mine\n");

  mkdirSync(LOCKED_SKILL, { recursive: true });
  writeFileSync(join(LOCKED_SKILL, MARKER), "");
  writeFileSync(join(LOCKED_SKILL, "SKILL.md"), "drifted\n");
  chmodSync(LOCKED_SKILL, 0o000);

  const stagingDir = join(STAGING_HOME, "skills", `${STAGING_PREFIX}4242-kept-skill`);
  mkdirSync(stagingDir, { recursive: true });
  writeFileSync(join(stagingDir, MARKER), "");
  writeFileSync(join(stagingDir, "SKILL.md"), "half-copied\n");

  mkdirSync(join(MATERIALIZED_HOME, "skills", "kept-skill"), { recursive: true });
  writeFileSync(join(MATERIALIZED_HOME, "skills", "kept-skill", MARKER), "");
  copyFileSync(
    join(KIT, "skills", "kept-skill", "SKILL.md"),
    join(MATERIALIZED_HOME, "skills", "kept-skill", "SKILL.md"),
  );

  copyFileSync(
    join(KIT, "skills", "kept-skill", "AGENTS.md"),
    join(MATERIALIZED_HOME, "skills", "kept-skill", "AGENTS.md"),
  );

  mkdirSync(PARTIAL_HOME, { recursive: true });
  writeFileSync(join(PARTIAL_HOME, CORE_RULES_MARKER), "");
  copyFileSync(join(KIT, "CORE_RULES.md"), join(PARTIAL_HOME, "CORE_RULES.md"));

  mkdirSync(FRESH_HOME, { recursive: true });

  mkdirSync(BLOCKED_FRESH_HOME, { recursive: true });
  writeFileSync(join(BLOCKED_FRESH_HOME, "CORE_RULES.md"), "MY OWN RULES\n");
}

before(() => {
  copyFixture(join(FIXTURES, "store"), STORE);
  copyFixture(join(FIXTURES, "anchors"), ANCHORS);
  copyFixture(join(FIXTURES, "budgets"), BUDGETS);
  copyFixture(join(FIXTURES, "legacy-context"), LEGACY_CONTEXT);
  for (const [folder, days] of FIXTURE_AGE_DAYS) ageFolder(folder, days);

  const freshPlan = join(STORE, "fresh-executing", "plan.md");

  mkdirSync(join(UNREADABLE_STORE, "locked-task"), { recursive: true });
  copyFileSync(freshPlan, UNREADABLE_FILE);
  chmodSync(UNREADABLE_FILE, 0o000);

  mkdirSync(LOCKED_TASK_DIR, { recursive: true });
  copyFileSync(freshPlan, join(LOCKED_TASK_DIR, "plan.md"));
  chmodSync(LOCKED_TASK_DIR, 0o000);

  writeFileSync(NOT_A_DIR, "not a store\n");

  mkdirSync(join(NAMED_SCRIPTS, "scripts"), { recursive: true });
  copyFileSync(freshPlan, join(NAMED_SCRIPTS, "scripts", "plan.md"));

  mkdirSync(join(PROJECT_ROOT, ".agents", "tasks"), { recursive: true });
  mkdirSync(join(PROJECT_ROOT, ".git"), { recursive: true });
  copyFixture(join(STORE, "fresh-executing"), join(PROJECT_ROOT, ".agents", "tasks", "nested-task"));
  copyFileSync(freshPlan, join(PROJECT_ROOT, ".git", "plan.md"));

  mkdirSync(SECOND_ROOT, { recursive: true });
  copyFixture(join(STORE, "done-unarchived"), join(SECOND_ROOT, "done-unarchived"));

  writeInstallFixtures();

  writeTaskFolder(join(DUP_A, "add-csv-export"));
  writeTaskFolder(join(DUP_B, "add-csv-export"));
  writeTaskFolder(join(DUP_A, "only-here"));
  writeTaskFolder(join(DUP_B, "Archive", "only-here"));
  writeTaskFolder(join(DUP_A, "parked-too"));
  writeTaskFolder(join(DUP_B, "Backlog", "parked-too"));
  writeTaskFolder(join(DUP_A, "unique-a"));
  writeTaskFolder(join(DUP_B, "unique-b"));
  writeTaskFolder(join(DUP_C, "area-a", "nested-dup"));
  writeTaskFolder(join(DUP_C, "area-b", "nested-dup"));

  mkdirSync(CASE_PROBE);
  writeVolumeStore(VOLUME_STORE);
});

after(() => {
  chmodSync(LOCKED_TASK_DIR, 0o755);
  chmodSync(LOCKED_SKILL, 0o755);
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

test("a readable store scans without warnings and exits 0", () => {
  const { stderr } = runCheck(STORE_ARGS);
  assert.strictEqual(stderr, "", "a readable fixture store must produce no warnings");
});

test("scanned counts every task folder, archived and backlogged ones included", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.strictEqual(report.scanned, 13, "scanned task count");
  assert.strictEqual(report.unreadable, 0, "a readable store reports nothing unread");
});

test("a plan status outside the vocabulary is reported rather than silently exempted", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.strictEqual(findingCount(report, "unknown-status"), 1, "unknown-status finding count");
  assert.strictEqual(
    findingDetail(report, "unknown-status", "store/unknown-status"),
    "plan.md carries an unrecognized status: in progress",
    "unknown-status detail carries the value the file actually holds",
  );
  assert.strictEqual(
    findingDetail(report, "stale", "store/unknown-status"),
    "",
    "an unclassifiable status is reported once, under its own check",
  );
});

test("a legacy result status is reported as legacy and never as an unrecognized status", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.strictEqual(
    findingCount(report, "legacy-result-status"),
    1,
    "legacy-result-status finding count",
  );
  assert.strictEqual(
    findingDetail(report, "legacy-result-status", "store/legacy-result-status"),
    "result.md carries a legacy **Status:** header (shipped onwards); plan.md owns the lifecycle",
    "the legacy finding names the file and the value it still carries",
  );
  assert.deepStrictEqual(
    report.findings.filter((entry) => entry.path === "store/legacy-result-status").map((entry) => entry.check),
    ["legacy-result-status"],
    "a result-side status produces no unknown-status and no other finding",
  );
});

test("a legacy CONTEXT.md status is tolerated and produces no finding", () => {
  const { report } = runCheck(LEGACY_CONTEXT_ARGS);
  assert.deepStrictEqual(
    report.findings.map((entry) => `${entry.check} ${entry.path}`),
    [],
    "a CONTEXT.md carrying a legacy **Status:** line raises nothing",
  );
  assert.strictEqual(report.scanned, 1, "the legacy-context root holds the one fixture folder");
});

test("a 62-day-old executing task is reported stale with its status and age", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.strictEqual(findingCount(report, "stale"), 2, "stale finding count");
  assert.strictEqual(
    findingDetail(report, "stale", "store/stale-executing"),
    "executing, 62 days stale",
    "stale detail for store/stale-executing",
  );
});

test("a 2-day-old executing task is not reported stale", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.strictEqual(
    findingDetail(report, "stale", "store/fresh-executing"),
    "",
    "fresh task must not be reported stale",
  );
});

test("a plan with no parseable status is reported stale under a named label, not an empty value", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.strictEqual(
    findingDetail(report, "stale", "store/no-status-plan"),
    "no-status, 70 days stale",
    "stale detail for a plan carrying no parseable status",
  );
});

test("a done task outside Archive/ is reported with its status", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.strictEqual(findingCount(report, "done-unarchived"), 2, "done-unarchived finding count");
  assert.strictEqual(
    findingDetail(report, "done-unarchived", "store/done-unarchived"),
    "done, outside Archive/",
    "done-unarchived detail for store/done-unarchived",
  );
});

test("a **Completed prose header on a plan-less result is not a done task", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.deepStrictEqual(
    report.findings.filter((entry) => entry.path === "store/completed-prose"),
    [],
    "a `**Completed steps:**` header is prose, not the closing line a done plan owes",
  );
});

test("a done task parked in Backlog/ is reported as misfiled, not merely unarchived", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.strictEqual(
    findingDetail(report, "done-unarchived", "store/Backlog/done-parked"),
    "done, parked in Backlog/ — belongs in Archive/",
    "done-unarchived detail for a terminal task inside a backlog",
  );
});

test("a parked to-do task produces no findings, its 70-day age included", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.deepStrictEqual(
    report.findings.filter((entry) => entry.path === "store/Backlog/parked-todo"),
    [],
    "an aged to-do task inside a backlog must stay silent",
  );
});

test("a live task parked in Backlog/ is reported under started-in-backlog", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.strictEqual(findingCount(report, "started-in-backlog"), 3, "started-in-backlog finding count");
  assert.strictEqual(
    findingDetail(report, "started-in-backlog", "store/Backlog/started-parked"),
    "executing, parked in Backlog/ — a parked task must be unstarted",
    "started-in-backlog detail for a live parked task",
  );
});

test("a parked plan with no parseable status is reported as unjudgeable, not left silent", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.strictEqual(
    findingDetail(report, "started-in-backlog", "store/Backlog/statusless-parked"),
    "no parseable plan status, parked in Backlog/ — cannot judge the entry gate",
    "the stale exemption must not silence a statusless parked plan",
  );
});

test("a plan-less parked folder holding a result.md at all is reported as started", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.strictEqual(
    findingDetail(report, "started-in-backlog", "store/Backlog/resultonly-parked"),
    "no plan.md but result.md exists, parked in Backlog/ — a parked task must be unstarted",
    "an existing result file must fail the entry gate for a plan-less parked folder",
  );
});

test("an archived task produces no findings", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.strictEqual(
    findingDetail(report, "done-unarchived", "store/Archive/done-archived"),
    "",
    "archived task must not be reported done-unarchived",
  );
  assert.strictEqual(
    findingDetail(report, "stale", "store/Archive/done-archived"),
    "",
    "archived task must not be reported stale",
  );
  assert.strictEqual(findingCount(report), 9, "total finding count");
});

test("an unreadable task file reaches the contract, not only stderr", (t: TestContext) => {
  if (isReadable(UNREADABLE_FILE)) {
    t.skip("the unreadable-file case needs a user that chmod 000 actually stops");
    return;
  }
  const { report } = runCheck([UNREADABLE_STORE]);
  assert.strictEqual(report.unreadable, 1, "a task file that cannot be read is counted");

  assert.deepStrictEqual(
    report.unreadablePaths,
    [UNREADABLE_FILE],
    "unreadablePaths names the file by absolute path",
  );
  assert.strictEqual(
    findingCount(report, "unknown-status"),
    0,
    "an unreadable status file is not classified as an unknown lifecycle value",
  );
});

test("an unlistable directory reaches the contract exactly once", (t: TestContext) => {
  if (isReadable(LOCKED_TASK_DIR)) {
    t.skip("the unreadable-directory case needs a user that chmod 000 actually stops");
    return;
  }
  const { report } = runCheck([LOCKED_TREE]);
  assert.strictEqual(
    report.unreadable,
    1,
    "a directory that cannot be listed is counted once, not once per walk pass",
  );
  assert.deepStrictEqual(
    report.unreadablePaths,
    [LOCKED_TASK_DIR],
    "unreadablePaths names the directory by absolute path, once",
  );
});

test("a root that exists but is not a directory reaches the contract, not only stderr", () => {
  const { report } = runCheck([NOT_A_DIR]);
  assert.strictEqual(report.scanned, 0, "a root that is not a directory walks nothing");
  assert.strictEqual(report.unreadable, 1, "a root that is not a directory is counted as uncovered");
  assert.deepStrictEqual(
    report.unreadablePaths,
    [NOT_A_DIR],
    "unreadablePaths names the root that could not be walked",
  );
});

test("--stale-days reports a task whose age equals the threshold", () => {
  const { report } = runCheck(["--stale-days", "62", STORE]);
  assert.strictEqual(findingCount(report, "stale"), 2, "stale count at the age boundary");
});

test("--stale-days raises the threshold without affecting the archive check", () => {
  const { report } = runCheck(["--stale-days=90", STORE]);
  assert.strictEqual(findingCount(report, "stale"), 0, "stale count above the age boundary");
  assert.strictEqual(
    findingCount(report, "done-unarchived"),
    2,
    "done-unarchived count is independent of --stale-days",
  );
});

test("a directory's name no longer decides whether the task inside it exists", () => {
  const { report } = runCheck([NAMED_SCRIPTS]);
  assert.strictEqual(report.scanned, 1, "a task folder named scripts is scanned like any other");
});

test("the canonical root is found from a project root, while every other dotted name stays pruned", () => {
  const { report } = runCheck([PROJECT_ROOT]);
  assert.strictEqual(report.scanned, 1, "a project root reaches the tasks under its .agents/tasks");
});

test("findings from same-basename roots remain unambiguous through the root field", () => {
  const { report } = runCheck([STORE, SECOND_ROOT]);
  assert.strictEqual(report.scanned, 14, "scanned count across two roots");
  assert.strictEqual(
    findingCount(report, "done-unarchived"),
    3,
    "done-unarchived count across two roots",
  );
  assert.strictEqual(
    findingDetail(report, "done-unarchived", "store/done-unarchived"),
    "done, outside Archive/",
    "done-unarchived detail from the second root",
  );
  assert.deepStrictEqual(
    findingRoots(report, "done-unarchived", "store/done-unarchived"),
    [STORE, SECOND_ROOT],
    "same-basename findings retain their resolved task roots",
  );
});

test("a checked step whose anchor is missing from the result file is reported, a resolving one is not", () => {
  const { report, stderr } = runCheck(ANCHORS_ARGS);
  assert.strictEqual(stderr, "", "the anchor fixtures must produce no warnings");
  assert.strictEqual(report.scanned, 14, "scanned count for the anchor fixtures");
  assert.strictEqual(findingCount(report, "dead-anchor"), 5, "dead-anchor finding count");
  assert.strictEqual(
    findingDetail(report, "dead-anchor", "anchors/dead-anchor"),
    "Step 2: anchor not found: #step-2--never-written in ./result.md",
    "dead-anchor detail for an unresolvable anchor",
  );
});

test("a checked step with no result link is reported; a checkpoint checkbox is not a step", () => {
  const { report } = runCheck(ANCHORS_ARGS);
  assert.strictEqual(
    findingDetail(report, "dead-anchor", "anchors/missing-link"),
    "Step 1: checked step missing result link",
    "dead-anchor detail for a step with no result link",
  );
});

test("a checked step linking a file the folder does not hold is reported", () => {
  const { report } = runCheck(ANCHORS_ARGS);
  assert.strictEqual(
    findingDetail(report, "dead-anchor", "anchors/missing-target"),
    "Step 1: link target missing: ./gone.result.md#step-1--vanished",
    "dead-anchor detail for a link whose file is gone",
  );
});

test("checked-step evidence must name both the result file and a concrete result heading", () => {
  const { report } = runCheck(ANCHORS_ARGS);
  assert.strictEqual(
    findingDetail(report, "dead-anchor", "anchors/anchorless-result"),
    "Step 1: result link missing anchor: ./result.md",
    "dead-anchor detail for an anchorless result link",
  );
  assert.strictEqual(
    findingDetail(report, "dead-anchor", "anchors/plan-local-result"),
    "Step 1: result link missing file target: #step-1--plan-local-evidence",
    "dead-anchor detail for a plan-local result link",
  );
});

test("a duplicate and malformed G-IDs are reported across bullet markers; a valid ID and an (external) token are not", () => {
  const { report } = runCheck(ANCHORS_ARGS);
  assert.strictEqual(findingCount(report, "goal-id"), 3, "goal-id finding count");
  assert.deepStrictEqual(
    findingDetails(report, "goal-id", "anchors/bad-goal-ids"),
    [
      "duplicate goal ID G1 in goals.md",
      "malformed goal ID in goals.md: - Goal three — no ID assigned",
      "malformed goal ID in goals.md: * Goal four — an asterisk bullet, no ID",
    ],
    "goal-id details for the malformed and duplicate IDs",
  );
});

test("a live result with no ## Current state block is reported", () => {
  const { report } = runCheck(ANCHORS_ARGS);
  assert.strictEqual(findingCount(report, "no-current-state"), 3, "no-current-state finding count");
  assert.strictEqual(
    findingDetail(report, "no-current-state", "anchors/no-current-state"),
    'blocked result.md has no "## Current state" block',
    "no-current-state detail for a blocked result",
  );
});

test("a ## Current state heading inside a code fence does not satisfy the liveness check", () => {
  const { report } = runCheck(ANCHORS_ARGS);
  assert.strictEqual(
    findingDetail(report, "no-current-state", "anchors/fenced-current-state"),
    'executing result.md has no "## Current state" block',
    "no-current-state detail for a result whose only block sits in a fence",
  );
});

test("a three-backtick example inside a four-backtick fence does not toggle scanning back on", () => {
  const { report } = runCheck(ANCHORS_ARGS);
  assert.strictEqual(
    findingDetail(report, "no-current-state", "anchors/nested-fence"),
    'executing result.md has no "## Current state" block',
    "no-current-state detail for a result whose only block sits in a nested fence",
  );
});

test("a fenced status example is illustrative markdown, not a lifecycle state", () => {
  const { report } = runCheck(ANCHORS_ARGS);
  assert.strictEqual(
    findingDetail(report, "done-unarchived", "anchors/fenced-status"),
    "",
    "a **Status:** line inside a fence must not be read as the plan's own",
  );
});

test("a step link whose section a Compacted stub tombstones is documented state, not a dead anchor", () => {
  const { report } = runCheck(ANCHORS_ARGS);
  assert.strictEqual(
    findingDetail(report, "dead-anchor", "anchors/compacted-tombstone"),
    "",
    "an anchor named by a ## Compacted tombstone bullet must resolve",
  );
});

test("archived folders are exempt from the content checks", () => {
  const { report } = runCheck(ANCHORS_ARGS);
  assert.deepStrictEqual(
    findingDetails(report, "dead-anchor", "anchors/Archive/archived-violations"),
    [],
    "an archived checked step with no result link must stay silent",
  );
  assert.deepStrictEqual(
    findingDetails(report, "goal-id", "anchors/Archive/archived-violations"),
    [],
    "an archived duplicate G-ID must stay silent",
  );
  assert.strictEqual(
    findingDetail(report, "no-current-state", "anchors/Archive/archived-violations"),
    "",
    "an archived live result without ## Current state must stay silent",
  );
  assert.strictEqual(
    findingCount(report, "legacy-result-status"),
    0,
    "the archived fixtures' legacy result statuses stay silent like every other archived shape",
  );
});

test("an archived folder and a legacy done result without ## Current state produce no findings", () => {
  const { report } = runCheck(ANCHORS_ARGS);
  assert.strictEqual(findingCount(report), 11, "total finding count for the anchor fixtures");
});

test("--result-max-kb reports a result over the given trigger and stays quiet at the default", () => {
  const { report: atDefault } = runCheck(ANCHORS_ARGS);
  assert.strictEqual(
    findingCount(atDefault, "oversized-result"),
    0,
    "oversized-result count at the default threshold",
  );
  const { report } = runCheck(["--result-max-kb", "1", ANCHORS]);
  assert.strictEqual(
    findingCount(report, "oversized-result"),
    1,
    "oversized-result count at a lowered threshold",
  );
  assert.strictEqual(
    findingDetail(report, "oversized-result", "anchors/oversized-result"),
    "result.md is 1.6 KB, over the 1 KB compaction trigger",
    "oversized-result detail carries the actual size",
  );
  assert.strictEqual(
    findingDetail(report, "oversized-result", "anchors/Archive/archived-violations"),
    "",
    "an archived oversized result must stay silent even at a lowered threshold",
  );
});

test("the folder and record budgets fire only past their thresholds, and never under Archive/", () => {
  const { report: atDefaults } = runCheck(BUDGETS_ARGS);
  assert.strictEqual(findingCount(atDefaults), 0, "the budget fixtures raise nothing at the committed defaults");

  const { report } = runCheck(LOWERED_BUDGET_ARGS);
  assert.strictEqual(findingCount(report, "oversized-task"), 1, "oversized-task count at a lowered budget");
  assert.strictEqual(
    findingDetail(report, "oversized-task", "budgets/over-budget"),
    "folder holds 2.1 KB of .md excluding ticket.md, over the 1 KB folder budget",
    "oversized-task measures the non-ticket .md bytes, not everything the folder holds",
  );
  assert.strictEqual(findingCount(report, "oversized-record"), 1, "oversized-record count at a lowered budget");
  assert.strictEqual(
    findingDetail(report, "oversized-record", "budgets/over-budget"),
    'result.md section "Full Run — Padded record" is 1.5 KB, over the 1 KB record budget',
    "oversized-record names the offending section and its size",
  );
  for (const check of ["oversized-task", "oversized-record"]) {
    assert.strictEqual(
      findingDetail(report, check, "budgets/Archive/over-budget-archived"),
      "",
      `an archived twin stays silent for ${check} even at a lowered budget`,
    );
  }
  assert.strictEqual(
    findingDetail(report, "oversized-task", "budgets/legacy-ticket"),
    "",
    "a legacy *.ticket.md is left out of the folder measure like ticket.md",
  );
});

test("--installs reports each differing, missing, and extra path, per home and native agent format", () => {
  const { report, stderr } = runCheck(INSTALLS_ARGS);
  assert.strictEqual(stderr, "", "readable install fixtures must produce no warnings");
  assert.strictEqual(report.scanned, 5, "scanned count of marker-owned items");
  assert.strictEqual(findingCount(report, "install-drift"), 19, "install-drift finding count");
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/CORE_RULES.md"),
    "differs from kit source",
    "install-drift detail for an edited CORE_RULES.md",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/skills/kept-skill/SKILL.md"),
    "differs from kit source",
    "install-drift detail for an edited installed skill file",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/skills/kept-skill/dropped.md"),
    "missing in install",
    "install-drift detail for a kit file absent from the install",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/skills/kept-skill/extra.md"),
    "extra in install",
    "install-drift detail for an installed file absent from the kit",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/agents/kept-agent.md"),
    "differs from kit source",
    "install-drift detail for an edited Markdown agent definition",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".codex/agents/kept-agent.toml"),
    "differs from kit source",
    "install-drift detail for an edited TOML agent definition",
  );
});

test("an item without its ownership marker is not kit-managed and produces no findings", () => {
  const { report } = runCheck(INSTALLS_ARGS);
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/skills/user-skill/SKILL.md"),
    "",
    "an unmarked skill must not be compared",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/agents/user-agent.md"),
    "",
    "an unmarked agent file must not be compared",
  );
});

test("byte-identical files and matching symlinks are silent", () => {
  const { report } = runCheck(INSTALLS_ARGS);
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/references/sample.md"),
    "",
    "an identical reference file must not be reported",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/references/nested/deep.md"),
    "",
    "an identical nested reference file must not be reported",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/skills/kept-skill/AGENTS.md"),
    "",
    "a symlink with the same target on both sides must not be reported",
  );
});

test("OS artifacts are skipped by name, and a kit dotfile beside one stays comparable", () => {
  const { report } = runCheck(INSTALLS_ARGS);
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/references/.DS_Store"),
    "",
    "an OS artifact differing on both sides must not be reported",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/references/.keeprc"),
    "differs from kit source",
    "a non-artifact dotfile differing on both sides is still reported",
  );
});

test("never-deployed kit payloads are reported in every home setup.ts has partially installed", () => {
  const { report } = runCheck(INSTALLS_ARGS);
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/skills/never-deployed/SKILL.md"),
    "missing in install",
    "a kit skill that was never deployed is reported",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/agents/never-deployed.md"),
    "missing in install",
    "a kit agent that was never deployed is reported",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".codex/skills/never-deployed/SKILL.md"),
    "missing in install",
    "a partially installed home is reported missing a kit skill even without skill markers",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".codex/references/sample.md"),
    "missing in install",
    "a partially installed home is reported missing shared references",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".codex/CORE_RULES.md"),
    "missing in install",
    "a partially installed home is reported missing CORE_RULES.md",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/skills/user-skill/SKILL.md"),
    "",
    "a kit-named skill the home owns unmarked is present, so it is never reported missing",
  );
});

test("an unmarked shared payload is a conflict, not a clean home", () => {
  const { report } = runCheck(["--installs", KIT, CONFLICT_HOME]);
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/CORE_RULES.md"),
    "present but not kit-owned — every kit skill resolves into it; move it aside and rerun setup.ts",
    "an unmarked CORE_RULES.md is reported rather than treated as the user's business",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/references"),
    "present but not kit-owned — every kit skill resolves into it; move it aside and rerun setup.ts",
    "an unmarked references/ is reported the same way",
  );
});

test("an unreadable ownership marker is a coverage gap, not proof the item is the user's", (t: TestContext) => {
  if (isReadable(LOCKED_SKILL)) {
    t.skip("the unreadable-marker case needs a user that chmod 000 actually stops");
    return;
  }
  const { report } = runCheck(["--installs", KIT, LOCKED_SKILL_HOME]);
  assert.strictEqual(
    report.scanned,
    1,
    "a skill whose marker cannot be read still counts as an item compared",
  );
  assert.ok(
    report.unreadable > 0,
    "an unreadable ownership marker must reach the contract, not be read as user-owned",
  );
  assert.ok(
    report.unreadablePaths.includes(join(LOCKED_SKILL, MARKER)),
    `unreadablePaths must name the marker that could not be stat'd (got ${JSON.stringify(report.unreadablePaths)})`,
  );
});

test("a leftover staging dir is an interrupted install, not drift to reconcile", () => {
  const { report } = runCheck(["--installs", KIT, STAGING_HOME]);
  assert.strictEqual(report.scanned, 0, "a leftover staging dir is not counted as an installed item");
  assert.strictEqual(
    findingCount(report, "install-drift"),
    1,
    "a home holding only a staging dir reports the never-installed line, not one finding per file",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude"),
    "no kit markers — never installed",
    "an interrupted first install is one fact about the home",
  );
});

test("the two sides disagreeing on link-ness is reported rather than compared through the link", () => {
  const { report } = runCheck(["--installs", KIT, MATERIALIZED_HOME]);
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/skills/kept-skill/AGENTS.md"),
    "symlink replaced by a copy",
    "a kit symlink materialized into a regular copy is drift, not a copy-mode difference",
  );
});

test("one surviving kit marker proves setup.ts ran, so absent payload categories are drift", () => {
  const { report } = runCheck(["--installs", KIT, PARTIAL_HOME]);
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/skills/never-deployed/SKILL.md"),
    "missing in install",
    "a core-only partial install is reported missing skills",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/references/sample.md"),
    "missing in install",
    "a core-only partial install is reported missing references",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude/agents/never-deployed.md"),
    "missing in install",
    "a core-only partial install is reported missing native agents",
  );
});

test("a home setup.ts never installed into is reported once rather than flooding", () => {
  const { report } = runCheck(["--installs", KIT, FRESH_HOME]);
  assert.strictEqual(
    findingCount(report, "install-drift"),
    1,
    "finding count for a never-installed home",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude"),
    "no kit markers — never installed",
    "a home with no markers reports one line, not one per kit file",
  );
  assert.strictEqual(report.scanned, 0, "scanned count for a never-installed home");
});

test("the conflict that blocks a never-installed home rides on its one line", () => {
  const { report } = runCheck(["--installs", KIT, BLOCKED_FRESH_HOME]);
  assert.strictEqual(
    findingCount(report, "install-drift"),
    1,
    "a never-installed home blocked by its own shared payload is still one finding",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude"),
    "no kit markers — never installed; CORE_RULES.md present but not kit-owned — move aside and rerun setup.ts",
    "the one line names the payload blocking the install",
  );
  assert.strictEqual(report.scanned, 0, "a blocked never-installed home compares nothing");
});

test("a missing install home reports the documented uninstalled state", () => {
  const { report } = runCheck(["--installs", KIT, ABSENT_HOME]);
  assert.strictEqual(
    findingCount(report, "install-drift"),
    1,
    "finding count for an absent install home",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude"),
    "no kit markers — never installed",
    "an absent install home is classified as uninstalled",
  );
  assert.strictEqual(report.unreadable, 0, "an absent install home is not an unreadable coverage gap");
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
    report.scanned,
    VOLUME_TASKS,
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

test("a slug in two roots reports once per colliding folder, not once per collision", () => {
  const { report } = runCheck(DUP_ARGS);
  assert.strictEqual(findingCount(report, "duplicate-slug"), 6, "duplicate-slug finding count");
});

test("each side of a collision is actionable from its own finding", () => {
  const { report } = runCheck(DUP_ARGS);
  assert.strictEqual(
    findingDetail(report, "duplicate-slug", "dup-a/add-csv-export"),
    `slug "add-csv-export" also at ${join(DUP_B, "add-csv-export")}`,
    "active/active collision detail names the peer by absolute path",
  );
  assert.strictEqual(
    findingDetail(report, "duplicate-slug", "dup-b/add-csv-export"),
    `slug "add-csv-export" also at ${join(DUP_A, "add-csv-export")}`,
    "the peer's own finding names it back",
  );
});

test("duplicate-slug sees archived folders, because a bare slug still falls back into Archive/", () => {
  const { report } = runCheck(DUP_ARGS);
  assert.strictEqual(
    findingDetail(report, "duplicate-slug", "dup-a/only-here"),
    `slug "only-here" also at ${join(DUP_B, "Archive", "only-here")} (archived)`,
    "an archived peer is reported and labelled archived",
  );
  assert.strictEqual(
    findingDetail(report, "duplicate-slug", "dup-b/Archive/only-here"),
    `slug "only-here" (archived) also at ${join(DUP_A, "only-here")}`,
    "the archived folder gets its own finding despite the archive exemption",
  );
});

test("duplicate-slug sees backlogged folders, because a bare slug still falls back into Backlog/", () => {
  const { report } = runCheck(DUP_ARGS);
  assert.strictEqual(
    findingDetail(report, "duplicate-slug", "dup-a/parked-too"),
    `slug "parked-too" also at ${join(DUP_B, "Backlog", "parked-too")} (backlogged)`,
    "a backlogged peer is reported and labelled backlogged",
  );
  assert.strictEqual(
    findingDetail(report, "duplicate-slug", "dup-b/Backlog/parked-too"),
    `slug "parked-too" (backlogged) also at ${join(DUP_A, "parked-too")}`,
    "the backlogged folder gets its own finding despite the stale exemption",
  );
});

test("a globally unique slug stays silent", () => {
  const { report } = runCheck(DUP_ARGS);
  assert.strictEqual(
    findingDetail(report, "duplicate-slug", "dup-a/unique-a"),
    "",
    "a slug unique to its root is not reported",
  );
  assert.strictEqual(
    findingDetail(report, "duplicate-slug", "dup-b/unique-b"),
    "",
    "a slug unique to the other root is not reported",
  );
});

test("a root whose slugs are all distinct stays silent, with no cross-root state leaking in", () => {
  const { report } = runCheck([DUP_A]);
  assert.strictEqual(
    findingCount(report, "duplicate-slug"),
    0,
    "single-root run reports no duplicate-slug",
  );
});

test("two area directories of one root collide — uniqueness is global, not per-parent", () => {
  const { report } = runCheck([DUP_C]);
  assert.strictEqual(
    findingCount(report, "duplicate-slug"),
    2,
    "nested same-root collision finding count",
  );
  assert.strictEqual(
    findingDetail(report, "duplicate-slug", "dup-c/area-a/nested-dup"),
    `slug "nested-dup" also at ${join(DUP_C, "area-b", "nested-dup")}`,
    "a within-root collision names its peer",
  );
});

test("an overlapping root argument is skipped rather than reported as a folder colliding with itself", () => {
  const { report: repeated } = runCheck([DUP_C, DUP_C]);
  assert.strictEqual(repeated.scanned, 2, "a repeated root is walked once");
  assert.strictEqual(
    findingCount(repeated, "duplicate-slug"),
    2,
    "a repeated root does not double the collision findings",
  );

  const { report } = runCheck([DUP_C, join(DUP_C, "area-a")]);
  assert.strictEqual(report.scanned, 2, "a root nested inside one already walked is skipped");
  assert.strictEqual(
    findingCount(report, "duplicate-slug"),
    2,
    "an overlapping root adds no self-collision",
  );
});

test("overlap detection is order-independent", () => {
  const { report } = runCheck([join(DUP_C, "area-a"), DUP_C]);
  assert.strictEqual(report.scanned, 2, "a root containing one already walked is skipped too");
  assert.strictEqual(
    findingCount(report, "duplicate-slug"),
    2,
    "argument order does not decide whether the overlap is caught",
  );
});

test("two case-spellings of one root are one root", (t: TestContext) => {
  if (!isDirectory(CASE_PROBE_RESPELLED)) {
    t.skip("the root case-collision case needs a case-insensitive volume");
    return;
  }
  const { report } = runCheck([DUP_C, DUP_C_RESPELLED]);
  assert.strictEqual(report.scanned, 2, "a root respelled in another case is walked once");
  assert.strictEqual(
    findingCount(report, "duplicate-slug"),
    2,
    "a case-respelled root adds no self-collision",
  );
  assert.strictEqual(report.unreadable, 0, "both spellings resolve, so neither is a coverage gap");
});

test("a rejected flag value re-enters the roots only when it names something on disk", () => {
  const { report: afterValuelessFlag } = runCheck(["--stale-days", STORE]);
  assert.strictEqual(afterValuelessFlag.scanned, 13, "a root spelled after a valueless flag is still walked");
  assert.strictEqual(
    afterValuelessFlag.unreadable,
    0,
    "the root a valueless flag would have swallowed is not a coverage gap",
  );

  const { report: afterJunkValue } = runCheck(["--stale-days", "20KB", STORE]);
  assert.strictEqual(afterJunkValue.scanned, 13, "a malformed flag value leaves the roots after it alone");
  assert.strictEqual(
    afterJunkValue.unreadable,
    0,
    "a malformed flag value is not reported as store the sweep did not see",
  );

  for (const flag of ["--result-max-kb", "--task-max-kb", "--record-max-kb"]) {
    const { report: afterEmptyValue } = runCheck([flag, "", STORE]);
    assert.strictEqual(
      afterEmptyValue.scanned,
      13,
      `an empty ${flag} value does not add the process directory as a root`,
    );
    assert.strictEqual(afterEmptyValue.unreadable, 0, `an empty ${flag} value is not a coverage gap`);
  }
});

test("a value that can never be a value is never consumed", () => {
  const { report } = runCheck(["--stale-days", "--installs", KIT, FRESH_HOME]);
  assert.strictEqual(
    findingCount(report, "install-drift"),
    1,
    "a flag spelled where a flag value belongs still reaches the argument walk",
  );
  assert.strictEqual(
    findingDetail(report, "install-drift", ".claude"),
    "no kit markers — never installed",
    "the install probe runs as asked rather than degrading to a task walk",
  );
});

test("a missing root argument still emits parseable JSON and warns on stderr", () => {
  const { report, stderr } = runCheck([]);
  assert.strictEqual(findingCount(report), 0, "finding count with no root given");
  assert.strictEqual(report.scanned, 0, "scanned count with no root given");
  assert.ok(stderr.length > 0, "a missing root argument must warn on stderr");
});
