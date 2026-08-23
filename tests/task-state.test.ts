// Covers scripts/task-state.ts: the plan-state report — checkbox state, next pending step,
// checkpoint outcomes, result-anchor resolution, goal coverage — and its 0/1/2 exit contract. The
// CLI cases run fixture task folders end to end; the parsing variants call the exported pure layer
// directly, which needs no folder on disk.
// Zero dependencies; runs under Node type stripping — too old a Node fails as a parse error, not a
// version message. Floor in AGENTS.md § The `.ts` sources are unchecked by design.
// Run: node --test tests/<name>.test.ts   ·   every suite: node --test "tests/*.test.ts"

import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { taskState, type TaskState } from "../scripts/task-state.ts";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SCRIPT = join(REPO_DIR, "scripts", "task-state.ts");
const TEST_ROOT = mkdtempSync(join(tmpdir(), "agents-kit-task-state-"));
// A fence opener written as a value, so a fixture can carry fenced markdown without escaping every
// backtick of it inside the template literal that holds it.
const FENCE = "```";

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

// The pure layer's inputs, so a parsing case can vary one file without writing three.
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
  // A checkpoint heading carries no checkbox, so it is never a step.
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
  // `none` on its own is a malformed goal line, not the escape task-goals.md defines, and review-task
  // reads orphanSteps as the whole answer to which steps deliver nothing — so a near miss that
  // silently qualified would hide exactly the scope creep this list exists to surface.
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
  // CommonMark allows an info string on an opener and nothing but whitespace on a closer. Closing on
  // the inner opener would hand the rest of the example back as the plan's own lines — and the
  // `**Status:** done` written there as illustration would then read as the plan's status.
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

// `plan.md` is the task's only lifecycle home, so a `**Status:**` surviving in a result file is
// reported as the legacy field it is: verbatim, judged against no vocabulary, and never a second
// lifecycle for a reader to weigh against the plan's.
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
