import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RESULT_MAX_KB } from "../scripts/lifecycle-constants.ts";
import { compactionSections, taskState, type CompactionPlan, type TaskState } from "../scripts/task-state.ts";
import { repairTask } from "../scripts/task-repair.ts";
import { parseGoalDefinitions, scanGoalReferences } from "../scripts/goal-structure.ts";

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

test("a malformed goal and its citations make coverage unreliable", () => {
  const goals = "## Goals\n- G1 — first\n- G4a — second\n";
  const plan = "## Scope\n- delivered: G1, G4a\n## Steps\n### Step 1 — First\n- [ ] **What:** first\n- **Goal:** G1\n### Step 2 — Second\n- [ ] **What:** second\n- **Goal:** G4a\n";
  const state = report(folder("malformed-coverage", { goals, plan }));
  assert.strictEqual(state.structure.reliable, false);
  assert.ok(state.structure.diagnostics.some((item) => item.code === "malformed-goal-id"));
  assert.ok(state.structure.diagnostics.some((item) => item.code === "malformed-goal-reference"));
});

test("ID-like vocabulary in the ticket or the deliverable is not a structural defect", () => {
  const dir = folder("upstream-vocabulary", {
    goals: "## Goals\n- G1 — first\n",
    plan: "## Scope\n- delivered: G1\n## Steps\n### Step 1 — First\n- [ ] **What:** first\n- **Goal:** G1\n",
  });
  writeFileSync(join(dir, "ticket.md"), "# Tune pauses\n\n## Acceptance Criteria\n- p99 pause drops after switching from CMS to G1GC.\n- G711 audio still plays.\n");
  writeFileSync(join(dir, "adr.md"), "# Collector choice\n\n**Status:** proposed\n\n## Decision\nUse G1GC; G20 hosts stay on CMS.\n");
  assert.deepStrictEqual(report(dir).structure, { reliable: true, diagnostics: [] });
  writeFileSync(join(dir, "notes.md"), "G1GC tuning notes.\n");
  assert.deepStrictEqual(report(dir).structure.diagnostics.map((item) => [item.code, item.file]), [["malformed-goal-reference", "notes.md"]]);
});

test("structural validation covers duplicates, anchors, and every task Markdown reference", () => {
  const dir = folder("structural-references", {
    goals: "## Goals\n- G1 — first\n- G1 — conflicting first\n- G3 (external) — deferred\n",
    plan: "## Scope\n- delivered: G1 · deferred: G3\n## Steps\n### Step 1 — First\n- [x] **What:** first\n- **Goal:** G1\n",
    result: "## Current state\nDelivered G1.\n",
  });
  writeFileSync(join(dir, "CONTEXT.md"), "See G9. `G8` and [example](https://example.test/G7) are samples.\n> G6 is quoted.\n");
  writeFileSync(join(dir, "notes.md"), "~~~\nG5 is code\n~~~\nG4a is an old reference.\n");
  const state = report(dir);
  assert.deepStrictEqual(state.goalCoverage.goals, [{ id: "G1", steps: ["1"] }, { id: "G3", steps: [] }]);
  assert.deepStrictEqual(state.goalCoverage.uncoveredGoals, ["G3"]);
  assert.deepStrictEqual(state.goalCoverage.scopePartition.missingFromPartition, []);
  assert.strictEqual(state.structure.reliable, false);
  assert.deepStrictEqual(state.structure.diagnostics.map((item) => item.code), [
    "duplicate-goal-id", "unknown-goal-reference", "malformed-goal-reference", "missing-result-anchor",
  ]);
  assert.deepStrictEqual(state.structure.diagnostics.map((item) => item.file), [
    "goals.md", "CONTEXT.md", "notes.md", "plan.md",
  ]);
});

test("sparse goals and deliberate deferral can have reliable coverage", () => {
  const state = report(folder("sparse-deferred", {
    goals: "## Goals\n- G1 — delivered\n- G3 (external) — later\n",
    plan: "## Scope\n- delivered: G1 · deferred: G3\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G1\n",
  }));
  assert.strictEqual(state.structure.reliable, true);
  assert.deepStrictEqual(state.structure.diagnostics, []);
  assert.deepStrictEqual(state.goalCoverage.uncoveredGoals, ["G3"]);
});

test("unknown IDs in step Goal and Scope fields are diagnosed once, even inside inline code", () => {
  const cases: readonly { scope: string; goal: string; unknown: string; line: number }[] = [
    { scope: "G1", goal: "G1, `G9`", unknown: "G9", line: 6 },
    { scope: "G1", goal: "G1, G8", unknown: "G8", line: 6 },
    { scope: "G1, `G7`", goal: "G1", unknown: "G7", line: 2 },
    { scope: "G1 · deferred: G6", goal: "G1", unknown: "G6", line: 2 },
  ];
  for (const { scope, goal, unknown, line } of cases) {
    const plan = `## Scope\n- delivered: ${scope}\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** ${goal}\n`;
    const state = parse(plan, null, "## Goals\n- G1 — first\n");
    assert.strictEqual(state.structure.reliable, false, plan);
    assert.deepStrictEqual(state.structure.diagnostics, [{ code: "unknown-goal-reference", file: "plan.md", line, detail: unknown }], plan);
  }
});

test("CRLF goals and plan retain structural IDs, offsets, and line endings through repair", () => {
  const dir = historicalRepairFolder("repair-crlf");
  const goals = "## Goals\r\n- G1 — first\r\n- G4a — new outcome\r\n";
  const plan = "## Scope\r\n- delivered: G1, G4a\r\n## Steps\r\n### Step 1 — Work\r\n- [ ] **What:** work\r\n- **Goal:** G4a\r\n";
  writeFileSync(join(dir, "goals.md"), goals);
  writeFileSync(join(dir, "plan.md"), plan);
  assert.deepStrictEqual(parseGoalDefinitions(goals).definitions.map((item) => item.id), ["G1"]);
  const before = report(dir);
  assert.deepStrictEqual(before.goalCoverage.goals.map((item) => item.id), ["G1"]);
  assert.deepStrictEqual(before.steps.map((item) => item.number), ["1"]);
  assert.ok(before.structure.diagnostics.some((item) => item.code === "malformed-goal-id" && item.line === 3));
  const repaired = run(["--repair", dir]);
  assert.strictEqual(repaired.status, 0, repaired.stderr + repaired.stdout);
  assert.deepStrictEqual(JSON.parse(repaired.stdout).mappings, [{ from: "G4a", to: "G10" }]);
  assert.strictEqual(readFileSync(join(dir, "goals.md"), "utf8"), "## Goals\r\n- G1 — first\r\n- G10 — new outcome\r\n");
  assert.strictEqual(readFileSync(join(dir, "plan.md"), "utf8"), plan.replaceAll("G4a", "G10"));
  assert.strictEqual(report(dir).structure.reliable, true);
});

test("CRLF plan and result resolve checked-step anchors, fences, and the current state", () => {
  const crlf = (lines: readonly string[]) => lines.join("\r\n") + "\r\n";
  const currentState = ["## Current state", "", `${FENCE}md`, "## Step 1 — Work", FENCE, "", "---"];
  const dir = folder("crlf-checked-step", {
    goals: crlf(["## Goals", "- G1 — first"]),
    plan: crlf(["## Scope", "- delivered: G1", "## Steps", "### Step 1 — Work", "- [x] **What:** work ([result](./result.md#step-1--work))", "- **Goal:** G1"]),
    result: crlf([...currentState, "", "## Step 1 — Work", "", "**Verified:** it happened"]),
  });
  const state = report(dir);
  assert.deepStrictEqual(state.steps.map((step) => [step.number, step.checked, step.anchor, step.anchorResolves]), [["1", true, "step-1--work", true]]);
  assert.deepStrictEqual(state.structure, { reliable: true, diagnostics: [] });
  assert.strictEqual(state.currentState, currentState.join("\n"));
  const repaired = run(["--repair", dir]);
  assert.strictEqual(repaired.status, 0, repaired.stderr + repaired.stdout);
  assert.deepStrictEqual(JSON.parse(repaired.stdout).unresolved, []);
});

test("repair normalizes an unambiguous decorated goal without a plan and is idempotent", () => {
  const dir = folder("repair-no-plan", { goals: "## Goals\n- G1: — delivered\n" });
  const first = run(["--repair", dir]);
  assert.strictEqual(first.status, 0, first.stderr + first.stdout);
  assert.deepStrictEqual(JSON.parse(first.stdout).applied.map((item: { file: string }) => item.file), ["goals.md"]);
  assert.strictEqual(readFileSync(join(dir, "goals.md"), "utf8"), "## Goals\n- G1 — delivered\n");
  const second = run(["--repair", dir]);
  assert.strictEqual(second.status, 0, second.stderr);
  assert.deepStrictEqual(JSON.parse(second.stdout).applied, []);
});

test("repair reports every diagnostic sharing one line, with or without a plan", () => {
  const unknown = [
    { code: "unknown-goal-reference", file: "CONTEXT.md", line: 1, detail: "G8" },
    { code: "unknown-goal-reference", file: "CONTEXT.md", line: 1, detail: "G9" },
  ];
  const cases: readonly { plan?: string; unresolved: readonly object[] }[] = [
    { unresolved: unknown },
    {
      plan: "## Scope\n- delivered: G1\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G1\n",
      unresolved: [
        ...unknown,
        { code: "missing-goal-partition", file: "plan.md", line: 0, detail: "G2" },
        { code: "missing-goal-partition", file: "plan.md", line: 0, detail: "G3" },
      ],
    },
  ];
  for (const { plan, unresolved } of cases) {
    const dir = folder(plan === undefined ? "repair-shared-line-no-plan" : "repair-shared-line-plan", {
      goals: "## Goals\n- G1 — first\n- G2 — second\n- G3 — third\n",
      plan,
    });
    writeFileSync(join(dir, "CONTEXT.md"), "Mentioned G8 and G9.\n");
    const result = run(["--repair", dir]);
    assert.strictEqual(result.status, 1, result.stderr + result.stdout);
    const repaired = JSON.parse(result.stdout);
    assert.deepStrictEqual(repaired.unresolved, unresolved, String(plan));
    if (plan === undefined) assert.strictEqual(repaired.state, null);
  }
});

function historicalRepairFolder(name: string, nested = false): string {
  const root = checkout(name);
  const dir = nested ? join(root, "Tasks", "Hub", "feature") : root;
  if (nested) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — first\n- G9 — retired\n");
  git(dir, ["add", "goals.md"]);
  git(dir, ["commit", "-qm", "record old goals"]);
  writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — first\n- G4a — new outcome\n");
  writeFileSync(join(dir, "plan.md"), "## Scope\n- delivered: G1, G4a\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G4a\n");
  writeFileSync(join(dir, "CONTEXT.md"), "The outcome is G4a.\r\n`G4a` is an example.\r\n> G4a is quoted.\r\n“G4a” is quoted inline.\r\n");
  writeFileSync(join(dir, "result.md"), "## Current state\nG4a was pending.\n\nSee G4a. [G4a](./plan.md) is local. https://example.test/G4a remains.\n");
  return dir;
}

