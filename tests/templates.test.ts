import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import type { TaskState } from "../scripts/task-state.ts";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const TEMPLATES = join(REPO_DIR, "references", "templates");
const TASK_STATE = join(REPO_DIR, "scripts", "task-state.ts");
const HEALTH_CHECK = join(REPO_DIR, "scripts", "health-check.ts");
const SWEEP_SCOPE = join(REPO_DIR, "scripts", "sweep-scope.ts");
const TEST_ROOT = mkdtempSync(join(tmpdir(), "agents-kit-templates-"));
const TASK_DIR = join(TEST_ROOT, "csv-export");
const MINIMAL_DIR = join(TEST_ROOT, "cache-repair");
const REVIEW_DIR = mkdtempSync(join(tmpdir(), "agents-kit-templates-review-"));
const AWAITED = "https://example.invalid/release/1";
const PLACEHOLDER = /<[^<>\n]*>/g;
const FILLER = "filled in";
const DATE = "2026-01-05";
const GOAL_IDS = ["G1", "G2", "G3", "G4"];
const STEP_GOALS = [
  ["G1", "G2"],
  ["G3", "G4"],
];

after(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
  rmSync(REVIEW_DIR, { recursive: true, force: true });
});

interface HealthReport {
  readonly findings: readonly { readonly check: string; readonly path: string; readonly detail: string }[];
  readonly scanned: number;
}

interface SweepReport {
  readonly planStatus: string | null;
  readonly citations: readonly { readonly url: string; readonly occurrences: readonly { readonly surface: string }[] }[];
}

function template(name: string): string {
  return readFileSync(join(TEMPLATES, name), "utf8");
}

function fill(text: string): string {
  let out = text.replaceAll("YYYY-MM-DD", DATE);
  while (PLACEHOLDER.test(out)) {
    PLACEHOLDER.lastIndex = 0;
    out = out.replace(PLACEHOLDER, FILLER);
  }
  PLACEHOLDER.lastIndex = 0;
  return out;
}

function planText(): string {
  let step = 0;
  const lines = template("plan.md")
    .split("\n")
    .map((line) => {
      if (line.startsWith("**Status:**")) return "**Status:** executing";
      if (line.startsWith("**Result:**")) return "**Result:** [./result.md](./result.md)";
      if (line.startsWith("- **In scope:**")) return `- **In scope:** ${GOAL_IDS.join(", ")} · ${FILLER}`;
      if (line.startsWith("- **Out of scope:**")) return "- **Out of scope:** none";
      if (line.startsWith("- **Goal:**")) return `- **Goal:** ${STEP_GOALS[step++].join(", ")}`;
      return line;
    });
  assert.equal(step, 1, "the plan template has one required step");
  const base = fill(lines.join("\n"))
    .replace("**Context:**", "**Ticket:** [./ticket.md](./ticket.md)\n**Context:**")
    .replace(
      "## Scope",
      "## Exploration Findings\n\nThe export has an existing download path.\n\n## Approach\n\nReuse that path.\n\n## Scope",
    );
  return `${base}\n### Step 2 — Check downloaded rows\n\n- [ ] **What:** Check the export against the active filter\n- **Verify:** Compare the downloaded rows with the visible count\n- **Goal:** ${STEP_GOALS[1].join(", ")}\n- **Depends on:** Step 1\n\n## Risks\n\n- The active filter may change during export.\n\n## Open Questions\n\n- Does the filter retain archived rows? [Decision](https://docs.example.invalid/export)\n`;
}

function build(): void {
  mkdirSync(TASK_DIR, { recursive: true });
  writeFileSync(join(TASK_DIR, "ticket.md"), fill(template("ticket.md")));
  writeFileSync(join(TASK_DIR, "CONTEXT.md"), `${fill(template("CONTEXT.md"))}\n## Recommended Direction\n\nReuse the download path.\n\n## Key Assumptions to Validate\n\n- [ ] The active filter is available at download time.\n\n## MVP Scope\n\n- **In:** current filter\n- **Out:** scheduled exports\n\n## Not Doing (and Why)\n\n- Scheduled exports require a separate flow.\n\n## Open Questions\n\n- Which rows are archived? [Issue](https://tracker.example.invalid/archive)\n\n## References\n\n- [Spec](https://docs.example.invalid/export)\n`);
  writeFileSync(join(TASK_DIR, "goals.md"), fill(template("goals.md")));
  writeFileSync(join(TASK_DIR, "plan.md"), planText());
  writeFileSync(join(TASK_DIR, "result.md"), fill(template("result.md"))
    .replace(/^- G3 —.*$/m, "- G3 — pending external (awaiting observed release)")
    .replace(/^- G4 —.*$/m, "- G4 — pending decision (scope unresolved)")
    .replace(/^- G5 —.*\n?/m, ""));
}

