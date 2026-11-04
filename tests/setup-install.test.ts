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
import { after, before, describe, test, type TestContext } from "node:test";
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
const RULE_FILE = "agents-kit-core-rules.md";
const RULE_FILE_SKIP = `  skipped (not kit-managed): rules/${RULE_FILE}`;
const USER_RULE_FILE = "user-owned Claude rule file\n";
const HOOK_EVENT = "SubagentStart";
const HOOK_MATCHER = "^(Explore|Plan)$";
const HOOK_TOKEN = "agents-kit-core-rules";
const HOOK_CONTEXT_LIMIT = 10_000;
const HOOK_SKIP = `Skipping the ${HOOK_EVENT} hook: `;
const USER_RULE_READER = `cat ~/.claude/rules/${HOOK_TOKEN}.md`;
const INVALID_SETTINGS_TEXT = '{\n  "model": "opus",\n';
const MISSHAPEN_SETTINGS_TEXT = '{\n  "hooks": {\n    "SubagentStart": {\n      "matcher": "Explore"\n    }\n  }\n}\n';
const SYNCED_CODEX_LINE = "Synced user line without a trailing newline.";
const BLOCK_START = "<!-- agents-kit:core-rules:start -->";
const BLOCK_END = "<!-- agents-kit:core-rules:end -->";
const CODEX_BLOCK = `${BLOCK_START}\n${readFileSync(join(REPO_DIR, "CORE_RULES.md"), "utf8")}${BLOCK_END}`;
const BLOCK_SKIP = "Skipping the core-rules block: ";
const USER_CODEX_LINE = "Prefer the user's own Codex instruction.\n";
const USER_CODEX_HEAD = "# User instructions\n\nKeep this line above the kit block.\n\n";
const USER_CODEX_TAIL = "\nKeep this line below the kit block.\n";
const STALE_CODEX_BLOCK = `${BLOCK_START}\nstale core rules\n${BLOCK_END}`;
const UNMATCHED_MARKER_TEXT = `${USER_CODEX_LINE}${BLOCK_START}\nan unterminated kit block\n${USER_CODEX_TAIL}${STALE_CODEX_BLOCK}\n`;
const REVERSED_MARKER_TEXT = `${USER_CODEX_HEAD}${BLOCK_END}\n${USER_CODEX_LINE}${BLOCK_START}\n${USER_CODEX_TAIL}`;
const RULE_SKIP = "Skipping the rule file: ";
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
const CONFLICT_ENTRIES: readonly string[] = [
  ".claude",
  join(".claude", "references"),
  join(".claude", "references", "user.txt"),
  ".codex",
  join(".codex", "CORE_RULES.md"),
];

const USER_LINK_SKILL = "user-owned linked skill\n";
const LINKED_ENTRY_NAME = "linked-fixture";
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

interface Scenario {
  readonly root: string;
  readonly home: string;
  readonly claude: string;
  readonly codex: string;
}

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
  readonly settingsCreated: readonly string[];
  readonly codexSettings: readonly string[];
  readonly hookOutput: readonly string[];
  readonly rerun: readonly string[];
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

interface LiveNameCollision {
  readonly collision: CollisionRun;
  readonly recovery: readonly string[];
}

interface ExecutorCollision extends PreservedPair {
  readonly skips: number;
  readonly unrelatedClaude: readonly string[];
  readonly unrelatedCodex: readonly string[];
  readonly reinstall: CollisionRun;
}

interface OrphanRecovery {
  readonly claudeAgent: readonly string[];
  readonly codexAgent: readonly string[];
  readonly unrelated: readonly string[];
}

interface RefusedRun extends SetupRun {
  readonly problems: readonly string[];
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

function frozen<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) frozen(nested);
    Object.freeze(value);
  }
  return value;
}

function scenarioPaths(name: string): Scenario {
  const root = join(TEST_ROOT, name);
  const home = join(root, "home");
  return { root, home, claude: join(home, ".claude"), codex: join(home, ".codex") };
}

function useScenario(name: string): Scenario {
  const scenario = scenarioPaths(name);
  before(() => {
    mkdirSync(scenario.home, { recursive: true });
  });
  after(() => {
    assert.ok(scenario.root.startsWith(TEST_ROOT + sep), `refusing to remove a scenario outside the test root: ${scenario.root}`);
    rmSync(scenario.root, { recursive: true, force: true });
  });
  return scenario;
}