test("fresh IDs reserve decorated numeric identities in either definition order", () => {
  for (const [label, decorated] of [["bold", "**G10**"], ["code", "`G10`"], ["colon", "G10:"], ["period", "G10."]] as const) {
    for (const order of ["malformed-first", "numeric-first"] as const) {
      const dir = historicalRepairFolder(`repair-reserve-${label}-${order}`);
      const outcomes = order === "malformed-first"
        ? ["- G4a — first outcome", `- ${decorated} — second outcome`]
        : [`- ${decorated} — second outcome`, "- G4a — first outcome"];
      writeFileSync(join(dir, "goals.md"), `## Goals\n- G1 — first\n${outcomes.join("\n")}\n`);
      writeFileSync(join(dir, "plan.md"), "## Scope\n- delivered: G1, G4a, G10\n## Steps\n### Step 1 — First outcome\n- [ ] **What:** first\n- **Goal:** G4a\n### Step 2 — Second outcome\n- [ ] **What:** second\n- **Goal:** G10\n");
      writeFileSync(join(dir, "result.md"), "The first outcome is G4a. The second outcome is G10.\n");

      const first = run(["--repair", dir]);
      assert.strictEqual(first.status, 0, `${label} ${order}: ${first.stderr}${first.stdout}`);
      const repaired = JSON.parse(first.stdout);
      assert.deepStrictEqual(repaired.unresolved, []);
      assert.deepStrictEqual(repaired.mappings, order === "malformed-first"
        ? [{ from: "G4a", to: "G11" }, { from: decorated, to: "G10" }]
        : [{ from: decorated, to: "G10" }, { from: "G4a", to: "G11" }]);
      assert.strictEqual(readFileSync(join(dir, "goals.md"), "utf8"), `## Goals\n- G1 — first\n${outcomes.map((line) => line.replace("G4a", "G11").replace(decorated, "G10")).join("\n")}\n`);
      assert.match(readFileSync(join(dir, "plan.md"), "utf8"), /delivered: G1, G11, G10/);
      assert.match(readFileSync(join(dir, "plan.md"), "utf8"), /\*\*Goal:\*\* G11[\s\S]*\*\*Goal:\*\* G10/);
      assert.strictEqual(readFileSync(join(dir, "result.md"), "utf8"), "The first outcome is G11. The second outcome is G10.\n");
      const fresh = report(dir);
      assert.strictEqual(fresh.structure.reliable, true, `${label} ${order}: ${JSON.stringify(fresh.structure.diagnostics)}`);
      assert.deepStrictEqual(fresh.goalCoverage.goals.find((goal) => goal.id === "G11")?.steps, ["1"]);
      assert.deepStrictEqual(fresh.goalCoverage.goals.find((goal) => goal.id === "G10")?.steps, ["2"]);
      const inode = statSync(join(dir, "goals.md")).ino;
      const second = run(["--repair", dir]);
      assert.strictEqual(second.status, 0, `${label} ${order}: ${second.stderr}${second.stdout}`);
      assert.deepStrictEqual(JSON.parse(second.stdout).applied, []);
      assert.strictEqual(statSync(join(dir, "goals.md")).ino, inode);
    }
  }
});

test("fresh IDs skip numeric IDs the task Markdown already references", () => {
  const upstream = historicalRepairFolder("repair-reserve-referenced-upstream");
  writeFileSync(join(upstream, "notes.md"), "Upstream note mentions G10 which is not one of our goals.\n");
  const sibling = checkout("repair-reserve-referenced-sibling");
  writeFileSync(join(sibling, "goals.md"), "## Goals\n- G1 — first\n- G4a — new outcome\n");
  git(sibling, ["add", "goals.md"]);
  git(sibling, ["commit", "-qm", "record goals"]);
  writeFileSync(join(sibling, "plan.md"), "## Scope\n- delivered: G1, G4a\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G4a\n");
  writeFileSync(join(sibling, "CONTEXT.md"), "Depends on the sibling export task delivering G2 first.\n");

  for (const [dir, file, stray, fresh] of [[upstream, "notes.md", "G10", "G11"], [sibling, "CONTEXT.md", "G2", "G3"]] as const) {
    const strayReported = (diagnostics: readonly { code: string; file: string; detail: string }[]) =>
      diagnostics.some((item) => item.code === "unknown-goal-reference" && item.file === file && item.detail === stray);
    const text = readFileSync(join(dir, file), "utf8");
    assert.ok(strayReported(report(dir).structure.diagnostics), stray);
    const result = run(["--repair", dir]);
    assert.strictEqual(result.status, 1, `${stray}: ${result.stderr}${result.stdout}`);
    const repaired = JSON.parse(result.stdout);
    assert.deepStrictEqual(repaired.mappings, [{ from: "G4a", to: fresh }], stray);
    assert.ok(strayReported(repaired.unresolved), `${stray}: ${JSON.stringify(repaired.unresolved)}`);
    assert.strictEqual(repaired.state.structure.reliable, false, stray);
    assert.match(readFileSync(join(dir, "goals.md"), "utf8"), new RegExp(`^- ${fresh} — new outcome$`, "m"));
    assert.strictEqual(readFileSync(join(dir, file), "utf8"), text, stray);
    assert.ok(strayReported(report(dir).structure.diagnostics), stray);
  }
});

test("fresh IDs skip a numeric ID written inside underscore emphasis", () => {
  const dir = checkout("repair-reserve-underscore-emphasis");
  writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — first\n");
  git(dir, ["add", "goals.md"]);
  git(dir, ["commit", "-qm", "record goals"]);
  writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — first\n- G4a — new outcome\n");
  writeFileSync(join(dir, "plan.md"), "## Scope\n- delivered: G1, G4a\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G4a\n");
  writeFileSync(join(dir, "CONTEXT.md"), "Depends on the sibling task delivering _its G2_ first.\n");
  const context = readFileSync(join(dir, "CONTEXT.md"));
  const result = run(["--repair", dir]);
  const repaired = JSON.parse(result.stdout);
  assert.deepStrictEqual(repaired.mappings, [{ from: "G4a", to: "G3" }], result.stderr + result.stdout);
  assert.match(readFileSync(join(dir, "goals.md"), "utf8"), /^- G3 — new outcome$/m);
  assert.ok(readFileSync(join(dir, "CONTEXT.md")).equals(context));
});

test("fresh IDs skip numbers written in code, quotes, comments, and link targets", () => {
  const dir = checkout("repair-reserve-hidden");
  writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — first\n- G4a — new outcome\n");
  git(dir, ["add", "goals.md"]);
  git(dir, ["commit", "-qm", "record goals"]);
  writeFileSync(join(dir, "plan.md"), "## Scope\n- delivered: G1, G4a\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G4a\n### Step 2 — Other\n- [ ] **What:** other\n- **Goal:** G1, `G2`\n");
  writeFileSync(join(dir, "CONTEXT.md"), "\"G3\" <!-- G4 --> [spec](./G5.md)\n");
  const cited = (state: TaskState) => state.structure.diagnostics.some((item) => item.code === "unknown-goal-reference" && item.detail === "G2");
  assert.ok(cited(report(dir)));
  const result = run(["--repair", dir]);
  const repaired = JSON.parse(result.stdout);
  assert.deepStrictEqual(repaired.mappings, [{ from: "G4a", to: "G6" }], result.stderr + result.stdout);
  assert.ok(cited(repaired.state));
});

test("apostrophes and inch marks never hide a live reference from repair", () => {
  for (const [label, line] of [
    ["code possessive", "The `exporter`'s G4a path doesn't handle archived rows."],
    ["bold possessive", "**Deliverable**'s G4a section isn't done."],
    ["elision", "Since the '90s, G4a has been blocked, and we don't know why."],
    ["inch marks", "On a 13\" laptop G4a keeps the layout, and on a 27\" monitor too."],
  ] as const) {
    const dir = historicalRepairFolder(`repair-apostrophe-${label.replace(/ /g, "-")}`);
    writeFileSync(join(dir, "CONTEXT.md"), `${line}\n'G4a' stays quoted.\n`);
    const result = run(["--repair", dir]);
    assert.strictEqual(result.status, 0, `${label}: ${result.stderr}${result.stdout}`);
    assert.deepStrictEqual(JSON.parse(result.stdout).mappings, [{ from: "G4a", to: "G10" }], label);
    assert.strictEqual(readFileSync(join(dir, "CONTEXT.md"), "utf8"), `${line.replace("G4a", "G10")}\n'G4a' stays quoted.\n`, label);
  }
});

test("a digit-leading straight quotation stays literal during repair", () => {
  const dir = historicalRepairFolder("repair-digit-leading-quotation");
  writeFileSync(join(dir, "CONTEXT.md"), "He wrote '2026 G4a' in the note.\n");
  const before = readFileSync(join(dir, "CONTEXT.md"));
  const attempted = run(["--repair", dir]);
  assert.strictEqual(attempted.status, 0, attempted.stderr + attempted.stdout);
  assert.deepStrictEqual(JSON.parse(attempted.stdout).mappings, [{ from: "G4a", to: "G10" }]);
  assert.ok(readFileSync(join(dir, "CONTEXT.md")).equals(before));
});

test("a multi-line digit-leading straight quotation blocks repair without changing core files", () => {
  const dir = historicalRepairFolder("repair-multiline-digit-leading-quotation");
  writeFileSync(join(dir, "CONTEXT.md"), "He wrote '2026\nG4a' in the note.\n");
  const files = ["goals.md", "plan.md", "CONTEXT.md", "result.md"];
  const before = files.map((name) => readFileSync(join(dir, name)));
  const attempted = run(["--repair", dir]);
  assert.strictEqual(attempted.status, 1, attempted.stderr + attempted.stdout);
  const repaired = JSON.parse(attempted.stdout);
  assert.deepStrictEqual(repaired.applied, []);
  assert.ok(repaired.unresolved.some((item: { code: string; file: string; line: number; detail: string }) =>
    item.code === "ambiguous-goal-reference" && item.file === "CONTEXT.md" && item.line === 2 && item.detail === "G4a"));
  for (const [index, name] of files.entries()) assert.ok(readFileSync(join(dir, name)).equals(before[index]), name);
});

test("link destinations with balanced or escaped parentheses, or a title, stay out of repair", () => {
  const dir = historicalRepairFolder("repair-parenthesized-destination");
  const links = "[spec](./a(b)G4a.md) and [spec](./a\\)G4a.md) stay linked.\n[spec](G4a.md \"the spec\") and [notes](./notes.md (G4a notes)) keep their titles.\n";
  writeFileSync(join(dir, "CONTEXT.md"), `The outcome is G4a.\n${links}`);
  const result = run(["--repair", dir]);
  assert.strictEqual(result.status, 0, result.stderr + result.stdout);
  const repaired = JSON.parse(result.stdout);
  assert.deepStrictEqual(repaired.mappings, [{ from: "G4a", to: "G10" }]);
  assert.deepStrictEqual(repaired.unresolved, []);
  assert.strictEqual(readFileSync(join(dir, "CONTEXT.md"), "utf8"), `The outcome is G10.\n${links}`);
});

test("URI identifiers stay literal while nearby local and colon-separated goal references repair", () => {
  const dir = historicalRepairFolder("repair-bare-uri");
  const context = "mailto:G4a@example.invalid\nurn:example:G4a\nGoal: G4a\nThe outcome is G4a.\n";
  writeFileSync(join(dir, "CONTEXT.md"), context);
  const result = run(["--repair", dir]);
  assert.strictEqual(result.status, 0, result.stderr + result.stdout);
  assert.deepStrictEqual(JSON.parse(result.stdout).mappings, [{ from: "G4a", to: "G10" }]);
  assert.strictEqual(readFileSync(join(dir, "CONTEXT.md"), "utf8"),
    "mailto:G4a@example.invalid\nurn:example:G4a\nGoal: G10\nThe outcome is G10.\n");
});

