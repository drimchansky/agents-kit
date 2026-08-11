// Covers scripts/size-check.ts: the context-size baseline ratchet and its 0/1/2 exit contract.
// Zero dependencies; Node >= 23.6 — type stripping runs unflagged from 23.6, and the test runner
// only discovers .ts files when it is enabled.
// Run: node --test tests/<name>.test.ts   ·   all five: node --test "tests/*.test.ts"

import assert from "node:assert";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
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

interface CheckRun {
  readonly stdout: string;
  readonly stderr: string;
}

interface BaselineEntry {
  readonly skill: string;
}

interface Baseline {
  readonly skills: readonly BaselineEntry[];
}

// The exit status is this script's whole contract surface — 0 clean or baseline written, 1 drift,
// 2 could not run — so every run asserts it rather than trusting the message it printed.
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

// A clean miniature of its own: the shared size-report fixture carries deliberately unresolved
// citations, which this checker refuses — that refusal is its own case against the fixture below.
function writeCleanKit(): void {
  mkdirSync(ONE_SKILL, { recursive: true });
  mkdirSync(REFERENCES_DIR, { recursive: true });
  writeFileSync(join(KIT, "CORE_RULES.md"), "# core\n");
  writeFileSync(
    join(ONE_SKILL, "SKILL.md"),
    "# one-skill\n\nRead `./AGENTS.md`, then `./references/workflow/alpha.md`.\n",
  );
  writeFileSync(CITED_REFERENCE, "# alpha\n");
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

test("--update writes a parseable baseline holding the measured skills", () => {
  runCheck(0, ["--update", "--baseline", BASELINE, KIT]);
  const baseline: Baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  assert.deepStrictEqual(
    baseline.skills.map((entry) => entry.skill),
    ["one-skill"],
    "the written baseline holds the measured skill",
  );
});

test("an unchanged kit passes against its captured baseline", () => {
  const { stdout } = runCheck(0, ["--baseline", BASELINE, KIT]);
  assertIncludes(stdout, "clean", "an unchanged kit reports clean");
});

test("a grown reference fails the check, naming each moved total", () => {
  appendFileSync(CITED_REFERENCE, "grown by a sentence the baseline never measured\n");
  const { stdout } = runCheck(1, ["--baseline", BASELINE, KIT]);
  assertIncludes(stdout, "one-skill: direct", "growth names the skill and the direct set");
  assertIncludes(stdout, "one-skill: transitive", "growth names the transitive set too");
  assertIncludes(stdout, "--update", "the drift summary carries the re-capture hint");
});

test("re-capturing after intended growth returns the check to clean", () => {
  runCheck(0, ["--update", "--baseline", BASELINE, KIT]);
  const { stdout } = runCheck(0, ["--baseline", BASELINE, KIT]);
  assertIncludes(stdout, "clean", "the re-captured baseline matches the grown kit");
});

test("a skill the baseline has never seen is reported, not silently admitted", (t: TestContext) => {
  // The cases below measure the kit this one leaves behind, so the added skill goes even on failure.
  t.after(() => rmSync(EXTRA_SKILL, { recursive: true, force: true }));
  mkdirSync(EXTRA_SKILL, { recursive: true });
  writeFileSync(join(EXTRA_SKILL, "SKILL.md"), "# extra-skill\n");
  const { stdout } = runCheck(1, ["--baseline", BASELINE, KIT]);
  assertIncludes(stdout, "extra-skill: not in the baseline", "a new skill is drift until captured");
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
