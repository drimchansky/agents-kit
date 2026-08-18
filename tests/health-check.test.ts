// Covers scripts/health-check.ts: the task-lifecycle walk and the --installs deploy-drift check.
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

// Ownership markers written by setup.ts, and the staging prefix it marks a half-copied skill with.
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
const INSTALLS_ARGS: readonly string[] = ["--installs", KIT, CLAUDE_HOME, CODEX_HOME];
const DUP_ARGS: readonly string[] = [DUP_A, DUP_B];
const VOLUME_ARGS: readonly string[] = [VOLUME_STORE];

const TO_DO_PLAN = "# t\n\n**Status:** to-do\n";
const VOLUME_PLAN =
  "# t\n\n**Status:** executing\n\n## Step 1 — do\n\n- [x] d ([result](./result.md#absent))\n";
const VOLUME_RESULT = "# r\n\n**Status:** executing\n\n## Current state\n\n_Updated:_ 2026-01-01\n";

// A committed fixture cannot carry an old mtime, so each folder's age is stamped at run time.
const FIXTURE_AGE_DAYS: readonly (readonly [string, number])[] = [
  [join(STORE, "stale-executing"), 62],
  [join(STORE, "fresh-executing"), 2],
  // Past the 30-day default on purpose: the only thing keeping it out of `stale` is then the
  // terminal-status exclusion, so a `done` leaking into LIVE_STATUSES fails the counts below.
  [join(STORE, "done-unarchived"), 70],
  [join(STORE, "no-status-plan"), 70],
  [join(STORE, "unknown-status"), 70],
  [join(STORE, "Archive", "done-archived"), 400],
  // This root exercises the durability checks, so every folder stays fresh and the age check is quiet.
  [ANCHORS, 1],
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

// The exit status is always 0 — a partly unreadable store still has to parse — so every run asserts
// it, and stdout has to be exactly one JSON object rather than a report with a warning printed into it.
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

// Unless path resolution is skipped, cpSync rewrites each relative symlink target to an absolute
// path under the tree it was copied from. The kit's `AGENTS.md` and `references` links would then
// resolve back into the committed fixtures rather than into each copy, and — since each side is
// rewritten against its own source — the two sides would no longer hold equal targets, reporting
// drift for the symlink pair the install checks require to be silent.
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

// The long folder names get the payload past the 64 KB pipe buffer in a few hundred findings rather
// than a few thousand: each folder's checked step links an anchor its result file does not hold.
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
  // A home's own directory name selects the agent format setup.ts installs, so each lands under its
  // host name. Finder droppings would read as real drift, so only the committed states remain.
  copyFixture(join(FIXTURES, "installs", "claude-home"), CLAUDE_HOME);
  copyFixture(join(FIXTURES, "installs", "codex-home"), CODEX_HOME);
  deleteFinderDroppings(INSTALLS);

  // .DS_Store is gitignored, so the OS-artifact pair is written here rather than committed: differing
  // on both sides, which is the state setup.ts's recursive copy plus a later Finder visit produces.
  // The dotfile beside it differs the same way and must still be reported — the check skips OS
  // artifacts by name, and a rule that skipped every dotted name would drop real kit content.
  writeFileSync(join(KIT, "references", ".DS_Store"), "kit-side finder state\n");
  writeFileSync(join(CLAUDE_HOME, "references", ".DS_Store"), "install-side finder state\n");
  writeFileSync(join(KIT, "references", ".keeprc"), "kit\n");
  writeFileSync(join(CLAUDE_HOME, "references", ".keeprc"), "install\n");

  // A skill and an agent added to the kit but never deployed. Neither carries a marker anywhere, so
  // only the kit-side pass can see them — and it must stay off the categories a home doesn't take,
  // which is why the agents-only codex home reports nothing for either.
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
  // This side must end up a regular file holding the link's bytes, not a link of its own: link-ness
  // is the only difference the case below has left to detect.
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
  // Fixtures are copied so the ages and the chmod locks below land outside the repository.
  copyFixture(join(FIXTURES, "store"), STORE);
  copyFixture(join(FIXTURES, "anchors"), ANCHORS);
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

  // duplicate-slug spans roots and is the only check that sees archived folders, so it needs a
  // two-root fixture: one active/active collision, one active/archived, and a slug unique to each
  // root that must stay silent. Peers are named by absolute directory — a compact display path is
  // prefixed by its root's basename alone, which two roots can share.
  writeTaskFolder(join(DUP_A, "add-csv-export"));
  writeTaskFolder(join(DUP_B, "add-csv-export"));
  writeTaskFolder(join(DUP_A, "only-here"));
  writeTaskFolder(join(DUP_B, "Archive", "only-here"));
  writeTaskFolder(join(DUP_A, "unique-a"));
  writeTaskFolder(join(DUP_B, "unique-b"));
  writeTaskFolder(join(DUP_C, "area-a", "nested-dup"));
  writeTaskFolder(join(DUP_C, "area-b", "nested-dup"));

  mkdirSync(CASE_PROBE);
  writeVolumeStore(VOLUME_STORE);
});

