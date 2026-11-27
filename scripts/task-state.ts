#!/usr/bin/env node
import { readdirSync, readFileSync, realpathSync, type Dirent } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ARCHIVE_DIR, BACKLOG_DIR, PLAN_VOCAB } from "./lifecycle-constants.ts";
import { GOAL_FIELD, markdownLines, parseGoalDefinitions, sameDiagnostic, SCOPE_HEADING, validateGoalStructure, withoutCodeSpans, type StructureDiagnostic, type StructureReport } from "./goal-structure.ts";
import { readTaskMarkdown, repairTask, type StructureValidator, type TaskMarkdown } from "./task-repair.ts";

const PLAN_FILE = "plan.md";
const RESULT_FILE = "result.md";
const GOALS_FILE = "goals.md";
const REPAIR_FLAG = "--repair";
const USAGE = [
  "usage: node scripts/task-state.ts <task-dir>",
  "       node scripts/task-state.ts --repair <task-dir>",
].join("\n");
const HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*$/;
const STEP_TITLE = /^Step[ \t]+(\d+[a-z]*)\b[ \t]*[—–:-]?[ \t]*(.*)$/i;
const CHECKPOINT_TITLE = /^Checkpoint after Step[ \t]+(\d+[a-z]*)\b/i;
export const RESULT_STEP_TITLE = /^Step[ \t]+(\d+[A-Za-z]*)[ \t]+—[ \t]+\S/;
const RESULT_CHECKPOINT_TITLE = /^Checkpoint after Step[ \t]+(\d+[A-Za-z]*)$/;
const RESULT_SECTION_TITLES = new Set([
  "Current state",
  "Final implementation commit",
  "Acceptance",
  "In review",
  "Blocked",
  "Live verification",
  "Open findings",
]);
const CURRENT_STATE_TITLE = /^current state\b/i;
const CHECKBOX = /^[ \t]*-[ \t]+\[([ xX])\]/;
const WHAT_FIELD = /^[ \t]*-[ \t]+\[[ xX]\][ \t]*\*\*What:?\*\*:?[ \t]*(.*)$/i;
const VERIFY_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Verify:?\*\*:?[ \t]*(.*)$/i;
const DEPENDS_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Depends on:?\*\*:?[ \t]*(.*)$/i;
const OUTCOME_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Outcome:?\*\*:?[ \t]*(.*)$/i;
const GOAL_ID = /\bG\d+\b/g;
const GOAL_ESCAPE = /^[ \t]*none[ \t]*\(infra\/refactor\)[ \t]*$/i;
const STEP_REF = /\bStep[ \t]+(\d+[a-z]*)\b/gi;
const BARE_STEP_REF = /\b(\d+[a-z]*)\b/g;
const STEPS_RUN = /\bSteps[ \t]+\d+[a-z]*(?:[ \t]*-[ \t]*\d+[a-z]*)?\b/gi;
const STEP_NUMBER = /^\d+[a-z]*$/i;
const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const RESULT_LINK = /\(\[result\]\(([^()]*)\)\)/g;
const HEADING_LEVEL = /^(#{1,6})[ \t]/;
const BLOCK_CLOSE = /^[ \t]*---[ \t]*$/;
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

export interface StepBody {
  readonly what: string | null;
  readonly verify: string | null;
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
  readonly nextPendingStepBody: StepBody | null;
  readonly checkpoints: readonly CheckpointState[];
  readonly goalCoverage: GoalCoverage;
  readonly structure: StructureReport;
  readonly currentState: string | null;
}

export interface TaskStateInput {
  readonly taskDir: string;
  readonly planText: string;
  readonly resultText: string | null;
  readonly goalsText: string | null;
  readonly otherMarkdown?: Readonly<Record<string, string>>;
  readonly unreadableMarkdown?: readonly string[];
  readonly nestedTasks?: readonly string[];
  readonly siblingTasks?: readonly string[];
}

const warnings: string[] = [];

interface ScannedLine {
  readonly line: string;
  readonly visible: string;
  readonly live: boolean;
}

function* scanLines(text: string): Generator<ScannedLine> {
  for (const line of markdownLines(text)) yield { line: line.text, visible: line.visible, live: line.live };
}

function* liveLines(text: string): Generator<string> {
  for (const scanned of scanLines(text)) if (scanned.live) yield scanned.visible;
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
    const raw = block.match(pattern)?.[1]?.replace(/[*_`]/g, "").trim();
    if (raw) return raw;
  }
  return null;
}

export function readPlanStatus(text: string): FileStatus {
  const cleaned = statusHeader(text);
  if (cleaned === null) return { file: PLAN_FILE, status: null, statusRaw: null };
  const token = firstToken(cleaned).replace(/[^a-z-]/g, "");
  return { file: PLAN_FILE, status: PLAN_VOCAB.has(token) ? token : "unknown", statusRaw: cleaned };
}

function slugify(heading: string): string {
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-");
}

export function slugAllocator(): (heading: string) => string | null {
  const seen = new Map<string, number>();
  const taken = new Set<string>();
  return (heading) => {
    const base = slugify(heading);
    if (!base) return null;
    let count = seen.get(base) ?? 0;
    let slug = count === 0 ? base : `${base}-${count}`;
    while (taken.has(slug)) {
      count++;
      slug = `${base}-${count}`;
    }
    seen.set(base, count + 1);
    taken.add(slug);
    return slug;
  };
}

export function resultStepByAnchor(text: string): Map<string, string | null> {
  const allocate = slugAllocator();
  const steps = new Map<string, string | null>();
  for (const line of liveLines(text)) {
    const heading = headingText(line);
    if (heading === null) continue;
    const slug = allocate(heading);
    if (slug === null) continue;
    const number = line.match(HEADING_LEVEL)?.[1].length === 2 ? heading.match(RESULT_STEP_TITLE)?.[1] : null;
    steps.set(slug, number?.toLowerCase() ?? null);
  }
  return steps;
}

interface ResultLink {
  readonly file: string;
  readonly anchor: string | null;
}

export function lastResultLink(line: string) {
  const markup = withoutCodeSpans(line);
  return [...line.matchAll(RESULT_LINK)].findLast((match) => markup.startsWith(match[0], match.index));
}

function resultLink(line: string): ResultLink | null {
  const match = lastResultLink(line);
  if (!match) return null;
  const target = match[1].trim();
  const hash = target.indexOf("#");
  const file = (hash === -1 ? target : target.slice(0, hash)).trim().replace(/^\.\//, "");
  const anchor = hash === -1 ? "" : target.slice(hash + 1).trim();
  return { file, anchor: anchor || null };
}

function goalIdsIn(value: string): string[] {
  return [...new Set([...value.matchAll(GOAL_ID)].map((match) => match[0]))];
}

function taskCitation(siblingTasks: readonly string[]): RegExp | null {
  if (siblingTasks.length === 0) return null;
  const names = [...siblingTasks].sort((a, b) => b.length - a.length).map((name) => name.replace(REGEXP_SPECIAL, "\\$&"));
  return new RegExp(`(?<![\\w-])(?:${names.join("|")})(?![\\w-])(?:\`?[ \\t]+Step[ \\t]+\\d+[a-z]*\\b)?`, "gi");
}

function stepRefsIn(value: string, citation: RegExp | null): string[] {
  if (/^\s*none\b/i.test(value)) return [];
  const own = citation === null ? value : value.replace(citation, " ");
  const labelled = [...own.matchAll(STEP_REF)].map((match) => match[1].toLowerCase());
  if (labelled.length > 0) {
    const runNumbers = [...(own.match(STEPS_RUN) ?? []).join(" ").matchAll(BARE_STEP_REF)].map((match) => match[1].toLowerCase());
    return [...new Set([...labelled, ...runNumbers])];
  }
  const firstCitation = citation === null ? -1 : value.search(citation);
  const bare = firstCitation === -1 ? own : [value.slice(0, firstCitation), ...(own.slice(firstCitation).match(STEPS_RUN) ?? [])].join(" ");
  return [...new Set([...bare.matchAll(BARE_STEP_REF)].map((match) => match[1].toLowerCase()))];
}

interface DraftStep {
  readonly number: string;
  readonly line: number;
  readonly title: string;
  checked: boolean;
  link: ResultLink | null;
  what: string | null;
  verify: string | null;
  goals: string[];
  goalEscape: boolean;
  dependsOn: string[];
  sawCheckbox: boolean;
  sawVerify: boolean;
  sawGoal: boolean;
  sawDepends: boolean;
}

function fieldText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

interface FieldCitation {
  readonly id: string;
  readonly line: number;
}

interface ParsedPlan {
  readonly steps: readonly DraftStep[];
  readonly checkpoints: readonly string[];
  readonly delivered: ReadonlySet<string>;
  readonly deferred: ReadonlySet<string>;
  readonly fieldCitations: readonly FieldCitation[];
}

function readScopeLine(line: string, delivered: Set<string>, deferred: Set<string>): string[] {
  const cited = new Set<string>();
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
    for (const id of goalIdsIn(span)) {
      mark.into.add(id);
      cited.add(id);
    }
  }
  return [...cited];
}

export function parsePlan(text: string, siblingTasks: readonly string[]): ParsedPlan {
  const citation = taskCitation(siblingTasks);
  const steps: DraftStep[] = [];
  const checkpoints: string[] = [];
  const delivered = new Set<string>();
  const deferred = new Set<string>();
  const fieldCitations: FieldCitation[] = [];
  let step: DraftStep | null = null;
  let inScope = false;
  for (const source of markdownLines(text)) {
    if (!source.live) continue;
    const line = source.visible;
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
        line: source.number,
        title: stepHeading[2].trim(),
        checked: false,
        link: null,
        what: null,
        verify: null,
        goals: [],
        goalEscape: false,
        dependsOn: [],
        sawCheckbox: false,
        sawVerify: false,
        sawGoal: false,
        sawDepends: false,
      };
      steps.push(step);
      continue;
    }
    if (inScope) {
      for (const id of readScopeLine(line, delivered, deferred)) fieldCitations.push({ id, line: source.number });
      continue;
    }
    if (step === null) continue;
    const box = line.match(CHECKBOX);
    if (box && !step.sawCheckbox) {
      step.sawCheckbox = true;
      step.checked = box[1].toLowerCase() === "x";
      step.link = resultLink(line);
      step.what = fieldText(line.match(WHAT_FIELD)?.[1]);
      continue;
    }
    const verify = line.match(VERIFY_FIELD);
    if (verify && !step.sawVerify) {
      step.sawVerify = true;
      step.verify = fieldText(verify[1]);
      continue;
    }
    const goal = line.match(GOAL_FIELD);
    if (goal && !step.sawGoal) {
      step.sawGoal = true;
      step.goals = goalIdsIn(goal[1]);
      step.goalEscape = step.goals.length === 0 && GOAL_ESCAPE.test(goal[1]);
      for (const id of step.goals) fieldCitations.push({ id, line: source.number });
      continue;
    }
    const depends = line.match(DEPENDS_FIELD);
    if (depends && !step.sawDepends) {
      step.sawDepends = true;
      step.dependsOn = stepRefsIn(depends[1], citation);
    }
  }
  return { steps, checkpoints, delivered, deferred, fieldCitations };
}

