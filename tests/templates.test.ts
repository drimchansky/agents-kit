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
const TEST_ROOT = mkdtempSync(join(tmpdir(), "agents-kit-templates-"));
const TASK_DIR = join(TEST_ROOT, "csv-export");
const PLACEHOLDER = /<[^<>\n]*>/g;
const FILLER = "filled in";
const DATE = "2026-01-05";
const GOAL_IDS = ["G1", "G2", "G3", "G4"];
const STEP_GOALS = [
  ["G1", "G2"],
  ["G3", "G4"],
];

after(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

interface HealthReport {
  readonly findings: readonly { readonly check: string; readonly path: string; readonly detail: string }[];
  readonly scanned: number;
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
    .filter((line) => !line.startsWith("**Deliverable:**"))
    .map((line) => {
      if (line.startsWith("**Status:**")) return "**Status:** executing";
      if (line.startsWith("**Result:**")) return "**Result:** [./result.md](./result.md)";
      if (line.startsWith("- **In scope:**")) return `- **In scope:** ${GOAL_IDS.join(", ")} · ${FILLER}`;
      if (line.startsWith("- **Out of scope:**")) return "- **Out of scope:** none";
      if (line.startsWith("- **Goal:**")) return `- **Goal:** ${STEP_GOALS[step++].join(", ")}`;
      return line;
    });
  assert.equal(step, STEP_GOALS.length, "the plan template's steps and the filled goal citations must line up");
  return fill(lines.join("\n"));
}

function build(): void {
  mkdirSync(TASK_DIR, { recursive: true });
  writeFileSync(join(TASK_DIR, "ticket.md"), fill(template("ticket.md")));
  writeFileSync(join(TASK_DIR, "CONTEXT.md"), fill(template("CONTEXT.md")));
  writeFileSync(join(TASK_DIR, "goals.md"), fill(template("goals.md")));
  writeFileSync(join(TASK_DIR, "plan.md"), planText());
  writeFileSync(join(TASK_DIR, "result.md"), fill(template("result.md")));
}

function run<T>(script: string, target: string): T {
  const child = spawnSync(process.execPath, [script, target], { encoding: "utf8" });
  assert.equal(child.status, 0, `expected exit 0, got ${child.status}: ${child.stderr}`);
  return JSON.parse(child.stdout) as T;
}

build();

test("a folder filled from the five templates parses as a live task", () => {
  const state = run<TaskState>(TASK_STATE, TASK_DIR);
  assert.equal(state.plan.status, "executing");
  assert.deepEqual(state.goalCoverage.uncoveredGoals, []);
  assert.deepEqual(state.goalCoverage.orphanSteps, []);
  assert.deepEqual(state.goalCoverage.unknownGoalCitations, []);
  assert.deepEqual(state.goalCoverage.scopePartition.missingFromPartition, []);
  assert.deepEqual(state.goalCoverage.scopePartition.inBoth, []);
  assert.notEqual(state.currentState, null);
});

test("that folder raises no health finding", () => {
  const report = run<HealthReport>(HEALTH_CHECK, TEST_ROOT);
  assert.deepEqual(report.findings, []);
  assert.equal(report.scanned, 1);
});