function hostHomes(scenario: Scenario): readonly string[] {
  return [scenario.claude, scenario.codex];
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

function foreignFormatProblems(scenario: Scenario): string[] {
  return [
    ...agentSources("toml").flatMap((name) => absenceProblems(join(scenario.claude, "agents", name))),
    ...agentSources("md").flatMap((name) => absenceProblems(join(scenario.codex, "agents", name))),
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

function referenceKitEntry(scenario: Scenario): HookEntry {
  const referenceHome = join(scenario.root, "reference-home");
  mkdirSync(referenceHome);
  runSetup(referenceHome);
  const entry = installedKitEntry(join(referenceHome, ".claude", "settings.json"));
  assert.ok(entry !== null, `the reference install wrote no ${HOOK_EVENT} entry`);
  return entry;
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

function linkProblems(link: string, target: string): string[] {
  return pathKind(link) === "symlink" && readlinkSync(link) === target
    ? []
    : [`expected ${link} to remain a symlink to ${target} (found ${pathKind(link)})`];
}

function observeCleanInstall(scenario: Scenario): CleanInstall {
  runSetup(scenario.home);
  const settings = join(scenario.claude, "settings.json");
  const codexAgents = join(scenario.codex, "AGENTS.md");
  const kitEntry = installedKitEntry(settings);
  const install = {
    claudeAgent: agentProblems(scenario.claude, "md"),
    codexAgent: agentProblems(scenario.codex, "toml"),
    foreignFormats: foreignFormatProblems(scenario),
    claudePayload: sharedPayloadProblems(scenario.claude),
    codexPayload: sharedPayloadProblems(scenario.codex),
    claudeRuleFile: ruleFileProblems(scenario.claude),
    codexRuleFile: ruleFileAbsenceProblems(scenario.codex),
    codexBlock: contentProblems(codexAgents, `${CODEX_BLOCK}\n`),
    claudeBlock: absenceProblems(join(scenario.claude, "AGENTS.md")),
    settingsCreated: [
      ...kitEntryProblems(kitEntry),
      ...contentProblems(settings, settingsText({ hooks: { [HOOK_EVENT]: [kitEntry] } })),
    ],
    codexSettings: absenceProblems(join(scenario.codex, "settings.json")),
    hookOutput: hookOutputProblems(scenario.home, kitEntry),
  };
  return {
    ...install,
    rerun: rerunProblems(scenario.home, [join(scenario.claude, "rules", RULE_FILE), settings, codexAgents]),
  };
}

function observeTomlParse(codexHome: string): TomlProbe {
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
        ...agentSources("toml").map((name) => join(codexHome, "agents", name)),
      ],
      { encoding: "utf8", maxBuffer: MAX_BUFFER_BYTES },
    );
    return { interpreter, status: run.status, output: `${run.stdout ?? ""}\n${run.stderr ?? ""}` };
  }
  return { interpreter: null, status: null, output: "" };
}

function runDoctor(codexHome: string, args: readonly string[]): SetupRun {
  const run = spawnSync("codex", ["--strict-config", "doctor", ...args], {
    encoding: "utf8",
    env: { ...process.env, CODEX_HOME: codexHome },
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

function observeDoctor(codexHome: string): DoctorProbe {
  const summary = runDoctor(codexHome, ["--summary"]);
  if (summary.status === null) return { available: false, configLine: "", summary: "", detail: "" };
  const configLine = doctorConfigLine(summary.log);
  const detail = configLine.includes(WARNED_CONFIG) ? runDoctor(codexHome, ["--no-color", "--ascii"]).log : "";
  return { available: true, configLine, summary: summary.log, detail };
}

function observeManagedReinstall(scenario: Scenario): ManagedReinstall {
  runSetup(scenario.home);
  for (const name of agentSources("md")) writeFileSync(join(scenario.claude, "agents", name), "stale managed Claude definition\n");
  for (const name of agentSources("toml")) writeFileSync(join(scenario.codex, "agents", name), "stale managed Codex definition\n");
  for (const home of hostHomes(scenario)) {
    writeFileSync(join(home, "skills", "translate", "SKILL.md"), "stale managed skill\n");
    writeFileSync(join(home, "references", "workflow", "executor-contract.md"), "stale managed reference\n");
    writeFileSync(join(home, "CORE_RULES.md"), "stale managed core rules\n");
  }
  writeFileSync(join(scenario.claude, "rules", RULE_FILE), "stale managed rule file\n");
  runSetup(scenario.home);
  return {
    claudeAgent: agentProblems(scenario.claude, "md"),
    codexAgent: agentProblems(scenario.codex, "toml"),
    payload: hostHomes(scenario).flatMap((home) => sharedPayloadProblems(home)),
    ruleFile: ruleFileProblems(scenario.claude),
  };
}

function observeRetiredSkill(scenario: Scenario): string[] {
  runSetup(scenario.home);
  for (const home of hostHomes(scenario)) {
    const skill = join(home, "skills", RETIRED_SKILL);
    mkdirSync(skill);
    writeFileSync(join(skill, MARKER), "");
    writeFileSync(join(skill, "SKILL.md"), "retired managed skill\n");
  }
  runSetup(scenario.home);
  return [
    ...hostHomes(scenario).flatMap((home) => absenceProblems(join(home, "skills", RETIRED_SKILL))),
    ...hostHomes(scenario).flatMap((home) => sharedPayloadProblems(home)),
  ];
}

function observeUserOwnedSkill(scenario: Scenario): PreservedPair {
  runSetup(scenario.home);
  for (const home of hostHomes(scenario)) {
    const skill = join(home, "skills", RETIRED_SKILL);
    mkdirSync(skill);
    writeFileSync(join(skill, "SKILL.md"), USER_RETIRED_SKILL);
  }
  runSetup(scenario.home);
  return {
    claude: preservedSkillProblems(scenario.claude, RETIRED_SKILL, USER_RETIRED_SKILL),
    codex: preservedSkillProblems(scenario.codex, RETIRED_SKILL, USER_RETIRED_SKILL),
  };
}

function observeLiveNameCollision(scenario: Scenario, collidingSkill: string): LiveNameCollision {
  runSetup(scenario.home);
  for (const home of hostHomes(scenario)) {
    const skill = join(home, "skills", collidingSkill);
    rmSync(skill, { recursive: true, force: true });
    mkdirSync(skill);
    writeFileSync(join(skill, "SKILL.md"), USER_LIVE_SKILL);
  }
  const log = runSetup(scenario.home);
  const collision = {
    skips: countExactLines(log, `  skipped (not kit-managed): ${collidingSkill}`),
    problems: hostHomes(scenario).flatMap((home) => [
      ...preservedSkillProblems(home, collidingSkill, USER_LIVE_SKILL),
      ...unchangedTreeProblems(join(home, "skills", collidingSkill), ["SKILL.md"]),
    ]),
  };
  for (const home of hostHomes(scenario)) rmSync(join(home, "skills", collidingSkill), { recursive: true, force: true });
  runSetup(scenario.home);
  return { collision, recovery: hostHomes(scenario).flatMap((home) => sharedPayloadProblems(home)) };
}

function writeUnrelatedAgents(scenario: Scenario): void {
  writeFileSync(join(scenario.claude, "agents", "bystander.md"), UNRELATED_CLAUDE_AGENT);
  writeFileSync(join(scenario.codex, "agents", "bystander.toml"), UNRELATED_CODEX_AGENT);
}

function preservedUnrelatedProblems(scenario: Scenario): string[] {
  return [
    ...contentProblems(join(scenario.claude, "agents", "bystander.md"), UNRELATED_CLAUDE_AGENT),
    ...contentProblems(join(scenario.codex, "agents", "bystander.toml"), UNRELATED_CODEX_AGENT),
  ];
}

function preservedExecutorProblems(hostHome: string, extension: string, content: string): string[] {
  return [
    ...contentProblems(join(hostHome, "agents", `executor.${extension}`), content),
    ...absenceProblems(join(hostHome, "agents", EXECUTOR_MARKER)),
  ];
}

function observeExecutorCollision(scenario: Scenario): ExecutorCollision {
  runSetup(scenario.home);
  rmSync(join(scenario.claude, "agents", EXECUTOR_MARKER));
  rmSync(join(scenario.codex, "agents", EXECUTOR_MARKER));
  writeFileSync(join(scenario.claude, "agents", "executor.md"), USER_CLAUDE_EXECUTOR);
  writeFileSync(join(scenario.codex, "agents", "executor.toml"), USER_CODEX_EXECUTOR);
  writeUnrelatedAgents(scenario);
  const log = runSetup(scenario.home);
  const collision = {
    skips: countMatchingLines(log, EXECUTOR_SKIP),
    claude: preservedExecutorProblems(scenario.claude, "md", USER_CLAUDE_EXECUTOR),
    codex: preservedExecutorProblems(scenario.codex, "toml", USER_CODEX_EXECUTOR),
    unrelatedClaude: contentProblems(join(scenario.claude, "agents", "bystander.md"), UNRELATED_CLAUDE_AGENT),
    unrelatedCodex: contentProblems(join(scenario.codex, "agents", "bystander.toml"), UNRELATED_CODEX_AGENT),
  };
  const rerunLog = runSetup(scenario.home);
  return {
    ...collision,
    reinstall: {
      skips: countMatchingLines(rerunLog, EXECUTOR_SKIP),
      problems: [
        ...preservedExecutorProblems(scenario.claude, "md", USER_CLAUDE_EXECUTOR),
        ...preservedExecutorProblems(scenario.codex, "toml", USER_CODEX_EXECUTOR),
        ...preservedUnrelatedProblems(scenario),
      ],
    },
  };
}

function orphanAgents(hostHome: string, extension: string): void {
  for (const name of agentSources(extension)) {
    rmSync(join(hostHome, "agents", name));
    writeFileSync(join(hostHome, "agents", `${AGENT_MARKER_PREFIX}${basename(name, `.${extension}`)}`), "");
  }
}

function observeOrphanRecovery(scenario: Scenario): OrphanRecovery {
  runSetup(scenario.home);
  writeUnrelatedAgents(scenario);
  orphanAgents(scenario.claude, "md");
  orphanAgents(scenario.codex, "toml");
  runSetup(scenario.home);
  return {
    claudeAgent: agentProblems(scenario.claude, "md"),
    codexAgent: agentProblems(scenario.codex, "toml"),
    unrelated: preservedUnrelatedProblems(scenario),
  };
}

function observeWholeHomeConflict(scenario: Scenario): RefusedRun {
  const reference = join(scenario.claude, "references", "user.txt");
  const coreRules = join(scenario.codex, "CORE_RULES.md");
  mkdirSync(dirname(reference), { recursive: true });
  mkdirSync(scenario.codex, { recursive: true });
  writeFileSync(reference, USER_CLAUDE_REFERENCE);
  writeFileSync(coreRules, USER_CODEX_CORE_RULES);
  const run = spawnSetup(scenario.home);
  return {
    ...run,
    problems: [
      ...contentProblems(reference, USER_CLAUDE_REFERENCE),
      ...contentProblems(coreRules, USER_CODEX_CORE_RULES),
      ...unchangedTreeProblems(scenario.home, CONFLICT_ENTRIES),
    ],
  };
}

function linkSkills(scenario: Scenario, target: string): void {
  mkdirSync(scenario.claude, { recursive: true });
  symlinkSync(target, join(scenario.claude, "skills"));
}

function reclaimedProblems(scenario: Scenario): string[] {
  const skills = join(scenario.claude, "skills");
  const kind = pathKind(skills);
  if (kind !== "directory") return [`expected a reclaimed skills directory, found ${kind}: ${skills}`];
  return skillNames().flatMap((name) => markerProblems(join(skills, name, MARKER)));
}

function preservedTargetProblems(target: string): string[] {
  return pathKind(target) === "directory" ? [] : [`a link target was removed through the symlink: ${target}`];
}

function observeRepoLink(scenario: Scenario): string[] {
  linkSkills(scenario, join(REPO_DIR, "skills"));
  runSetup(scenario.home);
  return [...reclaimedProblems(scenario), ...preservedTargetProblems(join(REPO_DIR, "skills"))];
}

function observeDanglingLink(scenario: Scenario): string[] {
  linkSkills(scenario, join(scenario.root, "never-created", "skills"));
  runSetup(scenario.home);
  return reclaimedProblems(scenario);
}

function observeForeignKitLink(scenario: Scenario): string[] {
  const foreignKit = join(scenario.root, "foreign-kit");
  mkdirSync(join(foreignKit, "skills"), { recursive: true });
  mkdirSync(join(foreignKit, "references"), { recursive: true });
  writeFileSync(join(foreignKit, "setup.ts"), "// a second kit checkout\n");
  writeFileSync(join(foreignKit, "CORE_RULES.md"), "# a second kit checkout\n");
  linkSkills(scenario, join(foreignKit, "skills"));
  runSetup(scenario.home);
  return [...reclaimedProblems(scenario), ...preservedTargetProblems(join(foreignKit, "skills"))];
}

function observeLinkedEntry(scenario: Scenario): string[] {
  const target = join(scenario.root, "user-owned-marked", LINKED_ENTRY_NAME);
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, MARKER), "");
  writeFileSync(join(target, "SKILL.md"), LINKED_ENTRY_SKILL);
  for (const home of hostHomes(scenario)) {
    mkdirSync(join(home, "skills"), { recursive: true });
    symlinkSync(target, join(home, "skills", LINKED_ENTRY_NAME));
  }
  runSetup(scenario.home);
  return [
    ...hostHomes(scenario).flatMap((home) => {
      const link = join(home, "skills", LINKED_ENTRY_NAME);
      const kind = pathKind(link);
      return kind === "symlink" ? [] : [`the sweep removed a linked entry whose target holds a marker: ${link} (found ${kind})`];
    }),
    ...preservedTargetProblems(target),
    ...contentProblems(join(target, "SKILL.md"), LINKED_ENTRY_SKILL),
  ];
}

function observeUserLink(scenario: Scenario): RefusedRun {
  const target = join(scenario.root, "user-owned", "skills");
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "SKILL.md"), USER_LINK_SKILL);
  linkSkills(scenario, target);
  const run = spawnSetup(scenario.home);
  return {
    ...run,
    problems: [
      pathKind(join(scenario.claude, "skills")) === "symlink"
        ? []
        : ["the user's skills symlink was reclaimed rather than refused"],
      contentProblems(join(target, "SKILL.md"), USER_LINK_SKILL),
      markerProblems(join(scenario.codex, CORE_RULES_MARKER)),
    ].flat(),
  };
}