function checkpointOutcomes(text: string): Map<string, string> {
  const outcomes = new Map<string, string>();
  let current: string | null = null;
  for (const line of liveLines(text)) {
    const heading = headingText(line);
    if (heading !== null) {
      const level = line.match(HEADING_LEVEL)![1].length;
      if (level <= 2) current = level === 2 ? heading.match(RESULT_CHECKPOINT_TITLE)?.[1].toLowerCase() ?? null : null;
      continue;
    }
    if (current === null) continue;
    const outcome = line.match(OUTCOME_FIELD);
    if (!outcome) continue;
    const token = firstToken(outcome[1]);
    if (token) outcomes.set(current, token);
  }
  return outcomes;
}

export function resultShapeDiagnostics(resultText: string, planStatus: string | null): StructureDiagnostic[] {
  const diagnostics: StructureDiagnostic[] = [];
  const seen = new Set<string>();

  for (const { visible, live, number } of markdownLines(resultText)) {
    if (!live || visible.match(HEADING_LEVEL)?.[1].length !== 2) continue;
    const heading = headingText(visible);
    if (heading === null) continue;
    const step = heading.match(RESULT_STEP_TITLE);
    const checkpoint = heading.match(RESULT_CHECKPOINT_TITLE);
    const key = step ? `Step ${step[1].toLowerCase()}`
      : checkpoint ? `Checkpoint after Step ${checkpoint[1].toLowerCase()}`
      : RESULT_SECTION_TITLES.has(heading) ? heading
      : null;
    if (key === null) {
      diagnostics.push({ code: "unknown-result-section", file: RESULT_FILE, line: number, detail: heading });
    } else if (seen.has(key)) {
      diagnostics.push({ code: "duplicate-result-record", file: RESULT_FILE, line: number, detail: key });
    } else {
      seen.add(key);
    }
  }

  const required = planStatus === "done" ? "Acceptance"
    : planStatus === "in-review" ? "In review"
    : planStatus === "blocked" ? "Blocked"
    : null;
  if (required !== null && !seen.has(required)) {
    diagnostics.push({ code: "missing-result-section", file: RESULT_FILE, line: 0, detail: required });
  }
  return diagnostics;
}