test("a code-spanned identity in a Scope or Goal field blocks its remap", () => {
  for (const [label, plan, line] of [
    ["goal field", "## Scope\n- delivered: G1, G4a\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G1, `G4a`\n", 6],
    ["scope", "## Scope\n- delivered: G1, `G4a`\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G4a\n", 2],
  ] as const) {
    const dir = historicalRepairFolder(`repair-field-code-${label.replace(/ /g, "-")}`);
    writeFileSync(join(dir, "plan.md"), plan);
    const before = new Map(["goals.md", "plan.md", "CONTEXT.md", "result.md"].map((file) => [file, readFileSync(join(dir, file), "utf8")]));
    const result = run(["--repair", dir]);
    assert.strictEqual(result.status, 1, `${label}: ${result.stderr}${result.stdout}`);
    const repaired = JSON.parse(result.stdout);
    assert.deepStrictEqual(repaired.mappings, [], label);
    assert.ok(repaired.unresolved.some((item: { code: string; file: string; line: number; detail: string }) =>
      item.code === "blocked-goal-remap" && item.file === "plan.md" && item.line === line && item.detail === "G4a"), label);
    for (const [file, text] of before) assert.strictEqual(readFileSync(join(dir, file), "utf8"), text, `${label}: ${file}`);
  }
});

test("an indented block after a blank line blocks a remap instead of rewriting evidence", () => {
  const dir = historicalRepairFolder("repair-indented-evidence");
  const result = "## Current state\nG4a was pending.\n\n    ERROR goal G4a missing\n";
  writeFileSync(join(dir, "result.md"), result);
  const repaired = run(["--repair", dir]);
  assert.strictEqual(repaired.status, 1, repaired.stderr + repaired.stdout);
  const report = JSON.parse(repaired.stdout);
  assert.deepStrictEqual(report.mappings, []);
  assert.ok(report.unresolved.some((item: { code: string; file: string; line: number }) => item.code === "blocked-goal-remap" && item.file === "result.md" && item.line === 4));
  assert.strictEqual(readFileSync(join(dir, "result.md"), "utf8"), result);
});

test("a reference definition continued on the next line keeps its label out of local remaps", () => {
  const dir = historicalRepairFolder("repair-definition-continuation");
  const context = "[G4a]:\n  ../other/goals.md\n\nSee [G4a] upstream.\n";
  writeFileSync(join(dir, "CONTEXT.md"), context);
  const blocked = run(["--repair", dir]);
  assert.strictEqual(blocked.status, 1, blocked.stderr + blocked.stdout);
  assert.deepStrictEqual(JSON.parse(blocked.stdout).mappings, []);
  assert.ok(JSON.parse(blocked.stdout).unresolved.some((item: { code: string; file: string; line: number }) => item.code === "outside-goal-reference" && item.file === "CONTEXT.md" && item.line === 4));
  assert.strictEqual(readFileSync(join(dir, "CONTEXT.md"), "utf8"), context);

  writeFileSync(join(dir, "CONTEXT.md"), "The outcome is G4a.\n[spec]:\n  G4a.md\n");
  const repaired = run(["--repair", dir]);
  assert.strictEqual(repaired.status, 0, repaired.stderr + repaired.stdout);
  assert.strictEqual(readFileSync(join(dir, "CONTEXT.md"), "utf8"), "The outcome is G10.\n[spec]:\n  G4a.md\n");
});

test("footnote bodies are prose: validated and remapped like any other line", () => {
  const dir = historicalRepairFolder("repair-footnote");
  writeFileSync(join(dir, "CONTEXT.md"), "Archived rows matter.[^1]\n\n[^1]: G4a covers archived rows.\n");
  const repaired = run(["--repair", dir]);
  assert.strictEqual(repaired.status, 0, repaired.stderr + repaired.stdout);
  assert.strictEqual(readFileSync(join(dir, "CONTEXT.md"), "utf8"), "Archived rows matter.[^1]\n\n[^1]: G10 covers archived rows.\n");
  writeFileSync(join(dir, "CONTEXT.md"), "[^1]: G7 is unknown.\n");
  assert.ok(report(dir).structure.diagnostics.some((item) => item.code === "unknown-goal-reference" && item.file === "CONTEXT.md" && item.detail === "G7"));
});

test("a normalization that would open a scope-partition gap writes nothing", () => {
  const dir = folder("repair-partition-gap", {
    goals: "## Goals\n- G1 — a\n- G2: — b\n",
    plan: "## Scope\n- delivered: G1\n## Steps\n### Step 1 — A\n- [ ] **What:** a\n- **Goal:** G1\n",
  });
  const repaired = run(["--repair", dir]);
  assert.strictEqual(repaired.status, 1, repaired.stderr + repaired.stdout);
  const report = JSON.parse(repaired.stdout);
  assert.deepStrictEqual(report.applied, []);
  assert.ok(report.unresolved.some((item: { code: string; detail: string }) => item.code === "missing-goal-partition" && item.detail === "G2"));
  assert.strictEqual(readFileSync(join(dir, "goals.md"), "utf8"), "## Goals\n- G1 — a\n- G2: — b\n");
});

test("repair uses the retired historical maximum and updates all proven task references", () => {
  const dir = historicalRepairFolder("repair-historical", true);
  assert.match(git(dir, ["ls-files", "--error-unmatch", "--", "goals.md"]), /goals\.md/);
  assert.match(git(resolve(dir, "../../.."), ["log", "--all", "--follow", "--format=", "--patch", "--", "Tasks/Hub/feature/goals.md"]), /^new file mode /m);
  const before = report(dir);
  assert.strictEqual(before.structure.reliable, false);
  const result = run(["--repair", dir]);
  assert.strictEqual(result.status, 0, result.stderr + result.stdout);
  const repaired = JSON.parse(result.stdout);
  assert.deepStrictEqual(repaired.mappings, [{ from: "G4a", to: "G10" }]);
  assert.deepStrictEqual(repaired.applied.map((item: { file: string }) => item.file).sort(), ["CONTEXT.md", "goals.md", "plan.md", "result.md"]);
  assert.deepStrictEqual(repaired.unresolved, []);
  assert.strictEqual(repaired.state.structure.reliable, true);
  assert.match(readFileSync(join(dir, "goals.md"), "utf8"), /^- G10 — new outcome$/m);
  assert.match(readFileSync(join(dir, "plan.md"), "utf8"), /delivered: G1, G10/);
  assert.strictEqual(readFileSync(join(dir, "CONTEXT.md"), "utf8"), "The outcome is G10.\r\n`G4a` is an example.\r\n> G4a is quoted.\r\n“G4a” is quoted inline.\r\n");
  assert.strictEqual(readFileSync(join(dir, "result.md"), "utf8"), "## Current state\nG10 was pending.\n\nSee G10. [G10](./plan.md) is local. https://example.test/G4a remains.\n");
  const inode = statSync(join(dir, "goals.md")).ino;
  const second = run(["--repair", dir]);
  assert.strictEqual(second.status, 0);
  assert.deepStrictEqual(JSON.parse(second.stdout).applied, []);
  assert.strictEqual(statSync(join(dir, "goals.md")).ino, inode);
});

test("repair leaves a lazy blockquote continuation literal", () => {
  const dir = historicalRepairFolder("repair-lazy-quote");
  writeFileSync(join(dir, "result.md"), "> Quoted example:\nG4a must remain literal.\n\nG4a resumes after the quote.\n");
  const result = run(["--repair", dir]);
  assert.strictEqual(result.status, 0, result.stderr + result.stdout);
  assert.deepStrictEqual(JSON.parse(result.stdout).mappings, [{ from: "G4a", to: "G10" }]);
  assert.strictEqual(readFileSync(join(dir, "result.md"), "utf8"), "> Quoted example:\nG4a must remain literal.\n\nG10 resumes after the quote.\n");
});

test("a reference definition in a lazy blockquote continuation defines no label", () => {
  const [reference] = scanGoalReferences("notes.md", "> Quoted example:\n[x]: https://example.test/\n\n[G4a][x]\n");
  assert.strictEqual(reference.linkedScope, "ambiguous");
});

test("fresh IDs skip a retired decorated historical definition", () => {
  for (const [label, decorated] of [["bold", "**G2**"], ["code", "`G2`"]] as const) {
    const dir = checkout(`repair-retired-decorated-${label}`);
    writeFileSync(join(dir, "goals.md"), `## Goals\n- G1 — first\n- ${decorated} — retired later\n`);
    git(dir, ["add", "goals.md"]);
    git(dir, ["commit", "-qm", "record decorated goal"]);
    writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — first\n");
    git(dir, ["commit", "-qam", "retire decorated goal"]);
    writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — first\n- G4a — new outcome\n");
    writeFileSync(join(dir, "plan.md"), "## Scope\n- delivered: G1, G4a\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G4a\n");

    const result = run(["--repair", dir]);
    assert.strictEqual(result.status, 0, `${label}: ${result.stderr}${result.stdout}`);
    assert.deepStrictEqual(JSON.parse(result.stdout).mappings, [{ from: "G4a", to: "G3" }], label);
    assert.strictEqual(readFileSync(join(dir, "goals.md"), "utf8"), "## Goals\n- G1 — first\n- G3 — new outcome\n", label);
    assert.match(readFileSync(join(dir, "plan.md"), "utf8"), /delivered: G1, G3\n[\s\S]*\*\*Goal:\*\* G3\n/, label);
  }
});

test("repair sweeps staging files whose writer is gone and keeps a live writer's", () => {
  const dir = historicalRepairFolder("repair-staging-sweep");
  const dead = spawnSync(process.execPath, ["-e", ""]).pid;
  const stale = `goals.md.agents-kit-repair.${dead}.abc123`;
  const live = `notes.md.agents-kit-repair.${process.pid}.def456`;
  writeFileSync(join(dir, stale), "partial");
  writeFileSync(join(dir, live), "in flight");
  const result = run(["--repair", dir]);
  assert.strictEqual(result.status, 0, result.stderr + result.stdout);
  assert.deepStrictEqual(JSON.parse(result.stdout).swept, [stale]);
  assert.ok(!existsSync(join(dir, stale)));
  assert.strictEqual(readFileSync(join(dir, live), "utf8"), "in flight");
});

test("a staging write that fails after creating its file leaves no staging file behind", () => {
  const dir = folder("repair-staging-write-failure", { goals: `## Goals\n- G1: — ${"delivered ".repeat(1024)}\n` });
  const original = readFileSync(join(dir, "goals.md"));
  const limited = spawnSync("/bin/sh", ["-c", 'ulimit -f 1 && exec "$0" "$@"', process.execPath, SCRIPT, "--repair", dir], { encoding: "utf8" });
  assert.strictEqual(limited.status, 2, limited.stderr + limited.stdout);
  const repaired = JSON.parse(limited.stdout);
  assert.match(repaired.error, /EFBIG/);
  assert.deepStrictEqual(repaired.applied, []);
  assert.deepStrictEqual(repaired.unrecovered, []);
  assert.deepStrictEqual(readdirSync(dir).filter((name) => name.includes(".agents-kit-repair.")), []);
  assert.ok(readFileSync(join(dir, "goals.md")).equals(original));
});

