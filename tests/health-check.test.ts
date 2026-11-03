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
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { after, before, describe, test, type TestContext } from "node:test";
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
const AGENT_MARKER_PREFIX = ".agents-kit-";
const STAGING_PREFIX = ".agents-kit-staging.";
const RULE_FILE = join("rules", "agents-kit-core-rules.md");
const RULE_MARKER = join("rules", CORE_RULES_MARKER);
const HOOK_EVENT = "SubagentStart";
const KIT_HOOK_COMMAND =
  `node -e 'const p=require("path").join(require("os").homedir(),".claude","rules","agents-kit-core-rules.md");` +
  `process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"SubagentStart",additionalContext:require("fs").readFileSync(p,"utf8")}}))'`;
const USER_RULE_READER = "cat ~/.claude/rules/agents-kit-core-rules.md";
const BLOCK_START = "<!-- agents-kit:core-rules:start -->";
const BLOCK_END = "<!-- agents-kit:core-rules:end -->";
const USER_CODEX_LINE = "Prefer short answers.\n";
const TEST_ROOT = mkdtempSync(join(tmpdir(), "agents-kit-health-check-"));
const STORE = join(TEST_ROOT, "store");
const UNREADABLE_STORE = join(TEST_ROOT, "unreadable-store");
const UNREADABLE_FILE = join(UNREADABLE_STORE, "locked-task", "plan.md");
const LOCKED_TREE = join(TEST_ROOT, "unreadable-tree");
const LOCKED_TASK_DIR = join(LOCKED_TREE, "area", "locked-task");
const LOCKED_SIBLING_DIR = join(LOCKED_TREE, "area", "citing-task");
const LOCKED_OUTSIDE_DIR = join(TEST_ROOT, "outside-locked");
const NOT_A_DIR = join(TEST_ROOT, "not-a-dir.md");
const NAMED_SCRIPTS = join(TEST_ROOT, "named-scripts");
const PROJECT_ROOT = join(TEST_ROOT, "project-root");
const SECOND_ROOT = join(TEST_ROOT, "second", "store");
const ANCHORS = join(TEST_ROOT, "anchors");
const BUDGETS = join(TEST_ROOT, "budgets");
const CITATIONS = join(TEST_ROOT, "citations");
const CITATIONS_SECOND = join(TEST_ROOT, "citations-second");
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
const DELIVERY = join(INSTALLS, "delivery");
const CLEAN_CLAUDE_HOME = join(DELIVERY, "clean", ".claude");
const CLEAN_CODEX_HOME = join(DELIVERY, "clean", ".codex");
const RULE_MISSING_HOME = join(DELIVERY, "rule-missing", ".claude");
const RULE_DIFFERS_HOME = join(DELIVERY, "rule-differs", ".claude");
const RULE_UNMARKED_HOME = join(DELIVERY, "rule-unmarked", ".claude");
const RULE_SYMLINK_HOME = join(DELIVERY, "rule-symlink", ".claude");
const RULE_DIRECTORY_HOME = join(DELIVERY, "rule-directory", ".claude");
const RULE_DIRECTORY_LINK_HOME = join(DELIVERY, "rule-directory-link", ".claude");
const HOOK_MISSING_HOME = join(DELIVERY, "hook-missing", ".claude");
const SETTINGS_MISSING_HOME = join(DELIVERY, "settings-missing", ".claude");
const HOOK_DIFFERS_HOME = join(DELIVERY, "hook-differs", ".claude");
const HOOK_DOUBLED_HOME = join(DELIVERY, "hook-doubled", ".claude");
const SETTINGS_INVALID_HOME = join(DELIVERY, "settings-invalid", ".claude");
const SETTINGS_NONLIST_HOME = join(DELIVERY, "settings-nonlist", ".claude");
const SETTINGS_DANGLING_HOME = join(DELIVERY, "settings-dangling", ".claude");
const RULES_DANGLING_HOME = join(DELIVERY, "rules-dangling", ".claude");
const RULES_FILE_HOME = join(DELIVERY, "rules-file", ".claude");
const RULES_FILE_LINK_HOME = join(DELIVERY, "rules-file-link", ".claude");
const SETTINGS_DIRECTORY_HOME = join(DELIVERY, "settings-directory", ".claude");
const BLOCK_MISSING_HOME = join(DELIVERY, "block-missing", ".codex");
const BLOCK_DIFFERS_HOME = join(DELIVERY, "block-differs", ".codex");
const BLOCK_UNMATCHED_HOME = join(DELIVERY, "block-unmatched", ".codex");
const BLOCK_REVERSED_HOME = join(DELIVERY, "block-reversed", ".codex");
const AGENTS_DANGLING_HOME = join(DELIVERY, "agents-dangling", ".codex");
const AGENTS_DIRECTORY_HOME = join(DELIVERY, "agents-directory", ".codex");
const OVERRIDE_HOME = join(DELIVERY, "override", ".codex");
const LOCKED_OVERRIDE_HOME = join(DELIVERY, "locked-override", ".codex");
const EMPTY_OVERRIDE_HOME = join(DELIVERY, "empty-override", ".codex");
const BLANK_OVERRIDE_HOME = join(DELIVERY, "blank-override", ".codex");
const VOLUME_STORE = join(TEST_ROOT, "big-report");
const VOLUME_REPORT = join(TEST_ROOT, "big-report.json");
const GROUPS = join(TEST_ROOT, "groups");
const GROUPS_LEAVES = join(GROUPS, "product", "backend", "empty");
const GROUPS_ARCHIVE = join(GROUPS_LEAVES, "Archive");
const GROUPS_BACKLOG = join(GROUPS_LEAVES, "Backlog");
const GROUPS_DEEP_BACKLOG = join(TEST_ROOT, "groups-deep-backlog");
const GROUPS_DEEP_BACKLOG_CONTAINER = join(GROUPS_DEEP_BACKLOG, "Backlog");
const GROUPS_DUP = join(TEST_ROOT, "groups-dup");
const NEAR_MISS = join(TEST_ROOT, "groups-near-miss");
const ARCHIVED_NEAR_MISS = join(TEST_ROOT, "groups-archived-near-miss");
const ARCHIVED_NEAR_MISS_CLAIM = join(ARCHIVED_NEAR_MISS, "Archive", "product");
const DUP_A = join(TEST_ROOT, "dup-a");
const DUP_B = join(TEST_ROOT, "dup-b");
const DUP_C = join(TEST_ROOT, "dup-c");
const DUP_C_RESPELLED = join(TEST_ROOT, "DUP-C");
const CASE_PROBE = join(TEST_ROOT, "case-probe");
const CASE_PROBE_RESPELLED = join(TEST_ROOT, "CASE-PROBE");
const STORE_ARGS: readonly string[] = [STORE];
const ANCHORS_ARGS: readonly string[] = [ANCHORS];
const BUDGETS_ARGS: readonly string[] = [BUDGETS];
const CITATIONS_ARGS: readonly string[] = [CITATIONS];
const CROSS_ROOT_ARGS: readonly string[] = [CITATIONS, CITATIONS_SECOND];
const LOWERED_BUDGET_ARGS: readonly string[] = ["--task-max-kb", "1", "--record-max-kb", "1", BUDGETS];
const LEGACY_CONTEXT_ARGS: readonly string[] = [LEGACY_CONTEXT];
const INSTALLS_ARGS: readonly string[] = ["--installs", KIT, CLAUDE_HOME, CODEX_HOME];
const DUP_ARGS: readonly string[] = [DUP_A, DUP_B];
const VOLUME_ARGS: readonly string[] = [VOLUME_STORE];
const GROUPS_ARGS: readonly string[] = [GROUPS];
const NEAR_MISS_ARGS: readonly string[] = [NEAR_MISS];
const ARCHIVED_NEAR_MISS_ARGS: readonly string[] = [ARCHIVED_NEAR_MISS];
const TO_DO_PLAN = "# t\n\n**Status:** to-do\n";
const DONE_PLAN = "# t\n\n**Status:** done\n";
const EXECUTING_PLAN = "# t\n\n**Status:** executing\n";
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
  const report: Report = JSON.parse(run.stdout, (_key, value) =>
    typeof value === "object" && value !== null ? Object.freeze(value) : value,
  );
  return Object.freeze({ report, stderr: run.stderr });
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

function writeTaskFolder(dir: string, plan: string = TO_DO_PLAN): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "plan.md"), plan);
}

function writeGroupFile(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "GROUP_CONTEXT.md"), "# group\n\nShared grounding for the tasks below it.\n");
}

function writeMisfiledGroupFile(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "CONTEXT.md"),
    "# product\n\nGrounding misfiled one prefix away from GROUP_CONTEXT.md.\n",
  );
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

function hookEntry(command: string, matcher = "^(Explore|Plan)$"): object {
  return { matcher, hooks: [{ type: "command", command }] };
}

function writeSettings(home: string, subagentStart: readonly object[]): void {
  const settings = {
    model: "fixture",
    hooks: {
      Stop: [hookEntry("echo user-stop", "")],
      [HOOK_EVENT]: subagentStart,
    },
  };
  writeFileSync(join(home, "settings.json"), `${JSON.stringify(settings, null, 2)}\n`);
}

function kitBlock(): string {
  return `${BLOCK_START}\n${readFileSync(join(KIT, "CORE_RULES.md"), "utf8")}${BLOCK_END}`;
}

