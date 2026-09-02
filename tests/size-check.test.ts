import assert from "node:assert";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SCRIPT = join(REPO_DIR, "scripts", "size-check.ts");
const FIXTURES = join(TESTS_DIR, "fixtures", "size-report");
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const TEST_ROOT = mkdtempSync(join(tmpdir(), "agents-kit-size-check-"));
const KIT = join(TEST_ROOT, "kit");
const BASELINE = join(TEST_ROOT, "baseline.json");
const DIRTY_BASELINE = join(TEST_ROOT, "dirty-baseline.json");
const ONE_SKILL = join(KIT, "skills", "one-skill");
const EXTRA_SKILL = join(KIT, "skills", "extra-skill");
const OTHER_SKILL = join(KIT, "skills", "other-skill");
const REFERENCES_DIR = join(KIT, "references", "workflow");
const CITED_REFERENCE = join(REFERENCES_DIR, "alpha.md");
const CORE_RULES_FILE = join(KIT, "CORE_RULES.md");
const AGENTS_FILE = join(KIT, "AGENTS.md");
const ONE_SKILL_FILE = join(ONE_SKILL, "SKILL.md");
const CITATION_LINE = "Read `./AGENTS.md`, then `./references/workflow/alpha.md`.";
const HOT_SKILL = `# one-skill\n\n${CITATION_LINE}\n`;
const COLD_SKILL = `# one-skill\n\n${CITATION_LINE} <!-- cold -->\n`;

interface CheckRun {
  readonly stdout: string;
  readonly stderr: string;
}

interface Totals {
  readonly bytes: number;
  readonly approxTokens: number;
}

interface BaselineEntry {
  readonly skill: string;
  readonly hot: Totals;
  readonly cold: Totals;
  readonly transitive: Totals;
}

interface Baseline {
  readonly skills: readonly BaselineEntry[];
  readonly corpus: Totals;
  readonly hotCapBytes: number;
}

const LINKED_SKILL = join(KIT, "skills", "linked-skill");

function runCheck(expectedStatus: number, args: readonly string[]): CheckRun {
  const run = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER_BYTES,
  });
  assert.strictEqual(
    run.status,
    expectedStatus,
    `expected exit ${expectedStatus}, got ${run.status} for: ${args.join(" ")}\n` +
      `${run.stdout ?? ""}${run.stderr ?? run.error?.message ?? ""}`,
  );
  return { stdout: run.stdout, stderr: run.stderr };
}

function assertIncludes(haystack: string, needle: string, message: string): void {
  assert.ok(haystack.includes(needle), `${message} (expected to contain "${needle}", got "${haystack}")`);
}

function writeCleanKit(): void {
  mkdirSync(ONE_SKILL, { recursive: true });
  mkdirSync(REFERENCES_DIR, { recursive: true });
  writeFileSync(CORE_RULES_FILE, "# core\n");
  writeFileSync(AGENTS_FILE, "# agents\n");
  writeFileSync(ONE_SKILL_FILE, HOT_SKILL);
  writeFileSync(CITED_REFERENCE, "# alpha\n");
}

function corpusBytes(): number {
  return [CORE_RULES_FILE, AGENTS_FILE, ONE_SKILL_FILE, CITED_REFERENCE].reduce(
    (total, path) => total + statSync(path).size,
    0,
  );
}

function hotBytes(): number {
  return [ONE_SKILL_FILE, CORE_RULES_FILE, CITED_REFERENCE].reduce(
    (total, path) => total + statSync(path).size,
    0,
  );
}

function capOf(baselinePath: string): number {
  const baseline: Baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  return baseline.hotCapBytes;
}

before(() => {
  writeCleanKit();
});