test("goal history reads only the task's own path when its name holds glob characters", () => {
  const root = checkout("repair-literal-pathspec");
  const sibling = join(root, "Tasks", "x");
  const dir = join(root, "Tasks", "[x]");
  mkdirSync(sibling, { recursive: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(sibling, "goals.md"), "## Goals\n- G1 — first\n- G30 — sibling outcome\n");
  writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — first\n- G4a — new outcome\n");
  git(root, ["add", "Tasks"]);
  git(root, ["commit", "-qm", "record both tasks"]);
  writeFileSync(join(dir, "plan.md"), "## Scope\n- delivered: G1, G4a\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G4a\n");
  const result = run(["--repair", dir]);
  assert.strictEqual(result.status, 0, result.stderr + result.stdout);
  assert.deepStrictEqual(JSON.parse(result.stdout).mappings, [{ from: "G4a", to: "G2" }]);
});

test("commented goal bullets are neither definitions nor repair targets", () => {
  const goals = "## Goals\n- G1 — first\n<!-- example:\n- G2: — example outcome\n-->\n<!-- - G4a — inline example -->\n";
  const parsed = parseGoalDefinitions(goals);
  assert.deepStrictEqual(parsed.definitions.map((goal) => goal.id), ["G1"]);
  assert.deepStrictEqual(parsed.diagnostics, []);
  const dir = folder("repair-commented-definitions", { goals, plan: "## Scope\n- delivered: G1\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G1\n" });
  const result = run(["--repair", dir]);
  assert.strictEqual(result.status, 0, result.stderr + result.stdout);
  assert.deepStrictEqual(JSON.parse(result.stdout).applied, []);
  assert.strictEqual(readFileSync(join(dir, "goals.md"), "utf8"), goals);
});

test("repair leaves the ticket, deliverables, and supplementary documents unchanged", () => {
  for (const file of ["ticket.md", "adr.md", "docs/notes.md"]) {
    const dir = historicalRepairFolder(`repair-guarded-${file.replace(/\W/g, "-")}`);
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, file), "Deliver G4a.\n");
    const files = ["goals.md", "plan.md", "CONTEXT.md", "result.md", file];
    const before = files.map((name) => readFileSync(join(dir, name)));
    const result = run(["--repair", dir]);
    assert.strictEqual(result.status, 1, `${file}: ${result.stderr}${result.stdout}`);
    const repaired = JSON.parse(result.stdout);
    assert.deepStrictEqual(repaired.applied, [], file);
    assert.ok(repaired.unresolved.some((item: { code: string; file: string; line: number; detail: string }) =>
      item.code === "blocked-goal-remap" && item.file === file && item.line === 1 && item.detail === "G4a"), `${file}: ${JSON.stringify(repaired.unresolved)}`);
    for (const [index, name] of files.entries()) assert.ok(readFileSync(join(dir, name)).equals(before[index]), `${file}: ${name}`);
  }
});

test("a remap inside a heading or tombstone that defines an anchor writes nothing", () => {
  for (const [label, result, line] of [
    ["heading", "## Current state\nPending.\n\n---\n\n## Step 1 — Deliver G4a\nDone.\n", 6],
    ["tombstone", "## Current state\nPending.\n\n---\n\n## Compacted\n- Step 1 — Deliver G4a\n", 7],
  ] as const) {
    const dir = historicalRepairFolder(`repair-anchor-${label}`);
    writeFileSync(join(dir, "result.md"), result);
    writeFileSync(join(dir, "plan.md"), "## Scope\n- delivered: G1, G4a\n## Steps\n### Step 1 — Work\n- [x] **What:** work ([result](./result.md#step-1--deliver-g4a))\n- **Goal:** G4a\n");
    const files = ["goals.md", "plan.md", "CONTEXT.md", "result.md"];
    const before = files.map((name) => readFileSync(join(dir, name)));
    const attempted = run(["--repair", dir]);
    assert.strictEqual(attempted.status, 1, `${label}: ${attempted.stderr}${attempted.stdout}`);
    const repaired = JSON.parse(attempted.stdout);
    assert.deepStrictEqual(repaired.applied, [], label);
    assert.ok(repaired.unresolved.some((item: { code: string; file: string; line: number }) =>
      item.code === "blocked-goal-remap" && item.file === "result.md" && item.line === line), `${label}: ${JSON.stringify(repaired.unresolved)}`);
    for (const [index, name] of files.entries()) assert.ok(readFileSync(join(dir, name)).equals(before[index]), `${label}: ${name}`);
    assert.strictEqual(report(dir).steps[0].anchorResolves, true, label);
  }
});

test("a mention the scan skips because a slash, hyphen, or underscore joins it blocks a fresh remap", () => {
  for (const [label, context] of [
    ["slash-after", "G4a/G1 share the export path.\n"],
    ["slash-before", "G1/G4a share the export path.\n"],
    ["hyphen", "The G4a-only path stays.\n"],
    ["underscore", "Status: _waiting on G4a_.\n"],
  ] as const) {
    const dir = historicalRepairFolder(`repair-adjacent-${label}`);
    writeFileSync(join(dir, "CONTEXT.md"), context);
    const files = ["goals.md", "plan.md", "CONTEXT.md", "result.md"];
    const before = files.map((name) => readFileSync(join(dir, name)));
    const attempted = run(["--repair", dir]);
    assert.strictEqual(attempted.status, 1, `${label}: ${attempted.stderr}${attempted.stdout}`);
    const repaired = JSON.parse(attempted.stdout);
    assert.deepStrictEqual(repaired.applied, [], label);
    assert.ok(repaired.unresolved.some((item: { code: string; file: string; line: number; detail: string }) =>
      item.code === "blocked-goal-remap" && item.file === "CONTEXT.md" && item.line === 1 && item.detail === "G4a"), `${label}: ${JSON.stringify(repaired.unresolved)}`);
    for (const [index, name] of files.entries()) assert.ok(readFileSync(join(dir, name)).equals(before[index]), `${label}: ${name}`);
  }
});

test("a filename mention blocks repair without changing the attachment or core files", () => {
  const dir = historicalRepairFolder("repair-filename-mention");
  const context = "See G4a.md for the attachment.\n";
  writeFileSync(join(dir, "CONTEXT.md"), context);
  writeFileSync(join(dir, "G4a.md"), "Attachment content.\n");
  assert.deepStrictEqual(scanGoalReferences("CONTEXT.md", context), []);
  const files = ["goals.md", "plan.md", "CONTEXT.md", "result.md", "G4a.md"];
  const before = files.map((name) => readFileSync(join(dir, name)));
  const attempted = run(["--repair", dir]);
  assert.strictEqual(attempted.status, 1, attempted.stderr + attempted.stdout);
  const repaired = JSON.parse(attempted.stdout);
  assert.deepStrictEqual(repaired.applied, []);
  assert.ok(repaired.unresolved.some((item: { code: string; file: string; line: number; detail: string }) =>
    item.code === "blocked-goal-remap" && item.file === "CONTEXT.md" && item.line === 1 && item.detail === "G4a"));
  for (const [index, name] of files.entries()) assert.ok(readFileSync(join(dir, name)).equals(before[index]), name);
  assert.ok(existsSync(join(dir, "G4a.md")));
});

test("sentence-final goal punctuation remains a repairable reference", () => {
  const dir = historicalRepairFolder("repair-sentence-final-goal");
  const context = "The outcome is G4a.\n";
  writeFileSync(join(dir, "CONTEXT.md"), context);
  assert.deepStrictEqual(scanGoalReferences("CONTEXT.md", context).map(({ id, linkedScope }) => [id, linkedScope]), [["G4a", null]]);
  const result = run(["--repair", dir]);
  assert.strictEqual(result.status, 0, result.stderr + result.stdout);
  assert.deepStrictEqual(JSON.parse(result.stdout).mappings, [{ from: "G4a", to: "G10" }]);
  assert.strictEqual(readFileSync(join(dir, "CONTEXT.md"), "utf8"), "The outcome is G10.\n");
});

test("wrapped link labels, nested labels, and multi-line code or quotations never become local remaps", () => {
  for (const [label, context, code, line] of [
    ["wrapped-inline", "This task depends on [the export task's\nG4a outcome](../other/goals.md) landing first.\n", "ambiguous-goal-reference", 2],
    ["wrapped-first-line", "Depends on [the export G4a\noutcome](../other/goals.md).\n", "ambiguous-goal-reference", 1],
    ["wrapped-reference", "See [the export task's\nG4a outcome][consumer].\n\n[consumer]: ../consumer/goals.md\n", "ambiguous-goal-reference", 2],
    ["nested", "See [the [G4a] outcome](../other/goals.md).\n", "outside-goal-reference", 1],
    ["code-span", "Use `the G1\nG4a` literal.\n", "ambiguous-goal-reference", 2],
    ["quotation", "He wrote “the G1\nG4a outcome” yesterday.\n", "ambiguous-goal-reference", 2],
    ["straight-quotation-first-line", "He wrote 'G4a is the export\noutcome' yesterday.\n", "ambiguous-goal-reference", 1],
    ["straight-quotation-continuation", "He wrote 'the old goal\nG4a' yesterday.\n", "ambiguous-goal-reference", 2],
  ] as const) {
    const dir = historicalRepairFolder(`repair-multiline-${label}`);
    writeFileSync(join(dir, "CONTEXT.md"), context);
    const diagnosed = (diagnostics: readonly { code: string; file: string; line: number; detail: string }[]) =>
      diagnostics.some((item) => item.code === code && item.file === "CONTEXT.md" && item.line === line && item.detail === "G4a");
    const ordinary = report(dir).structure.diagnostics;
    assert.ok(diagnosed(ordinary), `${label}: ${JSON.stringify(ordinary)}`);
    const files = ["goals.md", "plan.md", "CONTEXT.md", "result.md"];
    const before = files.map((name) => readFileSync(join(dir, name)));
    const attempted = run(["--repair", dir]);
    assert.strictEqual(attempted.status, 1, `${label}: ${attempted.stderr}${attempted.stdout}`);
    const repaired = JSON.parse(attempted.stdout);
    assert.deepStrictEqual(repaired.applied, [], label);
    assert.ok(diagnosed(repaired.unresolved), `${label}: ${JSON.stringify(repaired.unresolved)}`);
    for (const [index, name] of files.entries()) assert.ok(readFileSync(join(dir, name)).equals(before[index]), `${label}: ${name}`);
  }
});

test("a shorter backtick run inside multi-line code blocks repair until the matching run closes", () => {
  const dir = historicalRepairFolder("repair-multiline-mixed-backticks");
  const context = "Use ``historical code\n` G4a remains code\n`` closes it; G1 stays local.\n";
  writeFileSync(join(dir, "CONTEXT.md"), context);
  assert.deepStrictEqual(
    scanGoalReferences("CONTEXT.md", context).map(({ id, linkedScope }) => [id, linkedScope]),
    [["G4a", "ambiguous"], ["G1", null]],
  );
  const files = ["goals.md", "plan.md", "CONTEXT.md", "result.md"];
  const before = files.map((name) => readFileSync(join(dir, name)));
  const attempted = run(["--repair", dir]);
  assert.strictEqual(attempted.status, 1, attempted.stderr + attempted.stdout);
  const repaired = JSON.parse(attempted.stdout);
  assert.deepStrictEqual(repaired.applied, []);
  assert.ok(repaired.unresolved.some((item: { code: string; file: string; line: number; detail: string }) =>
    item.code === "ambiguous-goal-reference" && item.file === "CONTEXT.md" && item.line === 2 && item.detail === "G4a"));
  for (const [index, name] of files.entries()) assert.ok(readFileSync(join(dir, name)).equals(before[index]), name);
});

