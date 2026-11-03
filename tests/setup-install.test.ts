import assert from "node:assert";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, delimiter, dirname, join, resolve, sep } from "node:path";
import { after, before, test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SETUP = join(REPO_DIR, "setup.ts");
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const MARKER = ".agents-kit";
const CORE_RULES_MARKER = ".agents-kit-core-rules";
const AGENT_MARKER_PREFIX = ".agents-kit-";
const EXECUTOR_MARKER = `${AGENT_MARKER_PREFIX}executor`;
const EXECUTOR_SKIP = "skipped (not kit-managed): agents/executor";
const CONFIG_VERDICT = /[✓⚠] config/;
const WARNED_CONFIG = "⚠ config";
const CUSTOM_AGENT_ERROR = /malformed agent|agent role definition|custom[- ]agent.*(error|invalid|malformed)/i;
const TOML_INTERPRETERS: readonly string[] = [
  "python3",
  "python3.14",
  "python3.13",
  "python3.12",
  "python3.11",
];

const TEST_ROOT_PREFIX = join(tmpdir(), "agents-kit-setup-install.");
const TEST_ROOT = mkdtempSync(TEST_ROOT_PREFIX);
const OPERATOR_HOME = resolve(homedir());
const PRIMARY_HOME = join(TEST_ROOT, "primary-home");
const CLAUDE_HOME = join(PRIMARY_HOME, ".claude");
const CODEX_HOME = join(PRIMARY_HOME, ".codex");
const HOMES: readonly string[] = [CLAUDE_HOME, CODEX_HOME];
const CLAUDE_EXECUTOR = join(CLAUDE_HOME, "agents", "executor.md");
const CODEX_EXECUTOR = join(CODEX_HOME, "agents", "executor.toml");
const CLAUDE_EXECUTOR_MARKER = join(CLAUDE_HOME, "agents", EXECUTOR_MARKER);
const CODEX_EXECUTOR_MARKER = join(CODEX_HOME, "agents", EXECUTOR_MARKER);
const CLAUDE_BYSTANDER = join(CLAUDE_HOME, "agents", "bystander.md");
const CODEX_BYSTANDER = join(CODEX_HOME, "agents", "bystander.toml");
const RULE_FILE = "agents-kit-core-rules.md";
const RULE_FILE_SKIP = `  skipped (not kit-managed): rules/${RULE_FILE}`;
const RULE_OWNER_HOME = join(TEST_ROOT, "rule-owner-home");
const RULE_OWNER_FILE = join(RULE_OWNER_HOME, ".claude", "rules", RULE_FILE);
const LINKED_RULE_HOME = join(TEST_ROOT, "linked-rule-home");
const LINKED_RULE_FILE = join(LINKED_RULE_HOME, ".claude", "rules", RULE_FILE);
const LINKED_RULE_TARGET = join(TEST_ROOT, "user-rule.md");
const DANGLING_RULE_HOME = join(TEST_ROOT, "dangling-rule-home");
const DANGLING_RULE_FILE = join(DANGLING_RULE_HOME, ".claude", "rules", RULE_FILE);
const DANGLING_RULE_TARGET = join(TEST_ROOT, "missing-rule.md");
const USER_RULE_FILE = "user-owned Claude rule file\n";
const CLAUDE_RULE_FILE = join(CLAUDE_HOME, "rules", RULE_FILE);
const CLAUDE_SETTINGS = join(CLAUDE_HOME, "settings.json");
const HOOK_EVENT = "SubagentStart";
const HOOK_MATCHER = "^(Explore|Plan)$";
const HOOK_TOKEN = "agents-kit-core-rules";
const HOOK_CONTEXT_LIMIT = 10_000;
const HOOK_SKIP = `Skipping the ${HOOK_EVENT} hook: `;
const USER_RULE_READER = `cat ~/.claude/rules/${HOOK_TOKEN}.md`;
const HOOK_MERGE_HOME = join(TEST_ROOT, "hook-merge-home");
const HOOK_MERGE_SETTINGS = join(HOOK_MERGE_HOME, ".claude", "settings.json");
const INVALID_SETTINGS_HOME = join(TEST_ROOT, "invalid-settings-home");
const INVALID_SETTINGS = join(INVALID_SETTINGS_HOME, ".claude", "settings.json");
const INVALID_SETTINGS_TEXT = '{\n  "model": "opus",\n';
const DANGLING_SETTINGS_HOME = join(TEST_ROOT, "dangling-settings-home");
const DANGLING_SETTINGS = join(DANGLING_SETTINGS_HOME, ".claude", "settings.json");
const DANGLING_SETTINGS_TARGET = join(TEST_ROOT, "missing-settings-parent", "settings.json");
const MISSHAPEN_SETTINGS_HOME = join(TEST_ROOT, "misshapen-settings-home");
const MISSHAPEN_SETTINGS = join(MISSHAPEN_SETTINGS_HOME, ".claude", "settings.json");
const MISSHAPEN_SETTINGS_TEXT = '{\n  "hooks": {\n    "SubagentStart": {\n      "matcher": "Explore"\n    }\n  }\n}\n';
const LINKED_FILES_HOME = join(TEST_ROOT, "linked-files-home");
const LINKED_SETTINGS = join(LINKED_FILES_HOME, ".claude", "settings.json");
const LINKED_CODEX_AGENTS = join(LINKED_FILES_HOME, ".codex", "AGENTS.md");
const SYNCED_DIR = join(TEST_ROOT, "synced");
const SYNCED_SETTINGS = join(SYNCED_DIR, "settings.json");
const SYNCED_CODEX_AGENTS = join(SYNCED_DIR, "codex-AGENTS.md");
const SYNCED_CODEX_LINE = "Synced user line without a trailing newline.";
const BLOCK_START = "<!-- agents-kit:core-rules:start -->";
const BLOCK_END = "<!-- agents-kit:core-rules:end -->";
const CODEX_BLOCK = `${BLOCK_START}\n${readFileSync(join(REPO_DIR, "CORE_RULES.md"), "utf8")}${BLOCK_END}`;
const BLOCK_SKIP = "Skipping the core-rules block: ";
const CODEX_AGENTS = join(CODEX_HOME, "AGENTS.md");
const CODEX_BLOCK_HOME = join(TEST_ROOT, "codex-block-home");
const CODEX_BLOCK_AGENTS = join(CODEX_BLOCK_HOME, ".codex", "AGENTS.md");
const USER_CODEX_LINE = "Prefer the user's own Codex instruction.\n";
const USER_CODEX_HEAD = "# User instructions\n\nKeep this line above the kit block.\n\n";
const USER_CODEX_TAIL = "\nKeep this line below the kit block.\n";
const STALE_CODEX_BLOCK = `${BLOCK_START}\nstale core rules\n${BLOCK_END}`;
const UNMATCHED_MARKER_HOME = join(TEST_ROOT, "unmatched-marker-home");
const UNMATCHED_MARKER_AGENTS = join(UNMATCHED_MARKER_HOME, ".codex", "AGENTS.md");
const UNMATCHED_MARKER_TEXT = `${USER_CODEX_LINE}${BLOCK_START}\nan unterminated kit block\n${USER_CODEX_TAIL}${STALE_CODEX_BLOCK}\n`;
const REVERSED_MARKER_HOME = join(TEST_ROOT, "reversed-marker-home");
const REVERSED_MARKER_AGENTS = join(REVERSED_MARKER_HOME, ".codex", "AGENTS.md");
const REVERSED_MARKER_TEXT = `${USER_CODEX_HEAD}${BLOCK_END}\n${USER_CODEX_LINE}${BLOCK_START}\n${USER_CODEX_TAIL}`;
const RENAMED_WRITES_HOME = join(TEST_ROOT, "renamed-writes-home");
const RENAMED_SETTINGS = join(RENAMED_WRITES_HOME, ".claude", "settings.json");
const RENAMED_CODEX_AGENTS = join(RENAMED_WRITES_HOME, ".codex", "AGENTS.md");
const RULE_SKIP = "Skipping the rule file: ";
const DANGLING_RULES_HOME = join(TEST_ROOT, "dangling-rules-home");
const DANGLING_RULES = join(DANGLING_RULES_HOME, ".claude", "rules");
const DANGLING_RULES_TARGET = join(TEST_ROOT, "missing-rules-parent", "rules");
const RULES_FILE_HOME = join(TEST_ROOT, "rules-file-home");
const RULES_FILE = join(RULES_FILE_HOME, ".claude", "rules");
const RULES_FILE_TEXT = "user file where the rules directory belongs\n";

interface HookCommand {
  readonly type: string;
  readonly command: string;
}

interface HookEntry {
  readonly matcher?: string;
  readonly hooks: readonly HookCommand[];
}

interface ClaudeSettings {
  readonly hooks?: Readonly<Record<string, readonly HookEntry[]>>;
  readonly [key: string]: unknown;
}

const commandEntry = (command: string, matcher?: string): HookEntry => ({
  ...(matcher === undefined ? {} : { matcher }),
  hooks: [{ type: "command", command }],
});
const USER_SUBAGENT_ENTRY = commandEntry("echo user-subagent", "general-purpose");
const USER_PLAN_ENTRY = commandEntry("echo user-plan", "Plan");
const USER_RULE_READER_ENTRY = commandEntry(USER_RULE_READER, "general-purpose");
const USER_EXPLORE_HOOK: HookCommand = { type: "command", command: "echo user-explore" };
const USER_SETTINGS: ClaudeSettings = {
  model: "opus",
  permissions: { allow: ["Bash(git status)"], deny: [] },
  hooks: {
    PreToolUse: [commandEntry("echo user-pre-tool", "Bash")],
    SubagentStart: [USER_SUBAGENT_ENTRY, USER_PLAN_ENTRY],
    Stop: [commandEntry("echo user-stop")],
  },
  statusLine: { type: "command", command: "echo user-status" },
};
const SYNCED_USER_SETTINGS: ClaudeSettings = {
  theme: "dark",
  hooks: { Stop: [commandEntry("echo synced-stop")] },
};
const CONFLICT_HOME = join(TEST_ROOT, "conflict-home");
const CONFLICT_CLAUDE = join(CONFLICT_HOME, ".claude");
const CONFLICT_CODEX = join(CONFLICT_HOME, ".codex");
const CONFLICT_REFERENCE = join(CONFLICT_CLAUDE, "references", "user.txt");
const CONFLICT_CORE_RULES = join(CONFLICT_CODEX, "CORE_RULES.md");
const CONFLICT_ENTRIES: readonly string[] = [
  ".claude",
  join(".claude", "references"),
  join(".claude", "references", "user.txt"),
  ".codex",
  join(".codex", "CORE_RULES.md"),
];

const REPO_LINK_HOME = join(TEST_ROOT, "repo-link-home");
const DANGLING_LINK_HOME = join(TEST_ROOT, "dangling-link-home");
const FOREIGN_KIT_HOME = join(TEST_ROOT, "foreign-kit-home");
const USER_LINK_HOME = join(TEST_ROOT, "user-link-home");
const FOREIGN_KIT = join(TEST_ROOT, "foreign-kit");
const DANGLING_TARGET = join(TEST_ROOT, "never-created", "skills");
const USER_LINK_TARGET = join(TEST_ROOT, "user-owned", "skills");
const USER_LINK_SKILL = "user-owned linked skill\n";
const LINKED_ENTRY_HOME = join(TEST_ROOT, "linked-entry-home");
const LINKED_ENTRY_NAME = "linked-fixture";
const LINKED_ENTRY_TARGET = join(TEST_ROOT, "user-owned-marked", LINKED_ENTRY_NAME);
const LINKED_ENTRY_SKILL = "user-owned skill reached through a link\n";
const RETIRED_SKILL = "retired-fixture";
const USER_RETIRED_SKILL = "user-owned retired-name skill\n";
const USER_LIVE_SKILL = "user-owned live-name skill\n";
const USER_CLAUDE_EXECUTOR = "user-owned Claude executor\n";
const USER_CODEX_EXECUTOR = "user-owned Codex executor\n";
const UNRELATED_CLAUDE_AGENT = "unrelated Claude agent\n";
const UNRELATED_CODEX_AGENT = "unrelated Codex agent\n";
const USER_CLAUDE_REFERENCE = "user-owned Claude references\n";
const USER_CODEX_CORE_RULES = "user-owned Codex core rules\n";
type PathKind = "absent" | "directory" | "file" | "symlink" | "other";

interface SetupRun {
  readonly status: number | null;
  readonly log: string;
}

interface CleanInstall {
  readonly claudeAgent: readonly string[];
  readonly codexAgent: readonly string[];
  readonly foreignFormats: readonly string[];
  readonly claudePayload: readonly string[];
  readonly codexPayload: readonly string[];
  readonly claudeRuleFile: readonly string[];
  readonly codexRuleFile: readonly string[];
  readonly codexBlock: readonly string[];
  readonly claudeBlock: readonly string[];
}

interface TomlProbe {
  readonly interpreter: string | null;
  readonly status: number | null;
  readonly output: string;
}

interface DoctorProbe {
  readonly available: boolean;
  readonly configLine: string;
  readonly summary: string;
  readonly detail: string;
}

interface ManagedReinstall {
  readonly claudeAgent: readonly string[];
  readonly codexAgent: readonly string[];
  readonly payload: readonly string[];
  readonly ruleFile: readonly string[];
}

interface PreservedPair {
  readonly claude: readonly string[];
  readonly codex: readonly string[];
}

interface CollisionRun {
  readonly skips: number;
  readonly problems: readonly string[];
}

interface ExecutorCollision extends PreservedPair {
  readonly skips: number;
  readonly unrelatedClaude: readonly string[];
  readonly unrelatedCodex: readonly string[];
}

interface OrphanRecovery {
  readonly claudeAgent: readonly string[];
  readonly codexAgent: readonly string[];
  readonly unrelated: readonly string[];
}

interface WholeHomeConflict {
  readonly status: number | null;
  readonly log: string;
  readonly problems: readonly string[];
}

interface RefusedFile extends SetupRun {
  readonly problems: readonly string[];
}

interface CleanSettings {
  readonly kitEntry: HookEntry | null;
  readonly created: readonly string[];
  readonly codexSettings: readonly string[];
  readonly hookOutput: readonly string[];
}

interface SettingsMerge {
  readonly merged: readonly string[];
  readonly rerun: readonly string[];
}

interface LinkedFiles {
  readonly settings: readonly string[];
  readonly codexAgents: readonly string[];
}

interface CodexBlockEdits {
  readonly appended: readonly string[];
  readonly rerun: readonly string[];
  readonly replaced: readonly string[];
}

interface Observations {
  readonly clean: CleanInstall;
  readonly toml: TomlProbe;
  readonly doctor: DoctorProbe | null;
  readonly managed: ManagedReinstall;
  readonly retiredSkill: readonly string[];
  readonly userSkill: PreservedPair;
  readonly liveName: CollisionRun;
  readonly liveNameRecovery: readonly string[];
  readonly executor: ExecutorCollision;
  readonly executorReinstall: CollisionRun;
  readonly orphan: OrphanRecovery;
  readonly conflict: WholeHomeConflict;
  readonly symlinkGate: SymlinkGate;
  readonly ruleOwner: CollisionRun & SetupRun;
  readonly linkedRule: CollisionRun & SetupRun;
  readonly danglingRule: CollisionRun & SetupRun;
  readonly cleanSettings: CleanSettings;
  readonly cleanRerun: readonly string[];
  readonly hookMerge: SettingsMerge;
  readonly invalidSettings: RefusedFile;
  readonly danglingSettings: RefusedFile;
  readonly misshapenSettings: RefusedFile;
  readonly linkedFiles: LinkedFiles;
  readonly codexBlockEdits: CodexBlockEdits;
  readonly unmatchedMarkers: RefusedFile;
  readonly reversedMarkers: RefusedFile;
  readonly renamedWrites: readonly string[];
  readonly danglingRules: RefusedFile;
  readonly rulesFile: RefusedFile;
}

interface RefusedLink {
  readonly status: number | null;
  readonly log: string;
  readonly problems: readonly string[];
}

interface SymlinkGate {
  readonly repoLink: readonly string[];
  readonly dangling: readonly string[];
  readonly foreignKit: readonly string[];
  readonly userLink: RefusedLink;
  readonly linkedEntry: readonly string[];
}

function pathKind(path: string): PathKind {
  let stats;
  try {
    stats = lstatSync(path);
  } catch {
    return "absent";
  }
  if (stats.isSymbolicLink()) return "symlink";
  if (stats.isDirectory()) return "directory";
  if (stats.isFile()) return "file";
  return "other";
}

function markerProblems(path: string): string[] {
  return pathKind(path) === "file" ? [] : [`expected ownership marker: ${path}`];
}

function absenceProblems(path: string): string[] {
  const kind = pathKind(path);
  return kind === "absent" ? [] : [`expected path to remain absent: ${path} (found ${kind})`];
}

function copyProblems(source: string, target: string): string[] {
  if (pathKind(target) !== "file") return [`expected file: ${target}`];
  return readFileSync(source).equals(readFileSync(target)) ? [] : [`files differ: ${source} and ${target}`];
}

function contentProblems(path: string, expected: string): string[] {
  if (pathKind(path) !== "file") return [`expected a preserved file at ${path} (found ${pathKind(path)})`];
  const actual = readFileSync(path, "utf8");
  return actual === expected ? [] : [`${path} was rewritten as ${JSON.stringify(actual)}`];
}

function entryNames(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name !== MARKER)
    .sort();
}

