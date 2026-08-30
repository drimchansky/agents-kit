#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAN_VOCAB } from "./lifecycle-constants.ts";

const PLAN_FILE = "plan.md";
const RESULT_FILE = "result.md";
const GOALS_FILE = "goals.md";
const USAGE = "usage: node scripts/task-state.ts <task-dir>";
const FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*(.*)$/;
const HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*$/;
const STEP_TITLE = /^Step[ \t]+(\d+[a-z]*)\b[ \t]*[—–:-]?[ \t]*(.*)$/i;
const CHECKPOINT_TITLE = /^Checkpoint after Step[ \t]+(\d+[a-z]*)\b/i;
const SCOPE_HEADING = /^##[ \t]+Scope\b/;
const GOALS_HEADING = /^##[ \t]+Goals\b/;
const CHECKBOX = /^[ \t]*-[ \t]+\[([ xX])\]/;
const GOAL_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Goal:?\*\*:?[ \t]*(.*)$/i;
const DEPENDS_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Depends on:?\*\*:?[ \t]*(.*)$/i;
const OUTCOME_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Outcome:?\*\*:?[ \t]*(.*)$/i;
const GOAL_ID = /\bG\d+\b/g;
const GOAL_ESCAPE = /^[ \t]*none[ \t]*\(infra\/refactor\)[ \t]*$/i;
const GOAL_BULLET = /^[-*+][ \t]+(\S+)/;
const GOAL_ID_EXACT = /^G\d+$/;
const STEP_REF = /\bStep[ \t]+(\d+[a-z]*)\b/gi;
const BARE_STEP_REF = /\b(\d+[a-z]*)\b/g;
const RESULT_LINK = /\(\[result\]\(([^()]*)\)\)/g;
const COMPACTED_HEADING = /^Compacted\b/;
const TOMBSTONE_BULLET = /^[ \t]*-[ \t]+(.+?)[ \t]*$/;

const STATUS_PATTERNS = [
  /^\*\*Status\b[^:*\n]*:?\*\*:?[ \t]*(.+)$/im,
  /^\*\*Status\b[^:\n]*:[ \t]*(.+)$/im,
  /^Status:[ \t]*(.+)$/im,
];

const SCOPE_LABELS: readonly { readonly partition: "delivered" | "deferred"; readonly match: RegExp }[] = [
  { partition: "delivered", match: /\b(?:in[ -]scope|delivered)\b/gi },
  { partition: "deferred", match: /\b(?:out[ -]of[ -]scope|deferred)\b/gi },
];

export interface FileStatus {
  readonly file: string;
  readonly status: string | null;
  readonly statusRaw: string | null;
}

export interface LegacyResultStatus {
  readonly file: string;
  readonly legacyStatus: string | null;
}

export interface StepState {
  readonly number: string;
  readonly title: string;
  readonly checked: boolean;
  readonly anchor: string | null;
  readonly anchorResolves: boolean | null;
  readonly goals: readonly string[];
  readonly goalEscape: boolean;
  readonly dependsOn: readonly string[];
}

export interface CheckpointState {
  readonly afterStep: string;
  readonly outcome: string | null;
}

export interface ScopePartition {
  readonly delivered: readonly string[];
  readonly deferred: readonly string[];
  readonly missingFromPartition: readonly string[];
  readonly inBoth: readonly string[];
}

export interface GoalSteps {
  readonly id: string;
  readonly steps: readonly string[];
}

export interface StepGoals {
  readonly step: string;
  readonly goals: readonly string[];
}

export interface GoalCoverage {
  readonly goals: readonly GoalSteps[];
  readonly uncoveredGoals: readonly string[];
  readonly orphanSteps: readonly string[];
  readonly unknownGoalCitations: readonly StepGoals[];
  readonly scopePartition: ScopePartition;
}