test("a goal after a wrapped link label, code span, or quotation closes is a plain reference", () => {
  for (const [label, opening, closing] of [
    ["link", "See the [export", "spec](https://example.test/spec) for G1.\n"],
    ["quotation", "He wrote “the export", "spec” for G1.\n"],
    ["straight-quotation", "He wrote 'the export", "spec' for G1.\n"],
    ["code-span", "Run `npm", "test` before G1.\n"],
  ] as const) {
    const dir = folder(`wrapped-closed-${label}`, {
      goals: "## Goals\n- G1 — first\n",
      plan: "## Scope\n- delivered: G1\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G1\n",
    });
    writeFileSync(join(dir, "CONTEXT.md"), `${opening}\n${closing}`);
    assert.deepStrictEqual(report(dir).structure, { reliable: true, diagnostics: [] }, label);
    const repaired = run(["--repair", dir]);
    assert.strictEqual(repaired.status, 0, `${label}: ${repaired.stderr}${repaired.stdout}`);
    assert.deepStrictEqual(JSON.parse(repaired.stdout).unresolved, [], label);
    const scanned = scanGoalReferences("CONTEXT.md", `${opening}\nG2 ${closing}`).map((item) => [item.id, item.linkedScope]);
    assert.deepStrictEqual(scanned, [["G2", "ambiguous"], ["G1", null]], label);
  }
  const unclosed = scanGoalReferences("CONTEXT.md", "See the [export\nspec `npm](https://example.test/spec) for G1.\n");
  assert.deepStrictEqual(unclosed.map((item) => [item.id, item.linkedScope]), [["G1", "ambiguous"]]);
});

test("comment markers inside multiline code or quotations do not hide live references during repair", () => {
  for (const [label, open, close] of [
    ["code", "`", "`"],
    ["double-code", "``", "``"],
    ["curly-quote", "“", "”"],
    ["single-quote", "'", "'"],
    ["double-quote", '"', '"'],
  ] as const) {
    for (const marker of ["example <!--\n", "example\n<!--\n"]) {
      const dir = historicalRepairFolder(`repair-span-comment-${label}-${marker.length}`);
      const context = `Use ${open}${marker}${close} closes the example; G4a is live.\n`;
      writeFileSync(join(dir, "CONTEXT.md"), context);
      assert.deepStrictEqual(
        scanGoalReferences("CONTEXT.md", context).map(({ id, linkedScope }) => [id, linkedScope]),
        [["G4a", null]],
        `${label}: ${context}`,
      );
      const result = run(["--repair", dir]);
      assert.strictEqual(result.status, 0, `${label}: ${result.stderr}${result.stdout}`);
      const repaired = JSON.parse(result.stdout);
      assert.deepStrictEqual(repaired.mappings, [{ from: "G4a", to: "G10" }], label);
      assert.deepStrictEqual(repaired.unresolved, [], label);
      assert.strictEqual(repaired.state.structure.reliable, true, label);
      assert.strictEqual(readFileSync(join(dir, "CONTEXT.md"), "utf8"), context.replace("G4a", "G10"), label);
    }
  }
});

test("reference definitions inside multiline examples do not classify live shortcut goal labels", () => {
  for (const [label, open, close] of [
    ["code", "`", "`"],
    ["double-code", "``", "``"],
    ["curly-quote", "“", "”"],
    ["single-quote", "'", "'"],
    ["double-quote", '"', '"'],
  ] as const) {
    const dir = folder(`example-reference-definition-${label}`, {
      goals: "## Goals\n- G1 — first\n",
      plan: "## Scope\n- delivered: G1\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G1\n",
    });
    const context = `Use ${open}example\n[g1]: ../outside/goals.md\n${close} closes the example.\n\nThe local goal [G1] is pending.\n`;
    writeFileSync(join(dir, "CONTEXT.md"), context);
    assert.deepStrictEqual(report(dir).structure, { reliable: true, diagnostics: [] }, label);
    const result = run(["--repair", dir]);
    assert.strictEqual(result.status, 0, `${label}: ${result.stderr}${result.stdout}`);
    const repaired = JSON.parse(result.stdout);
    assert.deepStrictEqual(repaired.applied, [], label);
    assert.deepStrictEqual(repaired.unresolved, [], label);
    assert.strictEqual(readFileSync(join(dir, "CONTEXT.md"), "utf8"), context, label);
    const withDefinition = `${context}\n[g1]: ../actual/goals.md\n`;
    assert.deepStrictEqual(
      scanGoalReferences("CONTEXT.md", withDefinition).map(({ id, linkedScope }) => [id, linkedScope]),
      [["G1", "outside"]],
      label,
    );
  }
});

test("an escaped bracket inside a foreign link label never exposes its goal to a local remap", () => {
  for (const [label, context, code, line] of [
    ["before", "See [upstream \\] G4a](../other/goals.md).\n", "outside-goal-reference", 1],
    ["after", "See [G4a \\] upstream](../other/goals.md).\n", "outside-goal-reference", 1],
    ["wrapped", "See [upstream \\]\nG4a](../other/goals.md).\n", "ambiguous-goal-reference", 2],
  ] as const) {
    const dir = historicalRepairFolder(`repair-escaped-bracket-${label}`);
    writeFileSync(join(dir, "CONTEXT.md"), context);
    const diagnosed = (diagnostics: readonly { code: string; file: string; line: number; detail: string }[]) =>
      diagnostics.some((item) => item.code === code && item.file === "CONTEXT.md" && item.line === line && item.detail === "G4a");
    const ordinary = report(dir).structure.diagnostics;
    assert.ok(diagnosed(ordinary), `${label}: ${JSON.stringify(ordinary)}`);
    const files = ["goals.md", "plan.md", "CONTEXT.md", "result.md"];
    const before = files.map((name) => readFileSync(join(dir, name)));
    const attempted = run(["--repair", dir]);
    assert.strictEqual(attempted.status, 1, `${label}: ${attempted.stderr}${attempted.stdout}`);
    const repaired = JSON.parse(attempted.stdout);
    assert.deepStrictEqual(repaired.mappings, [], label);
    assert.deepStrictEqual(repaired.applied, [], label);
    assert.ok(diagnosed(repaired.unresolved), `${label}: ${JSON.stringify(repaired.unresolved)}`);
    for (const [index, name] of files.entries()) assert.ok(readFileSync(join(dir, name)).equals(before[index]), `${label}: ${name}`);
  }
});

test("a reference definition line still opens and closes an HTML comment for scanning and repair", () => {
  for (const [label, context, line, repairedContext] of [
    ["closing", "<!--\n[x]: ./goals.md -->\nG4a is live.\n", 3, "<!--\n[x]: ./goals.md -->\nG10 is live.\n"],
    ["opening", "[x]: ./goals.md <!--\nG4a hidden\n-->\nG4a live\n", 4, "[x]: ./goals.md <!--\nG4a hidden\n-->\nG10 live\n"],
  ] as const) {
    const dir = historicalRepairFolder(`repair-definition-comment-${label}`);
    writeFileSync(join(dir, "CONTEXT.md"), context);
    const mentions = report(dir).structure.diagnostics.filter((item) => item.file === "CONTEXT.md" && item.detail === "G4a");
    assert.deepStrictEqual(mentions.map((item) => [item.code, item.line]), [["malformed-goal-reference", line]], label);
    const result = run(["--repair", dir]);
    assert.strictEqual(result.status, 0, `${label}: ${result.stderr}${result.stdout}`);
    const repaired = JSON.parse(result.stdout);
    assert.deepStrictEqual(repaired.mappings, [{ from: "G4a", to: "G10" }], label);
    assert.deepStrictEqual(repaired.unresolved, [], label);
    assert.strictEqual(repaired.state.structure.reliable, true, label);
    assert.match(readFileSync(join(dir, "goals.md"), "utf8"), /^- G10 — new outcome$/m, label);
    assert.strictEqual(readFileSync(join(dir, "CONTEXT.md"), "utf8"), repairedContext, label);
  }
});

test("an HTML comment crossing a blockquote marker neither hides later prose nor leaks out of the quote", () => {
  for (const [label, context, line, repairedContext] of [
    ["closed on a quote line", "<!-- note\n> quoted -->\nIntro line.\n\nG4a is the export outcome.\n", 5, "<!-- note\n> quoted -->\nIntro line.\n\nG10 is the export outcome.\n"],
    ["opened on a quote line", "> quoted <!-- note\nG4a stays quoted.\n\nG4a is the export outcome.\n", 4, "> quoted <!-- note\nG4a stays quoted.\n\nG10 is the export outcome.\n"],
  ] as const) {
    const dir = historicalRepairFolder(`repair-quoted-comment-${label.replace(/ /g, "-")}`);
    writeFileSync(join(dir, "CONTEXT.md"), context);
    const mentions = report(dir).structure.diagnostics.filter((item) => item.file === "CONTEXT.md" && item.detail === "G4a");
    assert.deepStrictEqual(mentions.map((item) => [item.code, item.line]), [["malformed-goal-reference", line]], label);
    const result = run(["--repair", dir]);
    assert.strictEqual(result.status, 0, `${label}: ${result.stderr}${result.stdout}`);
    const repaired = JSON.parse(result.stdout);
    assert.deepStrictEqual(repaired.mappings, [{ from: "G4a", to: "G10" }], label);
    assert.deepStrictEqual(repaired.unresolved, [], label);
    assert.strictEqual(repaired.state.structure.reliable, true, label);
    assert.strictEqual(readFileSync(join(dir, "CONTEXT.md"), "utf8"), repairedContext, label);
  }
});

test("a goal label linked into a nested task folder is outside the task", () => {
  const dir = historicalRepairFolder("repair-nested-link");
  mkdirSync(join(dir, "child-task"));
  writeFileSync(join(dir, "child-task", "goals.md"), "## Goals\n- G4a — child outcome\n");
  writeFileSync(join(dir, "CONTEXT.md"), "The child delivers [G4a](./child-task/goals.md).\n");
  const files = ["goals.md", "CONTEXT.md", "child-task/goals.md"];
  const before = files.map((name) => readFileSync(join(dir, name)));
  assert.ok(report(dir).structure.diagnostics.some((item) => item.code === "outside-goal-reference" && item.file === "CONTEXT.md" && item.detail === "G4a"));
  const attempted = run(["--repair", dir]);
  assert.strictEqual(attempted.status, 1, attempted.stderr + attempted.stdout);
  assert.deepStrictEqual(JSON.parse(attempted.stdout).applied, []);
  for (const [index, name] of files.entries()) assert.ok(readFileSync(join(dir, name)).equals(before[index]), name);
});

test("fresh IDs require historical non-reuse proof", () => {
  const dir = folder("repair-unproved", { goals: "## Goals\n- G1 — first\n- G4a — new\n", plan: "## Scope\n- delivered: G1, G4a\n" });
  const original = readFileSync(join(dir, "goals.md"));
  const result = run(["--repair", dir]);
  assert.strictEqual(result.status, 1, result.stderr + result.stdout);
  assert.deepStrictEqual(JSON.parse(result.stdout).applied, []);
  assert.ok(readFileSync(join(dir, "goals.md")).equals(original));
});

