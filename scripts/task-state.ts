#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, fstatSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, rmSync, writeFileSync, type Stats } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAN_VOCAB, RESULT_MAX_KB } from "./lifecycle-constants.ts";
import { GOAL_FIELD, markdownLines, parseGoalDefinitions, sameDiagnostic, SCOPE_HEADING, validateGoalStructure, type StructureReport } from "./goal-structure.ts";
import { readTaskMarkdown, repairTask, type StructureValidator, type TaskMarkdown } from "./task-repair.ts";

const PLAN_FILE = "plan.md";
const RESULT_FILE = "result.md";
const GOALS_FILE = "goals.md";
const COMPACTION_FLAG = "--compaction-plan";
const SNAPSHOT_FLAG = "--compaction-snapshot";
const REPAIR_FLAG = "--repair";
const USAGE = [
  "usage: node scripts/task-state.ts <task-dir>",
  "       node scripts/task-state.ts --compaction-plan <task-dir>",
  "       node scripts/task-state.ts --compaction-snapshot <task-dir>",
  "       node scripts/task-state.ts --repair <task-dir>",
].join("\n");
const SNAPSHOT_DIR = [".local", "state", "agents-kit", "compaction"];
const SNAPSHOT_HASH_DIGITS = 12;
const HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*$/;
const STEP_TITLE = /^Step[ \t]+(\d+[a-z]*)\b[ \t]*[—–:-]?[ \t]*(.*)$/i;
const CHECKPOINT_TITLE = /^Checkpoint after Step[ \t]+(\d+[a-z]*)\b/i;
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
const TASK_CITATION = /(?<![\w-])([a-z0-9]+(?:-[a-z0-9]+)+)(?![\w-])(?:`?[ \t]+Step[ \t]+\d+[a-z]*\b)?/gi;
const TASK_NAME_WORD = /(?:^|-)[a-z]/i;
const RESULT_LINK = /\(\[result\]\(([^()]*)\)\)/g;
const COMPACTED_HEADING = /^Compacted\b/;
const TOMBSTONE_BULLET = /^[ \t]*-[ \t]+(.+?)[ \t]*$/;
const HEADING_LEVEL = /^(#{1,6})[ \t]/;
const BLOCK_CLOSE = /^[ \t]*---[ \t]*$/;
const PAUSE_KINDS: readonly { readonly status: string; readonly heading: RegExp; readonly label: RegExp }[] = [
  { status: "blocked", heading: /^blocked\b/i, label: /^[ \t]*\*\*blocked:?\*\*/i },
  { status: "in-review", heading: /^in[ \t]+review\b/i, label: /^[ \t]*\*\*in[ \t]+review:?\*\*/i },
];

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

function readPlanStatus(text: string): FileStatus {
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

function headingSlugs(text: string): Set<string> {
  const allocate = slugAllocator();
  const slugs = new Set<string>();
  let inCompacted = false;
  for (const line of liveLines(text)) {
    const heading = headingText(line);
    if (heading !== null) {
      inCompacted = COMPACTED_HEADING.test(heading);
      const slug = allocate(heading);
      if (slug !== null) slugs.add(slug);
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

function withoutTaskCitations(value: string): string {
  return value.replace(TASK_CITATION, (citation: string, name: string) => (TASK_NAME_WORD.test(name) ? " " : citation));
}

function stepRefsIn(value: string): string[] {
  const own = withoutTaskCitations(value);
  const labelled = [...own.matchAll(STEP_REF)].map((match) => match[1].toLowerCase());
  if (labelled.length > 0) return [...new Set(labelled)];
  if (/^\s*none\b/i.test(own)) return [];
  return [...new Set([...own.matchAll(BARE_STEP_REF)].map((match) => match[1].toLowerCase()))];
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

function parsePlan(text: string): ParsedPlan {
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
      step.dependsOn = stepRefsIn(depends[1]);
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
  const plan = parsePlan(input.planText);
  const slugs = input.resultText === null ? null : headingSlugs(input.resultText);
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

  return {
    taskDir: input.taskDir,
    plan: readPlanStatus(input.planText),
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
    structure: { reliable: validated.reliable && coverageDiagnostics.length === 0, diagnostics: [...validated.diagnostics, ...coverageDiagnostics] },
    currentState: input.resultText === null ? null : currentStateBlock(input.resultText),
  };
}

export interface ResultSize {
  readonly bytes: number;
  readonly kb: number;
  readonly over: boolean;
}

export function resultSize(text: string, maxKb: number): ResultSize {
  const bytes = Buffer.byteLength(text, "utf8");
  return { bytes, kb: bytes / 1024, over: bytes > maxKb * 1024 };
}

export type KeepRule =
  | "current-state"
  | "decision-log"
  | "acceptance"
  | "health-boundary"
  | "live-verification"
  | "reconciliation"
  | "compacted"
  | "pause";

export interface ResultSection {
  readonly heading: string;
  readonly anchor: string | null;
}

export interface KeptSection extends ResultSection {
  readonly rule: KeepRule;
}

export interface CompactionSections {
  readonly keep: readonly KeptSection[];
  readonly removable: readonly ResultSection[];
}

const KEEP_SECTIONS: readonly { readonly rule: KeepRule; readonly match: RegExp }[] = [
  { rule: "current-state", match: CURRENT_STATE_TITLE },
  { rule: "decision-log", match: /^decision log\b/i },
  { rule: "acceptance", match: /^acceptance\b/i },
  { rule: "health-boundary", match: /^health boundar(?:y|ies)\b/i },
  { rule: "live-verification", match: /^live verification\b/i },
  { rule: "reconciliation", match: /^reconciliation\b/i },
  { rule: "compacted", match: COMPACTED_HEADING },
];

interface DraftSection {
  readonly heading: string;
  readonly anchor: string | null;
  rule: KeepRule | null;
  pause: string | null;
}

function pauseKind(text: string, field: "heading" | "label"): string | null {
  return PAUSE_KINDS.find((kind) => kind[field].test(text))?.status ?? null;
}

export function compactionSections(resultText: string, planStatus: string | null): CompactionSections {
  const allocate = slugAllocator();
  const sections: DraftSection[] = [];
  let current: DraftSection | null = null;
  for (const line of liveLines(resultText)) {
    const heading = headingText(line);
    if (heading !== null) {
      const anchor = allocate(heading);
      const level = line.match(HEADING_LEVEL)?.[1].length ?? 0;
      if (level < 2) current = null;
      if (level !== 2) continue;
      current = {
        heading,
        anchor,
        rule: KEEP_SECTIONS.find((candidate) => candidate.match.test(heading))?.rule ?? null,
        pause: pauseKind(heading, "heading"),
      };
      sections.push(current);
      continue;
    }
    if (current !== null && current.pause === null) current.pause = pauseKind(line, "label");
  }

  const reconciliations = sections.filter((section) => section.rule === "reconciliation");
  for (const superseded of reconciliations.slice(0, -1)) superseded.rule = null;

  if (planStatus !== null) {
    const pauses = sections.filter((section) => section.pause === planStatus && section.rule === null);
    const active = pauses[pauses.length - 1];
    if (active !== undefined) active.rule = "pause";
  }

  return {
    keep: sections
      .filter((section) => section.rule !== null)
      .map((section) => ({ heading: section.heading, anchor: section.anchor, rule: section.rule as KeepRule })),
    removable: sections
      .filter((section) => section.rule === null)
      .map((section) => ({ heading: section.heading, anchor: section.anchor })),
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

export interface CompactionPlan {
  readonly taskDir: string;
  readonly resultFile: string;
  readonly bytes: number;
  readonly maxKb: number;
  readonly due: boolean;
  readonly keep: readonly KeptSection[];
  readonly removable: readonly ResultSection[];
  readonly resultSha256: string;
  readonly planStatus: string | null;
}

function compactionPlan(taskDir: string): CompactionPlan {
  const { fd, content } = readCompactionResult(taskDir);
  closeSync(fd);
  const resultText = content.toString("utf8");
  const planText = readOptional(join(taskDir, PLAN_FILE));
  const planStatus = planText === null ? null : readPlanStatus(planText).status;
  const size = resultSize(resultText, RESULT_MAX_KB);
  const sections = compactionSections(resultText, planStatus);
  return {
    taskDir,
    resultFile: RESULT_FILE,
    bytes: size.bytes,
    maxKb: RESULT_MAX_KB,
    due: size.over,
    keep: sections.keep,
    removable: sections.removable,
    resultSha256: createHash("sha256").update(content).digest("hex"),
    planStatus,
  };
}

export interface CompactionSnapshot {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

function reason(err: unknown): string {
  return (err as NodeJS.ErrnoException).code ?? (err as Error).message;
}

function readCompactionResult(taskDir: string): { fd: number; content: Buffer; source: Stats } {
  let fd: number | undefined;
  try {
    fd = openSync(join(taskDir, RESULT_FILE), constants.O_RDONLY | constants.O_NOFOLLOW);
    const content = readFileSync(fd);
    const source = fstatSync(fd);
    return { fd, content, source };
  } catch (err) {
    if (fd !== undefined) closeSync(fd);
    throw new Exit(1, `${taskDir} has no readable ${RESULT_FILE}: ${reason(err)}`);
  }
}

function readExisting(path: string, source: Stats, afterRead?: () => void): Buffer | null {
  let fd: number | undefined;
  try {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (stat === undefined) return null;
    if (!stat.isFile()) throw new Exit(2, `snapshot ${path} is not a regular file; left unchanged.`);
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(fd);
    if (opened.dev === source.dev && opened.ino === source.ino) throw new Exit(2, `snapshot ${path} is the same file as ${RESULT_FILE}; left unchanged.`);
    const content = readFileSync(fd);
    afterRead?.();
    const current = lstatSync(path);
    if (current.dev !== opened.dev || current.ino !== opened.ino) throw new Exit(2, `snapshot ${path} was replaced; snapshot is not accepted; entries left unchanged.`);
    return content;
  } catch (err) {
    if (err instanceof Exit) throw err;
    throw new Exit(2, `cannot read snapshot ${path}: ${reason(err)}`);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function publish(temp: string, path: string): boolean {
  try {
    linkSync(temp, path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw err;
  }
}

export function compactionSnapshot(taskDir: string, options: { beforePublish?: () => void; afterFinalRead?: () => void } = {}): CompactionSnapshot {
  const resultPath = join(taskDir, RESULT_FILE);
  const { fd, content, source } = readCompactionResult(taskDir);
  try {
    const sha256 = createHash("sha256").update(content).digest("hex");
    const dir = join(homedir(), ...SNAPSHOT_DIR);
    const path = join(dir, `${basename(taskDir)}-${sha256.slice(0, SNAPSHOT_HASH_DIGITS)}.md`);
    let existing = readExisting(path, source);
    if (existing === null) {
      const temp = join(dir, `.${randomUUID()}.tmp`);
      let published: boolean;
      try {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
        writeFileSync(temp, content, { mode: 0o600, flag: "wx" });
        options.beforePublish?.();
        published = publish(temp, path);
      } catch (err) {
        throw new Exit(2, `cannot write snapshot ${path}: ${reason(err)}`);
      } finally {
        rmSync(temp, { force: true });
      }
      if (!published) existing = readExisting(path, source);
    }
    if (existing !== null && !existing.equals(content)) throw new Exit(2, `snapshot ${path} already holds other bytes; left unchanged.`);
    const written = readExisting(path, source, options.afterFinalRead);
    if (written === null || !written.equals(content)) throw new Exit(2, `snapshot ${path} does not match ${RESULT_FILE} on re-read.`);
    let current: Stats;
    try {
      current = lstatSync(resultPath);
    } catch (err) {
      throw new Exit(2, `cannot confirm ${resultPath} identity for snapshot ${path}: ${reason(err)}`);
    }
    if (current.dev !== source.dev || current.ino !== source.ino) throw new Exit(2, `${resultPath} was replaced; snapshot ${path} is not accepted; entries left unchanged.`);
    return { path, bytes: content.length, sha256 };
  } finally {
    closeSync(fd);
  }
}

function main(): void {
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EPIPE" && err.code !== "ENOTCONN") throw err;
  });

  const args = process.argv.slice(2);
  const compacting = args[0] === COMPACTION_FLAG;
  const snapshotting = args[0] === SNAPSHOT_FLAG;
  const repairing = args[0] === REPAIR_FLAG;
  const positional = compacting || snapshotting || repairing ? args.slice(1) : args;
  if (positional.length !== 1) throw new Exit(2, USAGE);
  const taskDir = resolve(positional[0]);

  if (repairing) {
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
    });
    const unresolved = [...repaired.report.unresolved];
    for (const issue of state?.structure.diagnostics ?? []) {
      if (!unresolved.some((existing) => sameDiagnostic(existing, issue))) unresolved.push(issue);
    }
    process.stdout.write(JSON.stringify({ ...repaired.report, unresolved, state }) + "\n");
    if (repaired.failed) process.exitCode = 2;
    else if (unresolved.length > 0) process.exitCode = 1;
  } else if (compacting) {
    process.stdout.write(JSON.stringify(compactionPlan(taskDir)) + "\n");
  } else if (snapshotting) {
    process.stdout.write(JSON.stringify(compactionSnapshot(taskDir)) + "\n");
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