after(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

test("a check with no baseline refuses with the capture hint rather than passing vacuously", () => {
  const { stderr } = runCheck(2, ["--baseline", BASELINE, KIT]);
  assertIncludes(stderr, "--update", "a missing baseline names the way to capture one");
});

test("a baseline that will not parse is refused as unreadable, and its reset is announced", (t: TestContext) => {
  const corrupt = join(TEST_ROOT, "corrupt-baseline.json");
  t.after(() => rmSync(corrupt, { force: true }));
  writeFileSync(corrupt, "{ not json\n");

  const check = runCheck(2, ["--baseline", corrupt, KIT]);
  assertIncludes(check.stderr, "is not readable", "a file that exists is refused as unreadable");
  assert.ok(
    !check.stderr.includes("no baseline at"),
    `a baseline that exists is never reported as missing, got "${check.stderr}"`,
  );

  const update = runCheck(0, ["--update", "--baseline", corrupt, KIT]);
  assertIncludes(
    update.stderr,
    "carry nothing forward",
    "a capture over garbage says both ratchets reset rather than resetting them in silence",
  );
  const captured: Baseline = JSON.parse(readFileSync(corrupt, "utf8"));
  assert.strictEqual(
    captured.corpus.bytes,
    corpusBytes(),
    "and it still captures, because an unreadable file offers nothing to ratchet against",
  );
});

test("--update writes a parseable baseline holding the measured skills", () => {
  runCheck(0, ["--update", "--baseline", BASELINE, KIT]);
  const baseline: Baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  assert.deepStrictEqual(
    baseline.skills.map((entry) => entry.skill),
    ["one-skill"],
    "the written baseline holds the measured skill",
  );
  const [entry] = baseline.skills;
  assert.deepStrictEqual(
    Object.keys(entry),
    ["skill", "hot", "cold", "transitive"],
    "every ratcheted set is recorded, and nothing else is",
  );
  assert.deepStrictEqual(
    Object.keys(entry.hot),
    ["bytes", "approxTokens"],
    "a recorded set holds totals only — a per-file list would churn on every edit",
  );
  assert.deepStrictEqual(
    entry.cold,
    { bytes: 0, approxTokens: 0 },
    "a kit marking no citation cold baselines an empty cold set rather than omitting it",
  );
  assert.strictEqual(
    baseline.hotCapBytes,
    entry.hot.bytes,
    "a first capture has no cap to carry forward, so it records the measured maximum hot set",
  );
});

test("an unchanged kit passes against its captured baseline", () => {
  const { stdout } = runCheck(0, ["--baseline", BASELINE, KIT]);
  assertIncludes(stdout, "clean", "an unchanged kit reports clean");
});

test("a grown reference fails the check, naming each moved total", () => {
  const corpusBefore = corpusBytes();
  appendFileSync(CITED_REFERENCE, "grown by a sentence the baseline never measured\n");
  const { stdout } = runCheck(1, ["--baseline", BASELINE, KIT]);
  assertIncludes(stdout, "one-skill: hot", "growth in an unmarked citation names the hot set");
  assertIncludes(stdout, "one-skill: transitive", "growth names the transitive set too");
  assertIncludes(
    stdout,
    `corpus: ${corpusBefore} -> ${corpusBytes()} bytes`,
    "the kit-wide corpus moves with the same file, on its own drift line",
  );
  assertIncludes(stdout, "--update", "the drift summary carries the re-capture hint");
  assertIncludes(
    stdout,
    "--allow-corpus-growth",
    "and the hint carries the flag a grown corpus now needs, rather than naming a refused command",
  );
});

test("--update refuses to absorb corpus growth and leaves the baseline byte-identical", () => {
  const before = readFileSync(BASELINE);
  const { stderr } = runCheck(2, ["--update", "--baseline", BASELINE, KIT]);
  assertIncludes(stderr, "--allow-corpus-growth", "the refusal names the flag that would allow it");
  assert.deepStrictEqual(
    readFileSync(BASELINE),
    before,
    "a refused capture rewrites nothing, so the ratchet still holds the reviewed total",
  );
});

test("--allow-corpus-growth re-captures the grown corpus, leaving only the cap it carried forward", () => {
  runCheck(0, ["--update", "--allow-corpus-growth", "--baseline", BASELINE, KIT]);
  const baseline: Baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  assert.deepStrictEqual(
    Object.keys(baseline),
    ["skills", "corpus", "hotCapBytes"],
    "the baseline records the corpus and the hot cap beside the per-skill totals",
  );
  assert.deepStrictEqual(
    Object.keys(baseline.corpus),
    ["bytes", "approxTokens"],
    "the corpus is recorded as totals only, like every ratcheted set",
  );
  assert.strictEqual(baseline.corpus.bytes, corpusBytes(), "the flagged capture records the higher total");
  const { stdout } = runCheck(1, ["--baseline", BASELINE, KIT]);
  assert.deepStrictEqual(
    stdout.split("\n").filter((line) => line.length > 0 && !line.startsWith("[size-check]")),
    [`one-skill: hot ${hotBytes()} bytes over the cap of ${baseline.hotCapBytes}`],
    "every measured total re-captured, so the carried-forward cap is the one line a capture cannot clear",
  );
});

test("a shrunken corpus re-captures without the growth flag", () => {
  writeFileSync(CITED_REFERENCE, "# alpha\n");
  runCheck(0, ["--update", "--baseline", BASELINE, KIT]);
  const baseline: Baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  assert.strictEqual(
    baseline.corpus.bytes,
    corpusBytes(),
    "the ratchet resists growth only — a corpus that shrank is recorded, not refused",
  );
});

test("a baseline holding no corpus total names it, then first-captures without the flag", (t: TestContext) => {
  const corpusless = join(TEST_ROOT, "corpusless-baseline.json");
  t.after(() => {
    rmSync(corpusless, { force: true });
    writeFileSync(CITED_REFERENCE, "# alpha\n");
  });
  runCheck(0, ["--update", "--baseline", corpusless, KIT]);
  const captured: Baseline = JSON.parse(readFileSync(corpusless, "utf8"));
  writeFileSync(corpusless, JSON.stringify({ skills: captured.skills }, null, 2) + "\n");
  appendFileSync(CITED_REFERENCE, "growth a corpus-less baseline holds no total to refuse\n");
  const { stdout } = runCheck(1, ["--baseline", corpusless, KIT]);
  assertIncludes(
    stdout,
    `corpus: not in the baseline (${corpusBytes()} bytes)`,
    "a baseline predating the corpus key names it rather than passing the kit silently",
  );
  runCheck(0, ["--update", "--baseline", corpusless, KIT]);
  const recaptured: Baseline = JSON.parse(readFileSync(corpusless, "utf8"));
  assert.strictEqual(
    recaptured.corpus.bytes,
    corpusBytes(),
    "a baseline with no total to ratchet against has nothing to refuse, so the first capture needs no flag",
  );
});

test("a skill grown past the cap is named over it, beside the hot drift the growth caused", (t: TestContext) => {
  t.after(() => writeFileSync(ONE_SKILL_FILE, HOT_SKILL));
  const cap = capOf(BASELINE);
  const hotBefore = hotBytes();
  appendFileSync(ONE_SKILL_FILE, "a sentence that pushes the hot set past the recorded cap\n");
  const { stdout } = runCheck(1, ["--baseline", BASELINE, KIT]);
  assertIncludes(
    stdout,
    `one-skill: hot ${hotBefore} -> ${hotBytes()} bytes`,
    "the growth is drift against the recorded totals",
  );
  assertIncludes(
    stdout,
    `one-skill: hot ${hotBytes()} bytes over the cap of ${cap}`,
    "and crossing the cap is its own line, because re-capturing clears the drift but not the cap",
  );
});

test("--hot-cap lowers the recorded cap, which a plain re-capture then carries forward", (t: TestContext) => {
  const capped = join(TEST_ROOT, "capped-baseline.json");
  t.after(() => rmSync(capped, { force: true }));
  runCheck(0, ["--update", "--baseline", capped, KIT]);
  const measured = capOf(capped);
  runCheck(0, ["--update", "--hot-cap", String(measured - 1), "--baseline", capped, KIT]);
  assert.strictEqual(capOf(capped), measured - 1, "a value below the recorded cap tightens the ratchet");
  runCheck(0, ["--update", "--baseline", capped, KIT]);
  assert.strictEqual(
    capOf(capped),
    measured - 1,
    "an unflagged capture carries the tightened cap forward rather than raising it back to the measurement",
  );
});

test("--update refuses to raise the cap and leaves the baseline byte-identical", (t: TestContext) => {
  const capped = join(TEST_ROOT, "raised-baseline.json");
  t.after(() => rmSync(capped, { force: true }));
  runCheck(0, ["--update", "--baseline", capped, KIT]);
  const before = readFileSync(capped);
  const { stderr } = runCheck(2, [
    "--update",
    "--hot-cap",
    String(capOf(capped) + 1),
    "--baseline",
    capped,
    KIT,
  ]);
  assertIncludes(stderr, "ratchets down only", "the refusal says which direction the cap moves");
  assert.deepStrictEqual(
    readFileSync(capped),
    before,
    "a refused raise rewrites nothing, so the ratchet still holds the reviewed cap",
  );
});

test("a baseline holding no cap names it, then first-captures the measured maximum", (t: TestContext) => {
  const capless = join(TEST_ROOT, "capless-baseline.json");
  t.after(() => rmSync(capless, { force: true }));
  runCheck(0, ["--update", "--baseline", capless, KIT]);
  const captured: Baseline = JSON.parse(readFileSync(capless, "utf8"));
  writeFileSync(
    capless,
    JSON.stringify({ skills: captured.skills, corpus: captured.corpus }, null, 2) + "\n",
  );
  const { stdout } = runCheck(1, ["--baseline", capless, KIT]);
  assertIncludes(
    stdout,
    `hotCapBytes: not in the baseline (max hot ${hotBytes()} bytes)`,
    "a baseline predating the cap names it rather than passing every skill silently",
  );
  runCheck(0, ["--update", "--baseline", capless, KIT]);
  assert.strictEqual(
    capOf(capless),
    hotBytes(),
    "a baseline with no cap to ratchet against has nothing to refuse, so the first capture needs no flag",
  );
});

test("a skill the baseline has never seen is reported, not silently admitted", (t: TestContext) => {
  t.after(() => rmSync(EXTRA_SKILL, { recursive: true, force: true }));
  mkdirSync(EXTRA_SKILL, { recursive: true });
  writeFileSync(join(EXTRA_SKILL, "SKILL.md"), "# extra-skill\n");
  const { stdout } = runCheck(1, ["--baseline", BASELINE, KIT]);
  assertIncludes(stdout, "extra-skill: not in the baseline", "a new skill is drift until captured");
});

test("a citation marked cold moves its bytes out of the hot set, which is drift", (t: TestContext) => {
  t.after(() => writeFileSync(ONE_SKILL_FILE, HOT_SKILL));
  const referenceBytes = statSync(CITED_REFERENCE).size;
  const coreBytes = statSync(CORE_RULES_FILE).size;
  const hotBefore = statSync(ONE_SKILL_FILE).size + coreBytes + referenceBytes;
  writeFileSync(ONE_SKILL_FILE, COLD_SKILL);
  const hotAfter = statSync(ONE_SKILL_FILE).size + coreBytes;
  const { stdout } = runCheck(1, ["--baseline", BASELINE, KIT]);
  assertIncludes(
    stdout,
    `one-skill: hot ${hotBefore} -> ${hotAfter} bytes`,
    "the marked reference leaves the hot set",
  );
  assertIncludes(
    stdout,
    `one-skill: cold 0 -> ${referenceBytes} bytes`,
    "and lands in the cold set the baseline recorded as empty",
  );
});

test("a baseline missing a set names it rather than reporting NaN", (t: TestContext) => {
  const stale = join(TEST_ROOT, "stale-baseline.json");
  t.after(() => rmSync(stale, { force: true }));
  runCheck(0, ["--update", "--baseline", stale, KIT]);
  const captured: Baseline = JSON.parse(readFileSync(stale, "utf8"));
  writeFileSync(
    stale,
    JSON.stringify(
      { skills: captured.skills.map(({ skill, transitive }) => ({ skill, transitive })) },
      null,
      2,
    ) + "\n",
  );
  const { stdout } = runCheck(1, ["--baseline", stale, KIT]);
  assertIncludes(stdout, "one-skill: hot not in the baseline", "the missing set is named, not subtracted");
  assert.ok(!stdout.includes("NaN"), `no drift line reports NaN, got "${stdout}"`);
});

test("a baseline entry with no skill behind it is reported", () => {
  runCheck(0, ["--update", "--baseline", BASELINE, KIT]);
  rmSync(ONE_SKILL, { recursive: true, force: true });
  mkdirSync(OTHER_SKILL, { recursive: true });
  writeFileSync(join(OTHER_SKILL, "SKILL.md"), "# other-skill\n");
  const { stdout } = runCheck(1, ["--baseline", BASELINE, KIT]);
  assertIncludes(
    stdout,
    "one-skill: in the baseline but not in the kit",
    "a removed skill is drift, not a silent shrink",
  );
});

test("a corpus the walk could not measure in full is refused for both check and capture", (t: TestContext) => {
  const missBaseline = join(TEST_ROOT, "miss-baseline.json");
  const linkTarget = join(TEST_ROOT, "linked-target.md");
  t.after(() => {
    rmSync(LINKED_SKILL, { recursive: true, force: true });
    rmSync(linkTarget, { force: true });
    rmSync(missBaseline, { force: true });
  });
  writeFileSync(linkTarget, "# linked-skill\n");
  mkdirSync(LINKED_SKILL, { recursive: true });
  symlinkSync(linkTarget, join(LINKED_SKILL, "SKILL.md"));

  const { stderr } = runCheck(2, ["--update", "--baseline", missBaseline, KIT]);
  assertIncludes(stderr, "the corpus walk missed", "the refusal names the walk, not the citations");
  assert.ok(
    !existsSync(missBaseline),
    "a refused update writes no baseline, which would anchor the corpus below the truth",
  );
  runCheck(2, ["--baseline", BASELINE, KIT]);
});

test("a malformed --hot-cap is refused before anything is measured, so no null cap is recorded", (t: TestContext) => {
  const malformed = join(TEST_ROOT, "malformed-baseline.json");
  t.after(() => rmSync(malformed, { force: true }));
  runCheck(0, ["--update", "--baseline", malformed, KIT]);
  const before = readFileSync(malformed);
  const { stderr } = runCheck(2, ["--update", "--hot-cap", "12.5", "--baseline", malformed, KIT]);
  assertIncludes(stderr, "whole number of bytes", "the refusal names what the value has to be");
  assert.deepStrictEqual(readFileSync(malformed), before, "a refused capture rewrites nothing");
});

test("an incompletely measured kit is refused for both check and capture", () => {
  const { stderr } = runCheck(2, ["--baseline", DIRTY_BASELINE, "--update", FIXTURES]);
  assertIncludes(stderr, "unresolved", "the refusal names the unresolved citations");
  assert.ok(
    !existsSync(DIRTY_BASELINE),
    "a refused update must write no baseline, which would anchor the ratchet below the truth",
  );
});

test("a directory that is no kit refuses rather than reporting clean", () => {
  runCheck(2, [TEST_ROOT]);
});

test("this repository matches its committed size baseline", () => {
  const { stdout } = runCheck(0, [REPO_DIR]);
  assertIncludes(stdout, "clean", "the live run reports clean");
});