test("fresh IDs refuse a shallow clone, whose history cannot show a goal removed before its boundary", () => {
  const upstream = checkout("repair-shallow-upstream");
  writeFileSync(join(upstream, "goals.md"), "## Goals\n- G1 — first\n- G2 — removed later\n");
  git(upstream, ["add", "goals.md"]);
  git(upstream, ["commit", "-qm", "record goals"]);
  writeFileSync(join(upstream, "goals.md"), "## Goals\n- G1 — first\n");
  git(upstream, ["commit", "-qam", "remove G2"]);
  const clone = join(TEST_ROOT, "repair-shallow-clone");
  rmSync(clone, { recursive: true, force: true });
  git(TEST_ROOT, [
    "clone", "-q", "--depth", "1",
    "--config", "user.email=test@example.invalid", "--config", "user.name=agents-kit test", "--config", "commit.gpgsign=false",
    pathToFileURL(upstream).href, clone,
  ]);
  assert.strictEqual(git(clone, ["rev-parse", "--is-shallow-repository"]).trim(), "true");
  const files = ["goals.md", "plan.md"];
  for (const dir of [upstream, clone]) {
    writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — first\n- G4a — new outcome\n");
    writeFileSync(join(dir, "plan.md"), "## Scope\n- delivered: G1, G4a\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G4a\n");
  }
  const before = files.map((name) => readFileSync(join(clone, name)));
  const refused = run(["--repair", clone]);
  assert.strictEqual(refused.status, 1, refused.stderr + refused.stdout);
  const output = JSON.parse(refused.stdout);
  assert.deepStrictEqual(output.mappings, []);
  assert.deepStrictEqual(output.applied, []);
  for (const [index, name] of files.entries()) assert.ok(readFileSync(join(clone, name)).equals(before[index]), name);
  const full = run(["--repair", upstream]);
  assert.strictEqual(full.status, 0, full.stderr + full.stdout);
  assert.deepStrictEqual(JSON.parse(full.stdout).mappings, [{ from: "G4a", to: "G3" }]);
});

test("ambiguous duplicate definitions are reported without writes", () => {
  const dir = folder("repair-duplicate", { goals: "## Goals\n- G1 — first\n- G1 — conflicting\n", plan: "## Scope\n- delivered: G1\n" });
  const original = readFileSync(join(dir, "goals.md"));
  const result = run(["--repair", dir]);
  assert.strictEqual(result.status, 1, result.stderr + result.stdout);
  assert.deepStrictEqual(JSON.parse(result.stdout).applied, []);
  assert.ok(JSON.parse(result.stdout).unresolved.some((item: { code: string }) => item.code === "duplicate-goal-id"));
  assert.ok(readFileSync(join(dir, "goals.md")).equals(original));
});

test("partial replacement remains visible on a fresh read without repair state", () => {
  const dir = historicalRepairFolder("repair-partial-load");
  writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — first\n- G10 — new outcome\n");
  writeFileSync(join(dir, "plan.md"), "## Scope\n- delivered: G1, G10\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G10\n");
  const ordinary = report(dir);
  assert.strictEqual(ordinary.structure.reliable, false);
  assert.ok(ordinary.structure.diagnostics.some((item) => item.file === "CONTEXT.md" && item.detail === "G4a"));
  const attempted = run(["--repair", dir]);
  assert.strictEqual(attempted.status, 1, attempted.stderr + attempted.stdout);
  assert.deepStrictEqual(JSON.parse(attempted.stdout).applied, []);
  assert.strictEqual(report(dir).structure.reliable, false);
});

test("every intermediate replacement boundary remains detectable after restart", () => {
  const repairedDir = historicalRepairFolder("repair-boundary-final");
  const completed = run(["--repair", repairedDir]);
  assert.strictEqual(completed.status, 0, completed.stderr + completed.stdout);
  const files = JSON.parse(completed.stdout).applied.map((item: { file: string }) => item.file) as string[];
  for (let replaced = 1; replaced < files.length; replaced++) {
    const dir = historicalRepairFolder(`repair-boundary-${replaced}`);
    for (const file of files.slice(0, replaced)) writeFileSync(join(dir, file), readFileSync(join(repairedDir, file)));
    const state = report(dir);
    assert.strictEqual(state.structure.reliable, false, `boundary ${replaced}`);
    assert.ok(state.structure.diagnostics.some((issue) => issue.code === "malformed-goal-reference"), `boundary ${replaced}`);
    const readOnly = run([dir]);
    assert.strictEqual(readOnly.status, 0);
    assert.strictEqual(JSON.parse(readOnly.stdout).structure.reliable, false);
    const attempted = run(["--repair", dir]);
    assert.strictEqual(attempted.status, 1, attempted.stderr + attempted.stdout);
    assert.deepStrictEqual(JSON.parse(attempted.stdout).applied, []);
  }
});

test("a symlinked Markdown file blocks every repair edit and reports an incomplete scan", () => {
  const dir = folder("repair-symlink", { goals: "## Goals\n- G1: — first\n", plan: "## Scope\n- delivered: G1\n" });
  const outside = join(TEST_ROOT, "external-goal-note.md");
  writeFileSync(outside, "G2 outside\n");
  symlinkSync(outside, join(dir, "notes.md"));
  const original = readFileSync(join(dir, "goals.md"));
  const audit = report(dir);
  assert.strictEqual(audit.structure.reliable, false);
  assert.ok(audit.structure.diagnostics.some((issue) => issue.code === "incomplete-reference-scan" && issue.file === "notes.md"));
  const repaired = run(["--repair", dir]);
  assert.strictEqual(repaired.status, 1, repaired.stderr + repaired.stdout);
  const output = JSON.parse(repaired.stdout);
  assert.deepStrictEqual(output.applied, []);
  assert.deepStrictEqual(output.mappings, []);
  assert.strictEqual(output.error, null);
  assert.ok(output.unresolved.some((issue: { code: string; file: string }) => issue.code === "incomplete-reference-scan" && issue.file === "notes.md"));
  assert.strictEqual(output.state.structure.reliable, false);
  assert.ok(readFileSync(join(dir, "goals.md")).equals(original));
  assert.strictEqual(readFileSync(outside, "utf8"), "G2 outside\n");
});

test("non-Markdown symlinks and nested task folders stay outside the task's scan", () => {
  const dir = historicalRepairFolder("repair-walk-outside");
  symlinkSync(join(TEST_ROOT, "missing-image.png"), join(dir, "mock.png"));
  const child = join(dir, "child-task");
  mkdirSync(child);
  writeFileSync(join(child, "goals.md"), "## Goals\n- G1 — child\n- G4a — child outcome\n");
  writeFileSync(join(child, "plan.md"), "## Scope\n- delivered: G1, G4a\n");
  const childBefore = ["goals.md", "plan.md"].map((name) => readFileSync(join(child, name)));
  const diagnostics = report(dir).structure.diagnostics;
  assert.ok(!diagnostics.some((issue) => issue.code === "incomplete-reference-scan"), JSON.stringify(diagnostics));
  assert.ok(!diagnostics.some((issue) => issue.file.startsWith("child-task/")), JSON.stringify(diagnostics));
  const repaired = run(["--repair", dir]);
  assert.strictEqual(repaired.status, 0, repaired.stderr + repaired.stdout);
  const output = JSON.parse(repaired.stdout);
  assert.deepStrictEqual(output.mappings, [{ from: "G4a", to: "G10" }]);
  assert.ok(!output.applied.some((item: { file: string }) => item.file.startsWith("child-task/")));
  for (const [index, name] of ["goals.md", "plan.md"].entries()) assert.ok(readFileSync(join(child, name)).equals(childBefore[index]), name);
});

test("dot directories and node_modules stay outside the task's scan", () => {
  const dir = historicalRepairFolder("repair-walk-pruned");
  const pruned = ["node_modules/pkg/notes.md", ".cache/notes.md"];
  for (const file of pruned) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), "Deliver G4a.\n");
  }
  const diagnostics = report(dir).structure.diagnostics;
  assert.ok(!diagnostics.some((issue) => pruned.includes(issue.file)), JSON.stringify(diagnostics));
  const repaired = run(["--repair", dir]);
  assert.strictEqual(repaired.status, 0, repaired.stderr + repaired.stdout);
  const output = JSON.parse(repaired.stdout);
  assert.deepStrictEqual(output.mappings, [{ from: "G4a", to: "G10" }]);
  assert.ok(!output.applied.some((item: { file: string }) => pruned.includes(item.file)));
  for (const file of pruned) assert.strictEqual(readFileSync(join(dir, file), "utf8"), "Deliver G4a.\n", file);
});

test("unreadable and non-UTF-8 task Markdown are scan gaps that block every repair edit", { skip: process.getuid?.() === 0 && "root reads paths whose bits deny it" }, () => {
  const dir = historicalRepairFolder("repair-walk-gaps");
  writeFileSync(join(dir, "latin1.md"), Buffer.from([0x47, 0x34, 0x61, 0x20, 0xe9, 0x0a]));
  mkdirSync(join(dir, "locked"));
  writeFileSync(join(dir, "locked", "notes.md"), "G4a\n");
  chmodSync(join(dir, "locked"), 0o000);
  chmodSync(join(dir, "result.md"), 0o000);
  const goals = readFileSync(join(dir, "goals.md"));
  try {
    const gaps = (diagnostics: readonly { code: string; file: string }[]) =>
      diagnostics.filter((issue) => issue.code === "incomplete-reference-scan").map((issue) => issue.file).sort();
    const audit = report(dir);
    assert.strictEqual(audit.structure.reliable, false);
    assert.deepStrictEqual(gaps(audit.structure.diagnostics), ["latin1.md", "locked", "result.md"]);
    const repaired = run(["--repair", dir]);
    assert.strictEqual(repaired.status, 1, repaired.stderr + repaired.stdout);
    const output = JSON.parse(repaired.stdout);
    assert.deepStrictEqual(output.applied, []);
    assert.deepStrictEqual(gaps(output.unresolved), ["latin1.md", "locked", "result.md"]);
    assert.ok(readFileSync(join(dir, "goals.md")).equals(goals));
  } finally {
    chmodSync(join(dir, "locked"), 0o755);
    chmodSync(join(dir, "result.md"), 0o644);
  }
});

test("read-only and repair loads report coverage through symlinks and non-UTF-8 goals, marking the scan incomplete", () => {
  const goals = "## Goals\n- G1 — first\n";
  const plan = "## Scope\n- delivered: G1\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G1\n";
  const real = folder("read-only-real", { goals, plan });
  const linked = join(TEST_ROOT, "read-only-linked");
  rmSync(linked, { force: true });
  symlinkSync(real, linked);
  const linkedGoals = folder("read-only-linked-goals", { plan });
  writeFileSync(join(TEST_ROOT, "read-only-goals.md"), goals);
  symlinkSync(join(TEST_ROOT, "read-only-goals.md"), join(linkedGoals, "goals.md"));
  const latin = folder("read-only-latin-goals", { plan });
  writeFileSync(join(latin, "goals.md"), Buffer.concat([Buffer.from(goals), Buffer.from([0xff, 0x0a])]));

  for (const [dir, gap] of [[linked, "."], [linkedGoals, "goals.md"], [latin, "goals.md"]] as const) {
    const state = report(dir);
    assert.deepStrictEqual(state.goalCoverage.goals, [{ id: "G1", steps: ["1"] }], dir);
    assert.strictEqual(state.structure.reliable, false, dir);
    assert.ok(state.structure.diagnostics.some((item) => item.code === "incomplete-reference-scan" && item.file === gap), `${dir}: ${JSON.stringify(state.structure.diagnostics)}`);
  }
  const repaired = run(["--repair", linked]);
  assert.strictEqual(repaired.status, 2, repaired.stderr + repaired.stdout);

  for (const dir of [linkedGoals, latin]) {
    const child = run(["--repair", dir]);
    assert.strictEqual(child.status, 1, child.stderr + child.stdout);
    const output = JSON.parse(child.stdout);
    assert.deepStrictEqual(output.applied, [], dir);
    assert.notStrictEqual(output.state, null, dir);
    assert.deepStrictEqual(output.state.goalCoverage.goals, [{ id: "G1", steps: ["1"] }], dir);
    assert.strictEqual(output.state.goalsFile, "goals.md", dir);
    assert.strictEqual(output.state.structure.reliable, false, dir);
    assert.ok(output.unresolved.some((item: { code: string; file: string }) => item.code === "incomplete-reference-scan" && item.file === "goals.md"), `${dir}: ${JSON.stringify(output.unresolved)}`);
    assert.ok(!output.unresolved.some((item: { code: string }) => item.code === "missing-goals-file"), `${dir}: ${JSON.stringify(output.unresolved)}`);
  }
});