export interface TaskState {
  readonly taskDir: string;
  readonly plan: FileStatus;
  readonly result: LegacyResultStatus | null;
  readonly goalsFile: string | null;
  readonly steps: readonly StepState[];
  readonly nextPendingStep: string | null;
  readonly checkpoints: readonly CheckpointState[];
  readonly goalCoverage: GoalCoverage;
}

export interface TaskStateInput {
  readonly taskDir: string;
  readonly planText: string;
  readonly resultText: string | null;
  readonly goalsText: string | null;
}

const warnings: string[] = [];

function* liveLines(text: string): Generator<string> {
  let fence: { indent: number; char: string; len: number } | null = null;
  for (const line of text.split("\n")) {
    const marker = line.match(FENCE);
    if (marker) {
      const [, pad, run, rest] = marker;
      if (!fence) fence = { indent: pad.length, char: run[0], len: run.length };
      else if (pad.length <= fence.indent && run[0] === fence.char && run.length >= fence.len && rest === "") {
        fence = null;
      }
      continue;
    }
    if (!fence) yield line;
  }
}

function headingText(line: string): string | null {
  return line.match(HEADING)?.[1] ?? null;
}

function firstToken(value: string): string {
  return (value.replace(/[*_`]/g, "").trim().split(/[\s,;.]+/)[0] ?? "").toLowerCase();
}

function statusHeader(text: string): string | null {
  const header: string[] = [];
  for (const line of liveLines(text)) {
    if (/^#{2,6}[ \t]/.test(line)) break;
    header.push(line);
  }
  const block = header.join("\n");
  for (const pattern of STATUS_PATTERNS) {
    const raw = block.match(pattern)?.[1]?.trim();
    if (raw) return raw.replace(/[*_`]/g, "").trim();
  }
  return null;
}

function readPlanStatus(text: string): FileStatus {
  const cleaned = statusHeader(text);
  if (cleaned === null) return { file: PLAN_FILE, status: null, statusRaw: null };
  const token = firstToken(cleaned).replace(/[^a-z-]/g, "");
  return { file: PLAN_FILE, status: PLAN_VOCAB.has(token) ? token : "unknown", statusRaw: cleaned };
}

function slugify(heading: string): string {
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-");
}

function headingSlugs(text: string): Set<string> {
  const seen = new Map<string, number>();
  const slugs = new Set<string>();
  const taken = new Set<string>();
  let inCompacted = false;
  for (const line of liveLines(text)) {
    const heading = headingText(line);
    if (heading !== null) {
      inCompacted = COMPACTED_HEADING.test(heading);
      const base = slugify(heading);
      if (!base) continue;
      let count = seen.get(base) ?? 0;
      let slug = count === 0 ? base : `${base}-${count}`;
      while (taken.has(slug)) {
        count++;
        slug = `${base}-${count}`;
      }
      seen.set(base, count + 1);
      taken.add(slug);
      slugs.add(slug);
      continue;
    }
    if (!inCompacted) continue;
    const tombstone = line.match(TOMBSTONE_BULLET);
    if (tombstone) {
      const slug = slugify(tombstone[1]);
      if (slug) slugs.add(slug);
    }
  }
  return slugs;
}

interface ResultLink {
  readonly file: string;
  readonly anchor: string | null;
}

