#!/usr/bin/env node
// Reports one task folder's mechanical plan state for the `resume-task` and `review-task` skills:
// checkbox state, the next pending step, checkpoint outcomes, result-anchor resolution, and the
// goal-coverage map. Those skills keep the judgment that reads this report — whether a claim still
// holds, whether a citing step delivers all of its goal — and stop hand-enumerating the facts under it.
// Zero dependencies; runs under Node type stripping — too old a Node fails as a parse error, not a
// version message. Floor in AGENTS.md § The `.ts` sources are unchecked by design.
// Run: node scripts/task-state.ts <task-dir>
//
// Contract: stdout is exactly one JSON object,
// {taskDir,plan,result,goalsFile,steps,nextPendingStep,checkpoints,goalCoverage}, and the exit
// status is 0. `plan` is {file,status,statusRaw}: `status` is a value of the plan lifecycle
// vocabulary, `unknown` for a header the vocabulary does not hold, or null for no status header at
// all. `plan.md` is the task's only lifecycle home, so `result` carries no status of its own: it is
// {file,legacyStatus}, where `legacyStatus` is the pre-contract `**Status:**` header a result file
// may still hold (references/workflow/task-lifecycle.md § `result.md` — no status field), reported
// verbatim for inspection, acted on by nothing, and null on a conformant file. `result` is null when
// the folder has no `result.md`, and `goalsFile` is null when it has no `goals.md` — which empties
// every coverage list rather than reporting the plan's own citations as unknown IDs.
//
// `steps` follows plan order: {number,title,checked,anchor,anchorResolves,goals,goalEscape,dependsOn}.
// `number` is the plan's own step token, so a revision-inserted `Step 3a` reports as "3a". `checked`
// reads the step's first checkbox line — its `**What:**` marker. `anchor` is the anchor of the
// `([result](…))` link on that same line, null when it carries none; `anchorResolves` is null for an
// unchecked step, which claims nothing, and a boolean for a checked one — false when the link is
// missing, points outside `result.md`, or names a heading `result.md` does not hold, counting a
// tombstone under its `## Compacted` stub as held. `goalEscape` marks the `**Goal:** none
// (infra/refactor)` escape, which is what separates a deliberate infra step from an orphan.
// `nextPendingStep` is the first unchecked step's number, null when every step is checked.
// `checkpoints` lists every `### Checkpoint after Step N` the plan authors, in plan order, each with
// the `**Outcome:**` token of the matching result section — null when no such section exists, which
// is a checkpoint that has not run.
//
// `goalCoverage` is {goals,uncoveredGoals,orphanSteps,unknownGoalCitations,scopePartition}. `goals`
// maps each `goals.md` ID to the steps whose `**Goal:**` line cites it; `uncoveredGoals` are the IDs
// no step cites — a goal the plan defers is listed there too, and its `deferred` membership below is
// what makes that expected rather than a gap. `orphanSteps` are steps citing no goal and carrying no
// escape; `unknownGoalCitations` are steps citing IDs `goals.md` does not hold, empty when there is
// no `goals.md` to check against. `scopePartition` is {delivered,deferred,missingFromPartition,inBoth}
// over `goals.md`'s IDs, read from the plan's `## Scope`; the partition is total exactly when the
// last two lists are empty.
//
// Warnings go to stderr. Exit status: 0 = a report was written; 1 = nothing to report, because the
// argument names no readable `plan.md`; 2 = the run could not be carried out — bad usage, or an
// unexpected failure. Those three are the convention this script shares with
// `scripts/task-move.ts` and `scripts/pr-comments.ts`: 0 did the job, 1 is an outcome the script
// decided, 2 is a run that never got that far. A crash must not land on 1, which would report a
// readable plan folder as having none.

import { readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAN_VOCAB } from "./lifecycle-constants.ts";

const PLAN_FILE = "plan.md";
const RESULT_FILE = "result.md";
const GOALS_FILE = "goals.md";
const USAGE = "usage: node scripts/task-state.ts <task-dir>";