test("repair loads read a non-UTF-8 plan or result directly for state, marking the scan incomplete", () => {
  const goals = "## Goals\n- G1 — first\n";
  const latinResult = folder("repair-latin-result", {
    goals,
    plan: "## Scope\n- delivered: G1\n## Steps\n### Step 1 — Work\n- [x] **What:** work ([result](./result.md#step-1--work))\n- **Goal:** G1\n",
  });
  writeFileSync(join(latinResult, "result.md"), Buffer.concat([Buffer.from("## Step 1 — Work\nDone.\n"), Buffer.from([0xe9])]));
  const latinPlan = folder("repair-latin-plan", { goals });
  writeFileSync(join(latinPlan, "plan.md"), Buffer.concat([
    Buffer.from("## Scope\n- delivered: G1\n## Steps\n### Step 1 — Work\n- [ ] **What:** work "),
    Buffer.from([0xe9]),
    Buffer.from("\n- **Goal:** G1\n"),
  ]));

  const repairState = (dir: string, gap: string): TaskState => {
    const child = run(["--repair", dir]);
    assert.strictEqual(child.status, 1, child.stderr + child.stdout);
    const output = JSON.parse(child.stdout);
    assert.deepStrictEqual(output.applied, [], dir);
    assert.strictEqual(output.error, null, dir);
    assert.notStrictEqual(output.state, null, dir);
    assert.deepStrictEqual(output.state.goalCoverage.goals, [{ id: "G1", steps: ["1"] }], dir);
    assert.ok(output.unresolved.some((item: { code: string; file: string }) => item.code === "incomplete-reference-scan" && item.file === gap), `${dir}: ${JSON.stringify(output.unresolved)}`);
    assert.ok(!output.unresolved.some((item: { code: string }) => item.code === "missing-result-anchor"), `${dir}: ${JSON.stringify(output.unresolved)}`);
    return output.state;
  };
  const resultState = repairState(latinResult, "result.md");
  assert.notStrictEqual(resultState.result, null);
  assert.strictEqual(resultState.steps[0].anchorResolves, true);
  assert.strictEqual(repairState(latinPlan, "plan.md").steps.length, 1);
});

test("ordinary and compaction CLI modes leave artifact bytes unchanged", () => {
  const dir = folder("repair-audit", {
    goals: "## Goals\n- G1: — first\n",
    plan: "**Status:** to-do\n## Scope\n- delivered: G1\n",
    result: "## Current state\nG1 is pending.\n",
  });
  const before = ["goals.md", "plan.md", "result.md"].map((file) => readFileSync(join(dir, file)));
  assert.strictEqual(run([dir]).status, 0);
  assert.strictEqual(run(["--compaction-plan", dir]).status, 0);
  for (const [index, file] of ["goals.md", "plan.md", "result.md"].entries()) {
    assert.ok(readFileSync(join(dir, file)).equals(before[index]));
  }
});

test("changed inputs and failed rollback never report a successful repair", () => {
  const changed = historicalRepairFolder("repair-changed-input");
  const changedResult = repairTask(changed, { beforeReplace: () => writeFileSync(join(changed, "notes.md"), "concurrent change\n") });
  assert.strictEqual(changedResult.failed, true);
  assert.deepStrictEqual(changedResult.report.applied, []);
  assert.strictEqual(changedResult.report.recovery, "none");
  assert.match(readFileSync(join(changed, "goals.md"), "utf8"), /G4a/);

  const restored = historicalRepairFolder("repair-restored");
  const originalGoals = readFileSync(join(restored, "goals.md"));
  const restoredResult = repairTask(restored, {
    beforeReplace: (_file, index) => { if (index === 1) throw new Error("injected replacement failure"); },
  });
  assert.strictEqual(restoredResult.failed, true);
  assert.strictEqual(restoredResult.report.recovery, "restored");
  assert.ok(readFileSync(join(restored, "goals.md")).equals(originalGoals));

  const partial = historicalRepairFolder("repair-rollback-failure");
  const partialResult = repairTask(partial, {
    beforeReplace: (_file, index) => { if (index === 1) throw new Error("injected replacement failure"); },
    beforeRollback: () => { throw new Error("injected rollback failure"); },
  });
  assert.strictEqual(partialResult.failed, true);
  assert.deepStrictEqual(partialResult.report.applied, []);
  assert.strictEqual(partialResult.report.recovery, "partial");
  assert.strictEqual(report(partial).structure.reliable, false);
});

test("a new Markdown reference during repair prevents a successful mapping", () => {
  const dir = historicalRepairFolder("repair-added-reference");
  const original = readFileSync(join(dir, "goals.md"));
  const result = repairTask(dir, {
    beforeReplace: (_file, index) => {
      if (index === 1) writeFileSync(join(dir, "late.md"), "The old goal is G4a.\n");
    },
  });
  assert.strictEqual(result.failed, true);
  assert.deepStrictEqual(result.report.applied, []);
  assert.deepStrictEqual(result.report.mappings, []);
  assert.ok(readFileSync(join(dir, "goals.md")).equals(original), JSON.stringify(result.report));
  assert.strictEqual(report(dir).structure.reliable, false);
});

test("the final disk read rejects a Markdown reference added after the last replacement", () => {
  const dir = historicalRepairFolder("repair-late-final-reference");
  const original = readFileSync(join(dir, "goals.md"));
  const result = repairTask(dir, {
    afterReplace: (_file, index) => {
      if (index === 3) writeFileSync(join(dir, "late.md"), "G4a remained here.\n");
    },
  });
  assert.strictEqual(result.failed, true);
  assert.deepStrictEqual(result.report.applied, []);
  assert.strictEqual(result.report.recovery, "restored");
  assert.ok(readFileSync(join(dir, "goals.md")).equals(original));
  assert.strictEqual(report(dir).structure.reliable, false);
});

test("a repair proposal with overlapping edits reports its error as JSON and writes nothing", () => {
  const dir = checkout("repair-overlapping-edits");
  writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — first\n");
  git(dir, ["add", "goals.md"]);
  git(dir, ["commit", "-qm", "record goals"]);
  writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — first\n> <!--\n## Notes\n-->\n- G4a — x\n");
  writeFileSync(join(dir, "plan.md"), "## Scope\n- delivered: G1, G4a\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G4a\n");
  const goals = readFileSync(join(dir, "goals.md"));
  const plan = readFileSync(join(dir, "plan.md"));

  const result = run(["--repair", dir]);

  assert.strictEqual(result.status, 2, result.stderr + result.stdout);
  const repaired = JSON.parse(result.stdout);
  assert.strictEqual(repaired.error, "overlapping repair edits");
  assert.deepStrictEqual(repaired.applied, []);
  assert.strictEqual(repaired.state, null);
  assert.ok(readFileSync(join(dir, "goals.md")).equals(goals));
  assert.ok(readFileSync(join(dir, "plan.md")).equals(plan));
});

test("definitions with the same normalized identity remain unchanged", () => {
  const dir = historicalRepairFolder("repair-normalized-duplicate");
  writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — first\n- G4a — new outcome\n- **G4a** — conflicting outcome\n");
  const original = readFileSync(join(dir, "goals.md"));
  const result = run(["--repair", dir]);
  assert.strictEqual(result.status, 1, result.stderr + result.stdout);
  assert.deepStrictEqual(JSON.parse(result.stdout).applied, []);
  assert.ok(readFileSync(join(dir, "goals.md")).equals(original));

  const decorated = folder("repair-decorated-duplicate", { goals: "## Goals\n- G1 — first\n- **G1** — conflicting first\n" });
  const decoratedResult = run(["--repair", decorated]);
  assert.strictEqual(decoratedResult.status, 1, decoratedResult.stderr + decoratedResult.stdout);
  assert.deepStrictEqual(JSON.parse(decoratedResult.stdout).applied, []);
  assert.match(readFileSync(join(decorated, "goals.md"), "utf8"), /\*\*G1\*\*/);
});

test("an outside linked goal reference blocks remapping and is visible to read-only loads", () => {
  const dir = historicalRepairFolder("repair-outside-link");
  writeFileSync(join(dir, "notes.md"), "See [G4a](../other-task/goals.md).\n");
  const before = ["goals.md", "plan.md", "notes.md"].map((file) => readFileSync(join(dir, file)));
  const ordinary = report(dir);
  assert.ok(ordinary.structure.diagnostics.some((item) => item.code === "outside-goal-reference"));
  const repaired = run(["--repair", dir]);
  assert.strictEqual(repaired.status, 1, repaired.stderr + repaired.stdout);
  assert.deepStrictEqual(JSON.parse(repaired.stdout).applied, []);
  for (const [index, file] of ["goals.md", "plan.md", "notes.md"].entries()) {
    assert.ok(readFileSync(join(dir, file)).equals(before[index]));
  }
});

test("an anchored link with an unresolved target blocks the same remap", () => {
  const dir = historicalRepairFolder("repair-ambiguous-link");
  writeFileSync(join(dir, "notes.md"), "See [G4a](./goals.md#g4a).\n");
  assert.ok(report(dir).structure.diagnostics.some((item) => item.code === "ambiguous-goal-reference"));
  const result = run(["--repair", dir]);
  assert.strictEqual(result.status, 1, result.stderr + result.stdout);
  assert.deepStrictEqual(JSON.parse(result.stdout).applied, []);
  assert.match(readFileSync(join(dir, "goals.md"), "utf8"), /G4a/);
});

test("a foreign reference-style goal label blocks repair and remains diagnostic on read-only load", () => {
  const dir = historicalRepairFolder("repair-reference-style");
  writeFileSync(join(dir, "notes.md"), "See [G4a][consumer].\n\n[consumer]: ../consumer/goals.md\n");
  const original = readFileSync(join(dir, "goals.md"));
  const state = report(dir);
  assert.ok(state.structure.diagnostics.some((item) => item.code === "outside-goal-reference" && item.file === "notes.md"));
  const attempted = run(["--repair", dir]);
  assert.strictEqual(attempted.status, 1, attempted.stderr + attempted.stdout);
  assert.deepStrictEqual(JSON.parse(attempted.stdout).applied, []);
  assert.ok(readFileSync(join(dir, "goals.md")).equals(original));
});