function claudeRuleFile(scenario: Scenario): string {
  return join(scenario.claude, "rules", RULE_FILE);
}

function observeRuleOwner(scenario: Scenario): CollisionRun & SetupRun {
  const ruleFile = claudeRuleFile(scenario);
  mkdirSync(dirname(ruleFile), { recursive: true });
  writeFileSync(ruleFile, USER_RULE_FILE);
  const run = spawnSetup(scenario.home);
  return {
    ...run,
    skips: countExactLines(run.log, RULE_FILE_SKIP),
    problems: [
      ...contentProblems(ruleFile, USER_RULE_FILE),
      ...absenceProblems(join(dirname(ruleFile), CORE_RULES_MARKER)),
    ],
  };
}

function observeLinkedRule(scenario: Scenario): CollisionRun & SetupRun {
  const ruleFile = claudeRuleFile(scenario);
  const target = join(scenario.root, "user-rule.md");
  mkdirSync(dirname(ruleFile), { recursive: true });
  writeFileSync(join(dirname(ruleFile), CORE_RULES_MARKER), "");
  writeFileSync(target, USER_RULE_FILE);
  symlinkSync(target, ruleFile);
  const run = spawnSetup(scenario.home);
  return {
    ...run,
    skips: countExactLines(run.log, RULE_FILE_SKIP),
    problems: [...linkProblems(ruleFile, target), ...contentProblems(target, USER_RULE_FILE)],
  };
}

