// Covers scripts/size-report.ts: the per-skill context-load measurement and its JSON contract.
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
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SCRIPT = join(REPO_DIR, "scripts", "size-report.ts");
const FIXTURES = join(TESTS_DIR, "fixtures", "size-report");

const PIPE_BUFFER_BYTES = 65536;
const EARLY_READER_BYTES = 64;
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const VOLUME_SKILLS = 60;
const VOLUME_REFERENCES = 8;
const VOLUME_NAME_PADDING = 60;

const TEST_ROOT = mkdtempSync(join(tmpdir(), "agents-kit-size-report-"));
const KIT = join(TEST_ROOT, "kit");
const LOCKED_KIT = join(TEST_ROOT, "locked-kit");
const EMPTY_KIT = join(TEST_ROOT, "empty-kit");
const VOLUME_KIT = join(TEST_ROOT, "volume-kit");
const VOLUME_REPORT = join(TEST_ROOT, "volume-kit.json");

interface FileEntry {
  readonly path: string;
  readonly bytes: number;
  readonly approxTokens: number;
}

interface MeasuredSet {
  readonly files: readonly FileEntry[];
  readonly bytes: number;
  readonly approxTokens: number;
}

interface SkillReport {
  readonly skill: string;
  readonly hot: MeasuredSet;
  readonly cold: MeasuredSet;
  readonly transitive: MeasuredSet;
}

interface Report {
  readonly root: string | null;
  readonly skills: readonly SkillReport[];
  readonly warnings: number;
  readonly unresolved: readonly string[];
}

interface ReportRun {
  readonly report: Report;
  readonly stderr: string;
}

function runReport(args: readonly string[]): ReportRun {
  const run = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER_BYTES,
  });
  assert.strictEqual(
    run.status,
    0,
    `size-report.ts exited non-zero for: ${args.join(" ")}\n${run.stderr ?? run.error?.message ?? ""}`,
  );
  const report: Report = JSON.parse(run.stdout);
  return { report, stderr: run.stderr };
}

function skillNames(report: Report): string[] {
  return report.skills.map((entry) => entry.skill);
}

function skillRow(report: Report, skill: string): SkillReport {
  const row = report.skills.find((entry) => entry.skill === skill);
  assert.ok(row, `the report holds no row for skill: ${skill}`);
  return row;
}

function filePaths(set: MeasuredSet): string[] {
  return set.files.map((entry) => entry.path);
}

function fileEntry(set: MeasuredSet, path: string): FileEntry {
  const entry = set.files.find((candidate) => candidate.path === path);
  assert.ok(entry, `the set holds no file entry for: ${path}`);
  return entry;
}

function assertIncludes(haystack: string, needle: string, message: string): void {
  assert.ok(haystack.includes(needle), `${message} (expected to contain "${needle}", got "${haystack}")`);
}

function isReadable(path: string): boolean {
  try {
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function writeVolumeKit(root: string): void {
  const padding = "n".repeat(VOLUME_NAME_PADDING);
  const references = Array.from(
    { length: VOLUME_REFERENCES },
    (_, index) => `ref-${String(index).padStart(2, "0")}-${padding}.md`,
  );
  mkdirSync(join(root, "references", "workflow"), { recursive: true });
  for (const reference of references) {
    writeFileSync(join(root, "references", "workflow", reference), "# ref\n");
  }
  writeFileSync(join(root, "CORE_RULES.md"), "# core\n");
  const citations = references.map((reference) => `\`./references/workflow/${reference}\``).join(", ");
  for (let index = 0; index < VOLUME_SKILLS; index++) {
    const skillDir = join(root, "skills", `skill-${String(index).padStart(2, "0")}-${padding}`);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), `# skill\n\nReads \`./AGENTS.md\` and ${citations}.\n`);
  }
}

before(() => {
  cpSync(FIXTURES, KIT, { recursive: true });
  cpSync(FIXTURES, LOCKED_KIT, { recursive: true });
  mkdirSync(EMPTY_KIT);
  writeVolumeKit(VOLUME_KIT);
});