function writeCleanHome(home: string): void {
  const extension = basename(home) === ".claude" ? "md" : "toml";
  mkdirSync(join(home, "skills"), { recursive: true });
  for (const name of readdirSync(join(KIT, "skills"))) {
    copyFixture(join(KIT, "skills", name), join(home, "skills", name));
    writeFileSync(join(home, "skills", name, MARKER), "");
  }
  copyFixture(join(KIT, "references"), join(home, "references"));
  writeFileSync(join(home, "references", MARKER), "");
  copyFileSync(join(KIT, "CORE_RULES.md"), join(home, "CORE_RULES.md"));
  writeFileSync(join(home, CORE_RULES_MARKER), "");
  mkdirSync(join(home, "agents"));
  for (const file of readdirSync(join(KIT, "agents")).filter((name) => name.endsWith(`.${extension}`))) {
    copyFileSync(join(KIT, "agents", file), join(home, "agents", file));
    writeFileSync(join(home, "agents", `${AGENT_MARKER_PREFIX}${basename(file, `.${extension}`)}`), "");
  }
  if (extension === "md") {
    mkdirSync(join(home, "rules"));
    writeFileSync(join(home, RULE_MARKER), "");
    copyFileSync(join(KIT, "CORE_RULES.md"), join(home, RULE_FILE));
    writeSettings(home, [
      hookEntry("echo user-subagent", "general-purpose"),
      { hooks: [{ command: KIT_HOOK_COMMAND, type: "command" }], matcher: "^(Explore|Plan)$" },
    ]);
  } else {
    writeFileSync(join(home, "AGENTS.md"), `${USER_CODEX_LINE}\n${kitBlock()}\n`);
  }
}

function writeDeliveryFixtures(): void {
  for (const home of [
    CLEAN_CLAUDE_HOME,
    RULE_MISSING_HOME,
    RULE_DIFFERS_HOME,
    RULE_UNMARKED_HOME,
    RULE_SYMLINK_HOME,
    RULE_DIRECTORY_HOME,
    RULE_DIRECTORY_LINK_HOME,
    HOOK_MISSING_HOME,
    SETTINGS_MISSING_HOME,
    HOOK_DIFFERS_HOME,
    HOOK_DOUBLED_HOME,
    SETTINGS_INVALID_HOME,
    SETTINGS_NONLIST_HOME,
    SETTINGS_DANGLING_HOME,
    RULES_DANGLING_HOME,
    RULES_FILE_HOME,
    RULES_FILE_LINK_HOME,
    SETTINGS_DIRECTORY_HOME,
    CLEAN_CODEX_HOME,
    BLOCK_MISSING_HOME,
    BLOCK_DIFFERS_HOME,
    BLOCK_UNMATCHED_HOME,
    BLOCK_REVERSED_HOME,
    AGENTS_DANGLING_HOME,
    AGENTS_DIRECTORY_HOME,
    OVERRIDE_HOME,
    LOCKED_OVERRIDE_HOME,
    EMPTY_OVERRIDE_HOME,
    BLANK_OVERRIDE_HOME,
  ]) {
    writeCleanHome(home);
  }

  rmSync(join(RULE_MISSING_HOME, "rules"), { recursive: true });
  writeFileSync(join(RULE_DIFFERS_HOME, RULE_FILE), "stale core rules\n");
  rmSync(join(RULE_UNMARKED_HOME, RULE_MARKER));
  writeFileSync(join(RULE_UNMARKED_HOME, RULE_FILE), "MY OWN RULES\n");
  rmSync(join(RULE_SYMLINK_HOME, RULE_FILE));
  writeFileSync(join(RULE_SYMLINK_HOME, "user-rules.md"), "MY OWN RULES\n");
  symlinkSync(join(RULE_SYMLINK_HOME, "user-rules.md"), join(RULE_SYMLINK_HOME, RULE_FILE));
  rmSync(join(RULE_DIRECTORY_HOME, RULE_FILE));
  mkdirSync(join(RULE_DIRECTORY_HOME, RULE_FILE));
  rmSync(join(RULE_DIRECTORY_LINK_HOME, RULE_FILE));
  symlinkSync(join(RULE_DIRECTORY_HOME, RULE_FILE), join(RULE_DIRECTORY_LINK_HOME, RULE_FILE));

  writeSettings(HOOK_MISSING_HOME, [hookEntry(USER_RULE_READER, "general-purpose")]);
  rmSync(join(SETTINGS_MISSING_HOME, "settings.json"));
  writeSettings(HOOK_DIFFERS_HOME, [
    { matcher: "^(Explore|Plan)$", hooks: [{ type: "command", command: KIT_HOOK_COMMAND }, { type: "command", command: "echo user-explore" }] },
  ]);
  writeSettings(HOOK_DOUBLED_HOME, [hookEntry(KIT_HOOK_COMMAND), hookEntry(KIT_HOOK_COMMAND, "Plan")]);
  writeFileSync(join(SETTINGS_INVALID_HOME, "settings.json"), '{\n  "hooks": {\n');
  writeFileSync(join(SETTINGS_NONLIST_HOME, "settings.json"), JSON.stringify({ hooks: { [HOOK_EVENT]: {} } }));
  rmSync(join(SETTINGS_DANGLING_HOME, "settings.json"));
  symlinkSync(join(SETTINGS_DANGLING_HOME, "absent-settings.json"), join(SETTINGS_DANGLING_HOME, "settings.json"));
  rmSync(join(RULES_DANGLING_HOME, "rules"), { recursive: true });
  symlinkSync(join(RULES_DANGLING_HOME, "absent-rules"), join(RULES_DANGLING_HOME, "rules"));
  rmSync(join(RULES_FILE_HOME, "rules"), { recursive: true });
  writeFileSync(join(RULES_FILE_HOME, "rules"), "not a directory\n");
  rmSync(join(RULES_FILE_LINK_HOME, "rules"), { recursive: true });
  writeFileSync(join(RULES_FILE_LINK_HOME, "user-rules-file"), "not a directory\n");
  symlinkSync(join(RULES_FILE_LINK_HOME, "user-rules-file"), join(RULES_FILE_LINK_HOME, "rules"));
  rmSync(join(SETTINGS_DIRECTORY_HOME, "settings.json"));
  mkdirSync(join(SETTINGS_DIRECTORY_HOME, "settings.json"));

  writeFileSync(join(BLOCK_MISSING_HOME, "AGENTS.md"), USER_CODEX_LINE);
  writeFileSync(join(BLOCK_DIFFERS_HOME, "AGENTS.md"), `${USER_CODEX_LINE}\n${BLOCK_START}\nstale core rules\n${BLOCK_END}\n`);
  writeFileSync(join(BLOCK_UNMATCHED_HOME, "AGENTS.md"), `${BLOCK_START}\n${USER_CODEX_LINE}\n${kitBlock()}\n`);
  writeFileSync(join(BLOCK_REVERSED_HOME, "AGENTS.md"), `${USER_CODEX_LINE}\n${BLOCK_END}\nUser instructions between markers.\n${BLOCK_START}\nUser instructions after markers.\n`);
  rmSync(join(AGENTS_DANGLING_HOME, "AGENTS.md"));
  symlinkSync(join(AGENTS_DANGLING_HOME, "absent-AGENTS.md"), join(AGENTS_DANGLING_HOME, "AGENTS.md"));
  rmSync(join(AGENTS_DIRECTORY_HOME, "AGENTS.md"));
  mkdirSync(join(AGENTS_DIRECTORY_HOME, "AGENTS.md"));
  writeFileSync(join(OVERRIDE_HOME, "AGENTS.override.md"), "Temporary global override.\n");
  writeFileSync(join(EMPTY_OVERRIDE_HOME, "AGENTS.override.md"), "");
  writeFileSync(join(BLANK_OVERRIDE_HOME, "AGENTS.override.md"), "\n  \n\t\n");
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

  writeDeliveryFixtures();
}

before(() => {
  copyFixture(join(FIXTURES, "store"), STORE);
  copyFixture(join(FIXTURES, "anchors"), ANCHORS);
  copyFixture(join(FIXTURES, "budgets"), BUDGETS);
  copyFixture(join(FIXTURES, "citations"), CITATIONS);
  copyFixture(join(FIXTURES, "citations-second"), CITATIONS_SECOND);
  copyFixture(join(FIXTURES, "legacy-context"), LEGACY_CONTEXT);
  for (const [folder, days] of FIXTURE_AGE_DAYS) ageFolder(folder, days);

  const freshPlan = join(STORE, "fresh-executing", "plan.md");

  mkdirSync(join(UNREADABLE_STORE, "locked-task"), { recursive: true });
  copyFileSync(freshPlan, UNREADABLE_FILE);
  chmodSync(UNREADABLE_FILE, 0o000);

  mkdirSync(LOCKED_TASK_DIR, { recursive: true });
  copyFileSync(freshPlan, join(LOCKED_TASK_DIR, "plan.md"));
  mkdirSync(LOCKED_SIBLING_DIR, { recursive: true });
  copyFileSync(freshPlan, join(LOCKED_SIBLING_DIR, "plan.md"));
  mkdirSync(LOCKED_OUTSIDE_DIR, { recursive: true });
  writeFileSync(
    join(LOCKED_SIBLING_DIR, "CONTEXT.md"),
    "# Context\n\nThe prior ruling is [in the locked task](../locked-task/plan.md),\n" +
      "and the spec is [outside the store](../../../outside-locked/spec.md).\n",
  );
  chmodSync(LOCKED_OUTSIDE_DIR, 0o000);
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

  for (const group of [GROUPS, join(GROUPS, "product"), join(GROUPS, "product", "backend")]) {
    writeGroupFile(group);
  }
  writeGroupFile(GROUPS_ARCHIVE);
  writeGroupFile(GROUPS_BACKLOG);
  writeTaskFolder(join(GROUPS_LEAVES, "active-leaf"));
  writeTaskFolder(join(GROUPS_ARCHIVE, "archived-leaf"), DONE_PLAN);
  writeTaskFolder(join(GROUPS_BACKLOG, "parked-leaf"), EXECUTING_PLAN);
  ageFolder(join(GROUPS_ARCHIVE, "archived-leaf"), DAYS_PAST_STALE);
  ageFolder(join(GROUPS_BACKLOG, "parked-leaf"), DAYS_PAST_STALE);

  writeGroupFile(join(GROUPS_DEEP_BACKLOG_CONTAINER, "deeper"));
  writeTaskFolder(join(GROUPS_DEEP_BACKLOG_CONTAINER, "deeper", "grouped-leaf"), EXECUTING_PLAN);
  writeTaskFolder(join(GROUPS_DEEP_BACKLOG_CONTAINER, "parked-leaf"), EXECUTING_PLAN);
  ageFolder(join(GROUPS_DEEP_BACKLOG_CONTAINER, "deeper", "grouped-leaf"), DAYS_PAST_STALE);
  ageFolder(join(GROUPS_DEEP_BACKLOG_CONTAINER, "parked-leaf"), DAYS_PAST_STALE);

  writeGroupFile(join(GROUPS_DUP, "alpha"));
  writeGroupFile(join(GROUPS_DUP, "beta"));
  writeTaskFolder(join(GROUPS_DUP, "alpha", "shared-leaf"));
  writeTaskFolder(join(GROUPS_DUP, "beta", "shared-leaf"));

  writeMisfiledGroupFile(join(NEAR_MISS, "product"));
  writeTaskFolder(join(NEAR_MISS, "product", "backend", "hidden-leaf"));
  writeTaskFolder(join(NEAR_MISS, "product", "Archive", "hidden-archived"), DONE_PLAN);
  writeMisfiledGroupFile(join(NEAR_MISS, "product", "Archive"));

  writeMisfiledGroupFile(ARCHIVED_NEAR_MISS_CLAIM);
  writeTaskFolder(join(ARCHIVED_NEAR_MISS_CLAIM, "backend", "hidden-leaf"));
  ageFolder(ARCHIVED_NEAR_MISS_CLAIM, DAYS_PAST_STALE);

  mkdirSync(CASE_PROBE);
  writeVolumeStore(VOLUME_STORE);
});