function observeDanglingRule(scenario: Scenario): CollisionRun & SetupRun {
  const ruleFile = claudeRuleFile(scenario);
  const target = join(scenario.root, "missing-rule.md");
  mkdirSync(dirname(ruleFile), { recursive: true });
  symlinkSync(target, ruleFile);
  const run = spawnSetup(scenario.home);
  return {
    ...run,
    skips: countExactLines(run.log, RULE_FILE_SKIP),
    problems: [
      ...linkProblems(ruleFile, target),
      ...absenceProblems(target),
      ...absenceProblems(join(dirname(ruleFile), CORE_RULES_MARKER)),
    ],
  };
}

function observeHookMerge(scenario: Scenario): SettingsMerge {
  const kitEntry = referenceKitEntry(scenario);
  const settings = join(scenario.claude, "settings.json");
  const input = withSubagentEntries(USER_SETTINGS, [
    USER_SUBAGENT_ENTRY,
    { matcher: "Explore", hooks: [...kitEntry.hooks, USER_EXPLORE_HOOK] },
    USER_PLAN_ENTRY,
    { matcher: "Plan", hooks: kitEntry.hooks },
    USER_RULE_READER_ENTRY,
  ]);
  mkdirSync(dirname(settings), { recursive: true });
  writeFileSync(settings, settingsText(input));
  runSetup(scenario.home);
  const expected = withSubagentEntries(USER_SETTINGS, [
    USER_SUBAGENT_ENTRY,
    kitEntry,
    { matcher: "Explore", hooks: [USER_EXPLORE_HOOK] },
    USER_PLAN_ENTRY,
    USER_RULE_READER_ENTRY,
  ]);
  return {
    merged: contentProblems(settings, settingsText(expected)),
    rerun: rerunProblems(scenario.home, [settings]),
  };
}

function observeRefusedFile(scenario: Scenario, path: string, text: string): RefusedRun {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  const run = spawnSetup(scenario.home);
  return {
    ...run,
    problems: [
      ...contentProblems(path, text),
      ...ruleFileProblems(scenario.claude),
      ...sharedPayloadProblems(scenario.codex),
    ],
  };
}

function observeDanglingSettings(scenario: Scenario): RefusedRun {
  const settings = join(scenario.claude, "settings.json");
  const target = join(scenario.root, "missing-settings-parent", "settings.json");
  mkdirSync(dirname(settings), { recursive: true });
  symlinkSync(target, settings);
  const run = spawnSetup(scenario.home);
  return {
    ...run,
    problems: [
      ...linkProblems(settings, target),
      ...(pathKind(target) === "absent" ? [] : ["the settings link target must remain absent"]),
      ...sharedPayloadProblems(scenario.codex),
      ...contentProblems(join(scenario.codex, "AGENTS.md"), `${CODEX_BLOCK}\n`),
    ],
  };
}

function observeLinkedFiles(scenario: Scenario): LinkedFiles {
  const kitEntry = referenceKitEntry(scenario);
  const synced = join(scenario.root, "synced");
  const syncedSettings = join(synced, "settings.json");
  const syncedCodexAgents = join(synced, "codex-AGENTS.md");
  const settings = join(scenario.claude, "settings.json");
  const codexAgents = join(scenario.codex, "AGENTS.md");
  mkdirSync(synced, { recursive: true });
  mkdirSync(dirname(settings), { recursive: true });
  mkdirSync(dirname(codexAgents), { recursive: true });
  writeFileSync(syncedSettings, settingsText(SYNCED_USER_SETTINGS));
  writeFileSync(syncedCodexAgents, SYNCED_CODEX_LINE);
  symlinkSync(syncedSettings, settings);
  symlinkSync(syncedCodexAgents, codexAgents);
  runSetup(scenario.home);
  return {
    settings: [
      ...linkProblems(settings, syncedSettings),
      ...contentProblems(syncedSettings, settingsText(withSubagentEntries(SYNCED_USER_SETTINGS, [kitEntry]))),
    ],
    codexAgents: [
      ...linkProblems(codexAgents, syncedCodexAgents),
      ...contentProblems(syncedCodexAgents, `${SYNCED_CODEX_LINE}\n\n${CODEX_BLOCK}\n`),
    ],
  };
}