after(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

test("a miniature kit reports one entry per skill and exits 0", () => {
  const { report } = runReport([KIT]);
  assert.strictEqual(report.root, KIT, "root is the resolved kit root");
  assert.deepStrictEqual(
    skillNames(report),
    ["leaf-skill", "mixed-skill", "template-skill", "tiny-skill"],
    "every skill holding a SKILL.md is reported",
  );
});

test("the hot set holds the SKILL.md, its CORE_RULES.md, and each cited reference exactly once", () => {
  const { report } = runReport([KIT]);
  const { hot, cold } = skillRow(report, "tiny-skill");
  assert.deepStrictEqual(
    filePaths(hot),
    ["skills/tiny-skill/SKILL.md", "CORE_RULES.md", "references/workflow/alpha.md"],
    "hot files for tiny-skill, in citation order",
  );
  assert.strictEqual(hot.bytes, 1100, "hot bytes for tiny-skill");
  assert.strictEqual(hot.approxTokens, 275, "hot approxTokens for tiny-skill");
  assert.deepStrictEqual(
    fileEntry(hot, "CORE_RULES.md"),
    { path: "CORE_RULES.md", bytes: 200, approxTokens: 50 },
    "a skill's ./AGENTS.md citation is measured as the kit's CORE_RULES.md",
  );
  assert.deepStrictEqual(
    cold,
    { files: [], bytes: 0, approxTokens: 0 },
    "no tiny-skill citation carries the marker, so its whole closure stays hot",
  );
});

// The marker is unanimous or it does not hold: one unmarked citation loads the file on every
// invocation, whatever any marked citation of it said (references/workflow/skill-conventions.md
// § Cold citations). Both citation orders are fixtured on purpose — alpha unmarked-then-marked,
// gamma marked-then-unmarked — because a fold that simply keeps the last write agrees with the
// unanimous answer on one order and contradicts it on the other. Asserted on membership rather
// than bytes so the fixture stays editable.
test("a file cited both marked and unmarked stays hot in either order; one cited only marked goes cold", () => {
  const { report } = runReport([KIT]);
  const { hot, cold } = skillRow(report, "mixed-skill");
  assert.deepStrictEqual(
    filePaths(hot),
    [
      "skills/mixed-skill/SKILL.md",
      "CORE_RULES.md",
      "references/workflow/unmarked-first.md",
      "references/workflow/marked-first.md",
    ],
    "each carries one unmarked citation, so both stay hot whichever order the marker came in",
  );
  assert.deepStrictEqual(
    filePaths(cold),
    ["references/workflow/marked-always.md"],
    "marked-always carries the marker on every one of its citations, so it is cold",
  );
});

// The core rules load with the skill whatever a marker says, and mixed-skill marks the very line its
// ./AGENTS.md citation sits on — so this pins the exemption rather than the line's gating.
test("a marked line's ./AGENTS.md citation is still hot", () => {
  const { report } = runReport([KIT]);
  const { hot } = skillRow(report, "mixed-skill");
  assert.ok(
    filePaths(hot).includes("CORE_RULES.md"),
    "the ./AGENTS.md citation resolves to CORE_RULES.md and ignores the marker on its line",
  );
});

test("the transitive closure follows reference citations through a cycle and counts each file once", () => {
  const { report } = runReport([KIT]);
  const { transitive } = skillRow(report, "tiny-skill");
  assert.deepStrictEqual(
    filePaths(transitive),
    [
      "skills/tiny-skill/SKILL.md",
      "CORE_RULES.md",
      "references/workflow/alpha.md",
      "references/workflow/beta.md",
      "references/domain/gamma.md",
    ],
    "transitive files for tiny-skill, in breadth-first order",
  );
  assert.strictEqual(transitive.bytes, 1702, "transitive bytes for tiny-skill");
  assert.strictEqual(transitive.approxTokens, 426, "transitive approxTokens for tiny-skill");
});

test("approxTokens is round(bytes / 4), including at the half-token boundary", () => {
  const { report } = runReport([KIT]);
  const { transitive } = skillRow(report, "tiny-skill");
  assert.deepStrictEqual(
    fileEntry(transitive, "references/domain/gamma.md"),
    { path: "references/domain/gamma.md", bytes: 302, approxTokens: 76 },
    "approxTokens rounds a half-token up",
  );
});

test("a skill citing no reference reports its SKILL.md alone in every set", () => {
  const { report } = runReport([KIT]);
  const { hot, cold, transitive } = skillRow(report, "leaf-skill");
  assert.deepStrictEqual(
    filePaths(hot),
    ["skills/leaf-skill/SKILL.md"],
    "hot files for a skill citing nothing",
  );
  assert.deepStrictEqual(filePaths(cold), [], "cold files for a skill citing nothing");
  assert.deepStrictEqual(
    filePaths(transitive),
    ["skills/leaf-skill/SKILL.md"],
    "transitive files for a skill citing nothing",
  );
  assert.strictEqual(hot.bytes, 200, "hot bytes for leaf-skill");
  assert.strictEqual(transitive.approxTokens, 50, "transitive approxTokens for leaf-skill");
});

test("the domain-pack template counts the default pack's rules.md and same-line phase files", () => {
  const { report } = runReport([KIT]);
  const { hot, transitive } = skillRow(report, "template-skill");
  assert.deepStrictEqual(
    filePaths(hot),
    [
      "skills/template-skill/SKILL.md",
      "CORE_RULES.md",
      "references/engineering/rules.md",
      "references/engineering/delta.md",
    ],
    "hot files for template-skill, the template resolved against the default pack",
  );
  assert.strictEqual(hot.bytes, 1000, "hot bytes for template-skill");
  assert.strictEqual(transitive.bytes, 1000, "the template's resolved pack files cite nothing further");
});

test("a dangling citation is a stderr warning and a contract entry, never a crash", () => {
  const { report, stderr } = runReport([KIT]);
  assert.strictEqual(report.warnings, 3, "warning count for the fixture kit");
  assert.deepStrictEqual(
    report.unresolved,
    [
      "skills/tiny-skill/SKILL.md -> ./references/workflow/gone.md",
      "references/workflow/beta.md -> ./nowhere.md",
      "references/domain/gamma.md -> ../../../escape.md",
    ],
    "unresolved names each citation and the file that made it",
  );
  assertIncludes(
    stderr,
    "./references/workflow/gone.md (no such file)",
    "a dangling skill citation warns on stderr",
  );
  assertIncludes(
    stderr,
    "../../../escape.md (outside the kit root)",
    "a citation climbing out of the kit root warns on stderr",
  );
});

test("a citation naming a task-folder role file is not reported as a broken kit citation", () => {
  const { report } = runReport([KIT]);
  assert.ok(
    !report.unresolved.some((entry) => entry.includes("plan.md")),
    `a task-folder artifact citation must not be reported unresolved (got ${JSON.stringify(report.unresolved)})`,
  );
});

test("--skill reports one skill's paths without changing what they measure", () => {
  const { report } = runReport(["--skill", "tiny-skill", KIT]);
  assert.deepStrictEqual(skillNames(report), ["tiny-skill"], "--skill narrows the report to the named skill");
  assert.strictEqual(
    skillRow(report, "tiny-skill").hot.bytes,
    1100,
    "a filtered skill carries the same totals as an unfiltered run",
  );
  assert.strictEqual(report.warnings, 3, "filtering does not suppress the citation warnings");
});

test("a typo in --skill is reported rather than read as a skill that loads nothing", () => {
  const { report, stderr } = runReport(["--skill", "no-such-skill", KIT]);
  assert.deepStrictEqual(skillNames(report), [], "an unmatched --skill name reports no skill");
  assertIncludes(stderr, "no such skill: no-such-skill", "an unmatched --skill name warns on stderr");
});

test("a reference that cannot be opened shrinks the closure loudly, not silently", (t: TestContext) => {
  const unreadable = join(LOCKED_KIT, "references", "workflow", "alpha.md");
  chmodSync(unreadable, 0o000);
  if (isReadable(unreadable)) {
    t.skip("the unreadable-file case needs a user that chmod 000 actually stops");
    return;
  }
  const { report, stderr } = runReport(["--skill", "tiny-skill", LOCKED_KIT]);
  const { hot, transitive } = skillRow(report, "tiny-skill");
  assert.strictEqual(hot.bytes, 1100, "an unreadable reference is still measured by size");
  assert.strictEqual(
    transitive.bytes,
    1100,
    "an unreadable reference contributes no citations to the closure",
  );
  assertIncludes(
    stderr,
    "unresolved citation in references/workflow/alpha.md: (contents)",
    "an unreadable reference warns on stderr",
  );
  assert.ok(
    report.unresolved.includes("references/workflow/alpha.md -> (contents)"),
    `an unreadable reference names itself in unresolved (got ${JSON.stringify(report.unresolved)})`,
  );
});

test("a missing kit root still emits parseable JSON and warns on stderr", () => {
  const { report, stderr } = runReport([]);
  assert.strictEqual(report.root, null, "root is null when no kit root is given");
  assert.deepStrictEqual(skillNames(report), [], "no kit root reports no skill");
  assert.ok(stderr.length > 0, "a missing kit root must warn on stderr");
});

test("a kit root that is not a directory is reported rather than walked", () => {
  const { report, stderr } = runReport([join(KIT, "CORE_RULES.md")]);
  assert.deepStrictEqual(skillNames(report), [], "a file given as the kit root reports no skill");
  assertIncludes(stderr, "not a directory", "a file given as the kit root warns on stderr");
});

test("a kit holding no skills reports an empty list rather than failing", () => {
  const { report } = runReport([EMPTY_KIT]);
  assert.deepStrictEqual(skillNames(report), [], "a kit with no skills directory reports no skill");
});

test("a report over 64 KB parses when read through a pipe, not only from a file", () => {
  const target = openSync(VOLUME_REPORT, "w");
  try {
    const redirected = spawnSync(process.execPath, [SCRIPT, VOLUME_KIT], {
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

  const piped = spawnSync(process.execPath, [SCRIPT, VOLUME_KIT], {
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: MAX_BUFFER_BYTES,
  });
  assert.strictEqual(piped.status, 0, "the piped volume run must exit 0");
  assert.strictEqual(piped.stdout.length, fileBytes, "piped report size must match the file-redirected size");
  const report: Report = JSON.parse(piped.stdout.toString("utf8"));
  assert.strictEqual(
    report.skills.length,
    VOLUME_SKILLS,
    "a report larger than the pipe buffer must survive the pipe intact",
  );
});

test("an early-closing reader does not turn into a non-zero exit", async () => {
  const reader = spawn("head", ["-c", String(EARLY_READER_BYTES)], { stdio: ["pipe", "ignore", "ignore"] });
  assert.ok(reader.stdin, "the early-closing reader must expose a piped stdin");
  // The reader's read end is the subject's only one, and it closes while a report this far over the
  // pipe buffer still has bytes to write — point this at a fixture the reader can drain and the
  // subject finishes before any EPIPE, leaving the always-zero exit contract unexercised.
  const subject = spawn(process.execPath, [SCRIPT, VOLUME_KIT], {
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

test("a run over this repository emits valid JSON covering every skill", () => {
  const { report } = runReport([REPO_DIR]);
  const skillDirs = readdirSync(join(REPO_DIR, "skills"), { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && existsSync(join(REPO_DIR, "skills", entry.name, "SKILL.md")),
  );
  assert.strictEqual(
    report.skills.length,
    skillDirs.length,
    "the live run reports one entry per skill in this repository",
  );
});