// Mirrored in scripts/health-check.ts, whose dead-anchor check must agree with this report, and the
// fence and status halves again in scripts/task-move.ts; change the copies together.
const FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*(.*)$/;
const HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*$/;
// references/workflow/reconciliation.md's step-stability rule appends an inserted step as `Step 3a`,
// `3b`, … rather than renumbering, so a step number is a token and never an integer: parsing it as
// one would collapse `3a` onto `3`, and the result anchors and `**Depends on:**` lines that name it
// carry the plan's own spelling.
const STEP_TITLE = /^Step[ \t]+(\d+[a-z]*)\b[ \t]*[—–:-]?[ \t]*(.*)$/i;
const CHECKPOINT_TITLE = /^Checkpoint after Step[ \t]+(\d+[a-z]*)\b/i;
const SCOPE_HEADING = /^##[ \t]+Scope\b/;
const GOALS_HEADING = /^##[ \t]+Goals\b/;
const CHECKBOX = /^[ \t]*-[ \t]+\[([ xX])\]/;
const GOAL_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Goal:?\*\*:?[ \t]*(.*)$/i;
const DEPENDS_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Depends on:?\*\*:?[ \t]*(.*)$/i;
const OUTCOME_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Outcome:?\*\*:?[ \t]*(.*)$/i;
// references/workflow/task-goals.md: a durable goal ID, cited on a step's `**Goal:**` line and
// listed in the plan's `## Scope` partition.
const GOAL_ID = /\bG\d+\b/g;
// references/workflow/task-goals.md: the one escape a step may carry in place of a goal ID, matched
// at its own spelling rather than on the leading word — `**Goal:** none` and `**Goal:** none yet`
// are malformed goal lines, and reading either as the escape drops the step out of `orphanSteps`,
// which is the whole of what review-task reads to find a step delivering nothing.
const GOAL_ESCAPE = /^[ \t]*none[ \t]*\(infra\/refactor\)[ \t]*$/i;
const GOAL_BULLET = /^[-*+][ \t]+(\S+)/;
const GOAL_ID_EXACT = /^G\d+$/;
const STEP_REF = /\bStep[ \t]+(\d+[a-z]*)\b/gi;
const BARE_STEP_REF = /\b(\d+[a-z]*)\b/g;
// implement-task appends the evidence link at the end of the step line, but the step's own prose may
// cite a literal `([result](…))` as an example — so the last match on the line is the link, never the
// first. Read as scripts/health-check.ts reads it, whose dead-anchor check must agree with this
// report: looser here and a step would resolve against a link that check rejects.
const RESULT_LINK = /\(\[result\]\(([^()]*)\)\)/g;
// Compaction removes a result section but leaves its title as a tombstone bullet under a
// `## Compacted` stub (references/workflow/reconciliation-compaction.md § The procedure), so an
// anchor pointing at one is documented state rather than a dead link — again as health-check.ts
// resolves it.
const COMPACTED_HEADING = /^Compacted\b/;
const TOMBSTONE_BULLET = /^[ \t]*-[ \t]+(.+?)[ \t]*$/;
// The status spellings references/workflow/doc-task-files.md allows, read as scripts/health-check.ts
// and scripts/task-move.ts read them — canonical `**Status:** value`, a parenthetical qualifier,
// colon-inside-bold, unterminated bold. A reader that placed a folder's status differently from the
// health check would report a lifecycle state no other tool agrees with.
const STATUS_PATTERNS = [
  /^\*\*Status\b[^:*\n]*:?\*\*:?[ \t]*(.+)$/im,
  /^\*\*Status\b[^:\n]*:[ \t]*(.+)$/im,
  /^Status:[ \t]*(.+)$/im,
];
// references/workflow/task-goals.md gives the partition as `delivered: … · deferred: …` while
// plan-task's template writes it as `**In scope:**` / `**Out of scope:**` bullets; both spellings
// occur, often on one line ("**In scope:** delivered G1, G2 · <paths>"), so each label owns the span
// from its own end to the next label on that line. Per line, because an unlabeled bullet such as
// `**Boundaries:**` would otherwise inherit the partition of the bullet above it.
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

// Every scan below skips fenced content, because a heading, a checkbox, or a status line inside a
// fence is illustrative markdown rather than the file's own structure — the hazard scripts/health-check.ts
// documents and scripts/task-move.ts repeats. Closing a fence takes the opener's marker at its own
// length or longer, no further indented than the opener, and nothing after it but whitespace, so a
// shorter run, a different marker, a deeper-indented run, or a run carrying an info string is content
// inside an open block: a boolean flag would invert on it and hand back what it skipped. The indent
// test is relative to the opener rather than CommonMark's flat 0–3 columns, because a fence nested in
// a list item is legitimately indented past that and its content still has to be skipped. All three
// readers apply the same rule, because this report's anchor resolution has to agree with the
// dead-anchor check in scripts/health-check.ts.
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

// references/workflow/doc-task-files.md bounds a status header to the file's header block — under the
// `#` title, above the first `##` section — so the scan stops at the first `##`-or-deeper heading and
// a status-shaped body line (a log entry, a quoted example) is never a candidate.
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

// GitHub's heading-anchor rule: lowercase, drop every character that is not a letter, digit, hyphen,
// underscore, or space, then map each space to a hyphen — so an em-dash vanishes and leaves the
// double hyphen the kit's own step anchors carry.
function slugify(heading: string): string {
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-");
}

// A repeated heading takes GitHub's `-1`, `-2`, … suffix, so occurrences are counted rather than
// deduplicated, and allocation walks past every slug already assigned — `Foo`, `Foo-1`, `Foo` yields
// `foo-2` for the third. Tombstone slugs resolve links but reserve nothing, since compaction removed
// the rendered heading behind them.
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

// The column-0 bullet anchor is deliberate, as in scripts/health-check.ts: a goal's indented child
// bullet is prose, and reading it as a goal would invent an ID the plan can never cite.
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

// Every exit path unwinds through this rather than calling process.exit, because stderr is an
// asynchronous stream on a POSIX pipe: exiting immediately after writing the reason can drop it, and
// on a refused run the reason is the whole of what this script reports.
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
    // An unreadable file is reported and then treated as absent, so a permission error on one role
    // file still yields the state the other two carry rather than failing the whole read.
    if (code !== "ENOENT") warnings.push(`unreadable ${path}: ${code ?? (err as Error).message}`);
    return null;
  }
}

function main(): void {
  // stdout is asynchronous on a macOS pipe, so the report is written and the module then ends:
  // calling process.exit after the write would discard whatever the pipe buffer could not take. A
  // reader that closes early then raises EPIPE on a stream nothing awaits, which would surface as
  // exit 1 — the status this contract reserves for having had nothing to report.
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

// Only a direct run reads the filesystem: the pure layer above is what tests import, and reading at
// module scope would put a folder walk behind every import. The entry path goes through realpath
// because Node leaves `process.argv[1]` as it was typed while `import.meta.url` is already resolved,
// so a run through a symlinked path would otherwise look like an import.
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
