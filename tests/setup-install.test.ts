import assert from "node:assert";
import { spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { after, before, test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SETUP = join(REPO_DIR, "setup.ts");
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const MARKER = ".agents-kit";
const CORE_RULES_MARKER = ".agents-kit-core-rules";
const EXECUTOR_MARKER = ".agents-kit-executor";
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
const CLAUDE_REVIEWER = join(CLAUDE_HOME, "agents", "reviewer.md");
const CODEX_REVIEWER = join(CODEX_HOME, "agents", "reviewer.toml");
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

interface Observations {
  readonly clean: CleanInstall;
  readonly toml: TomlProbe;
  readonly doctor: DoctorProbe;
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

function agentProblems(hostHome: string, extension: string): string[] {
  return [
    ...markerProblems(join(hostHome, "agents", EXECUTOR_MARKER)),
    ...copyProblems(
      join(REPO_DIR, "agents", `executor.${extension}`),
      join(hostHome, "agents", `executor.${extension}`),
    ),
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
    foreignFormats: [
      ...absenceProblems(join(CLAUDE_HOME, "agents", "executor.toml")),
      ...absenceProblems(join(CODEX_HOME, "agents", "executor.md")),
    ],
    claudePayload: sharedPayloadProblems(CLAUDE_HOME),
    codexPayload: sharedPayloadProblems(CODEX_HOME),
  };
}

function observeTomlParse(): TomlProbe {
  for (const interpreter of TOML_INTERPRETERS) {
    const available = spawnSync(interpreter, ["-c", "import tomllib"], { encoding: "utf8" });
    if (available.error !== undefined || available.status !== 0) continue;
    const run = spawnSync(
      interpreter,
      ["-c", 'import sys, tomllib; tomllib.load(open(sys.argv[1], "rb"))', CODEX_EXECUTOR],
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
  writeFileSync(CLAUDE_EXECUTOR, "stale managed Claude definition\n");
  writeFileSync(CODEX_EXECUTOR, "stale managed Codex definition\n");
  for (const home of HOMES) {
    writeFileSync(join(home, "skills", "translate", "SKILL.md"), "stale managed skill\n");
    writeFileSync(join(home, "references", "workflow", "executor-contract.md"), "stale managed reference\n");
    writeFileSync(join(home, "CORE_RULES.md"), "stale managed core rules\n");
  }
  runSetup(PRIMARY_HOME);
  return {
    claudeAgent: agentProblems(CLAUDE_HOME, "md"),
    codexAgent: agentProblems(CODEX_HOME, "toml"),
    payload: HOMES.flatMap((home) => sharedPayloadProblems(home)),
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
    ...contentProblems(CLAUDE_REVIEWER, UNRELATED_CLAUDE_AGENT),
    ...contentProblems(CODEX_REVIEWER, UNRELATED_CODEX_AGENT),
  ];
}

function observeExecutorCollision(): ExecutorCollision {
  rmSync(CLAUDE_EXECUTOR_MARKER);
  rmSync(CODEX_EXECUTOR_MARKER);
  writeFileSync(CLAUDE_EXECUTOR, USER_CLAUDE_EXECUTOR);
  writeFileSync(CODEX_EXECUTOR, USER_CODEX_EXECUTOR);
  writeFileSync(CLAUDE_REVIEWER, UNRELATED_CLAUDE_AGENT);
  writeFileSync(CODEX_REVIEWER, UNRELATED_CODEX_AGENT);
  const log = runSetup(PRIMARY_HOME);
  return {
    skips: countMatchingLines(log, EXECUTOR_SKIP),
    claude: [...contentProblems(CLAUDE_EXECUTOR, USER_CLAUDE_EXECUTOR), ...absenceProblems(CLAUDE_EXECUTOR_MARKER)],
    codex: [...contentProblems(CODEX_EXECUTOR, USER_CODEX_EXECUTOR), ...absenceProblems(CODEX_EXECUTOR_MARKER)],
    unrelatedClaude: contentProblems(CLAUDE_REVIEWER, UNRELATED_CLAUDE_AGENT),
    unrelatedCodex: contentProblems(CODEX_REVIEWER, UNRELATED_CODEX_AGENT),
  };
}

function observeExecutorReinstall(): CollisionRun {
  const log = runSetup(PRIMARY_HOME);
  return {
    skips: countMatchingLines(log, EXECUTOR_SKIP),
    problems: [...preservedExecutorProblems(), ...preservedUnrelatedProblems()],
  };
}

function observeOrphanRecovery(): OrphanRecovery {
  rmSync(CLAUDE_EXECUTOR);
  rmSync(CODEX_EXECUTOR);
  writeFileSync(CLAUDE_EXECUTOR_MARKER, "");
  writeFileSync(CODEX_EXECUTOR_MARKER, "");
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

function assertNoProblems(problems: readonly string[], message: string): void {
  assert.ok(problems.length === 0, `${message}:\n  ${problems.join("\n  ")}`);
}

let observed: Observations;

before(() => {
  assertTestRootIsolated();
  const collidingSkill = skillNames()[0];
  assert.ok(collidingSkill !== undefined, "no source skill is available for the name-collision case");
  const clean = observeCleanInstall();
  observed = {
    clean,
    toml: observeTomlParse(),
    doctor: observeDoctor(),
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
  };
});

after(() => {
  assert.ok(TEST_ROOT.startsWith(TEST_ROOT_PREFIX), `refusing to remove an unexpected test root: ${TEST_ROOT}`);
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

test("Claude clean install executor definition matches its source", () => {
  assertNoProblems(observed.clean.claudeAgent, "a clean install must deploy the Claude executor under its marker");
});

test("Codex clean install executor definition matches its source", () => {
  assertNoProblems(observed.clean.codexAgent, "a clean install must deploy the Codex executor under its marker");
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

test("installed Codex executor TOML parses", (t: TestContext) => {
  const probe = observed.toml;
  if (probe.interpreter === null) {
    t.skip("no Python carrying tomllib is installed, so the deployed TOML was not parsed");
    return;
  }
  assert.strictEqual(
    probe.status,
    0,
    `${probe.interpreter} could not parse the installed ${CODEX_EXECUTOR}:\n${probe.output}`,
  );
});

test("Codex strict-config doctor reports a valid configuration (its exit status only reflects environmental diagnostics)", (t: TestContext) => {
  const probe = observed.doctor;
  if (!probe.available) {
    t.skip("codex is not installed, so its strict-config doctor was not run");
    return;
  }
  assert.match(probe.configLine, CONFIG_VERDICT, `codex doctor reported no configuration verdict:\n${probe.summary}`);
  if (probe.configLine.includes(WARNED_CONFIG)) {
    assert.doesNotMatch(probe.detail, CUSTOM_AGENT_ERROR, `codex doctor reported a custom-agent error:\n${probe.detail}`);
  }
});

test("Claude managed reinstall executor definition matches its source", () => {
  assertNoProblems(observed.managed.claudeAgent, "a reinstall must restore an edited Claude executor");
});

test("Codex managed reinstall executor definition matches its source", () => {
  assertNoProblems(observed.managed.codexAgent, "a reinstall must restore an edited Codex executor");
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

test("Claude orphan-marker recovery executor definition matches its source", () => {
  assertNoProblems(observed.orphan.claudeAgent, "a marker without its payload must reinstall the Claude executor");
});

test("Codex orphan-marker recovery executor definition matches its source", () => {
  assertNoProblems(observed.orphan.codexAgent, "a marker without its payload must reinstall the Codex executor");
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