function observeCodexBlockEdits(scenario: Scenario): CodexBlockEdits {
  const codexAgents = join(scenario.codex, "AGENTS.md");
  mkdirSync(dirname(codexAgents), { recursive: true });
  writeFileSync(codexAgents, USER_CODEX_LINE);
  runSetup(scenario.home);
  const appended = contentProblems(codexAgents, `${USER_CODEX_LINE}\n${CODEX_BLOCK}\n`);
  const rerun = rerunProblems(scenario.home, [codexAgents]);
  writeFileSync(codexAgents, `${USER_CODEX_HEAD}${STALE_CODEX_BLOCK}${USER_CODEX_TAIL}`);
  runSetup(scenario.home);
  return {
    appended,
    rerun,
    replaced: contentProblems(codexAgents, `${USER_CODEX_HEAD}${CODEX_BLOCK}${USER_CODEX_TAIL}`),
  };
}

function observeRenamedWrites(scenario: Scenario): string[] {
  const paths = [join(scenario.claude, "settings.json"), join(scenario.codex, "AGENTS.md")];
  for (const path of paths) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(paths[0], settingsText(USER_SETTINGS));
  writeFileSync(paths[1], USER_CODEX_LINE);
  const modes = [0o600, 0o640];
  paths.forEach((path, index) => chmodSync(path, modes[index]));
  const inodes = paths.map((path) => statSync(path).ino);
  runSetup(scenario.home);
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

function blockedRulesProblems(scenario: Scenario): string[] {
  return [
    ...kitEntryProblems(installedKitEntry(join(scenario.claude, "settings.json"))),
    ...sharedPayloadProblems(scenario.codex),
    ...contentProblems(join(scenario.codex, "AGENTS.md"), `${CODEX_BLOCK}\n`),
  ];
}

function observeDanglingRules(scenario: Scenario): RefusedRun {
  const rules = join(scenario.claude, "rules");
  const target = join(scenario.root, "missing-rules-parent", "rules");
  mkdirSync(dirname(rules), { recursive: true });
  symlinkSync(target, rules);
  const run = spawnSetup(scenario.home);
  return {
    ...run,
    problems: [...linkProblems(rules, target), ...absenceProblems(target), ...blockedRulesProblems(scenario)],
  };
}

function observeRulesFile(scenario: Scenario): RefusedRun {
  const rules = join(scenario.claude, "rules");
  mkdirSync(dirname(rules), { recursive: true });
  writeFileSync(rules, RULES_FILE_TEXT);
  const run = spawnSetup(scenario.home);
  return {
    ...run,
    problems: [...contentProblems(rules, RULES_FILE_TEXT), ...blockedRulesProblems(scenario)],
  };
}

function assertNoProblems(problems: readonly string[], message: string): void {
  assert.ok(problems.length === 0, `${message}:\n  ${problems.join("\n  ")}`);
}

function assertRefusal(refused: SetupRun, diagnostic: string, message: string): void {
  assert.strictEqual(refused.status, 1, `setup.ts must exit 1 when ${message}:\n${refused.log}`);
  assert.ok(refused.log.includes(diagnostic), `the refusal must name the file:\n${refused.log}`);
}

before(assertTestRootIsolated);

after(() => {
  assert.ok(TEST_ROOT.startsWith(TEST_ROOT_PREFIX), `refusing to remove an unexpected test root: ${TEST_ROOT}`);
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe("a clean install into an empty home", () => {
  const scenario = useScenario("clean-install");
  let clean: CleanInstall;
  before(() => {
    clean = frozen(observeCleanInstall(scenario));
  });

  test("clean install agent definitions match their sources in both homes", () => {
    assertNoProblems(clean.claudeAgent, "a clean install must deploy every Claude agent under its marker");
    assertNoProblems(clean.codexAgent, "a clean install must deploy every Codex agent under its marker");
  });

  test("clean install excludes foreign native agent formats", () => {
    assertNoProblems(clean.foreignFormats, "each host takes only the agent format it consumes");
  });

  test("shared skills, references, and CORE_RULES.md install unchanged in both homes", () => {
    assertNoProblems(clean.claudePayload, "the Claude home must hold the kit payload byte for byte");
    assertNoProblems(clean.codexPayload, "the Codex home must hold the kit payload byte for byte");
  });

  test("Claude clean install places CORE_RULES.md in rules/ under its marker", () => {
    assertNoProblems(clean.claudeRuleFile, "a clean install must deliver the core rules as a marked Claude rule file");
  });

  test("Codex clean install receives no Claude rule file", () => {
    assertNoProblems(clean.codexRuleFile, "only the Claude home loads rules/ instruction files");
  });

  test("a second run leaves the always-on core-rules files byte-identical", () => {
    assertNoProblems(clean.rerun, "a rerun with no source change must reproduce every always-on file");
  });

  test("a missing Claude settings.json is created holding only the kit SubagentStart entry", () => {
    assertNoProblems(clean.settingsCreated, "a clean install must create settings.json with the Explore/Plan hook");
  });

  test("Codex clean install receives no settings.json hook", () => {
    assertNoProblems(clean.codexSettings, "only the Claude home runs SubagentStart hooks");
  });

  test("the installed SubagentStart command prints the rule file as additionalContext", () => {
    assertNoProblems(clean.hookOutput, "Explore and Plan must receive the installed rule file verbatim");
  });

  test("a missing Codex AGENTS.md is created holding only the core-rules block", () => {
    assertNoProblems(clean.codexBlock, "a clean install must deliver the core rules between the kit markers");
  });

  test("the Claude home receives no AGENTS.md block", () => {
    assertNoProblems(clean.claudeBlock, "only the Codex home reads its global AGENTS.md");
  });

  test("both hosts install regular secretary duties with their contract citations, permission fields, and no helper scripts", () => {
    for (const home of hostHomes(scenario)) {
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
      const extension = home === scenario.claude ? "md" : "toml";
      const adapter = readFileSync(join(home, "agents", `secretary.${extension}`), "utf8");
      assert.match(adapter, /secretary-contract\.md/);
      if (extension === "md") assert.match(adapter, /^disallowedTools: Write, Edit, NotebookEdit, Agent, SendMessage, Monitor, TaskStop$/m);
      else assert.doesNotMatch(adapter, /^(?:sandbox_mode|approval_policy|approvals_reviewer|default_permissions|permissions|network_access)\s*=/m);
    }
  });

  test("installed Codex agent TOML definitions parse without permission overrides", (t: TestContext) => {
    const probe = observeTomlParse(scenario.codex);
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
    if (process.env.AGENTS_KIT_LIVE_CODEX_DOCTOR !== "1") {
      t.skip("set AGENTS_KIT_LIVE_CODEX_DOCTOR=1 to run Codex diagnostics with network access");
      return;
    }
    const probe = observeDoctor(scenario.codex);
    if (!probe.available) {
      t.skip("codex is not installed, so its strict-config doctor was not run");
      return;
    }
    assert.match(probe.configLine, CONFIG_VERDICT, `codex doctor reported no configuration verdict:\n${probe.summary}`);
    if (probe.configLine.includes(WARNED_CONFIG)) {
      assert.doesNotMatch(probe.detail, CUSTOM_AGENT_ERROR, `codex doctor reported a custom-agent error:\n${probe.detail}`);
    }
  });
});

describe("a managed reinstall over edited kit-owned files", () => {
  const scenario = useScenario("managed-reinstall");
  let managed: ManagedReinstall;
  before(() => {
    managed = frozen(observeManagedReinstall(scenario));
  });

  test("managed reinstall agent definitions match their sources in both homes", () => {
    assertNoProblems(managed.claudeAgent, "a reinstall must restore every edited Claude agent");
    assertNoProblems(managed.codexAgent, "a reinstall must restore every edited Codex agent");
  });

  test("managed reinstall refreshes the unchanged shared payload", () => {
    assertNoProblems(managed.payload, "a reinstall must restore every edited marker-owned payload");
  });

  test("managed reinstall refreshes the Claude rule file", () => {
    assertNoProblems(managed.ruleFile, "a rerun must restore an edited marker-owned rule file");
  });
});

describe("a reinstall after a marked skill leaves the source set", () => {
  const scenario = useScenario("retired-skill");
  let retired: readonly string[];
  before(() => {
    retired = frozen(observeRetiredSkill(scenario));
  });

  test("reinstall removes a marker-owned skill dropped from the source set", () => {
    assertNoProblems(retired, "a marked skill the kit no longer ships must be swept, payload intact");
  });
});

describe("a reinstall beside an unmarked user skill", () => {
  const scenario = useScenario("user-owned-skill");
  let userSkill: PreservedPair;
  before(() => {
    userSkill = frozen(observeUserOwnedSkill(scenario));
  });

  test("an unmarked user-owned skill directory is byte-preserved in both homes", () => {
    assertNoProblems(userSkill.claude, "an unmarked Claude skill directory is the user's, not the kit's");
    assertNoProblems(userSkill.codex, "an unmarked Codex skill directory is the user's, not the kit's");
  });
});

describe("a user directory at a live skill name, then removed", () => {
  const scenario = useScenario("live-name");
  let liveName: LiveNameCollision;
  before(() => {
    const collidingSkill = skillNames()[0];
    assert.ok(collidingSkill !== undefined, "no source skill is available for the name-collision case");
    liveName = frozen(observeLiveNameCollision(scenario, collidingSkill));
  });

  test("an unmarked directory at a live skill name is reported, preserved, and never entered", () => {
    assert.strictEqual(liveName.collision.skips, 2, "both homes must report the colliding skill name skipped");
    assertNoProblems(liveName.collision.problems, "a user directory at a shipped skill name must be left untouched");
  });

  test("removing the user directory lets the kit skill reinstall marked", () => {
    assertNoProblems(liveName.recovery, "clearing the collision must let the kit skill install marked again");
  });
});

describe("unmarked executor definitions beside unrelated agents, installed twice", () => {
  const scenario = useScenario("executor-collision");
  let executor: ExecutorCollision;
  before(() => {
    executor = frozen(observeExecutorCollision(scenario));
  });

  test("unmarked executor collisions are reported and byte-preserved in both homes", () => {
    assert.strictEqual(executor.skips, 2, "both homes must report their executor collision skipped");
    assertNoProblems(executor.claude, "an unmarked Claude executor is the user's file");
    assertNoProblems(executor.codex, "an unmarked Codex executor is the user's file");
  });

  test("unrelated agents remain byte-preserved in both homes", () => {
    assertNoProblems(executor.unrelatedClaude, "a Claude agent the kit never ships is out of its reach");
    assertNoProblems(executor.unrelatedCodex, "a Codex agent the kit never ships is out of its reach");
  });

  test("native collisions and unrelated agents remain byte-preserved on reinstall", () => {
    assert.strictEqual(executor.reinstall.skips, 2, "the collisions must stay skipped on a second run");
    assertNoProblems(executor.reinstall.problems, "a rerun must not reclaim what the first run refused");
  });
});

describe("agent markers whose definitions were removed", () => {
  const scenario = useScenario("orphan-markers");
  let orphan: OrphanRecovery;
  before(() => {
    orphan = frozen(observeOrphanRecovery(scenario));
  });

  test("orphan-marker recovery agent definitions match their sources in both homes", () => {
    assertNoProblems(orphan.claudeAgent, "a marker without its payload must reinstall every Claude agent");
    assertNoProblems(orphan.codexAgent, "a marker without its payload must reinstall every Codex agent");
  });

  test("orphan recovery leaves unrelated native agents unchanged", () => {
    assertNoProblems(orphan.unrelated, "reclaiming an orphaned marker must not reach the user's agents");
  });
});

describe("a home holding user-owned shared roots", () => {
  const scenario = useScenario("whole-home-conflict");
  let conflict: RefusedRun;
  before(() => {
    conflict = frozen(observeWholeHomeConflict(scenario));
  });

  test("whole-home conflict safeguards preserve both native homes without partial installation", () => {
    assert.notStrictEqual(conflict.status, 0, `setup.ts must refuse a home holding user-owned shared roots:\n${conflict.log}`);
    for (const home of hostHomes(scenario)) {
      assert.ok(conflict.log.includes(`Skipping ${home}`), `the refusal must name ${home}:\n${conflict.log}`);
    }
    assertNoProblems(conflict.problems, "a refused install must leave both native homes exactly as it found them");
  });
});

describe("a skills symlink into this repo", () => {
  const scenario = useScenario("repo-link");
  let problems: readonly string[];
  before(() => {
    problems = frozen(observeRepoLink(scenario));
  });

  test("a skills symlink into this repo is reclaimed", () => {
    assertNoProblems(problems, "a link into the running checkout is the kit's own to reclaim");
  });
});

describe("a dangling skills symlink", () => {
  const scenario = useScenario("dangling-link");
  let problems: readonly string[];
  before(() => {
    problems = frozen(observeDanglingLink(scenario));
  });

  test("a dangling skills symlink is reclaimed", () => {
    assertNoProblems(problems, "a link resolving to nothing blocks no one and is reclaimed");
  });
});

describe("a skills symlink into another kit checkout", () => {
  const scenario = useScenario("foreign-kit-link");
  let problems: readonly string[];
  before(() => {
    problems = frozen(observeForeignKitLink(scenario));
  });

  test("a skills symlink to another kit checkout is reclaimed", () => {
    assertNoProblems(problems, "a link into a second checkout is kit-owned and reclaimable");
  });
});

describe("a linked skill entry whose target holds a marker", () => {
  const scenario = useScenario("linked-entry");
  let problems: readonly string[];
  before(() => {
    problems = frozen(observeLinkedEntry(scenario));
  });

  test("the reclaim sweep skips a linked entry even when its target holds a marker", () => {
    assertNoProblems(
      problems,
      "the marker probe follows a link, so only the entry-level symlink skip keeps a user's link off the reclaim list",
    );
  });
});

describe("a skills symlink into a user directory", () => {
  const scenario = useScenario("user-link");
  let userLink: RefusedRun;
  before(() => {
    userLink = frozen(observeUserLink(scenario));
  });

  test("a skills symlink the kit does not own is refused, leaving the home uninstalled", () => {
    assert.notStrictEqual(
      userLink.status,
      0,
      `setup.ts must refuse a home whose skills/ is a user symlink:\n${userLink.log}`,
    );
    assert.ok(
      userLink.log.includes(`Skipping ${scenario.claude}`),
      `the refusal must name the skipped home:\n${userLink.log}`,
    );
    assertNoProblems(userLink.problems, "a refused link must survive with its target, and spare the other home");
  });
});

describe("an unmarked Claude rule file", () => {
  const scenario = useScenario("rule-owner");
  let ruleOwner: CollisionRun & SetupRun;
  before(() => {
    ruleOwner = frozen(observeRuleOwner(scenario));
  });

  test("an unmarked Claude rule file is reported, preserved, and left unmarked", () => {
    assertRefusal(ruleOwner, `${RULE_SKIP}${claudeRuleFile(scenario)}`, "an unmarked rule file prevents installation");
    assert.strictEqual(ruleOwner.skips, 1, "the Claude home must report the rule file skipped");
    assertNoProblems(ruleOwner.problems, "a same-named rule file without the marker is the user's");
  });
});

describe("a marked Claude rule symlink", () => {
  const scenario = useScenario("linked-rule");
  let linkedRule: CollisionRun & SetupRun;
  before(() => {
    linkedRule = frozen(observeLinkedRule(scenario));
  });

  test("a marked Claude rule symlink is reported and preserves its link and target", () => {
    assertRefusal(linkedRule, `${RULE_SKIP}${claudeRuleFile(scenario)}`, "a marked rule symlink prevents installation");
    assert.strictEqual(linkedRule.skips, 1, "the Claude home must report the rule symlink skipped exactly once");
    assertNoProblems(linkedRule.problems, "a rule symlink and its user's target must survive even with a marker");
  });
});

describe("an unmarked dangling Claude rule symlink", () => {
  const scenario = useScenario("dangling-rule");
  let danglingRule: CollisionRun & SetupRun;
  before(() => {
    danglingRule = frozen(observeDanglingRule(scenario));
  });

  test("an unmarked dangling Claude rule symlink is reported, preserved, and left unmarked", () => {
    assertRefusal(danglingRule, `${RULE_SKIP}${claudeRuleFile(scenario)}`, "a dangling rule symlink prevents installation");
    assert.strictEqual(danglingRule.skips, 1, "the Claude home must report the dangling rule symlink skipped exactly once");
    assertNoProblems(danglingRule.problems, "a dangling rule symlink must survive without creating its target or marker");
  });
});

describe("a dangling Claude rules link", () => {
  const scenario = useScenario("dangling-rules");
  let refused: RefusedRun;
  before(() => {
    refused = frozen(observeDanglingRules(scenario));
  });

  test("a dangling rules link is preserved and exits 1 after the hook merges and the Codex home installs", () => {
    assertRefusal(refused, `${RULE_SKIP}${join(scenario.claude, "rules", RULE_FILE)}`, "the rule file cannot be installed");
    assertNoProblems(refused.problems, "the dangling link must survive while the rest of the install runs");
  });
});

describe("a user file where the Claude rules directory belongs", () => {
  const scenario = useScenario("rules-file");
  let refused: RefusedRun;
  before(() => {
    refused = frozen(observeRulesFile(scenario));
  });

  test("a file where rules/ belongs is preserved and exits 1 after the hook merges and the Codex home installs", () => {
    assertRefusal(refused, `${RULE_SKIP}${join(scenario.claude, "rules", RULE_FILE)}`, "the rule file cannot be installed");
    assertNoProblems(refused.problems, "the user's file must survive while the rest of the install runs");
  });
});

describe("user settings holding moved and duplicated kit hook commands", () => {
  const scenario = useScenario("hook-merge");
  let hookMerge: SettingsMerge;
  before(() => {
    hookMerge = frozen(observeHookMerge(scenario));
  });

  test("the kit SubagentStart entry takes the first kit command's place, keeps user hook commands, and leaves other settings unchanged", () => {
    assertNoProblems(hookMerge.merged, "the merge may move or remove only the kit's own command");
  });

  test("a rerun leaves merged settings.json byte-identical", () => {
    assertNoProblems(hookMerge.rerun, "rewriting an already-merged settings file must reproduce its bytes");
  });
});

describe("invalid settings JSON", () => {
  const scenario = useScenario("invalid-settings");
  const settings = join(scenario.claude, "settings.json");
  let refused: RefusedRun;
  before(() => {
    refused = frozen(observeRefusedFile(scenario, settings, INVALID_SETTINGS_TEXT));
  });

  test("invalid settings JSON is left untouched, reported on stderr, and exits 1 after the rest installs", () => {
    assertRefusal(refused, `${HOOK_SKIP}${settings} is not valid JSON`, "settings.json cannot be parsed");
    assertNoProblems(refused.problems, "an unparsable settings file must survive while every other item installs");
  });
});

describe("settings whose SubagentStart hooks are not a list", () => {
  const scenario = useScenario("misshapen-settings");
  const settings = join(scenario.claude, "settings.json");
  let refused: RefusedRun;
  before(() => {
    refused = frozen(observeRefusedFile(scenario, settings, MISSHAPEN_SETTINGS_TEXT));
  });

  test("settings whose SubagentStart hooks are not a list are left untouched and exit 1", () => {
    assertRefusal(refused, `${HOOK_SKIP}${settings}`, "it cannot merge into settings.json");
    assertNoProblems(refused.problems, "settings the merge cannot place an entry in must survive unchanged");
  });
});

describe("a dangling settings link", () => {
  const scenario = useScenario("dangling-settings");
  let refused: RefusedRun;
  before(() => {
    refused = frozen(observeDanglingSettings(scenario));
  });

  test("a dangling settings link is preserved and exits 1 after the Codex home installs", () => {
    assertRefusal(refused, `${HOOK_SKIP}${join(scenario.claude, "settings.json")}`, "settings.json cannot be written");
    assert.ok(refused.log.includes("ENOENT"), `the refusal must include the error code:\n${refused.log}`);
    assertNoProblems(refused.problems, "the dangling link must survive while the Codex home installs");
  });
});

describe("settings.json and Codex AGENTS.md linked into a synced directory", () => {
  const scenario = useScenario("linked-files");
  let linkedFiles: LinkedFiles;
  before(() => {
    linkedFiles = frozen(observeLinkedFiles(scenario));
  });

  test("a symlinked settings.json is merged through its link", () => {
    assertNoProblems(linkedFiles.settings, "the merge must write the link target and keep the link");
  });

  test("a symlinked Codex AGENTS.md is written through its link", () => {
    assertNoProblems(linkedFiles.codexAgents, "the block must land in the link target and keep the link");
  });
});

describe("a Codex AGENTS.md holding user lines, rerun and then given a stale block", () => {
  const scenario = useScenario("codex-block");
  let edits: CodexBlockEdits;
  before(() => {
    edits = frozen(observeCodexBlockEdits(scenario));
  });

  test("the core-rules block is appended after the user's Codex line", () => {
    assertNoProblems(edits.appended, "an unmarked AGENTS.md must keep its lines and gain the block after a blank line");
  });

  test("a rerun leaves a Codex AGENTS.md holding user lines byte-identical", () => {
    assertNoProblems(edits.rerun, "replacing an up-to-date block must reproduce the file");
  });

  test("a stale core-rules block is replaced in place between the user's lines", () => {
    assertNoProblems(edits.replaced, "only the bytes between the kit markers may change");
  });
});

describe("user-owned settings.json and Codex AGENTS.md with restrictive modes", () => {
  const scenario = useScenario("renamed-writes");
  let problems: readonly string[];
  before(() => {
    problems = frozen(observeRenamedWrites(scenario));
  });

  test("settings.json and Codex AGENTS.md are replaced by rename rather than rewritten in place", () => {
    assertNoProblems(problems, "a failed merge write must not be able to truncate the user's file");
  });
});

describe("unmatched core-rules markers in Codex AGENTS.md", () => {
  const scenario = useScenario("unmatched-markers");
  const codexAgents = join(scenario.codex, "AGENTS.md");
  let refused: RefusedRun;
  before(() => {
    refused = frozen(observeRefusedFile(scenario, codexAgents, UNMATCHED_MARKER_TEXT));
  });

  test("unmatched core-rules markers leave Codex AGENTS.md untouched and exit 1 after the rest installs", () => {
    assertRefusal(refused, `${BLOCK_SKIP}${codexAgents}`, "it cannot place the block");
    assertNoProblems(refused.problems, "a file with unmatched kit markers must survive while every other item installs");
  });
});

describe("reversed core-rules markers in Codex AGENTS.md", () => {
  const scenario = useScenario("reversed-markers");
  const codexAgents = join(scenario.codex, "AGENTS.md");
  let refused: RefusedRun;
  before(() => {
    refused = frozen(observeRefusedFile(scenario, codexAgents, REVERSED_MARKER_TEXT));
  });

  test("reversed core-rules markers leave Codex AGENTS.md untouched and exit 1 after the rest installs", () => {
    assertRefusal(refused, `${BLOCK_SKIP}${codexAgents}`, "it cannot place the block");
    assertNoProblems(refused.problems, "a file with reversed kit markers must survive while every other item installs");
  });
});