function buildMinimal(): void {
  mkdirSync(MINIMAL_DIR, { recursive: true });
  writeFileSync(join(MINIMAL_DIR, "CONTEXT.md"), fill(template("CONTEXT.md")));
  writeFileSync(join(MINIMAL_DIR, "goals.md"), fill(template("goals.md").split("\n").filter((line) => !/^- G[234]\b/.test(line)).join("\n")));
  writeFileSync(join(MINIMAL_DIR, "plan.md"), fill(template("plan.md")
    .replace(/- \*\*In scope:\*\*.*/, "- **In scope:** G1 · repair the cache")
    .replace(/- \*\*Out of scope:\*\*.*/, "- **Out of scope:** none")
    .replace(/- \*\*Goal:\*\*.*/, "- **Goal:** G1")));
}

function buildInReview(): void {
  writeFileSync(join(REVIEW_DIR, "goals.md"), fill(template("goals.md")));
  writeFileSync(join(REVIEW_DIR, "plan.md"), planText().replace("**Status:** executing", "**Status:** in-review"));
  writeFileSync(join(REVIEW_DIR, "result.md"), fill(template("result.md")
    .replace(/^- G<n> —.*$/m, `- G3 — the [release](${AWAITED}), verified by the release owner`)));
}

function run<T>(script: string, target: string): T {
  const child = spawnSync(process.execPath, [script, target], { encoding: "utf8" });
  assert.equal(child.status, 0, `expected exit 0, got ${child.status}: ${child.stderr}`);
  return JSON.parse(child.stdout) as T;
}

build();
buildMinimal();
buildInReview();

test("a folder filled from the five templates parses as a live task", () => {
  const state = run<TaskState>(TASK_STATE, TASK_DIR);
  assert.equal(state.plan.status, "executing");
  assert.deepEqual(state.goalCoverage.uncoveredGoals, []);
  assert.deepEqual(state.goalCoverage.orphanSteps, []);
  assert.deepEqual(state.goalCoverage.unknownGoalCitations, []);
  assert.deepEqual(state.goalCoverage.scopePartition.missingFromPartition, []);
  assert.deepEqual(state.goalCoverage.scopePartition.inBoth, []);
  assert.equal(state.structure.reliable, true);
  assert.notEqual(state.currentState, null);
});

test("that folder raises no health finding", () => {
  const report = run<HealthReport>(HEALTH_CHECK, TEST_ROOT);
  assert.deepEqual(report.findings, []);
  assert.equal(report.scanned, 2);
});

test("a task created without refinement keeps only filled, required sections", () => {
  const context = readFileSync(join(MINIMAL_DIR, "CONTEXT.md"), "utf8");
  const plan = readFileSync(join(MINIMAL_DIR, "plan.md"), "utf8");
  assert.deepEqual([...context.matchAll(/^## (.+)$/gm)].map((match) => match[1]), ["Problem Statement"]);
  assert.deepEqual([...plan.matchAll(/^## (.+)$/gm)].map((match) => match[1]), ["Scope", "Live verification", "Steps"]);
  assert.doesNotMatch(context + plan, /<[^<>\n]+>|\(only when|\bTODO\b|\.\.\./);
  const state = run<TaskState>(TASK_STATE, MINIMAL_DIR);
  assert.equal(state.plan.status, "to-do");
  assert.deepEqual(state.goalCoverage.uncoveredGoals, []);
  assert.deepEqual(state.goalCoverage.scopePartition.missingFromPartition, []);
  const sweep = run<SweepReport>(SWEEP_SCOPE, MINIMAL_DIR);
  assert.equal(sweep.planStatus, "to-do");
  assert.deepEqual(sweep.citations, []);
});

test("populated optional sections remain readable and swept", () => {
  const state = run<TaskState>(TASK_STATE, TASK_DIR);
  assert.equal(state.steps.length, 2);
  const sweep = run<SweepReport>(SWEEP_SCOPE, TASK_DIR);
  assert.equal(sweep.planStatus, "executing");
  assert.deepEqual(
    sweep.citations.find((citation) => citation.url === "https://docs.example.invalid/export")?.occurrences.map((item) => item.surface),
    ["context-references", "plan-open-questions"],
  );
  assert.deepEqual(
    sweep.citations.find((citation) => citation.url === "https://tracker.example.invalid/archive")?.occurrences.map((item) => item.surface),
    ["context-open-questions"],
  );
});

test("an in-review result sweeps the links its In review section awaits", () => {
  const sweep = run<SweepReport>(SWEEP_SCOPE, REVIEW_DIR);
  assert.equal(sweep.planStatus, "in-review");
  assert.deepEqual(
    sweep.citations.find((citation) => citation.url === AWAITED)?.occurrences.map((item) => item.surface),
    ["result-pause"],
  );
});
