import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { RESULT_MAX_KB } from "../scripts/lifecycle-constants.ts";
import { compactionSections, taskState, type CompactionPlan, type TaskState } from "../scripts/task-state.ts";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SCRIPT = join(REPO_DIR, "scripts", "task-state.ts");
const HEALTH_CHECK = join(REPO_DIR, "scripts", "health-check.ts");
const TEST_ROOT = mkdtempSync(join(tmpdir(), "agents-kit-task-state-"));
const FENCE = "```";
const TRIGGER_BYTES = RESULT_MAX_KB * 1024;

after(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

interface Folder {
  readonly plan?: string;
  readonly result?: string;
  readonly goals?: string;
}

function folder(name: string, files: Folder): string {
  const dir = join(TEST_ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  if (files.plan !== undefined) writeFileSync(join(dir, "plan.md"), files.plan);
  if (files.result !== undefined) writeFileSync(join(dir, "result.md"), files.result);
  if (files.goals !== undefined) writeFileSync(join(dir, "goals.md"), files.goals);
  return dir;
}

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function run(args: readonly string[]): Run {
  const child = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  return { status: child.status, stdout: child.stdout, stderr: child.stderr };
}

function report(dir: string): TaskState {
  const child = run([dir]);
  assert.strictEqual(child.status, 0, `expected exit 0, got ${child.status}: ${child.stderr}`);
  return JSON.parse(child.stdout) as TaskState;
}

function parse(planText: string, resultText: string | null = null, goalsText: string | null = null): TaskState {
  return taskState({ taskDir: "/fixture", planText, resultText, goalsText });
}

const GOALS = `# Goals: fixture
**Plan:** [./plan.md](./plan.md)

## Goals
- G1 — the first outcome
- G2 — the second outcome
- G3 (external) — the third outcome
`;

const MIXED_PLAN = `# Plan: fixture

**Status:** executing

## Scope

- **In scope:** delivered G1, G2 · the fixture tree
- **Out of scope:** deferred G3 · everything else
- **Boundaries:** none

## Steps

### Step 1 — First thing

- [x] **What:** do the first thing ([result](./result.md#step-1--first-thing))
- **Verify:** it happened
- **Goal:** G1
- **Depends on:** none

### Step 2 — Second thing

- [ ] **What:** do the second thing
- **Verify:** it happens
- **Goal:** G2
- **Depends on:** Step 1

### Checkpoint after Step 2

- End-to-end: the fixture holds together
`;

const MIXED_RESULT = `# Result: fixture

## Current state

_Updated:_ 2026-01-01

---

## Step 1 — First thing

**Verified:** it happened

---
`;

test("reports steps, statuses, next pending step, and coverage for a mixed plan", () => {
  const state = report(folder("mixed", { plan: MIXED_PLAN, result: MIXED_RESULT, goals: GOALS }));

  assert.deepStrictEqual(state.plan, { file: "plan.md", status: "executing", statusRaw: "executing" });
  assert.deepStrictEqual(state.result, { file: "result.md", legacyStatus: null });
  assert.strictEqual(state.goalsFile, "goals.md");
  assert.deepStrictEqual(state.steps, [
    {
      number: "1",
      title: "First thing",
      checked: true,
      anchor: "step-1--first-thing",
      anchorResolves: true,
      goals: ["G1"],
      goalEscape: false,
      dependsOn: [],
    },
    {
      number: "2",
      title: "Second thing",
      checked: false,
      anchor: null,
      anchorResolves: null,
      goals: ["G2"],
      goalEscape: false,
      dependsOn: ["1"],
    },
  ]);
  assert.strictEqual(state.nextPendingStep, "2");
  assert.deepStrictEqual(state.goalCoverage.goals, [
    { id: "G1", steps: ["1"] },
    { id: "G2", steps: ["2"] },
    { id: "G3", steps: [] },
  ]);
  assert.deepStrictEqual(state.goalCoverage.uncoveredGoals, ["G3"]);
  assert.deepStrictEqual(state.goalCoverage.orphanSteps, []);
  assert.deepStrictEqual(state.goalCoverage.unknownGoalCitations, []);
  assert.deepStrictEqual(state.goalCoverage.scopePartition, {
    delivered: ["G1", "G2"],
    deferred: ["G3"],
    missingFromPartition: [],
    inBoth: [],
  });
});

test("a fully checked plan has no next pending step", () => {
  const state = parse(MIXED_PLAN.replace("- [ ] **What:** do the second thing", "- [x] **What:** do the second thing"));
  assert.deepStrictEqual(state.steps.map((step) => step.checked), [true, true]);
  assert.strictEqual(state.nextPendingStep, null);
});

test("an untouched plan reports its first step as pending", () => {
  const state = parse(MIXED_PLAN.replace("- [x] **What:** do the first thing", "- [ ] **What:** do the first thing"));
  assert.deepStrictEqual(state.steps.map((step) => step.checked), [false, false]);
  assert.strictEqual(state.nextPendingStep, "1");
});

test("the next pending step carries its What and Verify lines", () => {
  const pending = parse(MIXED_PLAN, MIXED_RESULT, GOALS);
  assert.strictEqual(pending.nextPendingStep, "2");
  assert.deepStrictEqual(pending.nextPendingStepBody, { what: "do the second thing", verify: "it happens" });

  const noVerify = parse(MIXED_PLAN.replace("- **Verify:** it happens\n", ""));
  assert.deepStrictEqual(noVerify.nextPendingStepBody, { what: "do the second thing", verify: null });

  const finished = parse(
    MIXED_PLAN.replace("- [ ] **What:** do the second thing", "- [x] **What:** do the second thing"),
  );
  assert.strictEqual(finished.nextPendingStep, null);
  assert.strictEqual(finished.nextPendingStepBody, null);
});

test("currentState is the result's Current state block, null without a result or a block", () => {
  const state = parse(MIXED_PLAN, MIXED_RESULT, GOALS);
  assert.strictEqual(state.currentState, "## Current state\n\n_Updated:_ 2026-01-01\n\n---");

  assert.strictEqual(parse(MIXED_PLAN, null, GOALS).currentState, null);
  assert.strictEqual(parse(MIXED_PLAN, "# Result: fixture\n\n## Step 1 — First thing\n", GOALS).currentState, null);
});

test("the Current state block ends at its closing rule, or at the next section heading", () => {
  const unclosed = parse(MIXED_PLAN, "# Result: unclosed\n\n## Current state\n\nstill open\n\n## Step 1 — After\n\nlog\n");
  assert.strictEqual(unclosed.currentState, "## Current state\n\nstill open");

  const nested = parse(MIXED_PLAN, "# Result: nested\n\n## Step 1 — After\n\n### Current state\n\nnot the block\n");
  assert.strictEqual(nested.currentState, null);
});

test("the CLI reports a committed fixture's Current state block", () => {
  const state = report(join(REPO_DIR, "tests", "fixtures", "health", "anchors", "oversized-result"));
  const block = state.currentState ?? "";
  assert.match(block, /^## Current state\n/);
  assert.match(block, /\*\*Next:\*\* none\n\n---$/);
  assert.ok(!block.includes("## Step 1"), "the block stops at its closing rule");
});

test("checkpoints carry the result outcome, or null until they run", () => {
  const plan = `# Plan: checkpoints

**Status:** executing

## Steps

### Step 1 — One

- [x] **What:** one
- **Goal:** none (infra/refactor)

### Checkpoint after Step 1

- End-to-end: one works

### Step 2 — Two

- [x] **What:** two
- **Goal:** none (infra/refactor)

### Checkpoint after Step 2

- End-to-end: two works

### Step 3 — Three

- [ ] **What:** three
- **Goal:** none (infra/refactor)

### Checkpoint after Step 3

- End-to-end: three works
`;
  const result = `# Result: checkpoints

## Checkpoint after Step 1

**Asserted:** the flow ran
**Outcome:** passed

---

## Checkpoint after Step 2

**Asserted:** the flow ran
**Outcome:** failed

---
`;
  const state = report(folder("checkpoints", { plan, result }));
  assert.deepStrictEqual(state.checkpoints, [
    { afterStep: "1", outcome: "passed" },
    { afterStep: "2", outcome: "failed" },
    { afterStep: "3", outcome: null },
  ]);

  assert.deepStrictEqual(state.steps.map((step) => step.number), ["1", "2", "3"]);
  assert.deepStrictEqual(state.goalCoverage.orphanSteps, []);
});

test("result anchors resolve against headings and compaction tombstones", () => {
  const plan = `# Plan: anchors

**Status:** executing

## Steps

### Step 1 — Live section

- [x] **What:** one ([result](./result.md#step-1--live-section))
- **Goal:** G1

### Step 2 — Compacted section

- [x] **What:** two ([result](./result.md#step-2--compacted-section))
- **Goal:** G1

### Step 3 — Missing section

- [x] **What:** three ([result](./result.md#step-3--missing-section))
- **Goal:** G1

### Step 4 — No link at all

- [x] **What:** four
- **Goal:** G1

### Step 5 — Link outside the result file

- [x] **What:** five ([result](./notes.md#step-5--link-outside-the-result-file))
- **Goal:** G1
`;
  const result = `# Result: anchors

## Step 1 — Live section

**Verified:** it happened

---

## Compacted

- Step 2 — Compacted section

---

${FENCE}markdown
## Step 3 — Missing section
${FENCE}
`;
  const state = report(folder("anchors", { plan, result, goals: GOALS }));
  assert.deepStrictEqual(
    state.steps.map((step) => [step.number, step.anchor, step.anchorResolves]),
    [
      ["1", "step-1--live-section", true],
      ["2", "step-2--compacted-section", true],
      ["3", "step-3--missing-section", false],
      ["4", null, false],
      ["5", "step-5--link-outside-the-result-file", false],
    ],
  );
});

test("a folder with no result file resolves no anchor", () => {
  const state = parse(MIXED_PLAN, null, GOALS);
  assert.strictEqual(state.result, null);
  assert.deepStrictEqual(
    state.steps.map((step) => step.anchorResolves),
    [false, null],
  );
  assert.deepStrictEqual(state.checkpoints, [{ afterStep: "2", outcome: null }]);
});

test("orphan steps, the infra escape, and citations of unknown goal IDs are separated", () => {
  const plan = `# Plan: coverage

**Status:** to-do

## Scope

- **In scope:** delivered G1, G2, G3

## Steps

### Step 1 — Cites a goal

- [ ] **What:** one
- **Goal:** G1

### Step 2 — Infra escape

- [ ] **What:** two
- **Goal:** none (infra/refactor)

### Step 3 — Cites nothing

- [ ] **What:** three
- **Verify:** it happens

### Step 4 — Cites a retired ID

- [ ] **What:** four
- **Goal:** G2, G9
`;
  const state = parse(plan, null, GOALS);
  assert.deepStrictEqual(state.goalCoverage.orphanSteps, ["3"]);
  assert.deepStrictEqual(state.goalCoverage.unknownGoalCitations, [{ step: "4", goals: ["G9"] }]);
  assert.deepStrictEqual(state.goalCoverage.uncoveredGoals, ["G3"]);
  assert.deepStrictEqual(state.steps[1].goals, []);
  assert.strictEqual(state.steps[1].goalEscape, true);
  assert.strictEqual(state.steps[2].goalEscape, false);
});

test("only the escape's own spelling clears a step out of orphanSteps", () => {
  const plan = `# Plan: near misses

**Status:** to-do

## Steps

### Step 1 — Bare none

- [ ] **What:** one
- **Goal:** none

### Step 2 — Hedged none

- [ ] **What:** two
- **Goal:** none yet

### Step 3 — The escape

- [ ] **What:** three
- **Goal:** none (infra/refactor)
`;
  const state = parse(plan, null, GOALS);
  assert.deepStrictEqual(state.goalCoverage.orphanSteps, ["1", "2"]);
  assert.deepStrictEqual(state.steps.map((step) => step.goalEscape), [false, false, true]);
});

test("a fence closer carrying an info string does not end the block", () => {
  const plan = `# Plan: fenced example

**Status:** executing

${FENCE}
Here is how a plan header looks:
${FENCE}md
**Status:** done
${FENCE}

## Steps

### Step 1 — Real step

- [ ] **What:** one
- **Goal:** G1
`;
  const state = parse(plan, null, GOALS);
  assert.strictEqual(state.plan.status, "executing", "the fenced example is illustration, not the header");
  assert.deepStrictEqual(state.steps.map((step) => step.number), ["1"], "no heading inside the fence became a step");
});

test("a folder with no goals file leaves every coverage list empty", () => {
  const state = parse(MIXED_PLAN);
  assert.strictEqual(state.goalsFile, null);
  assert.deepStrictEqual(state.goalCoverage.goals, []);
  assert.deepStrictEqual(state.goalCoverage.uncoveredGoals, []);
  assert.deepStrictEqual(state.goalCoverage.unknownGoalCitations, []);
  assert.deepStrictEqual(state.goalCoverage.scopePartition.missingFromPartition, []);
});

test("the scope partition is total only when no goal is missing from it or in both halves", () => {
  const total = parse(MIXED_PLAN, null, GOALS).goalCoverage.scopePartition;
  assert.deepStrictEqual(total.missingFromPartition, []);
  assert.deepStrictEqual(total.inBoth, []);

  const missing = parse(MIXED_PLAN.replace("deferred G3 · everything else", "deferred nothing"), null, GOALS);
  assert.deepStrictEqual(missing.goalCoverage.scopePartition.deferred, []);
  assert.deepStrictEqual(missing.goalCoverage.scopePartition.missingFromPartition, ["G3"]);

  const both = parse(MIXED_PLAN.replace("deferred G3 · everything else", "deferred G2, G3"), null, GOALS);
  assert.deepStrictEqual(both.goalCoverage.scopePartition.deferred, ["G2", "G3"]);
  assert.deepStrictEqual(both.goalCoverage.scopePartition.inBoth, ["G2"]);
});

test("the scope partition reads the single-line delivered/deferred spelling", () => {
  const plan = MIXED_PLAN.replace(
    `- **In scope:** delivered G1, G2 · the fixture tree
- **Out of scope:** deferred G3 · everything else`,
    "- delivered: G1, G2 · deferred: G3",
  );
  assert.deepStrictEqual(parse(plan, null, GOALS).goalCoverage.scopePartition, {
    delivered: ["G1", "G2"],
    deferred: ["G3"],
    missingFromPartition: [],
    inBoth: [],
  });
});

test("revision-inserted step numbers keep their letter suffix", () => {
  const plan = `# Plan: insertions

**Status:** executing

## Steps

### Step 3 — Original

- [x] **What:** three ([result](./result.md#step-3--original))
- **Goal:** G1

### Step 3a — Inserted after the review

- [ ] **What:** the repair
- **Goal:** G2
- **Depends on:** Step 3

### Step 3b — Inserted beside it

- [ ] **What:** the other repair
- **Goal:** G2
- **Depends on:** Step 3a
`;
  const state = parse(plan, null, GOALS);
  assert.deepStrictEqual(state.steps.map((step) => step.number), ["3", "3a", "3b"]);
  assert.strictEqual(state.nextPendingStep, "3a");
  assert.deepStrictEqual(state.steps[2].dependsOn, ["3a"]);
  assert.deepStrictEqual(state.goalCoverage.goals[1], { id: "G2", steps: ["3a", "3b"] });
});

test("fenced content is illustration, not structure", () => {
  const plan = `# Plan: fenced

${FENCE}
**Status:** blocked
${FENCE}

**Status:** executing

## Scope

- **In scope:** delivered G1

## Steps

### Step 1 — Real step

- [ ] **What:** the real one
- **Goal:** G1

${FENCE}markdown
### Step 2 — Illustrative step

- [x] **What:** never counted ([result](./result.md#step-2--illustrative-step))
- **Goal:** G2
${FENCE}
`;
  const state = parse(plan, null, GOALS);
  assert.strictEqual(state.plan.status, "executing");
  assert.deepStrictEqual(state.steps.map((step) => step.number), ["1"]);
  assert.strictEqual(state.nextPendingStep, "1");
  assert.deepStrictEqual(state.goalCoverage.goals, [
    { id: "G1", steps: ["1"] },
    { id: "G2", steps: [] },
    { id: "G3", steps: [] },
  ]);
});

test("a legacy result status is reported verbatim, and a conformant result carries none", () => {
  const legacy = parse(
    MIXED_PLAN,
    MIXED_RESULT.replace("# Result: fixture\n", "# Result: fixture\n\n**Status:** shipped onwards\n"),
    GOALS,
  );
  assert.deepStrictEqual(legacy.result, { file: "result.md", legacyStatus: "shipped onwards" });
  assert.strictEqual(legacy.plan.status, "executing", "the plan's own status is untouched by the legacy field");

  const conformant = parse(MIXED_PLAN, MIXED_RESULT, GOALS);
  assert.deepStrictEqual(conformant.result, { file: "result.md", legacyStatus: null });
});

test("an unrecognized status reads as unknown, an absent one as null", () => {
  const unknown = parse(MIXED_PLAN.replace("**Status:** executing", "**Status:** halfway"));
  assert.deepStrictEqual(unknown.plan, { file: "plan.md", status: "unknown", statusRaw: "halfway" });

  const absent = parse(MIXED_PLAN.replace("**Status:** executing\n", ""));
  assert.deepStrictEqual(absent.plan, { file: "plan.md", status: null, statusRaw: null });
});

test("a folder with no plan.md reports nothing and exits 1", () => {
  const dir = folder("no-plan", { goals: GOALS });
  const child = run([dir]);
  assert.strictEqual(child.status, 1, `expected exit 1, got ${child.status}`);
  assert.strictEqual(child.stdout, "");
  assert.match(child.stderr, /has no readable plan\.md/);
});

test("--compaction-plan on a folder with no result.md reports nothing and exits 1", () => {
  const dir = folder("plan-only", { plan: MIXED_PLAN });
  const child = run(["--compaction-plan", dir]);
  assert.strictEqual(child.status, 1, `expected exit 1, got ${child.status}`);
  assert.strictEqual(child.stdout, "");
  assert.match(child.stderr, /has no readable result\.md/);
});

test("a missing directory is the same nothing-to-report exit", () => {
  const child = run([join(TEST_ROOT, "nowhere")]);
  assert.strictEqual(child.status, 1, `expected exit 1, got ${child.status}`);
  assert.strictEqual(child.stdout, "");
});

test("a wrong argument count is a usage error", () => {
  for (const args of [[], [TEST_ROOT, TEST_ROOT]]) {
    const child = run(args);
    assert.strictEqual(child.status, 2, `expected exit 2 for ${args.length} arguments, got ${child.status}`);
    assert.match(child.stderr, /usage: node scripts\/task-state\.ts <task-dir>/);
  }
});

const COMPACTION_PLAN = `# Plan: compaction fixture

**Status:** executing

## Steps

### Step 1 — First thing

- [x] **What:** do the first thing ([result](./result.md#step-1--first-thing))
- **Goal:** none (infra/refactor)
`;

const COMPACTION_RESULT = `# Result: compaction fixture

**Plan:** [./plan.md](./plan.md)

## Current state

_Updated:_ 2026-01-04

---

## Compacted — 2025-12-01

- Step 0 — An older step

full text in git history (pre-compaction state).

---

## Step 1 — First thing

**Verified:** it happened

### Evidence

the transcript this collapse exists for

---

## Reconciliation — 2025-12-20

- superseded by the entry below

---

## Blocked — 2026-01-01

**Blocked:** waiting on the vendor

---

## Review — 2026-01-03

**In review:** awaiting the client's sign-off

---

## Reconciliation — 2026-01-04

- the latest entry

---

## Decision log

- chose the smaller cut

---

## Acceptance

- G1 — met

---

## Health boundary — 2026-01-04

**Trigger:** tail

---
`;

function git(cwd: string, args: readonly string[]): string {
  const child = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  assert.strictEqual(child.status, 0, `git ${args.join(" ")} failed: ${child.stderr}`);
  return child.stdout;
}

function checkout(name: string): string {
  const dir = join(TEST_ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const init = spawnSync("git", ["init", "-q", dir], { encoding: "utf8" });
  assert.strictEqual(init.status, 0, `git init failed: ${init.stderr}`);
  git(dir, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  git(dir, ["config", "user.email", "test@example.invalid"]);
  git(dir, ["config", "user.name", "agents-kit test"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  return dir;
}

function sized(base: string, bytes: number): string {
  const padding = bytes - Buffer.byteLength(base, "utf8");
  assert.ok(padding >= 0, `${bytes} bytes is smaller than the fixture itself`);
  return base + "x".repeat(padding);
}

function plan(dir: string): CompactionPlan {
  const child = run(["--compaction-plan", dir]);
  assert.strictEqual(child.status, 0, `expected exit 0, got ${child.status}: ${child.stderr}`);
  return JSON.parse(child.stdout) as CompactionPlan;
}

test("a result under the trigger is not due for compaction", () => {
  const dir = folder("compaction-small", { plan: COMPACTION_PLAN, result: COMPACTION_RESULT });
  const report = plan(dir);
  assert.strictEqual(report.due, false);
  assert.strictEqual(report.maxKb, RESULT_MAX_KB);
  assert.ok(report.bytes < TRIGGER_BYTES, `expected under ${TRIGGER_BYTES} bytes, got ${report.bytes}`);
});

test("an oversized result committed at HEAD passes the precondition and lists both section sets", () => {
  const repo = checkout("compaction-committed");
  const dir = join(repo, "task");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "plan.md"), COMPACTION_PLAN);
  writeFileSync(join(dir, "result.md"), sized(COMPACTION_RESULT, TRIGGER_BYTES + 1));
  git(repo, ["add", "-f", "--", "task/plan.md", "task/result.md"]);
  git(repo, ["commit", "-q", "-m", "the pre-compaction state"]);

  const report = plan(dir);
  assert.strictEqual(report.due, true);
  assert.strictEqual(report.bytes, TRIGGER_BYTES + 1);
  assert.deepStrictEqual(report.precondition, { state: "ok", detail: null, uncommitted: false });
  assert.deepStrictEqual(report.keep, [
    { heading: "Current state", anchor: "current-state", rule: "current-state" },
    { heading: "Compacted — 2025-12-01", anchor: "compacted--2025-12-01", rule: "compacted" },
    { heading: "Reconciliation — 2026-01-04", anchor: "reconciliation--2026-01-04", rule: "reconciliation" },
    { heading: "Decision log", anchor: "decision-log", rule: "decision-log" },
    { heading: "Acceptance", anchor: "acceptance", rule: "acceptance" },
    { heading: "Health boundary — 2026-01-04", anchor: "health-boundary--2026-01-04", rule: "health-boundary" },
  ]);
  assert.deepStrictEqual(report.removable, [
    { heading: "Step 1 — First thing", anchor: "step-1--first-thing" },
    { heading: "Reconciliation — 2025-12-20", anchor: "reconciliation--2025-12-20" },
    { heading: "Blocked — 2026-01-01", anchor: "blocked--2026-01-01" },
    { heading: "Review — 2026-01-03", anchor: "review--2026-01-03" },
  ]);

  writeFileSync(join(dir, "result.md"), sized(COMPACTION_RESULT, TRIGGER_BYTES + 2));
  assert.strictEqual(plan(dir).precondition.uncommitted, true);
});

test("a result that does not resolve at HEAD fails the precondition", () => {
  const repo = checkout("compaction-untracked");
  const dir = join(repo, "task");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(repo, "seed.md"), "the checkout needs a HEAD\n");
  git(repo, ["add", "-f", "--", "seed.md"]);
  git(repo, ["commit", "-q", "-m", "seed"]);
  writeFileSync(join(dir, "plan.md"), COMPACTION_PLAN);
  writeFileSync(join(dir, "result.md"), sized(COMPACTION_RESULT, TRIGGER_BYTES + 1));

  const report = plan(dir);
  assert.strictEqual(report.due, true);
  assert.strictEqual(report.precondition.state, "fails");
  assert.strictEqual(report.precondition.uncommitted, null);
  assert.match(report.precondition.detail ?? "", /result\.md/);
});

test("the active pause section is the one the plan's status owes, and only the most recent", () => {
  const blocked = compactionSections(COMPACTION_RESULT, "blocked");
  assert.deepStrictEqual(
    blocked.keep.filter((section) => section.rule === "pause").map((section) => section.heading),
    ["Blocked — 2026-01-01"],
  );
  assert.ok(blocked.removable.some((section) => section.heading === "Review — 2026-01-03"));

  const inReview = compactionSections(COMPACTION_RESULT, "in-review");
  assert.deepStrictEqual(
    inReview.keep.filter((section) => section.rule === "pause").map((section) => section.heading),
    ["Review — 2026-01-03"],
  );
  assert.ok(inReview.removable.some((section) => section.heading === "Blocked — 2026-01-01"));

  const older = COMPACTION_RESULT.replace(
    "## Review — 2026-01-03\n\n**In review:** awaiting the client's sign-off",
    "## Blocked — 2026-01-03\n\n**Blocked:** waiting on the vendor again",
  );
  assert.deepStrictEqual(
    compactionSections(older, "blocked").keep.filter((section) => section.rule === "pause").map((section) => section.heading),
    ["Blocked — 2026-01-03"],
  );
});

test("the compaction trigger reads the same bytes health-check's oversized-result verdict does", () => {
  const root = join(TEST_ROOT, "measure");
  rmSync(root, { recursive: true, force: true });
  const sizes = { "at-trigger": TRIGGER_BYTES, "over-trigger": TRIGGER_BYTES + 1 };
  for (const [name, bytes] of Object.entries(sizes)) {
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "plan.md"), COMPACTION_PLAN);
    writeFileSync(join(dir, "result.md"), sized(COMPACTION_RESULT, bytes));
  }

  const walk = spawnSync(process.execPath, [HEALTH_CHECK, root], { encoding: "utf8" });
  assert.strictEqual(walk.status, 0, `health-check failed: ${walk.stderr}`);
  const oversized = (JSON.parse(walk.stdout).findings as { check: string; path: string }[])
    .filter((finding) => finding.check === "oversized-result")
    .map((finding) => finding.path);

  assert.deepStrictEqual(oversized, ["measure/over-trigger"]);
  assert.strictEqual(plan(join(root, "at-trigger")).due, false);
  assert.strictEqual(plan(join(root, "over-trigger")).due, true);
});
