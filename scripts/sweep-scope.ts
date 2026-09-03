#!/usr/bin/env node
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { holdsRoleFile } from "./lifecycle-constants.ts";
import { compactionSections, taskState } from "./task-state.ts";

const CONTEXT_FILE = "CONTEXT.md";
const PLAN_FILE = "plan.md";
const TICKET_FILE = "ticket.md";
const RESULT_FILE = "result.md";
const LEDGER_FILE = "observations.md";
const DERIVED_ROLE_FILES: ReadonlySet<string> = new Set([LEDGER_FILE]);
const USAGE = "usage: node scripts/sweep-scope.ts <task-dir>";

const FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*(.*)$/;
const HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*$/;
const HEADING_LEVEL = /^(#{1,6})[ \t]/;
const QUOTE = /^[ \t]*>/;
const REFERENCES_HEADING = /^references\b/i;
const OPEN_QUESTIONS_HEADING = /^open questions\b/i;
const CURRENT_STATE_HEADING = /^current state\b/i;
const STEP_HEADING = /^Step[ \t]+\d+[a-z]*\b/i;
const POINTERS_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Pointers:?\*\*/i;
const PUBLISHED_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Published:?\*\*/i;
const STATUS_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Status\b[^:*\n]*:?\*\*/i;
const LEDGER_TAG = /^[ \t]*-[ \t]+\[(info|warn|block)\]/i;
const LINK_TARGET = /\]\([ \t]*<?((?:[^()\s>]|\([^()\s]*\))+)/g;
const BARE_URL = /[A-Za-z][A-Za-z0-9+.-]*:\/\/(?:[^\s<>()[\]"'`]|\([^()\s]*\))+/g;
const URL_SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//;
const TRAILING_NOISE = /[>\].,;:!?]+$/;
const UNFETCHABLE_SCHEMES: ReadonlySet<string> = new Set(["file"]);
const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);

export type Tag = "info" | "warn" | "block";

const TAG_STRENGTH: Readonly<Record<Tag, number>> = { info: 0, warn: 1, block: 2 };

export type Surface =
  | "context-references"
  | "context-open-questions"
  | "plan-step"
  | "plan-open-questions"
  | "ticket-references"
  | "result-pointers"
  | "result-pause"
  | "deliverable-published";

export interface Occurrence {
  readonly surface: Surface;
  readonly file: string;
  readonly section: string | null;
  readonly text: string;
}

export interface Citation {
  readonly url: string;
  readonly tag: Tag | null;
  readonly occurrences: readonly Occurrence[];
}

export interface TaskText {
  readonly context: string | null;
  readonly plan: string | null;
  readonly ticket: string | null;
  readonly result: string | null;
  readonly deliverable: string | null;
  readonly ledger: string | null;
}

export interface SweepScope {
  readonly taskDir: string;
  readonly planStatus: string | null;
  readonly deliverable: string | null;
  readonly deliverableCandidates: readonly string[];
  readonly ledger: string | null;
  readonly citations: readonly Citation[];
}

const warnings: string[] = [];

class Exit extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

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

function fetchable(url: string): boolean {
  const scheme = url.match(URL_SCHEME);
  if (scheme === null) return false;
  if (UNFETCHABLE_SCHEMES.has(scheme[1].toLowerCase())) return false;
  const authority = url.slice(scheme[0].length).split(/[/?#]/)[0];
  const host = (authority.split("@").pop() ?? "").replace(/:\d+$/, "").toLowerCase();
  return !LOCAL_HOSTS.has(host);
}

export function urlsIn(line: string): readonly string[] {
  const found = new Set<string>();
  const candidates = [
    ...[...line.matchAll(LINK_TARGET)].map((match) => match[1]),
    ...[...line.matchAll(BARE_URL)].map((match) => match[0]),
  ];
  for (const candidate of candidates) {
    const url = candidate.replace(TRAILING_NOISE, "");
    if (url !== "" && fetchable(url)) found.add(url);
  }
  return [...found];
}

export function ledgerTags(text: string): ReadonlyMap<string, Tag> {
  const tags = new Map<string, Tag>();
  for (const line of liveLines(text)) {
    const marked = line.match(LEDGER_TAG);
    if (marked === null) continue;
    const tag = marked[1].toLowerCase() as Tag;
    for (const url of urlsIn(line)) {
      const carried = tags.get(url);
      if (carried === undefined || TAG_STRENGTH[tag] > TAG_STRENGTH[carried]) tags.set(url, tag);
    }
  }
  return tags;
}

export function carriesStatusHeader(text: string): boolean {
  for (const line of liveLines(text)) {
    if (QUOTE.test(line)) continue;
    if (headingText(line) !== null) {
      if ((line.match(HEADING_LEVEL)?.[1].length ?? 0) > 1) return false;
      continue;
    }
    if (STATUS_FIELD.test(line)) return true;
  }
  return false;
}

interface Scoped {
  readonly surface: Surface;
  readonly section: string;
  readonly line: string;
}

function* scopedLines(text: string, opens: (heading: string, level: number) => Surface | null): Generator<Scoped> {
  let open: { surface: Surface; section: string; level: number } | null = null;
  for (const line of liveLines(text)) {
    const heading = headingText(line);
    if (heading !== null) {
      const level = line.match(HEADING_LEVEL)?.[1].length ?? 0;
      const surface = opens(heading, level);
      if (surface !== null) open = { surface, section: heading, level };
      else if (open !== null && level <= open.level) open = null;
      continue;
    }
    if (open !== null) yield { surface: open.surface, section: open.section, line };
  }
}

function activePause(resultText: string, planStatus: string | null): string | null {
  return compactionSections(resultText, planStatus).keep.find((section) => section.rule === "pause")?.heading ?? null;
}

function occurrencesIn(file: string, scoped: Iterable<Scoped>): Occurrence[] {
  const found: Occurrence[] = [];
  for (const { surface, section, line } of scoped) {
    if (surface === "result-pointers" && !POINTERS_FIELD.test(line)) continue;
    found.push({ surface, file, section, text: line.trim() });
  }
  return found;
}

function publishedOccurrences(file: string, text: string): Occurrence[] {
  const found: Occurrence[] = [];
  for (const line of liveLines(text)) {
    if (PUBLISHED_FIELD.test(line)) {
      found.push({ surface: "deliverable-published", file, section: null, text: line.trim() });
    }
  }
  return found;
}

function inScopeOccurrences(texts: TaskText, deliverable: string | null, planStatus: string | null): Occurrence[] {
  const found: Occurrence[] = [];
  if (texts.context !== null) {
    found.push(...occurrencesIn(CONTEXT_FILE, scopedLines(texts.context, (heading, level) =>
      level === 2 && REFERENCES_HEADING.test(heading)
        ? "context-references"
        : level === 2 && OPEN_QUESTIONS_HEADING.test(heading)
          ? "context-open-questions"
          : null)));
  }
  if (texts.plan !== null) {
    found.push(...occurrencesIn(PLAN_FILE, scopedLines(texts.plan, (heading, level) =>
      STEP_HEADING.test(heading)
        ? "plan-step"
        : level === 2 && OPEN_QUESTIONS_HEADING.test(heading)
          ? "plan-open-questions"
          : null)));
  }
  if (texts.ticket !== null) {
    found.push(...occurrencesIn(TICKET_FILE, scopedLines(texts.ticket, (heading, level) =>
      level === 2 && REFERENCES_HEADING.test(heading) ? "ticket-references" : null)));
  }
  if (texts.result !== null) {
    const pause = activePause(texts.result, planStatus);
    found.push(...occurrencesIn(RESULT_FILE, scopedLines(texts.result, (heading, level) =>
      level === 2 && CURRENT_STATE_HEADING.test(heading)
        ? "result-pointers"
        : level === 2 && pause !== null && heading === pause
          ? "result-pause"
          : null)));
  }
  if (texts.deliverable !== null && deliverable !== null) {
    found.push(...publishedOccurrences(deliverable, texts.deliverable));
  }
  return found;
}

export function sweepScope(
  taskDir: string,
  texts: TaskText,
  deliverable: string | null,
  deliverableCandidates: readonly string[],
): SweepScope {
  const planStatus =
    texts.plan === null
      ? null
      : taskState({ taskDir, planText: texts.plan, resultText: null, goalsText: null }).plan.status;
  const tags = texts.ledger === null ? new Map<string, Tag>() : ledgerTags(texts.ledger);
  const byUrl = new Map<string, Occurrence[]>();
  for (const occurrence of inScopeOccurrences(texts, deliverable, planStatus)) {
    for (const url of urlsIn(occurrence.text)) {
      const cited = byUrl.get(url);
      if (cited) cited.push(occurrence);
      else byUrl.set(url, [occurrence]);
    }
  }
  return {
    taskDir,
    planStatus,
    deliverable,
    deliverableCandidates: [...deliverableCandidates],
    ledger: texts.ledger === null ? null : LEDGER_FILE,
    citations: [...byUrl].map(([url, occurrences]) => ({ url, tag: tags.get(url) ?? null, occurrences })),
  };
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

function scope(taskDir: string): SweepScope {
  let names: string[];
  try {
    names = readdirSync(taskDir);
  } catch (err) {
    throw new Exit(2, `cannot read ${taskDir}: ${(err as NodeJS.ErrnoException).code ?? (err as Error).message}`);
  }
  if (!holdsRoleFile(names)) throw new Exit(2, `${taskDir} is not a task folder. ${USAGE}`);

  const deliverables = names
    .filter((name) => name.endsWith(".md") && !holdsRoleFile([name]) && !DERIVED_ROLE_FILES.has(name))
    .sort()
    .map((file) => ({ file, text: readOptional(join(taskDir, file)) }))
    .filter((candidate): candidate is { file: string; text: string } =>
      candidate.text !== null && carriesStatusHeader(candidate.text));
  const deliverable = deliverables.length === 1 ? deliverables[0] : null;
  if (deliverables.length > 1) {
    warnings.push(`${deliverables.length} deliverable candidates (${deliverables.map((c) => c.file).join(", ")}); none swept`);
  }

  return sweepScope(
    taskDir,
    {
      context: readOptional(join(taskDir, CONTEXT_FILE)),
      plan: readOptional(join(taskDir, PLAN_FILE)),
      ticket: readOptional(join(taskDir, TICKET_FILE)),
      result: readOptional(join(taskDir, RESULT_FILE)),
      deliverable: deliverable?.text ?? null,
      ledger: readOptional(join(taskDir, LEDGER_FILE)),
    },
    deliverable?.file ?? null,
    deliverables.map((candidate) => candidate.file),
  );
}

function main(): void {
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EPIPE") throw err;
  });

  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Exit(2, USAGE);
  process.stdout.write(JSON.stringify(scope(resolve(args[0]))) + "\n");
  for (const warning of warnings) console.error(`[sweep-scope] ${warning}`);
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
    const exit = err instanceof Exit ? err : new Exit(2, `sweep-scope failed: ${(err as Error).message}`);
    console.error(`[sweep-scope] ${exit.message}`);
    process.exitCode = exit.code;
  }
}