after(() => {
  // A directory left at mode 000 cannot be listed, so the recursive remove below would fail on it
  // while the unreadable-directory and unreadable-marker locks are still in place.
  chmodSync(LOCKED_TASK_DIR, 0o755);
  chmodSync(LOCKED_SKILL, 0o755);
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

test("a readable store scans without warnings and exits 0", () => {
  const { stderr } = runCheck(STORE_ARGS);
  assert.strictEqual(stderr, "", "a readable fixture store must produce no warnings");
});

test("scanned counts every task folder, archived ones included", () => {
  const { report } = runCheck(STORE_ARGS);
  assert.strictEqual(report.scanned, 6, "scanned task count");
  assert.strictEqual(report.unreadable, 0, "a readable store reports nothing unread");
});

// A value outside the vocabulary is not a lifecycle state, so the stale and archive checks both skip
// it. Silence there would hide the task permanently — the folder needs a check of its own instead.
test("a status outside the vocabulary is reported rather than silently exempted", () => {
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

// A plan file with no parseable `**Status:**` is a different fact from a folder holding no plan,
// so the detail must name it rather than rendering the absent value.
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
  assert.strictEqual(findingCount(report, "done-unarchived"), 1, "done-unarchived finding count");
  assert.strictEqual(
    findingDetail(report, "done-unarchived", "store/done-unarchived"),
    "done, outside Archive/",
    "done-unarchived detail for store/done-unarchived",
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
  assert.strictEqual(findingCount(report), 4, "total finding count");
});

// Findings alone would read clean over a task the run never opened, so incomplete coverage has to be
// a fact in the contract rather than a line on stderr the caller is never told to look at.
test("an unreadable task file reaches the contract, not only stderr", (t: TestContext) => {
  if (isReadable(UNREADABLE_FILE)) {
    t.skip("the unreadable-file case needs a user that chmod 000 actually stops");
    return;
  }
  const { report } = runCheck([UNREADABLE_STORE]);
  assert.strictEqual(report.unreadable, 1, "a task file that cannot be read is counted");
  // The field is the caller's coverage list, and it holds the absolute path rather than the
  // basename-prefixed display shape a finding's `path` carries: findings are attributed by their
  // absolute `root`, so a gap has to be attributable the same way once two roots share a basename.
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

// A directory the walk cannot list hides every task beneath it, so it belongs in the contract — once.
// The listing that classifies a folder is the one the recursion reuses; listing it a second time
// would report a single gap twice and inflate the count the caller reads as coverage.
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

// A root argument that exists but is not a directory contributed nothing to the walk. Reported only
// on stderr it would read as a clean root, since the caller treats `scanned` as a floor solely while
// `unreadable` is non-zero — the same failure `unreadablePaths` was added to close.
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
    1,
    "done-unarchived count is independent of --stale-days",
  );
});

test("a directory's name no longer decides whether the task inside it exists", () => {
  const { report } = runCheck([NAMED_SCRIPTS]);
  assert.strictEqual(report.scanned, 1, "a task folder named scripts is scanned like any other");
});

// `.agents` is the one dotted directory the walk enters: the canonical root sits inside it, so
// pruning it by the general dotted rule cost a registered project root every task it holds —
// silently, since an unwalked root and an empty one report identically.
test("the canonical root is found from a project root, while every other dotted name stays pruned", () => {
  const { report } = runCheck([PROJECT_ROOT]);
  assert.strictEqual(report.scanned, 1, "a project root reaches the tasks under its .agents/tasks");
});

test("findings from same-basename roots remain unambiguous through the root field", () => {
  const { report } = runCheck([STORE, SECOND_ROOT]);
  assert.strictEqual(report.scanned, 7, "scanned count across two roots");
  assert.strictEqual(
    findingCount(report, "done-unarchived"),
    2,
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

// CommonMark accepts `-`, `*` and `+` as list markers, so a goals file written with asterisks is a
// goals file: the ID lint has to see those bullets rather than skipping them into silence.
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

// A heading inside a fenced block is illustrative markdown, not the section — the same rule the
// anchor scan already applies, so the liveness check must not be satisfied by an example.
test("a ## Current state heading inside a code fence does not satisfy the liveness check", () => {
  const { report } = runCheck(ANCHORS_ARGS);
  assert.strictEqual(
    findingDetail(report, "no-current-state", "anchors/fenced-current-state"),
    'executing result.md has no "## Current state" block',
    "no-current-state detail for a result whose only block sits in a fence",
  );
});

// A boolean fence flag inverts on the inner opener of a nested block, handing the scan back the
// illustrative heading it was meant to skip. Closing a fence takes the opener's own marker and length.
test("a three-backtick example inside a four-backtick fence does not toggle scanning back on", () => {
  const { report } = runCheck(ANCHORS_ARGS);
  assert.strictEqual(
    findingDetail(report, "no-current-state", "anchors/nested-fence"),
    'executing result.md has no "## Current state" block',
    "no-current-state detail for a result whose only block sits in a nested fence",
  );
});

// The status scan reads the same file as the anchor and liveness scans, so it owes them the same rule:
// doc-task-files.md puts the status header outside fenced or quoted content.
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

// Every installed skill resolves ./AGENTS.md and ./references into the two install-root shared
// payloads, so an unmarked one is not a private file the way an unmarked skill is — it is what all of
// them load, and setup.ts refuses the whole home over it.
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

// An ownership marker the run cannot stat is not evidence the item is the user's: read as unowned it
// drops a kit-managed skill from the comparison while `unreadable` stays zero, reporting a deploy as
// clean over an item nothing compared.
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

// setup.ts marks a staging dir before it finishes copying into it, so an interrupted install leaves
// one behind: comparing it reports phantom paths the next setup.ts run deletes on its own, and its
// item count suppresses the single never-installed line a first interrupted install should get.
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

// skills/ is copied link-preserving so each skill's AGENTS.md and references resolve to the
// install-root originals. A copy that materialized them holds identical bytes, so only the link-ness
// difference itself shows the loss — ~1,500 duplicated files per home otherwise reporting clean.
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

// The unmarked shared payload is why setup.ts refuses this home, so it rides on the never-installed
// line instead of stacking a second finding beside it: two lines would break the one-fact-per-home
// rendering the caller keys on, and dropping it would leave the refusal with no reason attached.
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

// Every case above reads stdout through spawnSync's own drained pipe or a file, so none of them can
// see a report truncated at the pipe buffer. This one reads through a real pipe.
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
  // The reader's read end is the subject's only one, and it closes while a report this far over the
  // pipe buffer still has bytes to write — point this at a store the reader can drain and the
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

test("a slug in two roots reports once per colliding folder, not once per collision", () => {
  const { report } = runCheck(DUP_ARGS);
  assert.strictEqual(findingCount(report, "duplicate-slug"), 4, "duplicate-slug finding count");
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

// Uniqueness is global, not per-parent: the walk is recursive, so one root can hold the same slug
// under two area directories (references/workflow/task-store.md § The root registry).
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

// Containment is tested one way only by the case above: the guard asks whether a root sits inside
// one already walked, so passing the inner root first would leave the outer one to walk it again.
test("overlap detection is order-independent", () => {
  const { report } = runCheck([join(DUP_C, "area-a"), DUP_C]);
  assert.strictEqual(report.scanned, 2, "a root containing one already walked is skipped too");
  assert.strictEqual(
    findingCount(report, "duplicate-slug"),
    2,
    "argument order does not decide whether the overlap is caught",
  );
});

// canonicalRoot resolves with realpathSync.native, which returns the spelling the filesystem holds;
// the JS implementation returns the caller's own, so two case-spellings of one root canonicalize
// differently and the containment guard above misses — both are walked, `scanned` doubles, and every
// folder reports itself as its own collision peer. The divergence exists only on a case-insensitive
// volume, so the case is probed for rather than assumed, like the chmod cases above.
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

// parseArgs peeks a flag's separate value and consumes it only once it validates, so a root spelled
// after a dateless flag is not swallowed. The other half of that trade: a rejected value re-enters
// the roots only when it names something on disk, or a typo would report as store the sweep did not
// see — the twin of the shape test tests/session-triage.test.ts runs.
test("a rejected flag value re-enters the roots only when it names something on disk", () => {
  const { report: afterValuelessFlag } = runCheck(["--stale-days", STORE]);
  assert.strictEqual(afterValuelessFlag.scanned, 6, "a root spelled after a valueless flag is still walked");
  assert.strictEqual(
    afterValuelessFlag.unreadable,
    0,
    "the root a valueless flag would have swallowed is not a coverage gap",
  );

  const { report: afterJunkValue } = runCheck(["--stale-days", "20KB", STORE]);
  assert.strictEqual(afterJunkValue.scanned, 6, "a malformed flag value leaves the roots after it alone");
  assert.strictEqual(
    afterJunkValue.unreadable,
    0,
    "a malformed flag value is not reported as store the sweep did not see",
  );

  // `resolve("")` is the process directory, so an empty value re-entering the roots would walk the
  // caller's own checkout as a task store.
  const { report: afterEmptyValue } = runCheck(["--result-max-kb", "", STORE]);
  assert.strictEqual(
    afterEmptyValue.scanned,
    6,
    "an empty flag value does not add the process directory as a root",
  );
  assert.strictEqual(afterEmptyValue.unreadable, 0, "an empty flag value is not a coverage gap");
});

// A `-`-prefixed argument is the one value neither numeric flag can ever take, and it can never
// become a root either — the option, `--`, and unknown-option branches all intercept it first. So
// consuming one only ever loses a flag: swallowing `--installs` turns the install comparison into a
// task walk over the kit and the home, with nothing in the JSON to say the probe never ran.
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