function treeProblems(source: string, target: string): string[] {
  const sourceKind = pathKind(source);
  const targetKind = pathKind(target);
  if (sourceKind !== targetKind) return [`${target} is ${targetKind} where ${source} is ${sourceKind}`];
  switch (sourceKind) {
    case "symlink":
      return readlinkSync(source) === readlinkSync(target)
        ? []
        : [`symlink target differs: ${target} points at ${readlinkSync(target)}`];
    case "file":
      return readFileSync(source).equals(readFileSync(target)) ? [] : [`files differ: ${source} and ${target}`];
    case "directory": {
      const names = new Set([...entryNames(source), ...entryNames(target)]);
      return [...names].sort().flatMap((name) => treeProblems(join(source, name), join(target, name)));
    }
    default:
      return [`unsupported entry: ${source}`];
  }
}

function entryList(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: "utf8" }).sort();
}

function unchangedTreeProblems(root: string, expected: readonly string[]): string[] {
  const actual = entryList(root);
  const same = actual.length === expected.length && actual.every((entry, index) => entry === expected[index]);
  return same ? [] : [`${root} holds ${JSON.stringify(actual)} rather than ${JSON.stringify(expected)}`];
}

function skillNames(): string[] {
  return readdirSync(join(REPO_DIR, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function symlinksUnder(root: string): string[] {
  return entryList(root)
    .map((entry) => join(root, entry))
    .filter((path) => pathKind(path) === "symlink");
}

function agentSources(extension: string): string[] {
  return readdirSync(join(REPO_DIR, "agents"))
    .filter((name) => !name.startsWith(".") && name.endsWith(`.${extension}`))
    .sort();
}

function agentProblems(hostHome: string, extension: string): string[] {
  const sources = agentSources(extension);
  if (sources.length === 0) return [`the kit ships no agents/*.${extension} definition to install`];
  return sources.flatMap((sourceName) => [
    ...markerProblems(join(hostHome, "agents", `${AGENT_MARKER_PREFIX}${basename(sourceName, `.${extension}`)}`)),
    ...copyProblems(join(REPO_DIR, "agents", sourceName), join(hostHome, "agents", sourceName)),
  ]);
}

function foreignFormatProblems(): string[] {
  return [
    ...agentSources("toml").flatMap((name) => absenceProblems(join(CLAUDE_HOME, "agents", name))),
    ...agentSources("md").flatMap((name) => absenceProblems(join(CODEX_HOME, "agents", name))),
  ];
}

function sharedPayloadProblems(hostHome: string): string[] {
  const problems = [
    ...markerProblems(join(hostHome, CORE_RULES_MARKER)),
    ...copyProblems(join(REPO_DIR, "CORE_RULES.md"), join(hostHome, "CORE_RULES.md")),
    ...markerProblems(join(hostHome, "references", MARKER)),
    ...symlinksUnder(join(REPO_DIR, "references")).map((path) => `references/ must stay symlink-free: ${path}`),
    ...treeProblems(join(REPO_DIR, "references"), join(hostHome, "references")),
  ];
  for (const name of skillNames()) {
    const target = join(hostHome, "skills", name);
    problems.push(...markerProblems(join(target, MARKER)), ...treeProblems(join(REPO_DIR, "skills", name), target));
  }
  return problems;
}

function ruleFileProblems(hostHome: string): string[] {
  return [
    ...markerProblems(join(hostHome, "rules", CORE_RULES_MARKER)),
    ...copyProblems(join(REPO_DIR, "CORE_RULES.md"), join(hostHome, "rules", RULE_FILE)),
  ];
}

function ruleFileAbsenceProblems(hostHome: string): string[] {
  return [
    ...absenceProblems(join(hostHome, "rules", CORE_RULES_MARKER)),
    ...absenceProblems(join(hostHome, "rules", RULE_FILE)),
  ];
}

function preservedSkillProblems(hostHome: string, name: string, content: string): string[] {
  const skill = join(hostHome, "skills", name);
  return [...contentProblems(join(skill, "SKILL.md"), content), ...absenceProblems(join(skill, MARKER))];
}

function countExactLines(log: string, line: string): number {
  return log.split("\n").filter((entry) => entry === line).length;
}

function countMatchingLines(log: string, needle: string): number {
  return log.split("\n").filter((entry) => entry.includes(needle)).length;
}

function assertTestRootIsolated(): void {
  assert.ok(TEST_ROOT.startsWith(TEST_ROOT_PREFIX), `mkdtemp returned an unexpected path: ${TEST_ROOT}`);
  assert.strictEqual(pathKind(TEST_ROOT), "directory", `the test root must be a real directory: ${TEST_ROOT}`);
  assert.notStrictEqual(TEST_ROOT, OPERATOR_HOME, "the test root resolved to the operator HOME");
  assert.ok(
    !OPERATOR_HOME.startsWith(TEST_ROOT + sep),
    `the operator HOME ${OPERATOR_HOME} sits inside the test root ${TEST_ROOT}`,
  );
}

function assertIsolatedHome(candidate: string): void {
  const resolved = resolve(candidate);
  assert.ok(
    resolved.startsWith(TEST_ROOT + sep),
    `refusing to use a HOME outside the validated test root: ${candidate}`,
  );
  assert.notStrictEqual(resolved, OPERATOR_HOME, "refusing to use the operator HOME");
  assert.strictEqual(pathKind(resolved), "directory", `the isolated HOME must be a real directory: ${candidate}`);
}

function spawnSetup(isolatedHome: string): SetupRun {
  assertIsolatedHome(isolatedHome);
  const run = spawnSync(process.execPath, [SETUP], {
    encoding: "utf8",
    env: { ...process.env, HOME: isolatedHome },
    maxBuffer: MAX_BUFFER_BYTES,
  });
  return { status: run.status, log: `${run.stdout ?? ""}\n${run.stderr ?? run.error?.message ?? ""}` };
}

function runSetup(isolatedHome: string): string {
  const run = spawnSetup(isolatedHome);
  assert.strictEqual(run.status, 0, `setup.ts failed for isolated HOME ${isolatedHome}\n${run.log}`);
  return run.log;
}

function observeCleanInstall(): CleanInstall {
  mkdirSync(PRIMARY_HOME);
  runSetup(PRIMARY_HOME);
  return {
    claudeAgent: agentProblems(CLAUDE_HOME, "md"),
    codexAgent: agentProblems(CODEX_HOME, "toml"),
    foreignFormats: foreignFormatProblems(),
    claudePayload: sharedPayloadProblems(CLAUDE_HOME),
    codexPayload: sharedPayloadProblems(CODEX_HOME),
    claudeRuleFile: ruleFileProblems(CLAUDE_HOME),
    codexRuleFile: ruleFileAbsenceProblems(CODEX_HOME),
    codexBlock: contentProblems(CODEX_AGENTS, `${CODEX_BLOCK}\n`),
    claudeBlock: absenceProblems(join(CLAUDE_HOME, "AGENTS.md")),
  };
}

function observeTomlParse(): TomlProbe {
  for (const interpreter of TOML_INTERPRETERS) {
    const available = spawnSync(interpreter, ["-c", "import tomllib"], { encoding: "utf8" });
    if (available.error !== undefined || available.status !== 0) continue;
    const run = spawnSync(
      interpreter,
      [
        "-c",
        [
          "import sys, tomllib",
          'permission_keys = {"sandbox_mode", "sandbox_workspace_write", "sandbox_read_only", "approval_policy", "approvals_reviewer", "default_permissions", "permissions"}',
          "for path in sys.argv[1:]:",
          '    agent = tomllib.load(open(path, "rb"))',
          "    overrides = sorted(permission_keys.intersection(agent))",
          '    assert not overrides, f"{path}: permission overrides prevent inheritance: {overrides}"',
          '    assert "network_proxy" not in agent.get("features", {}), f"{path}: network proxy configuration must inherit"',
        ].join("\n"),
        ...agentSources("toml").map((name) => join(CODEX_HOME, "agents", name)),
      ],
      { encoding: "utf8", maxBuffer: MAX_BUFFER_BYTES },
    );
    return { interpreter, status: run.status, output: `${run.stdout ?? ""}\n${run.stderr ?? ""}` };
  }
  return { interpreter: null, status: null, output: "" };
}

function runDoctor(args: readonly string[]): SetupRun {
  const run = spawnSync("codex", ["--strict-config", "doctor", ...args], {
    encoding: "utf8",
    env: { ...process.env, CODEX_HOME },
    maxBuffer: MAX_BUFFER_BYTES,
  });
  return {
    status: run.error === undefined ? run.status : null,
    log: run.error === undefined ? `${run.stdout ?? ""}\n${run.stderr ?? ""}` : "",
  };
}

function doctorConfigLine(log: string): string {
  const lines = log.split("\n");
  const heading = lines.indexOf("Configuration");
  if (heading === -1) return "";
  return lines.slice(heading + 1).find((line) => /config\s+loaded/.test(line)) ?? "";
}

function observeDoctor(): DoctorProbe {
  const summary = runDoctor(["--summary"]);
  if (summary.status === null) return { available: false, configLine: "", summary: "", detail: "" };
  const configLine = doctorConfigLine(summary.log);
  const detail = configLine.includes(WARNED_CONFIG) ? runDoctor(["--no-color", "--ascii"]).log : "";
  return { available: true, configLine, summary: summary.log, detail };
}

function observeManagedReinstall(): ManagedReinstall {
  for (const name of agentSources("md")) writeFileSync(join(CLAUDE_HOME, "agents", name), "stale managed Claude definition\n");
  for (const name of agentSources("toml")) writeFileSync(join(CODEX_HOME, "agents", name), "stale managed Codex definition\n");
  for (const home of HOMES) {
    writeFileSync(join(home, "skills", "translate", "SKILL.md"), "stale managed skill\n");
    writeFileSync(join(home, "references", "workflow", "executor-contract.md"), "stale managed reference\n");
    writeFileSync(join(home, "CORE_RULES.md"), "stale managed core rules\n");
  }
  writeFileSync(join(CLAUDE_HOME, "rules", RULE_FILE), "stale managed rule file\n");
  runSetup(PRIMARY_HOME);
  return {
    claudeAgent: agentProblems(CLAUDE_HOME, "md"),
    codexAgent: agentProblems(CODEX_HOME, "toml"),
    payload: HOMES.flatMap((home) => sharedPayloadProblems(home)),
    ruleFile: ruleFileProblems(CLAUDE_HOME),
  };
}

function observeRetiredSkill(): string[] {
  for (const home of HOMES) {
    const skill = join(home, "skills", RETIRED_SKILL);
    mkdirSync(skill);
    writeFileSync(join(skill, MARKER), "");
    writeFileSync(join(skill, "SKILL.md"), "retired managed skill\n");
  }
  runSetup(PRIMARY_HOME);
  return [
    ...HOMES.flatMap((home) => absenceProblems(join(home, "skills", RETIRED_SKILL))),
    ...HOMES.flatMap((home) => sharedPayloadProblems(home)),
  ];
}

function observeUserOwnedSkill(): PreservedPair {
  for (const home of HOMES) {
    const skill = join(home, "skills", RETIRED_SKILL);
    mkdirSync(skill);
    writeFileSync(join(skill, "SKILL.md"), USER_RETIRED_SKILL);
  }
  runSetup(PRIMARY_HOME);
  return {
    claude: preservedSkillProblems(CLAUDE_HOME, RETIRED_SKILL, USER_RETIRED_SKILL),
    codex: preservedSkillProblems(CODEX_HOME, RETIRED_SKILL, USER_RETIRED_SKILL),
  };
}

function observeLiveNameCollision(collidingSkill: string): CollisionRun {
  for (const home of HOMES) {
    const skill = join(home, "skills", collidingSkill);
    rmSync(skill, { recursive: true, force: true });
    mkdirSync(skill);
    writeFileSync(join(skill, "SKILL.md"), USER_LIVE_SKILL);
  }
  const log = runSetup(PRIMARY_HOME);
  return {
    skips: countExactLines(log, `  skipped (not kit-managed): ${collidingSkill}`),
    problems: HOMES.flatMap((home) => [
      ...preservedSkillProblems(home, collidingSkill, USER_LIVE_SKILL),
      ...unchangedTreeProblems(join(home, "skills", collidingSkill), ["SKILL.md"]),
    ]),
  };
}

function observeLiveNameRecovery(collidingSkill: string): string[] {
  for (const home of HOMES) rmSync(join(home, "skills", collidingSkill), { recursive: true, force: true });
  runSetup(PRIMARY_HOME);
  return HOMES.flatMap((home) => sharedPayloadProblems(home));
}

function preservedExecutorProblems(): string[] {
  return [
    ...contentProblems(CLAUDE_EXECUTOR, USER_CLAUDE_EXECUTOR),
    ...absenceProblems(CLAUDE_EXECUTOR_MARKER),
    ...contentProblems(CODEX_EXECUTOR, USER_CODEX_EXECUTOR),
    ...absenceProblems(CODEX_EXECUTOR_MARKER),
  ];
}

function preservedUnrelatedProblems(): string[] {
  return [
    ...contentProblems(CLAUDE_BYSTANDER, UNRELATED_CLAUDE_AGENT),
    ...contentProblems(CODEX_BYSTANDER, UNRELATED_CODEX_AGENT),
  ];
}

function observeExecutorCollision(): ExecutorCollision {
  rmSync(CLAUDE_EXECUTOR_MARKER);
  rmSync(CODEX_EXECUTOR_MARKER);
  writeFileSync(CLAUDE_EXECUTOR, USER_CLAUDE_EXECUTOR);
  writeFileSync(CODEX_EXECUTOR, USER_CODEX_EXECUTOR);
  writeFileSync(CLAUDE_BYSTANDER, UNRELATED_CLAUDE_AGENT);
  writeFileSync(CODEX_BYSTANDER, UNRELATED_CODEX_AGENT);
  const log = runSetup(PRIMARY_HOME);
  return {
    skips: countMatchingLines(log, EXECUTOR_SKIP),
    claude: [...contentProblems(CLAUDE_EXECUTOR, USER_CLAUDE_EXECUTOR), ...absenceProblems(CLAUDE_EXECUTOR_MARKER)],
    codex: [...contentProblems(CODEX_EXECUTOR, USER_CODEX_EXECUTOR), ...absenceProblems(CODEX_EXECUTOR_MARKER)],
    unrelatedClaude: contentProblems(CLAUDE_BYSTANDER, UNRELATED_CLAUDE_AGENT),
    unrelatedCodex: contentProblems(CODEX_BYSTANDER, UNRELATED_CODEX_AGENT),
  };
}

function observeExecutorReinstall(): CollisionRun {
  const log = runSetup(PRIMARY_HOME);
  return {
    skips: countMatchingLines(log, EXECUTOR_SKIP),
    problems: [...preservedExecutorProblems(), ...preservedUnrelatedProblems()],
  };
}

function orphanAgents(hostHome: string, extension: string): void {
  for (const name of agentSources(extension)) {
    rmSync(join(hostHome, "agents", name));
    writeFileSync(join(hostHome, "agents", `${AGENT_MARKER_PREFIX}${basename(name, `.${extension}`)}`), "");
  }
}

function observeOrphanRecovery(): OrphanRecovery {
  orphanAgents(CLAUDE_HOME, "md");
  orphanAgents(CODEX_HOME, "toml");
  runSetup(PRIMARY_HOME);
  return {
    claudeAgent: agentProblems(CLAUDE_HOME, "md"),
    codexAgent: agentProblems(CODEX_HOME, "toml"),
    unrelated: preservedUnrelatedProblems(),
  };
}

function observeWholeHomeConflict(): WholeHomeConflict {
  mkdirSync(dirname(CONFLICT_REFERENCE), { recursive: true });
  mkdirSync(CONFLICT_CODEX, { recursive: true });
  writeFileSync(CONFLICT_REFERENCE, USER_CLAUDE_REFERENCE);
  writeFileSync(CONFLICT_CORE_RULES, USER_CODEX_CORE_RULES);
  const run = spawnSetup(CONFLICT_HOME);
  return {
    status: run.status,
    log: run.log,
    problems: [
      ...contentProblems(CONFLICT_REFERENCE, USER_CLAUDE_REFERENCE),
      ...contentProblems(CONFLICT_CORE_RULES, USER_CODEX_CORE_RULES),
      ...unchangedTreeProblems(CONFLICT_HOME, CONFLICT_ENTRIES),
    ],
  };
}

function linkedHome(home: string, target: string): void {
  mkdirSync(join(home, ".claude"), { recursive: true });
  symlinkSync(target, join(home, ".claude", "skills"));
}

function reclaimedProblems(home: string): string[] {
  const skills = join(home, ".claude", "skills");
  const kind = pathKind(skills);
  if (kind !== "directory") return [`expected a reclaimed skills directory, found ${kind}: ${skills}`];
  return skillNames().flatMap((name) => markerProblems(join(skills, name, MARKER)));
}

function preservedTargetProblems(target: string): string[] {
  return pathKind(target) === "directory" ? [] : [`a link target was removed through the symlink: ${target}`];
}

function observeSymlinkGate(): SymlinkGate {
  linkedHome(REPO_LINK_HOME, join(REPO_DIR, "skills"));
  runSetup(REPO_LINK_HOME);
  const repoLink = [
    ...reclaimedProblems(REPO_LINK_HOME),
    ...preservedTargetProblems(join(REPO_DIR, "skills")),
  ];

  linkedHome(DANGLING_LINK_HOME, DANGLING_TARGET);
  runSetup(DANGLING_LINK_HOME);
  const dangling = reclaimedProblems(DANGLING_LINK_HOME);

  mkdirSync(join(FOREIGN_KIT, "skills"), { recursive: true });
  mkdirSync(join(FOREIGN_KIT, "references"), { recursive: true });
  writeFileSync(join(FOREIGN_KIT, "setup.ts"), "// a second kit checkout\n");
  writeFileSync(join(FOREIGN_KIT, "CORE_RULES.md"), "# a second kit checkout\n");
  linkedHome(FOREIGN_KIT_HOME, join(FOREIGN_KIT, "skills"));
  runSetup(FOREIGN_KIT_HOME);
  const foreignKit = [
    ...reclaimedProblems(FOREIGN_KIT_HOME),
    ...preservedTargetProblems(join(FOREIGN_KIT, "skills")),
  ];

  mkdirSync(LINKED_ENTRY_TARGET, { recursive: true });
  writeFileSync(join(LINKED_ENTRY_TARGET, MARKER), "");
  writeFileSync(join(LINKED_ENTRY_TARGET, "SKILL.md"), LINKED_ENTRY_SKILL);
  for (const home of [".claude", ".codex"]) {
    mkdirSync(join(LINKED_ENTRY_HOME, home, "skills"), { recursive: true });
    symlinkSync(LINKED_ENTRY_TARGET, join(LINKED_ENTRY_HOME, home, "skills", LINKED_ENTRY_NAME));
  }
  runSetup(LINKED_ENTRY_HOME);
  const linkedEntry = [
    ...[".claude", ".codex"].flatMap((home) => {
      const link = join(LINKED_ENTRY_HOME, home, "skills", LINKED_ENTRY_NAME);
      const kind = pathKind(link);
      return kind === "symlink" ? [] : [`the sweep removed a linked entry whose target holds a marker: ${link} (found ${kind})`];
    }),
    ...preservedTargetProblems(LINKED_ENTRY_TARGET),
    ...contentProblems(join(LINKED_ENTRY_TARGET, "SKILL.md"), LINKED_ENTRY_SKILL),
  ];

  mkdirSync(USER_LINK_TARGET, { recursive: true });
  writeFileSync(join(USER_LINK_TARGET, "SKILL.md"), USER_LINK_SKILL);
  linkedHome(USER_LINK_HOME, USER_LINK_TARGET);
  const run = spawnSetup(USER_LINK_HOME);
  return {
    repoLink,
    dangling,
    foreignKit,
    linkedEntry,
    userLink: {
      status: run.status,
      log: run.log,
      problems: [
        pathKind(join(USER_LINK_HOME, ".claude", "skills")) === "symlink"
          ? []
          : ["the user's skills symlink was reclaimed rather than refused"],
        contentProblems(join(USER_LINK_TARGET, "SKILL.md"), USER_LINK_SKILL),
        markerProblems(join(USER_LINK_HOME, ".codex", CORE_RULES_MARKER)),
      ].flat(),
    },
  };
}

function observeRuleOwner(): CollisionRun & SetupRun {
  mkdirSync(dirname(RULE_OWNER_FILE), { recursive: true });
  writeFileSync(RULE_OWNER_FILE, USER_RULE_FILE);
  const run = spawnSetup(RULE_OWNER_HOME);
  return {
    ...run,
    skips: countExactLines(run.log, RULE_FILE_SKIP),
    problems: [
      ...contentProblems(RULE_OWNER_FILE, USER_RULE_FILE),
      ...absenceProblems(join(dirname(RULE_OWNER_FILE), CORE_RULES_MARKER)),
    ],
  };
}

function observeLinkedRule(): CollisionRun & SetupRun {
  mkdirSync(dirname(LINKED_RULE_FILE), { recursive: true });
  writeFileSync(join(dirname(LINKED_RULE_FILE), CORE_RULES_MARKER), "");
  writeFileSync(LINKED_RULE_TARGET, USER_RULE_FILE);
  symlinkSync(LINKED_RULE_TARGET, LINKED_RULE_FILE);
  const run = spawnSetup(LINKED_RULE_HOME);
  return {
    ...run,
    skips: countExactLines(run.log, RULE_FILE_SKIP),
    problems: [
      ...linkProblems(LINKED_RULE_FILE, LINKED_RULE_TARGET),
      ...contentProblems(LINKED_RULE_TARGET, USER_RULE_FILE),
    ],
  };
}

function observeDanglingRule(): CollisionRun & SetupRun {
  mkdirSync(dirname(DANGLING_RULE_FILE), { recursive: true });
  symlinkSync(DANGLING_RULE_TARGET, DANGLING_RULE_FILE);
  const run = spawnSetup(DANGLING_RULE_HOME);
  return {
    ...run,
    skips: countExactLines(run.log, RULE_FILE_SKIP),
    problems: [
      ...linkProblems(DANGLING_RULE_FILE, DANGLING_RULE_TARGET),
      ...absenceProblems(DANGLING_RULE_TARGET),
      ...absenceProblems(join(dirname(DANGLING_RULE_FILE), CORE_RULES_MARKER)),
    ],
  };
}

function settingsText(settings: unknown): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

function withSubagentEntries(settings: ClaudeSettings, entries: readonly unknown[]): unknown {
  return { ...settings, hooks: { ...settings.hooks, [HOOK_EVENT]: entries } };
}

function installedKitEntry(settingsPath: string): HookEntry | null {
  try {
    const settings: ClaudeSettings = JSON.parse(readFileSync(settingsPath, "utf8"));
    return settings.hooks?.[HOOK_EVENT]?.[0] ?? null;
  } catch {
    return null;
  }
}

function kitEntryProblems(entry: HookEntry | null): string[] {
  if (entry === null) return [`the Claude settings hold no ${HOOK_EVENT} entry`];
  const [hook, ...extra] = entry.hooks;
  const command = hook?.command ?? "";
  return [
    ...(entry.matcher === HOOK_MATCHER ? [] : [`the kit entry matches ${JSON.stringify(entry.matcher)}, not ${HOOK_MATCHER}`]),
    ...(hook?.type === "command" && extra.length === 0 ? [] : [`the kit entry must hold one command hook: ${JSON.stringify(entry.hooks)}`]),
    ...(command.includes(HOOK_TOKEN) ? [] : [`the kit command lacks its ${HOOK_TOKEN} token: ${command}`]),
    ...([TEST_ROOT, REPO_DIR, OPERATOR_HOME].some((path) => command.includes(path))
      ? [`the kit command names a machine-absolute path: ${command}`]
      : []),
  ];
}

function hookOutputProblems(isolatedHome: string, entry: HookEntry | null): string[] {
  assertIsolatedHome(isolatedHome);
  const command = entry?.hooks[0]?.command;
  if (command === undefined) return [`no installed ${HOOK_EVENT} command to run`];
  const run = spawnSync("sh", ["-c", command], {
    encoding: "utf8",
    env: { ...process.env, HOME: isolatedHome, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ""}` },
    input: JSON.stringify({ hook_event_name: HOOK_EVENT, agent_type: "Explore" }),
    maxBuffer: MAX_BUFFER_BYTES,
  });
  if (run.status !== 0 || run.stderr !== "") {
    return [`the hook command exited ${run.status}: ${run.stderr ?? run.error?.message ?? ""}`];
  }
  let output: unknown;
  try {
    output = JSON.parse(run.stdout);
  } catch {
    return [`the hook command printed more than one JSON object: ${run.stdout}`];
  }
  const ruleText = readFileSync(join(isolatedHome, ".claude", "rules", RULE_FILE), "utf8");
  const expected = { hookSpecificOutput: { hookEventName: HOOK_EVENT, additionalContext: ruleText } };
  return [
    ...(isDeepStrictEqual(output, expected) ? [] : [`the hook command printed ${run.stdout}`]),
    ...(ruleText.length <= HOOK_CONTEXT_LIMIT
      ? []
      : [`the rule file holds ${ruleText.length} characters, over the ${HOOK_CONTEXT_LIMIT}-character hook output limit`]),
  ];
}

function observeCleanSettings(): CleanSettings {
  const kitEntry = installedKitEntry(CLAUDE_SETTINGS);
  return {
    kitEntry,
    created: [
      ...kitEntryProblems(kitEntry),
      ...contentProblems(CLAUDE_SETTINGS, settingsText({ hooks: { [HOOK_EVENT]: [kitEntry] } })),
    ],
    codexSettings: absenceProblems(join(CODEX_HOME, "settings.json")),
    hookOutput: hookOutputProblems(PRIMARY_HOME, kitEntry),
  };
}

function fileSnapshot(paths: readonly string[]): (Buffer | null)[] {
  return paths.map((path) => (pathKind(path) === "absent" ? null : readFileSync(path)));
}

function rerunProblems(isolatedHome: string, paths: readonly string[]): string[] {
  const first = fileSnapshot(paths);
  runSetup(isolatedHome);
  const second = fileSnapshot(paths);
  return paths.flatMap((path, index) =>
    first[index] !== null && isDeepStrictEqual(first[index], second[index]) ? [] : [`a rerun changed or lacked ${path}`],
  );
}

function observeHookMerge(kitEntry: HookEntry | null): SettingsMerge {
  const kitHooks = kitEntry?.hooks ?? [];
  const input = withSubagentEntries(USER_SETTINGS, [
    USER_SUBAGENT_ENTRY,
    { matcher: "Explore", hooks: [...kitHooks, USER_EXPLORE_HOOK] },
    USER_PLAN_ENTRY,
    { matcher: "Plan", hooks: kitHooks },
    USER_RULE_READER_ENTRY,
  ]);
  mkdirSync(dirname(HOOK_MERGE_SETTINGS), { recursive: true });
  writeFileSync(HOOK_MERGE_SETTINGS, settingsText(input));
  runSetup(HOOK_MERGE_HOME);
  const expected = withSubagentEntries(USER_SETTINGS, [
    USER_SUBAGENT_ENTRY,
    kitEntry,
    { matcher: "Explore", hooks: [USER_EXPLORE_HOOK] },
    USER_PLAN_ENTRY,
    USER_RULE_READER_ENTRY,
  ]);
  return {
    merged: contentProblems(HOOK_MERGE_SETTINGS, settingsText(expected)),
    rerun: rerunProblems(HOOK_MERGE_HOME, [HOOK_MERGE_SETTINGS]),
  };
}

function observeRefusedFile(isolatedHome: string, path: string, text: string): RefusedFile {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  const run = spawnSetup(isolatedHome);
  return {
    ...run,
    problems: [
      ...contentProblems(path, text),
      ...ruleFileProblems(join(isolatedHome, ".claude")),
      ...sharedPayloadProblems(join(isolatedHome, ".codex")),
    ],
  };
}

function linkProblems(link: string, target: string): string[] {
  return pathKind(link) === "symlink" && readlinkSync(link) === target
    ? []
    : [`expected ${link} to remain a symlink to ${target} (found ${pathKind(link)})`];
}

function observeDanglingSettings(): RefusedFile {
  mkdirSync(dirname(DANGLING_SETTINGS), { recursive: true });
  symlinkSync(DANGLING_SETTINGS_TARGET, DANGLING_SETTINGS);
  const run = spawnSetup(DANGLING_SETTINGS_HOME);
  return {
    ...run,
    problems: [
      ...linkProblems(DANGLING_SETTINGS, DANGLING_SETTINGS_TARGET),
      ...(pathKind(DANGLING_SETTINGS_TARGET) === "absent" ? [] : ["the settings link target must remain absent"]),
      ...sharedPayloadProblems(join(DANGLING_SETTINGS_HOME, ".codex")),
      ...contentProblems(join(DANGLING_SETTINGS_HOME, ".codex", "AGENTS.md"), `${CODEX_BLOCK}\n`),
    ],
  };
}

function observeLinkedFiles(kitEntry: HookEntry | null): LinkedFiles {
  mkdirSync(SYNCED_DIR, { recursive: true });
  mkdirSync(dirname(LINKED_SETTINGS), { recursive: true });
  mkdirSync(dirname(LINKED_CODEX_AGENTS), { recursive: true });
  writeFileSync(SYNCED_SETTINGS, settingsText(SYNCED_USER_SETTINGS));
  writeFileSync(SYNCED_CODEX_AGENTS, SYNCED_CODEX_LINE);
  symlinkSync(SYNCED_SETTINGS, LINKED_SETTINGS);
  symlinkSync(SYNCED_CODEX_AGENTS, LINKED_CODEX_AGENTS);
  runSetup(LINKED_FILES_HOME);
  return {
    settings: [
      ...linkProblems(LINKED_SETTINGS, SYNCED_SETTINGS),
      ...contentProblems(SYNCED_SETTINGS, settingsText(withSubagentEntries(SYNCED_USER_SETTINGS, [kitEntry]))),
    ],
    codexAgents: [
      ...linkProblems(LINKED_CODEX_AGENTS, SYNCED_CODEX_AGENTS),
      ...contentProblems(SYNCED_CODEX_AGENTS, `${SYNCED_CODEX_LINE}\n\n${CODEX_BLOCK}\n`),
    ],
  };
}

function observeCodexBlockEdits(): CodexBlockEdits {
  mkdirSync(dirname(CODEX_BLOCK_AGENTS), { recursive: true });
  writeFileSync(CODEX_BLOCK_AGENTS, USER_CODEX_LINE);
  runSetup(CODEX_BLOCK_HOME);
  const appended = contentProblems(CODEX_BLOCK_AGENTS, `${USER_CODEX_LINE}\n${CODEX_BLOCK}\n`);
  const rerun = rerunProblems(CODEX_BLOCK_HOME, [CODEX_BLOCK_AGENTS]);
  writeFileSync(CODEX_BLOCK_AGENTS, `${USER_CODEX_HEAD}${STALE_CODEX_BLOCK}${USER_CODEX_TAIL}`);
  runSetup(CODEX_BLOCK_HOME);
  return {
    appended,
    rerun,
    replaced: contentProblems(CODEX_BLOCK_AGENTS, `${USER_CODEX_HEAD}${CODEX_BLOCK}${USER_CODEX_TAIL}`),
  };
}

function observeRenamedWrites(): string[] {
  const paths = [RENAMED_SETTINGS, RENAMED_CODEX_AGENTS];
  mkdirSync(dirname(RENAMED_SETTINGS), { recursive: true });
  mkdirSync(dirname(RENAMED_CODEX_AGENTS), { recursive: true });
  writeFileSync(RENAMED_SETTINGS, settingsText(USER_SETTINGS));
  writeFileSync(RENAMED_CODEX_AGENTS, USER_CODEX_LINE);
  const modes = [0o600, 0o640];
  paths.forEach((path, index) => chmodSync(path, modes[index]));
  const inodes = paths.map((path) => statSync(path).ino);
  runSetup(RENAMED_WRITES_HOME);
  const octal = (mode: number): string => mode.toString(8).padStart(4, "0");
  return paths.flatMap((path, index) => {
    const stats = statSync(path);
    const mode = stats.mode & 0o7777;
    return [
      ...(stats.ino === inodes[index] ? [`${path} was rewritten in place rather than replaced by rename`] : []),
      ...(mode === modes[index] ? [] : [`${path} changed mode from ${octal(modes[index])} to ${octal(mode)}`]),
      ...readdirSync(dirname(path))
        .filter((name) => name.includes(".agents-kit-tmp."))
        .map((name) => `a temporary file was left beside ${path}: ${name}`),
    ];
  });
}

function blockedRulesProblems(isolatedHome: string): string[] {
  return [
    ...kitEntryProblems(installedKitEntry(join(isolatedHome, ".claude", "settings.json"))),
    ...sharedPayloadProblems(join(isolatedHome, ".codex")),
    ...contentProblems(join(isolatedHome, ".codex", "AGENTS.md"), `${CODEX_BLOCK}\n`),
  ];
}

function observeDanglingRules(): RefusedFile {
  mkdirSync(dirname(DANGLING_RULES), { recursive: true });
  symlinkSync(DANGLING_RULES_TARGET, DANGLING_RULES);
  const run = spawnSetup(DANGLING_RULES_HOME);
  return {
    ...run,
    problems: [
      ...linkProblems(DANGLING_RULES, DANGLING_RULES_TARGET),
      ...absenceProblems(DANGLING_RULES_TARGET),
      ...blockedRulesProblems(DANGLING_RULES_HOME),
    ],
  };
}

function observeRulesFile(): RefusedFile {
  mkdirSync(dirname(RULES_FILE), { recursive: true });
  writeFileSync(RULES_FILE, RULES_FILE_TEXT);
  const run = spawnSetup(RULES_FILE_HOME);
  return {
    ...run,
    problems: [...contentProblems(RULES_FILE, RULES_FILE_TEXT), ...blockedRulesProblems(RULES_FILE_HOME)],
  };
}

function assertNoProblems(problems: readonly string[], message: string): void {
  assert.ok(problems.length === 0, `${message}:\n  ${problems.join("\n  ")}`);
}

let observed: Observations;

before(() => {
  assertTestRootIsolated();
  const collidingSkill = skillNames()[0];
  assert.ok(collidingSkill !== undefined, "no source skill is available for the name-collision case");
  const clean = observeCleanInstall();
  const cleanSettings = observeCleanSettings();
  const cleanRerun = rerunProblems(PRIMARY_HOME, [CLAUDE_RULE_FILE, CLAUDE_SETTINGS, CODEX_AGENTS]);
  observed = {
    clean,
    cleanSettings,
    cleanRerun,
    toml: observeTomlParse(),
    doctor: process.env.AGENTS_KIT_LIVE_CODEX_DOCTOR === "1" ? observeDoctor() : null,
    managed: observeManagedReinstall(),
    retiredSkill: observeRetiredSkill(),
    userSkill: observeUserOwnedSkill(),
    liveName: observeLiveNameCollision(collidingSkill),
    liveNameRecovery: observeLiveNameRecovery(collidingSkill),
    executor: observeExecutorCollision(),
    executorReinstall: observeExecutorReinstall(),
    orphan: observeOrphanRecovery(),
    conflict: observeWholeHomeConflict(),
    symlinkGate: observeSymlinkGate(),
    ruleOwner: observeRuleOwner(),
    linkedRule: observeLinkedRule(),
    danglingRule: observeDanglingRule(),
    hookMerge: observeHookMerge(cleanSettings.kitEntry),
    invalidSettings: observeRefusedFile(INVALID_SETTINGS_HOME, INVALID_SETTINGS, INVALID_SETTINGS_TEXT),
    danglingSettings: observeDanglingSettings(),
    misshapenSettings: observeRefusedFile(MISSHAPEN_SETTINGS_HOME, MISSHAPEN_SETTINGS, MISSHAPEN_SETTINGS_TEXT),
    linkedFiles: observeLinkedFiles(cleanSettings.kitEntry),
    codexBlockEdits: observeCodexBlockEdits(),
    unmatchedMarkers: observeRefusedFile(UNMATCHED_MARKER_HOME, UNMATCHED_MARKER_AGENTS, UNMATCHED_MARKER_TEXT),
    reversedMarkers: observeRefusedFile(REVERSED_MARKER_HOME, REVERSED_MARKER_AGENTS, REVERSED_MARKER_TEXT),
    renamedWrites: observeRenamedWrites(),
    danglingRules: observeDanglingRules(),
    rulesFile: observeRulesFile(),
  };
});

after(() => {
  assert.ok(TEST_ROOT.startsWith(TEST_ROOT_PREFIX), `refusing to remove an unexpected test root: ${TEST_ROOT}`);
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

test("Claude clean install agent definitions match their sources", () => {
  assertNoProblems(observed.clean.claudeAgent, "a clean install must deploy every Claude agent under its marker");
});

test("Codex clean install agent definitions match their sources", () => {
  assertNoProblems(observed.clean.codexAgent, "a clean install must deploy every Codex agent under its marker");
});

test("clean install excludes foreign native agent formats", () => {
  assertNoProblems(observed.clean.foreignFormats, "each host takes only the agent format it consumes");
});

test("Claude shared skills, references, and CORE_RULES.md install unchanged", () => {
  assertNoProblems(observed.clean.claudePayload, "the Claude home must hold the kit payload byte for byte");
});

test("Codex shared skills, references, and CORE_RULES.md install unchanged", () => {
  assertNoProblems(observed.clean.codexPayload, "the Codex home must hold the kit payload byte for byte");
});

test("Claude clean install places CORE_RULES.md in rules/ under its marker", () => {
  assertNoProblems(observed.clean.claudeRuleFile, "a clean install must deliver the core rules as a marked Claude rule file");
});

test("Codex clean install receives no Claude rule file", () => {
  assertNoProblems(observed.clean.codexRuleFile, "only the Claude home loads rules/ instruction files");
});

test("a second run leaves the always-on core-rules files byte-identical", () => {
  assertNoProblems(observed.cleanRerun, "a rerun with no source change must reproduce every always-on file");
});

test("managed reinstall refreshes the Claude rule file", () => {
  assertNoProblems(observed.managed.ruleFile, "a rerun must restore an edited marker-owned rule file");
});

test("an unmarked Claude rule file is reported, preserved, and left unmarked", () => {
  assert.strictEqual(observed.ruleOwner.status, 1, "setup.ts must exit 1 when an unmarked rule file prevents installation");
  assert.ok(observed.ruleOwner.log.includes(`${RULE_SKIP}${RULE_OWNER_FILE}`), "the refusal must name the file");
  assert.strictEqual(observed.ruleOwner.skips, 1, "the Claude home must report the rule file skipped");
  assertNoProblems(observed.ruleOwner.problems, "a same-named rule file without the marker is the user's");
});

test("a marked Claude rule symlink is reported and preserves its link and target", () => {
  assert.strictEqual(observed.linkedRule.status, 1, "setup.ts must exit 1 when a marked rule symlink prevents installation");
  assert.ok(observed.linkedRule.log.includes(`${RULE_SKIP}${LINKED_RULE_FILE}`), "the refusal must name the file");
  assert.strictEqual(observed.linkedRule.skips, 1, "the Claude home must report the rule symlink skipped exactly once");
  assertNoProblems(observed.linkedRule.problems, "a rule symlink and its user's target must survive even with a marker");
});

test("an unmarked dangling Claude rule symlink is reported, preserved, and left unmarked", () => {
  assert.strictEqual(observed.danglingRule.status, 1, "setup.ts must exit 1 when a dangling rule symlink prevents installation");
  assert.ok(observed.danglingRule.log.includes(`${RULE_SKIP}${DANGLING_RULE_FILE}`), "the refusal must name the file");
  assert.strictEqual(observed.danglingRule.skips, 1, "the Claude home must report the dangling rule symlink skipped exactly once");
  assertNoProblems(observed.danglingRule.problems, "a dangling rule symlink must survive without creating its target or marker");
});

test("a dangling rules link is preserved and exits 1 after the hook merges and the Codex home installs", () => {
  const refused = observed.danglingRules;
  assert.strictEqual(refused.status, 1, `setup.ts must exit 1 when the rule file cannot be installed:\n${refused.log}`);
  assert.ok(refused.log.includes(`${RULE_SKIP}${join(DANGLING_RULES, RULE_FILE)}`), `the refusal must name the file:\n${refused.log}`);
  assertNoProblems(refused.problems, "the dangling link must survive while the rest of the install runs");
});

test("a file where rules/ belongs is preserved and exits 1 after the hook merges and the Codex home installs", () => {
  const refused = observed.rulesFile;
  assert.strictEqual(refused.status, 1, `setup.ts must exit 1 when the rule file cannot be installed:\n${refused.log}`);
  assert.ok(refused.log.includes(`${RULE_SKIP}${join(RULES_FILE, RULE_FILE)}`), `the refusal must name the file:\n${refused.log}`);
  assertNoProblems(refused.problems, "the user's file must survive while the rest of the install runs");
});

test("a missing Claude settings.json is created holding only the kit SubagentStart entry", () => {
  assertNoProblems(observed.cleanSettings.created, "a clean install must create settings.json with the Explore/Plan hook");
});

test("Codex clean install receives no settings.json hook", () => {
  assertNoProblems(observed.cleanSettings.codexSettings, "only the Claude home runs SubagentStart hooks");
});

test("the installed SubagentStart command prints the rule file as additionalContext", () => {
  assertNoProblems(observed.cleanSettings.hookOutput, "Explore and Plan must receive the installed rule file verbatim");
});

test("the kit SubagentStart entry takes the first kit command's place, keeps user hook commands, and leaves other settings unchanged", () => {
  assertNoProblems(observed.hookMerge.merged, "the merge may move or remove only the kit's own command");
});

test("a rerun leaves merged settings.json byte-identical", () => {
  assertNoProblems(observed.hookMerge.rerun, "rewriting an already-merged settings file must reproduce its bytes");
});

test("invalid settings JSON is left untouched, reported on stderr, and exits 1 after the rest installs", () => {
  const refused = observed.invalidSettings;
  assert.strictEqual(refused.status, 1, `setup.ts must exit 1 when settings.json cannot be parsed:\n${refused.log}`);
  assert.ok(refused.log.includes(`${HOOK_SKIP}${INVALID_SETTINGS} is not valid JSON`), `the refusal must name the file:\n${refused.log}`);
  assertNoProblems(refused.problems, "an unparsable settings file must survive while every other item installs");
});

test("settings whose SubagentStart hooks are not a list are left untouched and exit 1", () => {
  const refused = observed.misshapenSettings;
  assert.strictEqual(refused.status, 1, `setup.ts must exit 1 when it cannot merge into settings.json:\n${refused.log}`);
  assert.ok(refused.log.includes(`${HOOK_SKIP}${MISSHAPEN_SETTINGS}`), `the refusal must name the file:\n${refused.log}`);
  assertNoProblems(refused.problems, "settings the merge cannot place an entry in must survive unchanged");
});

test("a dangling settings link is preserved and exits 1 after the Codex home installs", () => {
  const refused = observed.danglingSettings;
  assert.strictEqual(refused.status, 1, `setup.ts must exit 1 when settings.json cannot be written:\n${refused.log}`);
  assert.ok(refused.log.includes(`${HOOK_SKIP}${DANGLING_SETTINGS}`), `the refusal must name the file:\n${refused.log}`);
  assert.ok(refused.log.includes("ENOENT"), `the refusal must include the error code:\n${refused.log}`);
  assertNoProblems(refused.problems, "the dangling link must survive while the Codex home installs");
});

test("a symlinked settings.json is merged through its link", () => {
  assertNoProblems(observed.linkedFiles.settings, "the merge must write the link target and keep the link");
});

test("a missing Codex AGENTS.md is created holding only the core-rules block", () => {
  assertNoProblems(observed.clean.codexBlock, "a clean install must deliver the core rules between the kit markers");
});

test("the Claude home receives no AGENTS.md block", () => {
  assertNoProblems(observed.clean.claudeBlock, "only the Codex home reads its global AGENTS.md");
});

test("the core-rules block is appended after the user's Codex line", () => {
  assertNoProblems(observed.codexBlockEdits.appended, "an unmarked AGENTS.md must keep its lines and gain the block after a blank line");
});

test("a rerun leaves a Codex AGENTS.md holding user lines byte-identical", () => {
  assertNoProblems(observed.codexBlockEdits.rerun, "replacing an up-to-date block must reproduce the file");
});

test("a stale core-rules block is replaced in place between the user's lines", () => {
  assertNoProblems(observed.codexBlockEdits.replaced, "only the bytes between the kit markers may change");
});

test("a symlinked Codex AGENTS.md is written through its link", () => {
  assertNoProblems(observed.linkedFiles.codexAgents, "the block must land in the link target and keep the link");
});

test("settings.json and Codex AGENTS.md are replaced by rename rather than rewritten in place", () => {
  assertNoProblems(observed.renamedWrites, "a failed merge write must not be able to truncate the user's file");
});

test("unmatched core-rules markers leave Codex AGENTS.md untouched and exit 1 after the rest installs", () => {
  const refused = observed.unmatchedMarkers;
  assert.strictEqual(refused.status, 1, `setup.ts must exit 1 when it cannot place the block:\n${refused.log}`);
  assert.ok(refused.log.includes(`${BLOCK_SKIP}${UNMATCHED_MARKER_AGENTS}`), `the refusal must name the file:\n${refused.log}`);
  assertNoProblems(refused.problems, "a file with unmatched kit markers must survive while every other item installs");
});

test("reversed core-rules markers leave Codex AGENTS.md untouched and exit 1 after the rest installs", () => {
  const refused = observed.reversedMarkers;
  assert.strictEqual(refused.status, 1, `setup.ts must exit 1 when it cannot place the block:\n${refused.log}`);
  assert.ok(refused.log.includes(`${BLOCK_SKIP}${REVERSED_MARKER_AGENTS}`), `the refusal must name the file:\n${refused.log}`);
  assertNoProblems(refused.problems, "a file with reversed kit markers must survive while every other item installs");
});

test("both hosts install regular secretary duties and retain authority and source helper boundaries", () => {
  for (const home of HOMES) {
    for (const duty of ["runbook-maintenance", "meeting-sync"]) {
      const relative = join("references", "secretary", `${duty}.md`);
      const installed = join(home, relative);
      assert.strictEqual(pathKind(installed), "file", `${installed} must be a regular file`);
      assert.deepStrictEqual(readFileSync(installed), readFileSync(join(REPO_DIR, relative)));
    }
    const contract = readFileSync(join(home, "references", "workflow", "secretary-contract.md"), "utf8");
    assert.match(contract, /\.\.\/secretary\/meeting-sync\.md/);
    const coordinator = readFileSync(join(home, "skills", "start-secretary", "SKILL.md"), "utf8");
    assert.match(coordinator, /<kit-root>\/scripts\/meeting-sync-state\.ts/);
    assert.match(coordinator, /task-store\.md.*Resolving `<kit-root>`/);
    assert.strictEqual(pathKind(join(home, "scripts")), "absent");
    const extension = home === CLAUDE_HOME ? "md" : "toml";
    const adapter = readFileSync(join(home, "agents", `secretary.${extension}`), "utf8");
    assert.match(adapter, /secretary-contract\.md/);
    assert.match(adapter, /parent sandbox, approval setting, and managed security policy/);
    if (extension === "md") assert.match(adapter, /^disallowedTools: Write, Edit, NotebookEdit, Agent, SendMessage, Monitor, TaskStop$/m);
    else assert.doesNotMatch(adapter, /^(?:sandbox_mode|approval_policy|approvals_reviewer|default_permissions|permissions|network_access)\s*=/m);
  }
});

test("installed Codex agent TOML definitions parse and inherit parent permissions", (t: TestContext) => {
  const probe = observed.toml;
  if (probe.interpreter === null) {
    t.skip("no Python carrying tomllib is installed, so the deployed TOML was not parsed");
    return;
  }
  assert.strictEqual(
    probe.status,
    0,
    `${probe.interpreter} rejected an installed Codex agent TOML or its permission overrides:\n${probe.output}`,
  );
});

test("Codex strict-config doctor reports a valid configuration (its exit status only reflects environmental diagnostics)", (t: TestContext) => {
  const probe = observed.doctor;
  if (probe === null) {
    t.skip("set AGENTS_KIT_LIVE_CODEX_DOCTOR=1 to run Codex diagnostics with network access");
    return;
  }
  if (!probe.available) {
    t.skip("codex is not installed, so its strict-config doctor was not run");
    return;
  }
  assert.match(probe.configLine, CONFIG_VERDICT, `codex doctor reported no configuration verdict:\n${probe.summary}`);
  if (probe.configLine.includes(WARNED_CONFIG)) {
    assert.doesNotMatch(probe.detail, CUSTOM_AGENT_ERROR, `codex doctor reported a custom-agent error:\n${probe.detail}`);
  }
});

test("Claude managed reinstall agent definitions match their sources", () => {
  assertNoProblems(observed.managed.claudeAgent, "a reinstall must restore every edited Claude agent");
});

test("Codex managed reinstall agent definitions match their sources", () => {
  assertNoProblems(observed.managed.codexAgent, "a reinstall must restore every edited Codex agent");
});

test("managed reinstall refreshes the unchanged shared payload", () => {
  assertNoProblems(observed.managed.payload, "a reinstall must restore every edited marker-owned payload");
});

test("reinstall removes a marker-owned skill dropped from the source set", () => {
  assertNoProblems(observed.retiredSkill, "a marked skill the kit no longer ships must be swept, payload intact");
});

test("Claude unmarked user-owned skill directory is byte-preserved", () => {
  assertNoProblems(observed.userSkill.claude, "an unmarked Claude skill directory is the user's, not the kit's");
});

test("Codex unmarked user-owned skill directory is byte-preserved", () => {
  assertNoProblems(observed.userSkill.codex, "an unmarked Codex skill directory is the user's, not the kit's");
});

test("an unmarked directory at a live skill name is reported, preserved, and never entered", () => {
  assert.strictEqual(observed.liveName.skips, 2, "both homes must report the colliding skill name skipped");
  assertNoProblems(observed.liveName.problems, "a user directory at a shipped skill name must be left untouched");
});

test("removing the user directory lets the kit skill reinstall marked", () => {
  assertNoProblems(observed.liveNameRecovery, "clearing the collision must let the kit skill install marked again");
});

test("Claude unmarked executor collision is reported and byte-preserved", () => {
  assert.strictEqual(observed.executor.skips, 2, "both homes must report their executor collision skipped");
  assertNoProblems(observed.executor.claude, "an unmarked Claude executor is the user's file");
});

test("Codex unmarked executor collision is reported and byte-preserved", () => {
  assert.strictEqual(observed.executor.skips, 2, "both homes must report their executor collision skipped");
  assertNoProblems(observed.executor.codex, "an unmarked Codex executor is the user's file");
});

test("unrelated Claude agent remains byte-preserved", () => {
  assertNoProblems(observed.executor.unrelatedClaude, "a Claude agent the kit never ships is out of its reach");
});

test("unrelated Codex agent remains byte-preserved", () => {
  assertNoProblems(observed.executor.unrelatedCodex, "a Codex agent the kit never ships is out of its reach");
});

test("native collisions and unrelated agents remain byte-preserved on reinstall", () => {
  assert.strictEqual(observed.executorReinstall.skips, 2, "the collisions must stay skipped on a second run");
  assertNoProblems(observed.executorReinstall.problems, "a rerun must not reclaim what the first run refused");
});

test("Claude orphan-marker recovery agent definitions match their sources", () => {
  assertNoProblems(observed.orphan.claudeAgent, "a marker without its payload must reinstall every Claude agent");
});

test("Codex orphan-marker recovery agent definitions match their sources", () => {
  assertNoProblems(observed.orphan.codexAgent, "a marker without its payload must reinstall every Codex agent");
});

test("orphan recovery leaves unrelated native agents unchanged", () => {
  assertNoProblems(observed.orphan.unrelated, "reclaiming an orphaned marker must not reach the user's agents");
});

test("whole-home conflict safeguards preserve both native homes without partial installation", () => {
  const conflict = observed.conflict;
  assert.notStrictEqual(conflict.status, 0, `setup.ts must refuse a home holding user-owned shared roots:\n${conflict.log}`);
  for (const home of [CONFLICT_CLAUDE, CONFLICT_CODEX]) {
    assert.ok(conflict.log.includes(`Skipping ${home}`), `the refusal must name ${home}:\n${conflict.log}`);
  }
  assertNoProblems(conflict.problems, "a refused install must leave both native homes exactly as it found them");
});

test("a skills symlink into this repo is reclaimed", () => {
  assertNoProblems(observed.symlinkGate.repoLink, "a link into the running checkout is the kit's own to reclaim");
});

test("a dangling skills symlink is reclaimed", () => {
  assertNoProblems(observed.symlinkGate.dangling, "a link resolving to nothing blocks no one and is reclaimed");
});

test("a skills symlink to another kit checkout is reclaimed", () => {
  assertNoProblems(observed.symlinkGate.foreignKit, "a link into a second checkout is kit-owned and reclaimable");
});

test("the reclaim sweep skips a linked entry even when its target holds a marker", () => {
  assertNoProblems(
    observed.symlinkGate.linkedEntry,
    "the marker probe follows a link, so only the entry-level symlink skip keeps a user's link off the reclaim list",
  );
});

test("a skills symlink the kit does not own is refused, leaving the home uninstalled", () => {
  const userLink = observed.symlinkGate.userLink;
  assert.notStrictEqual(
    userLink.status,
    0,
    `setup.ts must refuse a home whose skills/ is a user symlink:\n${userLink.log}`,
  );
  assert.ok(
    userLink.log.includes(`Skipping ${join(USER_LINK_HOME, ".claude")}`),
    `the refusal must name the skipped home:\n${userLink.log}`,
  );
  assertNoProblems(userLink.problems, "a refused link must survive with its target, and spare the other home");
});