test("a defined shortcut label keeps its foreign target and blocks repair; an undefined one is plain text", () => {
  const dir = historicalRepairFolder("repair-reference-shortcut");
  const note = "See [G4a].\n\n[G4a]: ../consumer/goals.md\n";
  writeFileSync(join(dir, "notes.md"), note);
  const goals = readFileSync(join(dir, "goals.md"));
  assert.ok(report(dir).structure.diagnostics.some((item) => item.code === "outside-goal-reference" && item.file === "notes.md"));
  const attempted = run(["--repair", dir]);
  assert.strictEqual(attempted.status, 1, attempted.stderr + attempted.stdout);
  assert.deepStrictEqual(JSON.parse(attempted.stdout).applied, []);
  assert.ok(readFileSync(join(dir, "goals.md")).equals(goals));
  assert.strictEqual(readFileSync(join(dir, "notes.md"), "utf8"), note);

  rmSync(join(dir, "notes.md"));
  writeFileSync(join(dir, "result.md"), "See [G4a] and [G1, G4a].\n");
  assert.ok(!report(dir).structure.diagnostics.some((item) => item.code === "ambiguous-goal-reference"));
  const plain = run(["--repair", dir]);
  assert.strictEqual(plain.status, 0, plain.stderr + plain.stdout);
  assert.strictEqual(readFileSync(join(dir, "result.md"), "utf8"), "See [G10] and [G1, G10].\n");
});

test("an unproved reference-style target remains ambiguous", () => {
  const dir = historicalRepairFolder("repair-reference-style-ambiguous");
  writeFileSync(join(dir, "notes.md"), "See [G4a][local].\n\n[local]: ./missing.md\n");
  assert.ok(report(dir).structure.diagnostics.some((item) => item.code === "ambiguous-goal-reference" && item.file === "notes.md"));
  const attempted = run(["--repair", dir]);
  assert.strictEqual(attempted.status, 1, attempted.stderr + attempted.stdout);
  assert.deepStrictEqual(JSON.parse(attempted.stdout).applied, []);
});

test("goals listed under Retired stay valid in task history without Git", () => {
  const goals = "## Goals\n- G1 — current\n\n## Retired\n- G2 — earlier outcome (retired 2026-01-02: folded into G1)\n";
  const plan = "## Decision log\n- 2026-01-02 — G2 was folded into G1.\n\n## Scope\n- delivered: G1\n## Steps\n### Step 1 — Work\n- [x] **What:** work ([result](./result.md#step-1--work))\n- **Goal:** G1\n";
  const result = "## Current state\nG1 replaced G2.\n\n---\n\n### Step 1 — Work\nChecked G2 before retiring it.\n\n## Reconciliation — 2026-01-02\n- Retired G2.\n\n**In review:**\n- G2 — superseded.\n\n## Acceptance\n- G2 — met in the original delivery.\n";
  const dir = folder("retired-list", { goals, plan, result });
  writeFileSync(join(dir, "CONTEXT.md"), "## Decisions\nG2 had an earlier acceptance path.\n");

  const accepted = report(dir);
  assert.strictEqual(accepted.structure.reliable, true, JSON.stringify(accepted.structure.diagnostics));
  assert.deepStrictEqual(accepted.goalCoverage.goals, [{ id: "G1", steps: ["1"] }]);
  const health = spawnSync(process.execPath, [HEALTH_CHECK, TEST_ROOT], { encoding: "utf8" });
  assert.strictEqual(health.status, 0, health.stderr);
  assert.deepStrictEqual((JSON.parse(health.stdout).findings as { check: string; path: string }[])
    .filter((item) => item.check === "goal-id" && item.path.endsWith("retired-list")), []);

  writeFileSync(join(dir, "plan.md"), plan.replace("delivered: G1", "delivered: G1, G2").replace("**Goal:** G1", "**Goal:** G1, G2"));
  assert.deepStrictEqual(report(dir).structure.diagnostics.filter((item) => item.detail === "G2"), [
    { code: "retired-goal-reference", file: "plan.md", line: 5, detail: "G2" },
    { code: "retired-goal-reference", file: "plan.md", line: 9, detail: "G2" },
  ]);
  const retiredCited = spawnSync(process.execPath, [HEALTH_CHECK, TEST_ROOT], { encoding: "utf8" });
  assert.strictEqual(retiredCited.status, 0, retiredCited.stderr);
  assert.deepStrictEqual((JSON.parse(retiredCited.stdout).findings as { check: string; path: string; detail: string }[])
    .filter((item) => item.check === "goal-id" && item.path.endsWith("retired-list")).map((item) => item.detail), [
    "retired-goal-reference G2 in plan.md:5",
    "retired-goal-reference G2 in plan.md:9",
  ]);
  writeFileSync(join(dir, "plan.md"), plan.replace("**Goal:** G1", "**Goal:** G1, `G9`"));
  const codeCited = spawnSync(process.execPath, [HEALTH_CHECK, TEST_ROOT], { encoding: "utf8" });
  assert.strictEqual(codeCited.status, 0, codeCited.stderr);
  assert.deepStrictEqual((JSON.parse(codeCited.stdout).findings as { check: string; path: string; detail: string }[])
    .filter((item) => item.check === "goal-id" && item.path.endsWith("retired-list")).map((item) => item.detail), [
    "unknown-goal-reference G9 in plan.md:9",
  ]);
  writeFileSync(join(dir, "plan.md"), plan);
  writeFileSync(join(dir, "result.md"), result.replace("met in the original", "met alongside G3 in the original"));
  assert.ok(report(dir).structure.diagnostics.some((item) => item.code === "unknown-goal-reference" && item.detail === "G3"));
});

test("a goal listed as both current and retired is a duplicate definition", () => {
  const state = report(folder("retired-duplicate", {
    goals: "## Goals\n- G1 — current\n- G2 — current\n\n## Retired\n- G2 — retired\n",
    plan: "## Scope\n- delivered: G1, G2\n## Steps\n### Step 1 — Work\n- [ ] **What:** work\n- **Goal:** G1, G2\n",
  }));
  assert.deepStrictEqual(state.structure.diagnostics, [{ code: "duplicate-goal-id", file: "goals.md", line: 6, detail: "G2" }]);
});

test("fresh IDs skip IDs listed as retired", () => {
  const dir = historicalRepairFolder("repair-retired-list");
  writeFileSync(join(dir, "goals.md"), "## Goals\n- G1 — first\n- G4a — new outcome\n\n## Retired\n- G12 — earlier outcome\n");
  const result = run(["--repair", dir]);
  assert.strictEqual(result.status, 0, result.stderr + result.stdout);
  assert.deepStrictEqual(JSON.parse(result.stdout).mappings, [{ from: "G4a", to: "G13" }]);
  assert.match(readFileSync(join(dir, "goals.md"), "utf8"), /^- G13 — new outcome\n\n## Retired\n- G12 — earlier outcome\n$/m);
});

test("rollback refuses a changed task-directory identity and names unrecovered files", () => {
  const dir = historicalRepairFolder("repair-rollback-symlink", true);
  const moved = `${dir}-moved`;
  const result = repairTask(dir, {
    beforeReplace: (_file, index) => { if (index === 1) throw new Error("injected replacement failure"); },
    beforeRollback: () => {
      renameSync(dir, moved);
      symlinkSync(moved, dir, "dir");
    },
  });
  assert.strictEqual(result.failed, true);
  assert.strictEqual(result.report.recovery, "partial");
  assert.deepStrictEqual(result.report.unrecovered, ["goals.md"]);
  assert.match(readFileSync(join(moved, "goals.md"), "utf8"), /G10/);
});

test("rollback preserves permissions changed after replacement and reports partial recovery", () => {
  const dir = historicalRepairFolder("repair-rollback-changed-mode");
  const goals = join(dir, "goals.md");
  chmodSync(goals, 0o644);
  const result = repairTask(dir, {
    afterReplace: (file) => { if (file === "goals.md") chmodSync(goals, 0o600); },
    beforeReplace: (_file, index) => { if (index === 1) throw new Error("injected replacement failure"); },
  });
  assert.strictEqual(result.failed, true);
  assert.strictEqual(statSync(goals).mode & 0o7777, 0o600);
  assert.match(readFileSync(goals, "utf8"), /G10/);
  assert.strictEqual(result.report.recovery, "partial");
  assert.deepStrictEqual(result.report.unrecovered, ["goals.md"]);
  assert.deepStrictEqual(result.report.recoveryErrors, [{ file: "goals.md", error: "changed repaired file goals.md" }]);
  assert.ok(!readdirSync(dir).some((name) => name.includes(".agents-kit-repair.")));
});

test("repair and rollback keep each replaced file's permission bits under a narrowing umask", () => {
  const dir = historicalRepairFolder("repair-mode");
  chmodSync(join(dir, "goals.md"), 0o664);
  const repaired = spawnSync("/bin/sh", ["-c", 'umask 077 && exec "$0" "$@"', process.execPath, SCRIPT, "--repair", dir], { encoding: "utf8" });
  assert.strictEqual(repaired.status, 0, repaired.stderr + repaired.stdout);
  assert.ok(JSON.parse(repaired.stdout).applied.some((item: { file: string }) => item.file === "goals.md"));
  assert.strictEqual(statSync(join(dir, "goals.md")).mode & 0o7777, 0o664);

  const restored = historicalRepairFolder("repair-mode-restored");
  chmodSync(join(restored, "goals.md"), 0o664);
  const previous = process.umask(0o077);
  let result: ReturnType<typeof repairTask>;
  try {
    result = repairTask(restored, { beforeReplace: (_file, index) => { if (index === 1) throw new Error("injected replacement failure"); } });
  } finally {
    process.umask(previous);
  }
  assert.strictEqual(result.report.recovery, "restored", JSON.stringify(result.report));
  assert.strictEqual(statSync(join(restored, "goals.md")).mode & 0o7777, 0o664);
});

test("the scope partition is total only when no goal is missing from it or in both halves", () => {
  const total = parse(MIXED_PLAN, null, GOALS).goalCoverage.scopePartition;
  assert.deepStrictEqual(total.missingFromPartition, []);
  assert.deepStrictEqual(total.inBoth, []);

  const missing = parse(MIXED_PLAN.replace("deferred G3 · everything else", "deferred nothing"), null, GOALS);
  assert.deepStrictEqual(missing.goalCoverage.scopePartition.deferred, []);
  assert.deepStrictEqual(missing.goalCoverage.scopePartition.missingFromPartition, ["G3"]);
  assert.strictEqual(missing.structure.reliable, false);

  const both = parse(MIXED_PLAN.replace("deferred G3 · everything else", "deferred G2, G3"), null, GOALS);
  assert.deepStrictEqual(both.goalCoverage.scopePartition.deferred, ["G2", "G3"]);
  assert.deepStrictEqual(both.goalCoverage.scopePartition.inBoth, ["G2"]);
  assert.strictEqual(both.structure.reliable, false);
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

test("compaction keeps the Live verification section as completion evidence", () => {
  const sections = compactionSections("## Current state\nDone.\n\n## Step 1 — Work\nDid it.\n\n## Live verification\n- prod — release 1.2 observed healthy\n", "done");
  assert.deepStrictEqual(sections.keep, [
    { heading: "Current state", anchor: "current-state", rule: "current-state" },
    { heading: "Live verification", anchor: "live-verification", rule: "live-verification" },
  ]);
  assert.deepStrictEqual(sections.removable, [{ heading: "Step 1 — Work", anchor: "step-1--work" }]);
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