after(() => {
  chmodSync(LOCKED_TASK_DIR, 0o755);
  chmodSync(LOCKED_OUTSIDE_DIR, 0o755);
  chmodSync(LOCKED_SKILL, 0o755);
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe("the fixture store, scanned once", () => {
  let storeRun: CheckRun;
  before(() => {
    storeRun = runCheck(STORE_ARGS);
  });

  test("a readable store scans without warnings and exits 0", () => {
    const { stderr } = storeRun;
    assert.strictEqual(stderr, "", "a readable fixture store must produce no warnings");
  });

  test("scanned counts every task folder, archived and backlogged ones included", () => {
    const { report } = storeRun;
    assert.strictEqual(report.scanned, 13, "scanned task count");
    assert.strictEqual(report.unreadable, 0, "a readable store reports nothing unread");
  });

  test("a plan status outside the vocabulary is reported rather than silently exempted", () => {
    const { report } = storeRun;
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
    const { report } = storeRun;
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

  test("a 62-day-old executing task is reported stale with its status and age", () => {
    const { report } = storeRun;
    assert.strictEqual(findingCount(report, "stale"), 2, "stale finding count");
    assert.strictEqual(
      findingDetail(report, "stale", "store/stale-executing"),
      "executing, 62 days stale",
      "stale detail for store/stale-executing",
    );
  });

  test("a 2-day-old executing task is not reported stale", () => {
    const { report } = storeRun;
    assert.strictEqual(
      findingDetail(report, "stale", "store/fresh-executing"),
      "",
      "fresh task must not be reported stale",
    );
  });

  test("a plan with no parseable status is reported stale under a named label, not an empty value", () => {
    const { report } = storeRun;
    assert.strictEqual(
      findingDetail(report, "stale", "store/no-status-plan"),
      "no-status, 70 days stale",
      "stale detail for a plan carrying no parseable status",
    );
  });

  test("a done task outside Archive/ is reported with its status", () => {
    const { report } = storeRun;
    assert.strictEqual(findingCount(report, "done-unarchived"), 2, "done-unarchived finding count");
    assert.strictEqual(
      findingDetail(report, "done-unarchived", "store/done-unarchived"),
      "done, outside Archive/",
      "done-unarchived detail for store/done-unarchived",
    );
  });

  test("a **Completed prose header on a plan-less result is not a done task", () => {
    const { report } = storeRun;
    assert.deepStrictEqual(
      report.findings.filter((entry) => entry.path === "store/completed-prose"),
      [],
      "a `**Completed steps:**` header is prose, not the closing line a done plan owes",
    );
  });

  test("a done task parked in Backlog/ is reported as misfiled, not merely unarchived", () => {
    const { report } = storeRun;
    assert.strictEqual(
      findingDetail(report, "done-unarchived", "store/Backlog/done-parked"),
      "done, parked in Backlog/ — belongs in Archive/",
      "done-unarchived detail for a terminal task inside a backlog",
    );
  });

  test("a parked to-do task produces no findings, its 70-day age included", () => {
    const { report } = storeRun;
    assert.deepStrictEqual(
      report.findings.filter((entry) => entry.path === "store/Backlog/parked-todo"),
      [],
      "an aged to-do task inside a backlog must stay silent",
    );
  });

  test("a live task parked in Backlog/ is reported under started-in-backlog", () => {
    const { report } = storeRun;
    assert.strictEqual(findingCount(report, "started-in-backlog"), 3, "started-in-backlog finding count");
    assert.strictEqual(
      findingDetail(report, "started-in-backlog", "store/Backlog/started-parked"),
      "executing, parked in Backlog/ — a parked task must be unstarted",
      "started-in-backlog detail for a live parked task",
    );
  });

  test("a parked plan with no parseable status is reported as unjudgeable, not left silent", () => {
    const { report } = storeRun;
    assert.strictEqual(
      findingDetail(report, "started-in-backlog", "store/Backlog/statusless-parked"),
      "no parseable plan status, parked in Backlog/ — cannot judge the entry gate",
      "the stale exemption must not silence a statusless parked plan",
    );
  });

  test("a plan-less parked folder holding a result.md at all is reported as started", () => {
    const { report } = storeRun;
    assert.strictEqual(
      findingDetail(report, "started-in-backlog", "store/Backlog/resultonly-parked"),
      "no plan.md but result.md exists, parked in Backlog/ — a parked task must be unstarted",
      "an existing result file must fail the entry gate for a plan-less parked folder",
    );
  });

  test("an archived task produces no findings", () => {
    const { report } = storeRun;
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
    "a directory that cannot be listed is counted once, not once per walk pass — the sibling task " +
      "cites into it, so the citation pass lists it a second time and must not record it again",
  );
  assert.deepStrictEqual(
    report.unreadablePaths,
    [LOCKED_TASK_DIR],
    "unreadablePaths names the directory by absolute path, once",
  );
});

test("a citation into an unlistable directory is concealed rather than reported dead", (t: TestContext) => {
  if (isReadable(LOCKED_TASK_DIR)) {
    t.skip("the unreadable-directory case needs a user that chmod 000 actually stops");
    return;
  }
  const { report } = runCheck([LOCKED_TREE]);
  assert.deepStrictEqual(
    report.findings.filter((entry) => entry.check === "dead-citation").map((entry) => entry.detail),
    [],
    "a target the walk cannot see is concealment rather than absence, and a run's findings are " +
      "never read as its coverage — the unreadablePaths entry is what reports the gap",
  );
  assert.deepStrictEqual(
    report.unreadablePaths,
    [LOCKED_TASK_DIR],
    "a citation climbing outside every walked root reaches an unlistable directory the store does " +
      "not own, so it conceals the target without claiming a coverage gap this run never had",
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

describe("the anchor fixtures, scanned once", () => {
  let anchorsRun: CheckRun;
  before(() => {
    anchorsRun = runCheck(ANCHORS_ARGS);
  });

  test("a checked step whose anchor is missing from the result file is reported, a resolving one is not", () => {
    const { report, stderr } = anchorsRun;
    assert.strictEqual(stderr, "", "the anchor fixtures must produce no warnings");
    assert.strictEqual(report.scanned, 14, "scanned count for the anchor fixtures");
    assert.strictEqual(findingCount(report, "dead-anchor"), 6, "dead-anchor finding count");
    assert.deepStrictEqual(
      findingDetails(report, "dead-anchor", "anchors/dead-anchor"),
      [
        "Step 2: anchor not found: #step-2--never-written in ./result.md",
        "Step 2a: anchor not found: #step-2a--never-written in ./result.md",
      ],
      "dead-anchor details for unresolvable anchors, the inserted step labelled by its own number",
    );
  });

  test("a checked step with no result link is reported; a checkpoint checkbox is not a step", () => {
    const { report } = anchorsRun;
    assert.strictEqual(
      findingDetail(report, "dead-anchor", "anchors/missing-link"),
      "Step 1: checked step missing result link",
      "dead-anchor detail for a step with no result link",
    );
  });

  test("a checked step linking a file the folder does not hold is reported", () => {
    const { report } = anchorsRun;
    assert.strictEqual(
      findingDetail(report, "dead-anchor", "anchors/missing-target"),
      "Step 1: link target missing: ./gone.result.md#step-1--vanished",
      "dead-anchor detail for a link whose file is gone",
    );
  });

  test("checked-step evidence must name both the result file and a concrete result heading", () => {
    const { report } = anchorsRun;
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
    const { report } = anchorsRun;
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
    const { report } = anchorsRun;
    assert.strictEqual(findingCount(report, "no-current-state"), 3, "no-current-state finding count");
    assert.strictEqual(
      findingDetail(report, "no-current-state", "anchors/no-current-state"),
      'blocked result.md has no "## Current state" block',
      "no-current-state detail for a blocked result",
    );
  });

  test("a ## Current state heading inside a code fence does not satisfy the liveness check", () => {
    const { report } = anchorsRun;
    assert.strictEqual(
      findingDetail(report, "no-current-state", "anchors/fenced-current-state"),
      'executing result.md has no "## Current state" block',
      "no-current-state detail for a result whose only block sits in a fence",
    );
  });

  test("a three-backtick example inside a four-backtick fence does not toggle scanning back on", () => {
    const { report } = anchorsRun;
    assert.strictEqual(
      findingDetail(report, "no-current-state", "anchors/nested-fence"),
      'executing result.md has no "## Current state" block',
      "no-current-state detail for a result whose only block sits in a nested fence",
    );
  });

  test("a fenced status example is illustrative markdown, not a lifecycle state", () => {
    const { report } = anchorsRun;
    assert.strictEqual(
      findingDetail(report, "done-unarchived", "anchors/fenced-status"),
      "",
      "a **Status:** line inside a fence must not be read as the plan's own",
    );
  });

  test("a step link whose section a Compacted stub tombstones is documented state, not a dead anchor", () => {
    const { report } = anchorsRun;
    assert.strictEqual(
      findingDetail(report, "dead-anchor", "anchors/compacted-tombstone"),
      "",
      "an anchor named by a ## Compacted tombstone bullet must resolve",
    );
  });

  test("archived folders are exempt from the content checks", () => {
    const { report } = anchorsRun;
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
    const { report } = anchorsRun;
    assert.strictEqual(findingCount(report), 14, "total finding count for the anchor fixtures");
  });

  test("a dead link is reported under dead-citation wherever it sits, a dead step link twice over", () => {
    const { report } = anchorsRun;
    assert.deepStrictEqual(
      report.findings
        .filter((entry) => entry.check === "dead-citation")
        .map((entry) => `${entry.path} — ${entry.detail}`),
      [
        "anchors/bad-goal-ids — goals.md: link target ./plan.md resolves to nothing",
        "anchors/missing-target — plan.md: link target ./gone.result.md#step-1--vanished resolves to nothing",
      ],
      "a checked step's own dead link is checked like any other, while the backticked ([result](…)) " +
        "example on the compacted-tombstone step raises nothing",
    );
    assert.strictEqual(
      findingDetail(report, "dead-anchor", "anchors/missing-target"),
      "Step 1: link target missing: ./gone.result.md#step-1--vanished",
      "a checked step's dead link is both a dead anchor and a dead citation",
    );
  });

  test("--result-max-kb reports a result over the given trigger and stays quiet at the default", () => {
    const { report: atDefault } = anchorsRun;
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
});

test("goal references in task Markdown share the structural validator and archived tasks stay exempt", () => {
  const root = join(TEST_ROOT, "goal-reference-store");
  const live = join(root, "live");
  const archived = join(root, "Archive", "old");
  mkdirSync(live, { recursive: true });
  mkdirSync(archived, { recursive: true });
  for (const dir of [live, archived]) {
    writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — delivered\n");
    writeFileSync(join(dir, "plan.md"), "**Status:** to-do\n## Scope\n- delivered: G1\n");
    writeFileSync(join(dir, "CONTEXT.md"), "G9 is a stale reference.\n");
  }
  const { report } = runCheck([root]);
  assert.deepStrictEqual(findingDetails(report, "goal-id", "goal-reference-store/live"), [
    "unknown-goal-reference G9 in CONTEXT.md:1",
  ]);
  assert.deepStrictEqual(findingDetails(report, "goal-id", "goal-reference-store/Archive/old"), []);
});

test("goal-id validates citation fields in canonical and legacy plan filenames without duplicate diagnostics", () => {
  const root = join(TEST_ROOT, "goal-reference-plan-filenames");
  for (const planFile of ["plan.md", "task.plan.md"]) {
    const dir = join(root, planFile);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — delivered\n\n## Retired\n- G2 — previous outcome\n");
    writeFileSync(join(dir, planFile), "**Status:** to-do\n## Scope\n- delivered: G1, `G9`\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G1, `G8`, G7, G2\n");
  }
  const { report } = runCheck([root]);
  for (const planFile of ["plan.md", "task.plan.md"]) {
    assert.deepStrictEqual(findingDetails(report, "goal-id", `goal-reference-plan-filenames/${planFile}`).sort(), [
      `retired-goal-reference G2 in ${planFile}:7`,
      `unknown-goal-reference G7 in ${planFile}:7`,
      `unknown-goal-reference G8 in ${planFile}:7`,
      `unknown-goal-reference G9 in ${planFile}:3`,
    ], planFile);
  }
});

test("goal-id reads the same task Markdown and scan gaps as task-state", () => {
  const root = join(TEST_ROOT, "goal-reference-walk");
  const live = join(root, "live");
  mkdirSync(join(live, "notes"), { recursive: true });
  mkdirSync(join(live, "child"), { recursive: true });
  writeFileSync(join(live, "goals.md"), "## Goals\n- G1 — delivered\n");
  writeFileSync(join(live, "plan.md"), "**Status:** to-do\n## Scope\n- delivered: G1\n");
  writeFileSync(join(live, "notes", "extra.md"), "G9 is a stale reference.\n");
  writeFileSync(join(live, "child", "goals.md"), "## Goals\n- G7 — another task's outcome\n");
  writeFileSync(join(TEST_ROOT, "goal-walk-outside.md"), "G8 lives outside.\n");
  symlinkSync(join(TEST_ROOT, "goal-walk-outside.md"), join(live, "linked.md"));
  const { report } = runCheck([root]);
  assert.deepStrictEqual(findingDetails(report, "goal-id", "goal-reference-walk/live").sort(), [
    "incomplete-reference-scan in linked.md",
    "unknown-goal-reference G9 in notes/extra.md:1",
  ]);
});

test("goal-id reports a goals file it cannot read as an incomplete scan", () => {
  const root = join(TEST_ROOT, "goal-reference-linked-goals");
  const live = join(root, "live");
  mkdirSync(live, { recursive: true });
  writeFileSync(join(live, "plan.md"), "**Status:** to-do\n## Scope\n- delivered: G1\n");
  writeFileSync(join(TEST_ROOT, "goal-linked-goals.md"), "## Goals\n- G1 — delivered\n");
  symlinkSync(join(TEST_ROOT, "goal-linked-goals.md"), join(live, "goals.md"));
  const { report } = runCheck([root]);
  assert.deepStrictEqual(findingDetails(report, "goal-id", "goal-reference-linked-goals/live"), [
    "incomplete-reference-scan in goals.md",
  ]);
});

test("goal-id counts a nested Markdown read failure as unreadable", (t: TestContext) => {
  const root = join(TEST_ROOT, "goal-reference-locked");
  const live = join(root, "live");
  mkdirSync(join(live, "notes"), { recursive: true });
  writeFileSync(join(live, "goals.md"), "## Goals\n- G1 — delivered\n");
  writeFileSync(join(live, "plan.md"), "**Status:** to-do\n## Scope\n- delivered: G1\n");
  const locked = join(live, "notes", "locked.md");
  writeFileSync(locked, "G1\n");
  chmodSync(locked, 0o000);
  t.after(() => chmodSync(locked, 0o644));
  if (isReadable(locked)) {
    t.skip("the unreadable-file case needs a user that chmod 000 actually stops");
    return;
  }
  const { report } = runCheck([root]);
  assert.deepStrictEqual(findingDetails(report, "goal-id", "goal-reference-locked/live"), [
    "incomplete-reference-scan in notes/locked.md",
  ]);
  assert.strictEqual(report.unreadable, 1);
  assert.deepStrictEqual(report.unreadablePaths, [locked]);
});

test("a CRLF plan resolves its checked-step anchors, so a fenced-only heading is a dead anchor", () => {
  const root = join(TEST_ROOT, "crlf-anchors");
  const live = join(root, "live");
  mkdirSync(live, { recursive: true });
  writeFileSync(join(live, "goals.md"), "## Goals\r\n- G1 — delivered\r\n");
  writeFileSync(join(live, "plan.md"), "**Status:** executing\r\n## Scope\r\n- delivered: G1\r\n## Steps\r\n### Step 1 — Work\r\n- [x] **What:** work ([result](./result.md#step-1--work))\r\n- **Goal:** G1\r\n");
  writeFileSync(join(live, "result.md"), "## Current state\r\nPending.\r\n\r\n---\r\n\r\n```\r\n### Step 1 — Work\r\n```\r\n");
  const { report } = runCheck([root]);
  assert.deepStrictEqual(findingDetails(report, "dead-anchor", "crlf-anchors/live"), [
    "Step 1: anchor not found: #step-1--work in ./result.md",
  ]);
  assert.deepStrictEqual(findingDetails(report, "no-current-state", "crlf-anchors/live"), []);
});

test("health-check resolves every retained duplicate and nested anchor before and after body compaction", () => {
  const root = join(TEST_ROOT, "compaction-round-trip");
  const anchors = ["step-1--work", "example", "example-1", "example-2", "step-1--work-1", "step-0--legacy"];
  const plan = "# Plan\n**Status:** executing\n## Scope\n- delivered: G1\n## Steps\n" + anchors.map((anchor, index) =>
    `### Step ${index + 1} — Evidence\n- [x] **What:** done ([result](./result.md#${anchor}))\n- **Goal:** G1\n`,
  ).join("\n");
  const headings = ["## Step 1 — Work\n### Example\n#### Example-1\n##### Example\n", "## Step 1 — Work\n"];
  for (const [name, compacted] of [["before", []], ["older", [0]], ["newer", [1]], ["both", [0, 1]]] as const) {
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — evidence survives\n");
    writeFileSync(join(dir, "plan.md"), plan);
    writeFileSync(join(dir, "result.md"), "## Current state\nExecuting.\n" + headings.map((heading, index) =>
      heading + (compacted.some((selected) => selected === index) ? "Compacted 2026-11-01; full text in git history (pre-compaction state).\n" : "Narrative. ".repeat(100) + "\n"),
    ).join("") + "## Compacted — 2025-12-01\n- Step 0 — Legacy\n");
  }
  const { report } = runCheck([root]);
  assert.strictEqual(report.scanned, 4);
  assert.deepStrictEqual(report.findings.filter((finding) => ["dead-anchor", "dead-citation", "goal-id"].includes(finding.check)), []);
});

test("health-check agrees on terminal status and checked duplicate anchors after comment-contained fences", () => {
  const root = join(TEST_ROOT, "comment-fence-readers");
  for (const marker of ["```", "~~~"]) for (const eol of ["\n", "\r\n"]) {
    const dir = join(root, `${marker[0]}-${eol.length}`);
    mkdirSync(dir, { recursive: true });
    const comment = `<!-- illustrative\n${marker}\n**Status:** blocked\n## Step 1 — Work\n-->\n`;
    writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — done\n");
    writeFileSync(join(dir, "plan.md"), (comment + "**Status:** done\n## Scope\n- delivered: G1\n## Steps\n### Step 1 — Work\n- [x] **What:** done ([result](./result.md#step-1--work-1))\n- **Goal:** G1\n").replaceAll("\n", eol));
    writeFileSync(join(dir, "result.md"), ("## Current state\nDone.\n## Step 1 — Work\nOld evidence.\n" + comment + "## Step 1 — Work\nCurrent evidence.\n").replaceAll("\n", eol));
  }
  const { report } = runCheck([root]);
  assert.strictEqual(report.scanned, 4);
  assert.strictEqual(findingCount(report, "done-unarchived"), 4);
  assert.deepStrictEqual(report.findings.filter((finding) => finding.check !== "done-unarchived"), []);
});

test("health-check keeps fences and later anchors live after an unpaired comment opener", () => {
  const dir = join(TEST_ROOT, "unpaired-opener", "task");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — done\n");
  writeFileSync(join(dir, "CONTEXT.md"), "A bare <!-- marker.\n\n~~~md\n[example](./missing.md)\n~~~\n");
  writeFileSync(join(dir, "plan.md"), "**Status:** executing\n## Scope\n- delivered: G1\n## Steps\n### Step 1 — Work\n- [x] **What:** work ([result](./result.md#step-1--work))\n- **Goal:** G1\n### Step 2 — More\n- [x] **What:** more ([result](./result.md#step-2--more))\n- **Goal:** G1\n");
  writeFileSync(join(dir, "result.md"), "## Current state\nWorking.\n## Step 1 — Work\nFixed the <!-- parser.\n## Step 2 — More\nDone.\n");
  const { report } = runCheck([join(TEST_ROOT, "unpaired-opener")]);
  assert.deepStrictEqual(report.findings.filter((finding) => ["dead-anchor", "dead-citation"].includes(finding.check)), []);
});

test("a comment-only legacy result status raises no finding", () => {
  const dir = join(TEST_ROOT, "comment-only-legacy", "task");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "plan.md"), EXECUTING_PLAN);
  writeFileSync(join(dir, "result.md"), "**Status:** <!-- shipped -->\n\n## Current state\nWorking.\n");
  const { report } = runCheck([join(TEST_ROOT, "comment-only-legacy")]);
  assert.strictEqual(findingCount(report, "legacy-result-status"), 0);
});

describe("the citation fixtures, scanned once", () => {
  let citationsRun: CheckRun;
  before(() => {
    citationsRun = runCheck(CITATIONS_ARGS);
  });

  test("the citation fixtures scan without warnings and leave nothing unread", () => {
    const { report, stderr } = citationsRun;
    assert.strictEqual(stderr, "", "the citation fixtures must produce no warnings");
    assert.strictEqual(report.unreadable, 0, "the citation fixtures are all readable");
  });

  test("a link to a local path the store does not hold is reported once, with the target as written", () => {
    const { report } = citationsRun;
    assert.deepStrictEqual(
      findingDetails(report, "dead-citation", "citations/dead-link"),
      ["CONTEXT.md: link target ../gone/adr.md resolves to nothing"],
      "dead-citation detail names the citing file and the unresolvable target",
    );
  });

  test("a resolving link, an anchor, a mailto, and an http URL are not local citations to check", () => {
    const { report } = citationsRun;
    assert.deepStrictEqual(
      report.findings.filter((entry) => entry.path === "citations/live-links"),
      [],
      "a ./ link that resolves, a bare #anchor, a mailto:, and an https:// target must all stay silent",
    );
  });

  test("a citation differing from the file on disk by case alone is dead, whatever the filesystem folds", () => {
    const { report } = citationsRun;
    assert.deepStrictEqual(
      findingDetails(report, "dead-citation", "citations/case-only"),
      ["CONTEXT.md: link target ./Plan.md resolves to nothing"],
      "resolution compares the directory listing, so ./Plan.md misses a plan.md on a case-insensitive volume",
    );
  });

  test("a cross-folder relative link is reported by form, its conformant replacement named", () => {
    const { report } = citationsRun;
    assert.deepStrictEqual(
      report.findings
        .filter((entry) => entry.check === "citation-form")
        .map((entry) => `${entry.path} — ${entry.detail}`),
      [
        "citations/cross-archived — CONTEXT.md: cross-folder link ../Archive/archived-sibling/adr.md — " +
          "cite task `archived-sibling` by its bare slug (adr.md)",
        "citations/cross-folder — CONTEXT.md: cross-folder link ../sibling-task/adr.md — " +
          "cite task `sibling-task` by its bare slug (adr.md)",
        "citations/cross-folder — CONTEXT.md: cross-folder link ../Area/nested-task/adr.md — " +
          "cite the folder path Area/nested-task/adr.md",
        "citations/cross-folder — CONTEXT.md: cross-folder link ../cross-folder/adr.md — cite ./adr.md inside this folder",
        "citations/cross-folder — CONTEXT.md: cross-folder link ../../outside-the-root.md — " +
          "the target lies outside the store root",
        "citations/cross-folder — CONTEXT.md: cross-folder link ../cross-folder — cite this folder as ./",
        "citations/cross-folder — CONTEXT.md: cross-folder link ../ — the target is the store root itself",
        "citations/cross-root — CONTEXT.md: cross-folder link ../../citations-second/target-task/adr.md — " +
          "the target lies outside the store root",
        "citations/cross-root — CONTEXT.md: cross-folder link ../../citations-second/Area/deep-task/adr.md — " +
          "the target lies outside the store root",
        "citations/cross-root — CONTEXT.md: cross-folder link ../../citations-second/Hub/DECISIONS.md — " +
          "the target lies outside the store root",
        "citations/dead-link — CONTEXT.md: cross-folder link ../gone/adr.md — cite the folder path gone/adr.md",
        "citations/root-absolute — CONTEXT.md: store-level doc link /Area/DECISIONS.md — " +
          "cite Area/DECISIONS.md as plain text",
        "citations/root-absolute — CONTEXT.md: root-absolute link /Area/gone.md — " +
          "cite the folder path Area/gone.md",
        "citations/root-absolute — CONTEXT.md: store-level doc link Area/DECISIONS.md — " +
          "cite Area/DECISIONS.md as plain text",
        "citations/store-level — ticket.md: cross-folder link ../Area/DECISIONS.md — cite Area/DECISIONS.md as plain text",
        "citations/store-level — ticket.md: cross-folder link ../Stale/Area/DECISIONS.md — " +
          "cite Stale/Area/DECISIONS.md as plain text",
      ],
      "a walked task is named by its bare slug, an archived one included, and a target in no task folder by its path",
    );
  });

  test("the replacement named is one that resolves — never a slug for a group-nested or self-cited target", () => {
    const { report } = citationsRun;
    const forms = report.findings
      .filter((entry) => entry.check === "citation-form")
      .map((entry) => entry.detail)
      .join("\n");
    assert.ok(
      forms.includes("../Area/nested-task/adr.md — cite the folder path Area/nested-task/adr.md"),
      "a bare slug reads the canonical root one level deep, so a group under it takes the path form",
    );
    assert.ok(
      forms.includes("../cross-folder/adr.md — cite ./adr.md inside this folder"),
      "a folder citing itself the long way round owes a ./ link, not its own slug",
    );
    assert.ok(
      !forms.includes("cite the folder path ../"),
      "a path from the root never begins with .., so a target above the root is named as outside it",
    );
    assert.ok(
      forms.includes("../cross-folder — cite this folder as ./"),
      "a link naming the citing folder itself owes a ./ link, and no branch names an empty path",
    );
    assert.ok(
      forms.includes("../ — the target is the store root itself"),
      "a link landing on the walked root names it rather than falling through to an empty path",
    );
  });

  test("a cross-folder link whose target is gone is reported both by form and as a dead citation", () => {
    const { report } = citationsRun;
    assert.deepStrictEqual(
      report.findings
        .filter((entry) => entry.path === "citations/dead-link")
        .map((entry) => entry.check)
        .sort(),
      ["citation-form", "dead-citation"],
      "the form is wrong whatever the target resolves to, and this target resolves to nothing",
    );
  });

  test("a plain-text store-level path that resolves from no walked root is reported as written", () => {
    const { report } = citationsRun;
    assert.deepStrictEqual(
      findingDetails(report, "dead-citation", "citations/store-level"),
      [
        "ticket.md: store-level citation Stale/Area/DECISIONS.md resolves to nothing from the root",
        "ticket.md: store-level citation Legacy/Area/DECISIONS.md resolves to nothing from the root",
        "ticket.md: link target ../Stale/Area/DECISIONS.md resolves to nothing",
      ],
      "the run is the path token alone, so a bulleted line reports the target rather than the whole bullet",
    );
  });

  test("a link whose text repeats its own path is one citation, not a link and a plain-text one", () => {
    const { report } = citationsRun;
    assert.strictEqual(
      findingDetails(report, "dead-citation", "citations/store-level").filter((detail) =>
        detail.includes("Stale/Area/DECISIONS.md"),
      ).length,
      2,
      "the link arm owns its target and the text repeating it, leaving only the unlinked citation above",
    );
  });

  test("prose carrying an unrelated slash, and a placeholder broken by one, are not store-level citations", () => {
    const { report } = citationsRun;
    const details = findingDetails(report, "dead-citation", "citations/store-level").join("\n");
    assert.ok(
      !details.includes("eng/platform"),
      "a slash earlier in the sentence is not a path ahead of the filename, so the run stops at the token",
    );
    assert.ok(
      !details.includes("CONTEXT section"),
      "the leading-slash guard tests the token that gets reported, so a broken placeholder raises nothing",
    );
    assert.ok(
      !details.includes("~/.claude"),
      "a ~ path names a home rather than a store root, so it is an illustration the guard drops too",
    );
  });

  test("a quoted repo path, a pathless filename, a relative token, and a link target are not this arm's", () => {
    const { report } = citationsRun;
    assert.deepStrictEqual(
      report.findings
        .filter((entry) => entry.path === "citations/store-level")
        .map((entry) => entry.check),
      ["dead-citation", "citation-form", "dead-citation", "citation-form", "dead-citation"],
      "only the unresolvable root-relative paths are dead citations, and the links are the link arm's alone",
    );
    assert.strictEqual(findingCount(report), 34, "total finding count for the citation fixtures");
  });

  test("a store-level path carrying a space in a group name resolves rather than reporting dead", () => {
    const { report } = citationsRun;
    const details = findingDetails(report, "dead-citation", "citations/store-level").join("\n");
    assert.ok(
      !details.includes("Management"),
      "the run widens across a space whenever the wider candidate resolves, so the live " +
        `spaced path is read whole and resolves: ${details}`,
    );
    assert.ok(
      !details.includes("Platform"),
      "a group name carrying two spaces widens as far as it resolves, rather than stopping at the " +
        `first word whose predecessor carries no slash: ${details}`,
    );
  });

  test("a link target starting at the root is resolved from the root, not from the task folder", () => {
    const { report } = citationsRun;
    assert.deepStrictEqual(
      findingDetails(report, "dead-citation", "citations/root-absolute"),
      [
        "CONTEXT.md: link target /Area/gone.md resolves to nothing",
        "CONTEXT.md: link target Area/DECISIONS.md resolves to nothing",
      ],
      "a leading slash names the store root, so the live decision log resolves and only the absent " +
        "one is dead; the same path without the slash resolves from the folder, where it is not there",
    );
  });

  test("a store-level doc cited as a link is reported by form, whatever the link resolves to", () => {
    const { report } = citationsRun;
    assert.deepStrictEqual(
      findingDetails(report, "citation-form", "citations/root-absolute"),
      [
        "CONTEXT.md: store-level doc link /Area/DECISIONS.md — cite Area/DECISIONS.md as plain text",
        "CONTEXT.md: root-absolute link /Area/gone.md — cite the folder path Area/gone.md",
        "CONTEXT.md: store-level doc link Area/DECISIONS.md — cite Area/DECISIONS.md as plain text",
      ],
      "one-home.md gives a store-level doc no link form at all, so the root-absolute and " +
        "root-relative spellings are both reported however they resolve; a root-absolute target " +
        "that names no store-level doc is reported by form too, since a renderer resolves it from " +
        "the repository root and finds nothing there whatever this walk resolves it to",
    );
  });

  test("a link inside a blockquote or an HTML comment is not the citing folder's own citation", () => {
    const { report } = citationsRun;
    assert.deepStrictEqual(
      findingDetails(report, "dead-citation", "citations/quoted"),
      [
        "CONTEXT.md: link target ./gone-after-heading.md resolves to nothing",
        "CONTEXT.md: link target ./gone-after-list.md resolves to nothing",
        "CONTEXT.md: store-level citation Gone/DECISIONS.md resolves to nothing from the root",
        "CONTEXT.md: link target ./gone-after-break.md resolves to nothing",
        "CONTEXT.md: link target ./gone-after-marker.md resolves to nothing",
        "CONTEXT.md: link target ./gone-after-unclosed.md resolves to nothing",
      ],
      "a quoted line carries another file's markdown and a commented one a retired citation, so " +
        "neither resolves against the quoting folder and neither is read; a heading, a list item, " +
        "and a thematic break each open a block the quote cannot lazily continue into, so both arms " +
        "read that line and everything under it rather than running on to the next blank line; a " +
        "backticked <!-- is an illustration rather than an opener, so it cannot pair with the real " +
        "comment below it and swallow the citations between them, and an unclosed one opens no span",
    );
  });

  test("an angle-bracketed target carries its spaces, the one shape that form exists for", () => {
    const { report } = citationsRun;
    assert.deepStrictEqual(
      findingDetails(report, "dead-citation", "citations/angle-target"),
      ["CONTEXT.md: link target ./no notes.md resolves to nothing"],
      "the target runs to the closing bracket, so a spaced name resolves and a missing one reports in " +
        "full, while padding inside the brackets is trimmed rather than resolved as a ' .' segment",
    );
  });

  test("an archived folder's own citations are still followed, unlike every other content check", () => {
    const { report } = citationsRun;
    assert.deepStrictEqual(
      findingDetails(report, "dead-citation", "citations/Archive/archived-sibling"),
      ["adr.md: link target ./gone-in-archive.md resolves to nothing"],
      "the two citation checks run inside Archive/, where a slug fallback keeps the folder citable",
    );
  });

  test("a link inside an inline code span is literal text, not a citation the check follows", () => {
    const { report } = citationsRun;
    assert.deepStrictEqual(
      report.findings
        .filter((entry) => entry.path === "citations/code-span")
        .map((entry) => `${entry.check} ${entry.detail}`),
      [
        "dead-citation CONTEXT.md: link target ./gone-outside.md resolves to nothing",
        "dead-citation CONTEXT.md: link target ./gone-after-tick.md resolves to nothing",
      ],
      "a shell regex and a single- and double-backtick span raise nothing, while a link beside a span " +
        "and one after an unclosed backtick are both followed; both arms read the blanked line, so a " +
        "backticked path is an illustration to neither of them",
    );
  });
});

test("a slug citation across two walked roots is named from the root that holds the target", () => {
  const { report } = runCheck(CROSS_ROOT_ARGS);
  assert.deepStrictEqual(
    findingDetails(report, "citation-form", "citations/cross-root"),
    [
      "CONTEXT.md: cross-folder link ../../citations-second/target-task/adr.md — cite task " +
        "`target-task` by its bare slug (adr.md)",
      "CONTEXT.md: cross-folder link ../../citations-second/Area/deep-task/adr.md — cite the " +
        `folder path Area/deep-task/adr.md in the root ${CITATIONS_SECOND}`,
      "CONTEXT.md: cross-folder link ../../citations-second/Hub/DECISIONS.md — cite " +
        `Hub/DECISIONS.md as plain text in the root ${CITATIONS_SECOND}`,
    ],
    "the depth test belongs to the holder's own root, so a uniquely-slugged task in the second " +
      "root is citable by slug rather than reported as outside the store root, and a target no " +
      "slug reaches takes the path form from the root that holds it, named",
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

describe("the pre-delivery Claude Code and Codex homes, compared once", () => {
  let installsRun: CheckRun;
  before(() => {
    installsRun = runCheck(INSTALLS_ARGS);
  });

  test("--installs reports each differing, missing, and extra path, per home and native agent format", () => {
    const { report, stderr } = installsRun;
    assert.strictEqual(stderr, "", "readable install fixtures must produce no warnings");
    assert.strictEqual(report.scanned, 5, "scanned count of marker-owned items");
    assert.strictEqual(findingCount(report, "install-drift"), 22, "install-drift finding count");
    assert.deepStrictEqual(
      [
        findingDetail(report, "install-drift", ".claude/rules/agents-kit-core-rules.md"),
        findingDetail(report, "install-drift", ".claude/settings.json"),
        findingDetail(report, "install-drift", ".codex/AGENTS.md"),
      ],
      ["missing in install", `${HOOK_EVENT} hook entry missing in install`, "core-rules block missing in install"],
      "a home installed before always-on delivery reports each delivery item it lacks",
    );
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
    const { report } = installsRun;
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
    const { report } = installsRun;
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
    const { report } = installsRun;
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
    const { report } = installsRun;
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

describe("each single-home --installs fixture, compared once", () => {
  const userFixHomes = [
    CONFLICT_HOME, BLOCKED_FRESH_HOME, RULE_UNMARKED_HOME, RULE_SYMLINK_HOME,
    RULE_DIRECTORY_HOME, RULE_DIRECTORY_LINK_HOME, SETTINGS_INVALID_HOME,
    SETTINGS_NONLIST_HOME, SETTINGS_DANGLING_HOME, RULES_DANGLING_HOME,
    RULES_FILE_HOME, RULES_FILE_LINK_HOME, SETTINGS_DIRECTORY_HOME,
    BLOCK_UNMATCHED_HOME, BLOCK_REVERSED_HOME, AGENTS_DANGLING_HOME,
    AGENTS_DIRECTORY_HOME, OVERRIDE_HOME,
  ];
  const rerunHomes = [
    CLAUDE_HOME, CODEX_HOME, STAGING_HOME, MATERIALIZED_HOME, PARTIAL_HOME,
    FRESH_HOME, ABSENT_HOME, RULE_MISSING_HOME, RULE_DIFFERS_HOME,
    HOOK_MISSING_HOME, SETTINGS_MISSING_HOME, HOOK_DIFFERS_HOME,
    HOOK_DOUBLED_HOME, BLOCK_MISSING_HOME, BLOCK_DIFFERS_HOME,
  ];
  const homeRuns = new Map<string, CheckRun>();
  before(() => {
    for (const home of [...userFixHomes, ...rerunHomes]) homeRuns.set(home, runCheck(["--installs", KIT, home]));
  });

  function homeRun(home: string): CheckRun {
    const run = homeRuns.get(home);
    assert.ok(run, `no single-home run was captured for ${home}`);
    return run;
  }

  function assertOnlyDrift(home: string, path: string, detail: string, message: string): void {
    const { report, stderr } = homeRun(home);
    assert.strictEqual(stderr, "", `${message}: the run must produce no warnings`);
    assert.deepStrictEqual(report.findings, [{ check: "install-drift", path, detail }], message);
  }

  test("an unmarked shared payload is a conflict, not a clean home", () => {
    const { report } = homeRun(CONFLICT_HOME);
    assert.strictEqual(
      findingDetail(report, "install-drift", ".claude/CORE_RULES.md"),
      "present but not kit-owned — skills using shared rules resolve into it; move it aside and rerun setup.ts",
      "an unmarked CORE_RULES.md is reported rather than treated as the user's business",
    );
    assert.strictEqual(
      findingDetail(report, "install-drift", ".claude/references"),
      "present but not kit-owned — skills using shared rules resolve into it; move it aside and rerun setup.ts",
      "an unmarked references/ is reported the same way",
    );
  });

  test("a leftover staging dir is an interrupted install, not drift to reconcile", () => {
    const { report } = homeRun(STAGING_HOME);
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
    const { report } = homeRun(MATERIALIZED_HOME);
    assert.strictEqual(
      findingDetail(report, "install-drift", ".claude/skills/kept-skill/AGENTS.md"),
      "symlink replaced by a copy",
      "a kit symlink materialized into a regular copy is drift, not a copy-mode difference",
    );
  });

  test("one surviving kit marker proves setup.ts ran, so absent payload categories are drift", () => {
    const { report } = homeRun(PARTIAL_HOME);
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
    const { report } = homeRun(FRESH_HOME);
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
    const { report } = homeRun(BLOCKED_FRESH_HOME);
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
    const { report } = homeRun(ABSENT_HOME);
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

  test("install drift names a user action exactly when setup.ts cannot clear it", () => {
    const userAction = /(?:move (?:it )?aside|fix the file|repair or remove (?:the link|the markers)) and rerun setup\.ts|empty or remove it/;
    for (const [homes, needsUserAction] of [[userFixHomes, true], [rerunHomes, false]] as const) {
      for (const home of homes) {
        const { report } = homeRun(home);
        const drift = report.findings.filter((finding) => finding.check === "install-drift");
        assert.ok(drift.length > 0, `${home}: fixture must report drift`);
        for (const finding of drift) {
          const isConflict = [".claude/references", ".claude/CORE_RULES.md"].includes(finding.path);
          const needsAction = needsUserAction && (home !== CONFLICT_HOME || isConflict);
          assert.strictEqual(userAction.test(finding.detail), needsAction, `${home}: ${finding.path}: ${finding.detail}`);
        }
      }
    }
  });

  test("a missing Claude Code rule file is drift", () => {
    assertOnlyDrift(RULE_MISSING_HOME, ".claude/rules/agents-kit-core-rules.md", "missing in install", "the rule file and its marker are gone");
  });

  test("a marked rule file that differs from CORE_RULES.md is drift", () => {
    assertOnlyDrift(RULE_DIFFERS_HOME, ".claude/rules/agents-kit-core-rules.md", "differs from kit source", "the rule file holds stale rules");
  });

  test("an unmarked rule file is drift setup.ts cannot clear", () => {
    assertOnlyDrift(
      RULE_UNMARKED_HOME,
      ".claude/rules/agents-kit-core-rules.md",
      "present but not kit-owned — setup.ts never replaces it; move it aside and rerun setup.ts",
      "a same-named user file keeps the core rules out of Claude Code",
    );
  });

  test("a symlinked rule file with a marker is drift setup.ts cannot clear", () => {
    assertOnlyDrift(
      RULE_SYMLINK_HOME,
      ".claude/rules/agents-kit-core-rules.md",
      "present but not kit-owned — setup.ts never replaces it; move it aside and rerun setup.ts",
      "a marked symlink remains user-owned",
    );
  });

  test("settings without the kit SubagentStart entry report the hook missing", () => {
    assertOnlyDrift(HOOK_MISSING_HOME, ".claude/settings.json", `${HOOK_EVENT} hook entry missing in install`, "a synced settings copy dropped the entry");
    assertOnlyDrift(SETTINGS_MISSING_HOME, ".claude/settings.json", `${HOOK_EVENT} hook entry missing in install`, "no settings.json holds no entry");
  });

  test("a kit SubagentStart entry unlike the one setup.ts writes is drift", () => {
    const detail = `${HOOK_EVENT} hook entry differs from the entry setup.ts writes`;
    assertOnlyDrift(HOOK_DIFFERS_HOME, ".claude/settings.json", detail, "the kit entry also holds a user command");
    assertOnlyDrift(HOOK_DOUBLED_HOME, ".claude/settings.json", detail, "setup.ts keeps one kit entry, so a second is drift");
  });

  test("invalid settings JSON is drift setup.ts cannot clear", () => {
    assertOnlyDrift(
      SETTINGS_INVALID_HOME,
      ".claude/settings.json",
      `not valid JSON — setup.ts cannot merge the ${HOOK_EVENT} hook entry; fix the file and rerun setup.ts`,
      "setup.ts refuses to merge into a file it cannot parse",
    );
  });

  test("settings with a non-list SubagentStart value are drift setup.ts cannot clear", () => {
    assertOnlyDrift(
      SETTINGS_NONLIST_HOME,
      ".claude/settings.json",
      `holds no hooks.${HOOK_EVENT} list — setup.ts cannot merge the hook entry; fix the file and rerun setup.ts`,
      "setup.ts refuses to merge into a hook event that is not a list",
    );
  });

  test("a Codex AGENTS.md without the core-rules block is drift", () => {
    assertOnlyDrift(BLOCK_MISSING_HOME, ".codex/AGENTS.md", "core-rules block missing in install", "only the user's line remains");
  });

  test("a core-rules block that differs from CORE_RULES.md is drift", () => {
    assertOnlyDrift(BLOCK_DIFFERS_HOME, ".codex/AGENTS.md", "core-rules block differs from kit source", "the block holds stale rules");
  });

  test("unmatched core-rules block markers are drift setup.ts cannot clear", () => {
    assertOnlyDrift(
      BLOCK_UNMATCHED_HOME,
      ".codex/AGENTS.md",
      "holds unmatched core-rules block markers — setup.ts leaves the file untouched; repair or remove the markers and rerun setup.ts",
      "a second start marker blocks the block replacement",
    );
  });

  test("reversed core-rules block markers are drift setup.ts cannot clear", () => {
    assertOnlyDrift(
      BLOCK_REVERSED_HOME,
      ".codex/AGENTS.md",
      "holds unmatched core-rules block markers — setup.ts leaves the file untouched; repair or remove the markers and rerun setup.ts",
      "an end marker before the start marker blocks the block replacement",
    );
  });

  test("dangling settings.json, AGENTS.md, and rules links are drift setup.ts cannot clear", () => {
    const detail = "dangling symlink — setup.ts cannot write through it; repair or remove the link and rerun setup.ts";
    assertOnlyDrift(SETTINGS_DANGLING_HOME, ".claude/settings.json", detail, "setup.ts refuses to write through a dangling settings link");
    assertOnlyDrift(AGENTS_DANGLING_HOME, ".codex/AGENTS.md", detail, "setup.ts refuses to write through a dangling AGENTS.md link");
    assertOnlyDrift(RULES_DANGLING_HOME, ".claude/rules", detail, "setup.ts cannot create the rule file under a dangling rules link");
  });

  test("a rules path that is not a directory is drift setup.ts cannot clear", () => {
    const detail = "not a directory — setup.ts cannot create the rule file; move it aside and rerun setup.ts";
    for (const [home, message] of [
      [RULES_FILE_HOME, "setup.ts cannot create the rule file under a regular rules file"],
      [RULES_FILE_LINK_HOME, "setup.ts cannot create the rule file under a rules link to a file"],
    ]) {
      assertOnlyDrift(home, ".claude/rules", detail, message);
      assert.strictEqual(homeRun(home).report.unreadable, 0, `${message}: the rule marker is not an unreadable coverage gap`);
    }
  });

  test("a marked Claude rule file that is a directory or a link to one is drift setup.ts cannot clear", () => {
    const detail = "a directory — setup.ts cannot write it; move it aside and rerun setup.ts";
    for (const home of [RULE_DIRECTORY_HOME, RULE_DIRECTORY_LINK_HOME]) {
      assertOnlyDrift(home, ".claude/rules/agents-kit-core-rules.md", detail, "setup.ts cannot write the rule file over a directory");
      assert.strictEqual(homeRun(home).report.unreadable, 0, "the directory is not an unreadable coverage gap");
    }
  });

  test("a settings.json or AGENTS.md that is a directory is drift setup.ts cannot clear", () => {
    const detail = "a directory — setup.ts cannot write it; move it aside and rerun setup.ts";
    for (const [home, path, message] of [
      [SETTINGS_DIRECTORY_HOME, ".claude/settings.json", "setup.ts cannot merge the hook entry into a settings.json directory"],
      [AGENTS_DIRECTORY_HOME, ".codex/AGENTS.md", "setup.ts cannot write the core-rules block into an AGENTS.md directory"],
    ]) {
      assertOnlyDrift(home, path, detail, message);
      assert.strictEqual(homeRun(home).report.unreadable, 0, `${message}: the directory is not an unreadable coverage gap`);
    }
  });

  test("a non-empty AGENTS.override.md hides the core-rules block", () => {
    assertOnlyDrift(
      OVERRIDE_HOME,
      ".codex/AGENTS.override.md",
      "non-empty — Codex reads it in place of AGENTS.md, hiding the core-rules block; empty or remove it",
      "Codex reads the override instead of AGENTS.md",
    );
  });
});

test("a clean install reports no drift in either home, its core-rules delivery included", () => {
  const { report, stderr } = runCheck(["--installs", KIT, CLEAN_CLAUDE_HOME, CLEAN_CODEX_HOME]);
  assert.strictEqual(stderr, "", "a clean install must produce no warnings");
  assert.deepStrictEqual(report.findings, [], "user hooks, user lines, and key order must not read as drift");
  assert.strictEqual(report.unreadable, 0, "a clean install leaves nothing unread");
  assert.strictEqual(report.scanned, 14, "eight Claude Code items, its marked rule file included, and six Codex items");
});

test("an empty or whitespace-only AGENTS.override.md hides nothing", () => {
  const { report, stderr } = runCheck(["--installs", KIT, EMPTY_OVERRIDE_HOME, BLANK_OVERRIDE_HOME]);
  assert.strictEqual(stderr, "", "an empty override must produce no warnings");
  assert.deepStrictEqual(report.findings, [], "Codex skips an override whose trimmed text is empty");
});

test("an override symlink into an unreadable directory reports a coverage gap", (t: TestContext) => {
  const lockedDir = join(DELIVERY, "locked-override", "locked");
  const target = join(lockedDir, "override.md");
  const override = join(LOCKED_OVERRIDE_HOME, "AGENTS.override.md");
  mkdirSync(lockedDir);
  writeFileSync(target, "Temporary global override.\n");
  symlinkSync(target, override);
  t.after(() => chmodSync(lockedDir, 0o755));
  chmodSync(lockedDir, 0o000);
  if (isReadable(target)) {
    t.skip("the unreadable-override case needs a user that chmod 000 actually stops");
    return;
  }
  const { report } = runCheck(["--installs", KIT, LOCKED_OVERRIDE_HOME]);
  assert.strictEqual(report.unreadable, 1, "the inaccessible override must count as unreadable");
  assert.deepStrictEqual(report.unreadablePaths, [override], "unreadablePaths names the override by absolute path");
  assert.deepStrictEqual(report.findings, [], "the installed core-rules block matches the kit");
});

test("a never-installed home skips the core-rules delivery checks", () => {
  const { report } = runCheck(["--installs", KIT, FRESH_HOME, ABSENT_HOME]);
  assert.deepStrictEqual(
    report.findings.map((finding) => finding.detail),
    ["no kit markers — never installed", "no kit markers — never installed"],
    "a markerless home keeps its one line instead of per-item delivery findings",
  );
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

describe("two roots sharing slugs, scanned once", () => {
  let duplicatesRun: CheckRun;
  before(() => {
    duplicatesRun = runCheck(DUP_ARGS);
  });

  test("a slug in two roots reports once per colliding folder, not once per collision", () => {
    const { report } = duplicatesRun;
    assert.strictEqual(findingCount(report, "duplicate-slug"), 6, "duplicate-slug finding count");
  });

  test("each side of a collision is actionable from its own finding", () => {
    const { report } = duplicatesRun;
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
    const { report } = duplicatesRun;
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
    const { report } = duplicatesRun;
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
    const { report } = duplicatesRun;
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

describe("a root of grouping directories, scanned once", () => {
  let groupsRun: CheckRun;
  before(() => {
    groupsRun = runCheck(GROUPS_ARGS);
  });

  test("a root of grouping directories scans its task leaves and reports nothing about the groups", () => {
    const { report, stderr } = groupsRun;
    assert.strictEqual(stderr, "", "a readable group tree must produce no warnings");
    assert.strictEqual(
      report.scanned,
      3,
      "scanned counts the active, archived, and parked leaves — never the four groups above them",
    );
    assert.deepStrictEqual(
      report.findings.map((entry) => entry.path).filter((path) => !path.endsWith("-leaf")),
      [],
      "a directory holding only a group file raises no finding of its own",
    );
    assert.strictEqual(findingCount(report, "nested-task"), 0, "a correctly spelled group tree hides no task folder");
  });

  test("a group file dropped straight into a nested Archive/ or Backlog/ makes no task and no finding", () => {
    const { report } = groupsRun;
    for (const container of [
      "groups/product/backend/empty/Archive",
      "groups/product/backend/empty/Backlog",
    ]) {
      assert.deepStrictEqual(
        report.findings.filter((entry) => entry.path === container),
        [],
        `${container} carries a group file and is still not a task folder`,
      );
    }
    assert.strictEqual(report.scanned, 3, "the two decoy group files add no task folder to the walk");
  });

  test("a task archived inside a nested group is counted and exempt from every check but duplicate-slug", () => {
    const { report } = groupsRun;
    assert.deepStrictEqual(
      report.findings.filter(
        (entry) => entry.path === "groups/product/backend/empty/Archive/archived-leaf",
      ),
      [],
      "a done leaf well past the stale window raises neither stale nor done-unarchived once archived",
    );
  });

  test("a backlogged task inside a nested group is exempt from stale alone", () => {
    const { report } = groupsRun;
    assert.strictEqual(findingCount(report, "stale"), 0, "a parked leaf past the stale window is exempt");
    assert.deepStrictEqual(
      findingDetails(report, "started-in-backlog", "groups/product/backend/empty/Backlog/parked-leaf"),
      ["executing, parked in Backlog/ — a parked task must be unstarted"],
      "the same leaf is still judged by the checks the backlog does not exempt",
    );
  });
});

describe("a near-miss group, scanned once", () => {
  let nearMissRun: CheckRun;
  before(() => {
    nearMissRun = runCheck(NEAR_MISS_ARGS);
  });

  test("a group holding a CONTEXT.md instead of a GROUP_CONTEXT.md is named with the task folders it hides", () => {
    const { report } = nearMissRun;
    assert.strictEqual(report.scanned, 1, "the near-miss group is the only folder the walk claims");
    assert.strictEqual(
      findingDetail(report, "nested-task", "groups-near-miss/product"),
      "claimed as a task folder, hiding the task folders beneath it: groups-near-miss/product/Archive/hidden-archived, groups-near-miss/product/backend/hidden-leaf",
      "the finding names every hidden task folder beneath the claimed one",
    );
  });

  test("a role file misfiled into a container under a claim never makes the container the hidden task", () => {
    const { report } = nearMissRun;
    const hidden = findingDetail(report, "nested-task", "groups-near-miss/product")
      .replace("claimed as a task folder, hiding the task folders beneath it: ", "")
      .split(", ");
    assert.ok(
      hidden.includes("groups-near-miss/product/Archive/hidden-archived"),
      "the descent walks through the container to the task folder beneath it",
    );
    assert.ok(
      !hidden.includes("groups-near-miss/product/Archive"),
      "the container is tested before the recognition set, so its own CONTEXT.md never claims it",
    );
  });
});

test("a claimed folder under Archive/ is still named with the task folders it hides", () => {
  const { report } = runCheck(ARCHIVED_NEAR_MISS_ARGS);
  assert.strictEqual(report.scanned, 1, "the archived near-miss group is the only folder the walk claims");
  assert.strictEqual(
    findingDetail(report, "nested-task", "groups-archived-near-miss/Archive/product"),
    "claimed as a task folder, hiding the task folders beneath it: groups-archived-near-miss/Archive/product/backend/hidden-leaf",
    "the archived exemption does not reach nested-task — a claim hides the folders beneath it wherever it sits",
  );
  assert.deepStrictEqual(
    report.findings
      .filter((entry) => entry.path === "groups-archived-near-miss/Archive/product")
      .map((entry) => entry.check),
    ["nested-task"],
    "every other check still exempts the folder, well past the stale window as it is",
  );
});

test("a task under a group inside Backlog/ is parked by nothing, while one directly under it is", () => {
  const { report } = runCheck([GROUPS_DEEP_BACKLOG]);
  assert.deepStrictEqual(
    findingDetails(report, "started-in-backlog", "groups-deep-backlog/Backlog/deeper/grouped-leaf"),
    [],
    "a group between the container and the task leaves the task's immediate parent an ordinary group",
  );
  assert.deepStrictEqual(
    report.findings.filter((entry) => entry.check === "stale").map((entry) => entry.path),
    ["groups-deep-backlog/Backlog/deeper/grouped-leaf"],
    "the grouped leaf is executing and past the window, and no backlog exemption reaches it",
  );
  assert.deepStrictEqual(
    findingDetails(report, "started-in-backlog", "groups-deep-backlog/Backlog/parked-leaf"),
    ["executing, parked in Backlog/ — a parked task must be unstarted"],
    "the immediate-parent position is still the parked one",
  );
});

test("a slug repeated in two groups of one root is reported per folder, each keeping its root", () => {
  const { report } = runCheck([GROUPS_DUP]);
  assert.strictEqual(report.scanned, 2, "both group leaves are walked");
  assert.strictEqual(findingCount(report, "duplicate-slug"), 2, "one finding per colliding folder");
  assert.strictEqual(
    findingDetail(report, "duplicate-slug", "groups-dup/alpha/shared-leaf"),
    `slug "shared-leaf" also at ${join(GROUPS_DUP, "beta", "shared-leaf")}`,
    "a collision across two groups names its peer by absolute path",
  );
  assert.deepStrictEqual(
    findingRoots(report, "duplicate-slug", "groups-dup/beta/shared-leaf"),
    [GROUPS_DUP],
    "each finding carries the root its folder was walked from",
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