function resultLink(line: string): ResultLink | null {
  const matches = [...line.matchAll(RESULT_LINK)];
  if (matches.length === 0) return null;
  const target = matches[matches.length - 1][1].trim();
  const hash = target.indexOf("#");
  const file = (hash === -1 ? target : target.slice(0, hash)).trim().replace(/^\.\//, "");
  const anchor = hash === -1 ? "" : target.slice(hash + 1).trim();
  return { file, anchor: anchor || null };
}

function goalIdsIn(value: string): string[] {
  return [...new Set([...value.matchAll(GOAL_ID)].map((match) => match[0]))];
}

function stepRefsIn(value: string): string[] {
  const labelled = [...value.matchAll(STEP_REF)].map((match) => match[1].toLowerCase());
  if (labelled.length > 0) return [...new Set(labelled)];
  if (/^\s*none\b/i.test(value)) return [];
  return [...new Set([...value.matchAll(BARE_STEP_REF)].map((match) => match[1].toLowerCase()))];
}

interface DraftStep {
  readonly number: string;
  readonly title: string;
  checked: boolean;
  link: ResultLink | null;
  goals: string[];
  goalEscape: boolean;
  dependsOn: string[];
  sawCheckbox: boolean;
  sawGoal: boolean;
  sawDepends: boolean;
}

interface ParsedPlan {
  readonly steps: readonly DraftStep[];
  readonly checkpoints: readonly string[];
  readonly delivered: ReadonlySet<string>;
  readonly deferred: ReadonlySet<string>;
}

function readScopeLine(line: string, delivered: Set<string>, deferred: Set<string>): void {
  const marks: { index: number; end: number; into: Set<string> }[] = [];
  for (const label of SCOPE_LABELS) {
    for (const match of line.matchAll(label.match)) {
      marks.push({
        index: match.index,
        end: match.index + match[0].length,
        into: label.partition === "delivered" ? delivered : deferred,
      });
    }
  }
  marks.sort((a, b) => a.index - b.index);
  for (const [position, mark] of marks.entries()) {
    const span = line.slice(mark.end, marks[position + 1]?.index ?? line.length);
    for (const id of goalIdsIn(span)) mark.into.add(id);
  }
}

function parsePlan(text: string): ParsedPlan {
  const steps: DraftStep[] = [];
  const checkpoints: string[] = [];
  const delivered = new Set<string>();
  const deferred = new Set<string>();
  let step: DraftStep | null = null;
  let inScope = false;
  for (const line of liveLines(text)) {
    const heading = headingText(line);
    if (heading !== null) {
      step = null;
      inScope = SCOPE_HEADING.test(line);
      const checkpoint = heading.match(CHECKPOINT_TITLE);
      if (checkpoint) {
        checkpoints.push(checkpoint[1].toLowerCase());
        continue;
      }
      const stepHeading = heading.match(STEP_TITLE);
      if (!stepHeading) continue;
      step = {
        number: stepHeading[1].toLowerCase(),
        title: stepHeading[2].trim(),
        checked: false,
        link: null,
        goals: [],
        goalEscape: false,
        dependsOn: [],
        sawCheckbox: false,
        sawGoal: false,
        sawDepends: false,
      };
      steps.push(step);
      continue;
    }
    if (inScope) {
      readScopeLine(line, delivered, deferred);
      continue;
    }
    if (step === null) continue;
    const box = line.match(CHECKBOX);
    if (box && !step.sawCheckbox) {
      step.sawCheckbox = true;
      step.checked = box[1].toLowerCase() === "x";
      step.link = resultLink(line);
      continue;
    }
    const goal = line.match(GOAL_FIELD);
    if (goal && !step.sawGoal) {
      step.sawGoal = true;
      step.goals = goalIdsIn(goal[1]);
      step.goalEscape = step.goals.length === 0 && GOAL_ESCAPE.test(goal[1]);
      continue;
    }
    const depends = line.match(DEPENDS_FIELD);
    if (depends && !step.sawDepends) {
      step.sawDepends = true;
      step.dependsOn = stepRefsIn(depends[1]);
    }
  }
  return { steps, checkpoints, delivered, deferred };
}

function checkpointOutcomes(text: string): Map<string, string> {
  const outcomes = new Map<string, string>();
  let current: string | null = null;
  for (const line of liveLines(text)) {
    const heading = headingText(line);
    if (heading !== null) {
      current = heading.match(CHECKPOINT_TITLE)?.[1].toLowerCase() ?? null;
      continue;
    }
    if (current === null || outcomes.has(current)) continue;
    const outcome = line.match(OUTCOME_FIELD);
    if (!outcome) continue;
    const token = firstToken(outcome[1]);
    if (token) outcomes.set(current, token);
  }
  return outcomes;
}

function goalIds(text: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  let inGoals = false;
  for (const line of liveLines(text)) {
    if (HEADING.test(line)) {
      inGoals = GOALS_HEADING.test(line);
      continue;
    }
    if (!inGoals) continue;
    const id = line.match(GOAL_BULLET)?.[1];
    if (id === undefined || !GOAL_ID_EXACT.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function taskState(input: TaskStateInput): TaskState {
  const plan = parsePlan(input.planText);
  const slugs = input.resultText === null ? null : headingSlugs(input.resultText);
  const outcomes = input.resultText === null ? new Map<string, string>() : checkpointOutcomes(input.resultText);
  const ids = input.goalsText === null ? [] : goalIds(input.goalsText);
  const known = new Set(ids);

  const steps: StepState[] = plan.steps.map((step) => ({
    number: step.number,
    title: step.title,
    checked: step.checked,
    anchor: step.link?.anchor ?? null,
    anchorResolves: step.checked
      ? step.link?.file === RESULT_FILE && step.link.anchor !== null && slugs !== null && slugs.has(step.link.anchor)
      : null,
    goals: step.goals,
    goalEscape: step.goalEscape,
    dependsOn: step.dependsOn,
  }));

  const goals: GoalSteps[] = ids.map((id) => ({
    id,
    steps: steps.filter((step) => step.goals.includes(id)).map((step) => step.number),
  }));

  return {
    taskDir: input.taskDir,
    plan: readPlanStatus(input.planText),
    result:
      input.resultText === null
        ? null
        : { file: RESULT_FILE, legacyStatus: statusHeader(input.resultText) },
    goalsFile: input.goalsText === null ? null : GOALS_FILE,
    steps,
    nextPendingStep: steps.find((step) => !step.checked)?.number ?? null,
    checkpoints: plan.checkpoints.map((afterStep) => ({ afterStep, outcome: outcomes.get(afterStep) ?? null })),
    goalCoverage: {
      goals,
      uncoveredGoals: goals.filter((goal) => goal.steps.length === 0).map((goal) => goal.id),
      orphanSteps: steps.filter((step) => !step.goalEscape && step.goals.length === 0).map((step) => step.number),
      unknownGoalCitations:
        input.goalsText === null
          ? []
          : steps
              .map((step) => ({ step: step.number, goals: step.goals.filter((id) => !known.has(id)) }))
              .filter((citation) => citation.goals.length > 0),
      scopePartition: {
        delivered: [...plan.delivered],
        deferred: [...plan.deferred],
        missingFromPartition: ids.filter((id) => !plan.delivered.has(id) && !plan.deferred.has(id)),
        inBoth: ids.filter((id) => plan.delivered.has(id) && plan.deferred.has(id)),
      },
    },
  };
}

class Exit extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

function readOptional(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;

    if (code !== "ENOENT") warnings.push(`unreadable ${path}: ${code ?? (err as Error).message}`);
    return null;
  }
}

function main(): void {
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EPIPE") throw err;
  });

  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Exit(2, USAGE);
  const taskDir = resolve(args[0]);
  const planText = readOptional(join(taskDir, PLAN_FILE));
  if (planText === null) throw new Exit(1, `${taskDir} has no readable ${PLAN_FILE}.`);

  const state = taskState({
    taskDir,
    planText,
    resultText: readOptional(join(taskDir, RESULT_FILE)),
    goalsText: readOptional(join(taskDir, GOALS_FILE)),
  });
  process.stdout.write(JSON.stringify(state) + "\n");
  for (const warning of warnings) console.error(`[task-state] ${warning}`);
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  try {
    main();
  } catch (err) {
    const exit = err instanceof Exit ? err : new Exit(2, `task-state failed: ${(err as Error).message}`);
    console.error(`[task-state] ${exit.message}`);
    process.exitCode = exit.code;
  }
}