function currentStateBlock(text: string): string | null {
  const block: string[] = [];
  let open = false;
  for (const { line, visible, live } of scanLines(text)) {
    const heading = live ? headingText(visible) : null;
    if (heading !== null && (visible.match(HEADING_LEVEL)?.[1].length ?? 0) === 2) {
      if (open) break;
      if (!CURRENT_STATE_TITLE.test(heading)) continue;
      open = true;
      block.push(line);
      continue;
    }
    if (!open) continue;
    block.push(line);
    if (live && BLOCK_CLOSE.test(visible)) break;
  }
  return open ? block.join("\n").replace(/\s+$/, "") : null;
}

export function taskState(input: TaskStateInput): TaskState {
  const plan = parsePlan(input.planText, input.siblingTasks ?? []);
  const planStatus = readPlanStatus(input.planText);
  const stepByAnchor = input.resultText === null ? null : resultStepByAnchor(input.resultText);
  const outcomes = input.resultText === null ? new Map<string, string>() : checkpointOutcomes(input.resultText);
  const parsedGoals = input.goalsText === null ? null : parseGoalDefinitions(input.goalsText);
  const ids = parsedGoals === null ? [] : [...new Set(parsedGoals.definitions.map((goal) => goal.id))];
  const known = new Set(ids);
  const retired = new Set(parsedGoals?.retired.map((goal) => goal.id) ?? []);

  const steps: StepState[] = plan.steps.map((step) => ({
    number: step.number,
    title: step.title,
    checked: step.checked,
    anchor: step.link?.anchor ?? null,
    anchorResolves: step.checked
      ? step.link?.file === RESULT_FILE && step.link.anchor !== null && stepByAnchor?.get(step.link.anchor) === step.number
      : null,
    goals: step.goals,
    goalEscape: step.goalEscape,
    dependsOn: step.dependsOn,
  }));

  const goals: GoalSteps[] = ids.map((id) => ({
    id,
    steps: steps.filter((step) => step.goals.includes(id)).map((step) => step.number),
  }));

  const pending = steps.findIndex((step) => !step.checked);
  const validated = validateGoalStructure(input.goalsText, {
    "plan.md": input.planText,
    ...(input.resultText === null ? {} : { "result.md": input.resultText }),
    ...(input.goalsText === null ? {} : { "goals.md": input.goalsText }),
    ...input.otherMarkdown,
  }, {
    missingAnchors: plan.steps.filter((step, index) => steps[index].anchorResolves === false).map((step) => ({ step: step.number, line: step.line })),
    unreadableMarkdown: input.unreadableMarkdown,
    nestedTasks: input.nestedTasks,
  });
  const scannedUnknown = new Set(validated.diagnostics
    .filter((item) => item.code === "unknown-goal-reference" && item.file === PLAN_FILE)
    .map((item) => `${item.line}\0${item.detail}`));
  const coverageDiagnostics = [
    ...(input.goalsText === null ? [] : plan.fieldCitations)
      .filter((citation) => !known.has(citation.id) && !scannedUnknown.has(`${citation.line}\0${citation.id}`))
      .map((citation) => ({
        code: retired.has(citation.id) ? "retired-goal-reference" as const : "unknown-goal-reference" as const,
        file: PLAN_FILE, line: citation.line, detail: citation.id,
      })),
    ...plan.steps.filter((step) => !step.goalEscape && step.goals.length === 0).map((step) => ({
      code: "orphan-step" as const, file: "plan.md", line: step.line, detail: `Step ${step.number}`,
    })),
    ...ids.filter((id) => !plan.delivered.has(id) && !plan.deferred.has(id)).map((id) => ({
      code: "missing-goal-partition" as const, file: "plan.md", line: 0, detail: id,
    })),
    ...ids.filter((id) => plan.delivered.has(id) && plan.deferred.has(id)).map((id) => ({
      code: "conflicting-goal-partition" as const, file: "plan.md", line: 0, detail: id,
    })),
  ];

  const shapeDiagnostics = input.resultText === null ? [] : resultShapeDiagnostics(input.resultText, planStatus.status);
  const diagnostics = [...validated.diagnostics, ...coverageDiagnostics, ...shapeDiagnostics];
  return {
    taskDir: input.taskDir,
    plan: planStatus,
    result:
      input.resultText === null
        ? null
        : { file: RESULT_FILE, legacyStatus: statusHeader(input.resultText) },
    goalsFile: input.goalsText === null ? null : GOALS_FILE,
    steps,
    nextPendingStep: pending === -1 ? null : steps[pending].number,
    nextPendingStepBody:
      pending === -1 ? null : { what: plan.steps[pending].what, verify: plan.steps[pending].verify },
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
    structure: { reliable: validated.reliable && diagnostics.length === 0, diagnostics },
    currentState: input.resultText === null ? null : currentStateBlock(input.resultText),
  };
}

export class Exit extends Error {
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

function reason(err: unknown): string {
  return (err as NodeJS.ErrnoException).code ?? (err as Error).message;
}

function folderEntries(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") warnings.push(`cannot list sibling tasks in ${dir}: ${reason(err)}`);
    return [];
  }
}

function listSiblingTasks(taskDir: string): string[] {
  const parent = dirname(taskDir);
  const group = ARCHIVE_DIR.test(basename(parent)) || BACKLOG_DIR.test(basename(parent)) ? dirname(parent) : parent;
  const names: string[] = [];
  for (const entry of folderEntries(group)) {
    if (ARCHIVE_DIR.test(entry.name) || BACKLOG_DIR.test(entry.name)) names.push(...folderEntries(join(group, entry.name)).map((child) => child.name));
    else names.push(entry.name);
  }
  return names.filter((name) => name !== basename(taskDir) && !ARCHIVE_DIR.test(name) && !BACKLOG_DIR.test(name) && !STEP_NUMBER.test(name));
}

function main(): void {
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EPIPE" && err.code !== "ENOTCONN") throw err;
  });

  const args = process.argv.slice(2);
  const repairing = args[0] === REPAIR_FLAG;
  const positional = repairing ? args.slice(1) : args;
  if (positional.length !== 1) throw new Exit(2, USAGE);
  const taskDir = resolve(positional[0]);

  if (repairing) {
    const siblings = listSiblingTasks(taskDir);
    const validate: StructureValidator = (documents, options) => {
      const direct = (file: string): string | null => documents[file] ?? readOptional(join(taskDir, file));
      const planText = direct(PLAN_FILE);
      return planText === null
        ? validateGoalStructure(documents[GOALS_FILE] ?? null, documents, options)
        : taskState({
          taskDir,
          planText,
          resultText: direct(RESULT_FILE),
          goalsText: direct(GOALS_FILE),
          otherMarkdown: documents,
          unreadableMarkdown: options.unreadableMarkdown ?? [],
          nestedTasks: options.nestedTasks,
          siblingTasks: siblings,
        }).structure;
    };
    const repaired = repairTask(taskDir, {}, validate);
    const documents = repaired.documents;
    const read = (file: string): string | null => repaired.failed ? null : documents[file] ?? readOptional(join(taskDir, file));
    const planText = read(PLAN_FILE);
    const state = planText === null ? null : taskState({
      taskDir,
      planText,
      resultText: read(RESULT_FILE),
      goalsText: read(GOALS_FILE),
      otherMarkdown: documents,
      unreadableMarkdown: repaired.gaps,
      nestedTasks: repaired.nested,
      siblingTasks: siblings,
    });
    const unresolved = [...repaired.report.unresolved];
    for (const issue of state?.structure.diagnostics ?? []) {
      if (!unresolved.some((existing) => sameDiagnostic(existing, issue))) unresolved.push(issue);
    }
    process.stdout.write(JSON.stringify({ ...repaired.report, unresolved, state }) + "\n");
    if (repaired.failed) process.exitCode = 2;
    else if (unresolved.length > 0) process.exitCode = 1;
  } else {
    const planText = readOptional(join(taskDir, PLAN_FILE));
    if (planText === null) throw new Exit(1, `${taskDir} has no readable ${PLAN_FILE}.`);
    let markdown: TaskMarkdown;
    try { markdown = readTaskMarkdown(taskDir); }
    catch (err) {
      warnings.push(`incomplete Markdown scan ${taskDir}: ${(err as Error).message}`);
      markdown = { documents: Object.create(null), gaps: ["."], nested: [], failures: [] };
    }
    const resultText = markdown.documents[RESULT_FILE] ?? readOptional(join(taskDir, RESULT_FILE));
    const goalsText = markdown.documents[GOALS_FILE] ?? readOptional(join(taskDir, GOALS_FILE));

    const state = taskState({
      taskDir,
      planText,
      resultText,
      goalsText,
      otherMarkdown: markdown.documents,
      unreadableMarkdown: markdown.gaps,
      nestedTasks: markdown.nested,
      siblingTasks: listSiblingTasks(taskDir),
    });
    process.stdout.write(JSON.stringify(state) + "\n");
  }
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
