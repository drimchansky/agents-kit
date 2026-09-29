import { holdsRoleFile } from "./lifecycle-constants.ts";

export interface GoalDefinition {
  readonly id: string;
  readonly line: number;
  readonly text: string;
}

export interface GoalReference {
  readonly id: string;
  readonly file: string;
  readonly line: number;
  readonly start: number;
  readonly end: number;
  readonly linkedScope: "outside" | "ambiguous" | null;
}

export interface StructureDiagnostic {
  readonly code: "missing-goals-file" | "malformed-goal-id" | "duplicate-goal-id" | "unknown-goal-reference" | "retired-goal-reference" | "blocked-goal-remap" | "malformed-goal-reference" | "outside-goal-reference" | "ambiguous-goal-reference" | "missing-result-anchor" | "incomplete-reference-scan" | "orphan-step" | "missing-goal-partition" | "conflicting-goal-partition";
  readonly file: string;
  readonly line: number;
  readonly detail: string;
}

export interface GoalDefinitions {
  readonly definitions: readonly GoalDefinition[];
  readonly retired: readonly GoalDefinition[];
  readonly diagnostics: readonly StructureDiagnostic[];
}

export interface StructureReport {
  readonly reliable: boolean;
  readonly diagnostics: readonly StructureDiagnostic[];
}

const HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*$/;
const GOALS_HEADING = /^##[ \t]+Goals\b/;
const DEFINITION_HEADING = /^##[ \t]+(?:Goals|Retired)\b/;
const FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*(.*)$/;
const GOAL_BULLET = /^[-*+][ \t]+(\S+)/;
const GOAL_ID = /^G\d+$/;
const GOAL_TOKEN = /(?<![\p{L}\p{N}_/.-])G\d+[A-Za-z]*(?![\p{L}\p{N}_/-]|\.[\p{L}\p{N}_-])/gu;
const BOUNDED_GOAL_TOKEN = /(?<![\p{L}\p{N}])G\d+[A-Za-z]*(?![\p{L}\p{N}])/gu;
const DEFINITION_PREFIX = /^[ \t]{0,3}\[[^\]]+\]:/;
const REFERENCE_DEFINITION = /^[ \t]{0,3}\[([^\]^][^\]]*)\]:[ \t]*(?:(?:<([^>]+)>|(\S+))[ \t]*(?:"[^"]*"|'[^']*'|\([^)]*\))?[ \t]*)?$/;
const DEFINITION_CONTINUATION = /^[ \t]*(?:<([^>]+)>|(\S+))[ \t]*(?:"[^"]*"|'[^']*'|\([^)]*\))?[ \t]*$/;
const BLOCKQUOTE = /^[ \t]*>/;
const STATUS_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Status\b[^:*\n]*:?\*\*/i;
const TICKET_FILE = "ticket.md";
const LIST_START = /^[ \t]*(?:[-*+]|1[.)])[ \t]/;
const THEMATIC_BREAK = /^[ \t]*(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
export const SCOPE_HEADING = /^##[ \t]+Scope\b/;
export const GOAL_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Goal:?\*\*:?[ \t]*(.*)$/i;
const COMPACTED_HEADING = /^#{1,6}[ \t]+Compacted\b/;
const TOMBSTONE_BULLET = /^[ \t]*-[ \t]/;

function classifyTarget(file: string, rawTarget: string, nestedTasks: readonly string[]): "outside" | "ambiguous" | null {
  let target = rawTarget.trim().replace(/^<|>$/g, "");
  try { target = decodeURIComponent(target); }
  catch { return "ambiguous"; }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target) || target.startsWith("/")) return "outside";
  if (!target || target.includes("#") || target.includes("?") || /[\s()]/.test(target)) return "ambiguous";
  const parts = [...file.split("/").slice(0, -1), ...target.split("/")];
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (resolved.length === 0) return "outside";
      resolved.pop();
    } else resolved.push(part);
  }
  const path = resolved.join("/");
  return nestedTasks.some((dir) => path === dir || path.startsWith(`${dir}/`)) ? "outside" : null;
}

function referenceKey(label: string): string {
  return label.trim().replace(/[ \t]+/g, " ").toLowerCase();
}

function bracketAt(line: string, index: number, bracket: "[" | "]"): boolean {
  if (line[index] !== bracket) return false;
  let backslashes = 0;
  while (line[index - 1 - backslashes] === "\\") backslashes++;
  return backslashes % 2 === 0;
}

function nextBracket(line: string, bracket: "[" | "]", from: number): number {
  for (let index = line.indexOf(bracket, from); index !== -1; index = line.indexOf(bracket, index + 1)) {
    if (bracketAt(line, index, bracket)) return index;
  }
  return -1;
}

function enclosingLabels(line: string, start: number, end: number): { labels: [number, number][]; unclosed: boolean } {
  const labels: [number, number][] = [];
  let left = start;
  let right = end;
  for (;;) {
    let open = -1;
    for (let index = left - 1, depth = 0; index >= 0; index--) {
      if (bracketAt(line, index, "]")) depth++;
      else if (bracketAt(line, index, "[") && depth-- === 0) { open = index; break; }
    }
    if (open === -1) return { labels, unclosed: false };
    let close = -1;
    for (let index = right, depth = 0; index < line.length; index++) {
      if (bracketAt(line, index, "[")) depth++;
      else if (bracketAt(line, index, "]") && depth-- === 0) { close = index; break; }
    }
    if (close === -1) return { labels, unclosed: true };
    labels.push([open, close]);
    left = open;
    right = close + 1;
  }
}

function linkedScope(
  file: string,
  line: string,
  start: number,
  end: number,
  definitions: ReadonlyMap<string, string | null>,
  nestedTasks: readonly string[],
): "outside" | "ambiguous" | null {
  const enclosing = enclosingLabels(line, start, end);
  for (const [open, close] of enclosing.labels) {
    const scope = labelScope(file, line, open, close, definitions, nestedTasks);
    if (scope !== undefined) return scope;
  }
  return enclosing.unclosed ? "ambiguous" : null;
}

function labelScope(
  file: string,
  line: string,
  open: number,
  close: number,
  definitions: ReadonlyMap<string, string | null>,
  nestedTasks: readonly string[],
): "outside" | "ambiguous" | null | undefined {
  if (line[close + 1] === "[") {
    const labelEnd = nextBracket(line, "]", close + 2);
    if (labelEnd === -1) return "ambiguous";
    const label = line.slice(close + 2, labelEnd) || line.slice(open + 1, close);
    const target = definitions.get(referenceKey(label));
    if (target == null) return "ambiguous";
    return classifyTarget(file, target, nestedTasks) === "outside" ? "outside" : "ambiguous";
  }
  if (line[close + 1] !== "(") {
    const key = referenceKey(line.slice(open + 1, close));
    if (!definitions.has(key)) return undefined;
    const target = definitions.get(key);
    return target == null ? "ambiguous" : classifyTarget(file, target, nestedTasks) === "outside" ? "outside" : "ambiguous";
  }
  const targetEnd = line.indexOf(")", close + 2);
  return targetEnd === -1 ? "ambiguous" : classifyTarget(file, line.slice(close + 2, targetEnd), nestedTasks);
}

interface LiveLine {
  readonly text: string;
  readonly number: number;
  readonly offset: number;
  readonly live: boolean;
}

export function* markdownLines(text: string): Generator<LiveLine> {
  let fence: { indent: number; char: string; length: number } | null = null;
  let offset = 0;
  for (const [index, line] of text.split("\n").entries()) {
    const content = line.replace(/\r$/, "");
    const marker = content.match(FENCE);
    if (marker) {
      const [, pad, run, rest] = marker;
      if (!fence) fence = { indent: pad.length, char: run[0], length: run.length };
      else if (pad.length <= fence.indent && run[0] === fence.char && run.length >= fence.length && rest === "") fence = null;
      yield { text: content, number: index + 1, offset, live: false };
    } else {
      yield { text: content, number: index + 1, offset, live: fence === null };
    }
    offset += line.length + 1;
  }
}

export function carriesStatusHeader(text: string): boolean {
  for (const line of markdownLines(text)) {
    if (!line.live || BLOCKQUOTE.test(line.text)) continue;
    if (HEADING.test(line.text)) {
      if (line.text.startsWith("##")) return false;
      continue;
    }
    if (STATUS_FIELD.test(line.text)) return true;
  }
  return false;
}

function authoredElsewhere(file: string, text: string): boolean {
  return file === TICKET_FILE || (!file.includes("/") && !holdsRoleFile([file]) && carriesStatusHeader(text));
}

export function anchorLines(text: string): Set<number> {
  const lines = new Set<number>();
  let compacted = false;
  for (const line of markdownLines(text)) {
    if (!line.live) continue;
    if (HEADING.test(line.text)) {
      compacted = COMPACTED_HEADING.test(line.text);
      lines.add(line.number);
    } else if (compacted && TOMBSTONE_BULLET.test(line.text)) lines.add(line.number);
  }
  return lines;
}

export function fieldGoalTokens(planText: string): { id: string; line: number; start: number }[] {
  const tokens: { id: string; line: number; start: number }[] = [];
  let inScope = false;
  for (const line of markdownLines(planText)) {
    if (!line.live) continue;
    if (HEADING.test(line.text)) {
      inScope = SCOPE_HEADING.test(line.text);
      continue;
    }
    if (!inScope && !GOAL_FIELD.test(line.text)) continue;
    for (const match of line.text.matchAll(BOUNDED_GOAL_TOKEN)) tokens.push({ id: match[0], line: line.number, start: line.offset + match.index });
  }
  return tokens;
}

export function indentedBlockLines(text: string): Set<number> {
  const lines = new Set<number>();
  let previousBlank = true;
  for (const line of markdownLines(text)) {
    const blank = line.text.trim() === "";
    if (line.live && !blank && /^(?: {4}| {0,3}\t)/.test(line.text) && (previousBlank || lines.has(line.number - 1))) lines.add(line.number);
    previousBlank = blank;
  }
  return lines;
}

function opensBlock(line: string): boolean {
  return HEADING.test(line) || LIST_START.test(line) || THEMATIC_BREAK.test(line);
}

interface InlineState {
  previous: number;
  inComment: boolean;
  code: number;
  quote: string | null;
}

function inlineState(): InlineState {
  return { previous: 0, inComment: false, code: 0, quote: null };
}

function continuesParagraph(line: LiveLine, previous: number): boolean {
  return line.number === previous + 1 && line.text.trim() !== "" && !opensBlock(line.text);
}

function* unquotedLines(text: string): Generator<LiveLine> {
  let quoted = false;
  const state = inlineState();
  for (const line of markdownLines(text)) {
    if (!line.live) { quoted = false; continue; }
    if (!state.inComment) {
      if (BLOCKQUOTE.test(line.text)) { quoted = true; continue; }
      if (quoted && line.text.trim() !== "" && !opensBlock(line.text)) continue;
    }
    quoted = false;
    maskComments(line, state, false);
    yield line;
  }
}

export function parseGoalDefinitions(text: string): GoalDefinitions {
  const definitions: GoalDefinition[] = [];
  const retired: GoalDefinition[] = [];
  const diagnostics: StructureDiagnostic[] = [];
  const seen = new Set<string>();
  let section: GoalDefinition[] | null = null;
  const state = inlineState();
  for (const line of markdownLines(text)) {
    if (!line.live) continue;
    const visible = maskComments(line, state, false).join("");
    const heading = visible.match(HEADING);
    if (heading) {
      section = GOALS_HEADING.test(visible) ? definitions : DEFINITION_HEADING.test(visible) ? retired : null;
      continue;
    }
    if (section === null) continue;
    const id = visible.match(GOAL_BULLET)?.[1];
    if (id === undefined) continue;
    if (!GOAL_ID.test(id)) {
      diagnostics.push({ code: "malformed-goal-id", file: "goals.md", line: line.number, detail: line.text });
      continue;
    }
    if (seen.has(id)) diagnostics.push({ code: "duplicate-goal-id", file: "goals.md", line: line.number, detail: id });
    seen.add(id);
    section.push({ id, line: line.number, text: line.text });
  }
  return { definitions, retired, diagnostics };
}

function maskComments(source: LiveLine, state: InlineState, maskCode: boolean): string[] {
  const line = source.text;
  if (!continuesParagraph(source, state.previous)) {
    state.code = 0;
    state.quote = null;
  }
  state.previous = source.number;
  const chars = line.split("");
  const blank = (start: number, end: number): void => {
    for (let index = start; index < end; index++) chars[index] = " ";
  };
  for (let index = 0; index < line.length; index++) {
    if (state.inComment) {
      const end = line.indexOf("-->", index);
      if (end === -1) { blank(index, line.length); break; }
      blank(index, end + 3);
      index = end + 2;
      state.inComment = false;
      continue;
    }
    if (state.code !== 0) {
      if (line[index] === "`") {
        let length = 1;
        while (line[index + length] === "`") length++;
        if (length === state.code) state.code = 0;
        index += length - 1;
      }
      continue;
    }
    if (state.quote !== null) {
      if (closesQuotation(line, index, state.quote)) state.quote = null;
      continue;
    }
    if (line.startsWith("<!--", index)) {
      const end = line.indexOf("-->", index + 4);
      if (end === -1) { blank(index, line.length); state.inComment = true; break; }
      blank(index, end + 3);
      index = end + 2;
      continue;
    }
    if (line[index] === "`") {
      let length = 1;
      while (line[index + length] === "`") length++;
      const close = line.indexOf("`".repeat(length), index + length);
      if (close !== -1) {
        if (maskCode) blank(index, close + length);
        index = close + length - 1;
      } else {
        state.code = length;
        index += length - 1;
      }
      continue;
    }
    const quote = quotationClose(line, line, index);
    if (quote !== null) {
      let end = index + 1;
      while (end < line.length && !closesQuotation(line, end, quote)) end++;
      if (end < line.length) index = end;
      else state.quote = quote;
    }
  }
  return chars;
}

function visibleText(line: LiveLine, state: InlineState): { text: string; markup: string } {
  const chars = maskComments(line, state, true);
  const blank = (start: number, end: number): void => {
    for (let index = start; index < end; index++) chars[index] = " ";
  };
  const masked = chars.join("");
  for (const match of masked.matchAll(/\]\((?:<[^>\n]*>|(?:[^()\\\n]|\\.|\((?:[^()\\\n]|\\.)*\))*|[^)\n]*)\)|\b[A-Za-z][A-Za-z0-9+.-]*:[^\s)>]+/gu)) {
    blank(match.index, match.index + match[0].length);
  }
  for (let index = 0; index < masked.length; index++) {
    const close = quotationClose(line.text, masked, index);
    if (close === null) continue;
    for (let end = index + 1; end < masked.length; end++) {
      if (closesQuotation(masked, end, close)) {
        blank(index, end + 1);
        index = end;
        break;
      }
    }
  }
  return { text: chars.join(""), markup: masked };
}

function quotationClose(line: string, text: string, index: number): string | null {
  const before = line[index - 1] ?? " ";
  if (text[index] === "“") return "”";
  if (text[index] === "\"") return /[\p{L}\p{N}]/u.test(before) ? null : "\"";
  if (text[index] === "'" || text[index] === "‘") {
    if (text[index] === "'" && /^'\d{2}s\b/.test(text.slice(index))) return null;
    return /[\s([{"“]/u.test(before) ? (text[index] === "'" ? "'" : "’") : null;
  }
  return null;
}

function closesQuotation(text: string, index: number, close: string): boolean {
  if (text[index] !== close) return false;
  return close === "”" || close === "\"" || !/[\p{L}\p{N}]/u.test(text[index + 1] ?? "");
}

function opensSpanBefore(line: string, searchable: string, end: number): boolean {
  for (let index = 0; index < end; index++) {
    if (searchable[index] === "`" || quotationClose(line, searchable, index) !== null) return true;
  }
  return false;
}

function referenceDefinitions(text: string): { definitions: Map<string, string | null>; lines: Set<number> } {
  const definitions = new Map<string, string | null>();
  const lines = new Set<number>();
  const define = (key: string, target: string | null): void => {
    definitions.set(key, definitions.has(key) ? null : target);
  };
  const state = inlineState();
  let pending: { key: string; number: number } | null = null;
  for (const line of unquotedLines(text)) {
    const inSpan = continuesParagraph(line, state.previous) && (state.code !== 0 || state.quote !== null);
    const visible = visibleText(line, state);
    if (pending !== null) {
      const continuation = line.number === pending.number + 1 ? line.text.match(DEFINITION_CONTINUATION) : null;
      define(pending.key, continuation ? continuation[1] ?? continuation[2] : null);
      pending = null;
      if (continuation) {
        lines.add(line.number);
        continue;
      }
    }
    if (inSpan || !DEFINITION_PREFIX.test(visible.text)) continue;
    const definition = line.text.match(REFERENCE_DEFINITION);
    if (!definition) continue;
    lines.add(line.number);
    if (definition[2] === undefined && definition[3] === undefined) pending = { key: referenceKey(definition[1]), number: line.number };
    else define(referenceKey(definition[1]), definition[2] ?? definition[3]);
  }
  if (pending !== null) define(pending.key, null);
  return { definitions, lines };
}

export function scanGoalReferences(file: string, text: string, nestedTasks: readonly string[] = []): GoalReference[] {
  const references: GoalReference[] = [];
  const { definitions } = referenceDefinitions(text);
  for (const { line, searchable, carriedUntil, openers } of searchableLines(file, text)) {
    for (const match of searchable.matchAll(GOAL_TOKEN)) {
      const scope = linkedScope(file, line.text, match.index, match.index + match[0].length, definitions, nestedTasks);
      const inSpan = match.index < carriedUntil || opensSpanBefore(line.text, openers, match.index);
      references.push({
        id: match[0], file, line: line.number,
        start: line.offset + match.index, end: line.offset + match.index + match[0].length,
        linkedScope: scope ?? (inSpan ? "ambiguous" : null),
      });
    }
  }
  return references;
}

function* searchableLines(file: string, text: string): Generator<{ line: LiveLine; searchable: string; carriedUntil: number; openers: string }> {
  const definitionLines = referenceDefinitions(text).lines;
  const state = inlineState();
  let inDefinitions = false;
  let previous = 0;
  let brackets = 0;
  let code = 0;
  let quote: string | null = null;
  for (const line of unquotedLines(text)) {
    if (line.number !== previous + 1 || line.text.trim() === "" || opensBlock(line.text)) {
      brackets = 0;
      code = 0;
      quote = null;
    }
    previous = line.number;
    const visible = visibleText(line, state);
    if (definitionLines.has(line.number)) continue;
    if (file === "goals.md" && HEADING.test(visible.text)) inDefinitions = DEFINITION_HEADING.test(visible.text);
    let searchable = visible.text;
    if (file === "goals.md" && inDefinitions) {
      const definition = searchable.match(GOAL_BULLET);
      if (definition) searchable = " ".repeat(definition[0].length) + searchable.slice(definition[0].length);
    }
    let bracketsClose: number | null = brackets > 0 ? null : 0;
    for (let index = 0; index < visible.markup.length; index++) {
      if (bracketAt(visible.markup, index, "[")) brackets++;
      else if (bracketAt(visible.markup, index, "]") && brackets > 0 && --brackets === 0) bracketsClose ??= index + 1;
    }
    const runs = [...visible.text.matchAll(/`+/g)];
    let carriedCode = code !== 0;
    let codeClose = carriedCode ? line.text.length : 0;
    for (const run of runs) {
      if (code === 0) code = run[0].length;
      else if (run[0].length === code) {
        code = 0;
        if (carriedCode) {
          codeClose = run.index + run[0].length;
          carriedCode = false;
        }
      }
    }
    let quoteClose: number | null = quote === null ? 0 : null;
    for (let index = 0; index < visible.text.length; index++) {
      if (quote !== null) {
        if (closesQuotation(visible.text, index, quote)) {
          quote = null;
          quoteClose ??= index + 1;
        }
      } else quote = quotationClose(line.text, visible.text, index);
    }
    const carriedUntil = Math.max(bracketsClose ?? line.text.length, codeClose, quoteClose ?? line.text.length);
    const openers = searchable.split("").fill(" ", 0, codeClose);
    if (quoteClose !== null && quoteClose > 0) openers[quoteClose - 1] = " ";
    yield { line, searchable, carriedUntil, openers: openers.join("") };
  }
}

export function adjacentGoalMentions(file: string, text: string): { id: string; line: number }[] {
  const mentions: { id: string; line: number }[] = [];
  for (const { line, searchable } of searchableLines(file, text)) {
    const scanned = new Set([...searchable.matchAll(GOAL_TOKEN)].map((match) => match.index));
    for (const match of searchable.matchAll(BOUNDED_GOAL_TOKEN)) {
      if (!scanned.has(match.index)) mentions.push({ id: match[0], line: line.number });
    }
  }
  return mentions;
}

export function sameDiagnostic(a: StructureDiagnostic, b: StructureDiagnostic): boolean {
  return a.code === b.code && a.file === b.file && a.line === b.line && a.detail === b.detail;
}

export function validateGoalStructure(
  goalsText: string | null,
  documents: Readonly<Record<string, string>>,
  { missingAnchors = [], unreadableMarkdown = [], nestedTasks = [] }: {
    readonly missingAnchors?: readonly { step: string; line: number }[];
    readonly unreadableMarkdown?: readonly string[];
    readonly nestedTasks?: readonly string[];
  } = {},
): StructureReport {
  const parsed = goalsText === null ? { definitions: [], retired: [], diagnostics: [] } : parseGoalDefinitions(goalsText);
  const diagnostics: StructureDiagnostic[] = [...parsed.diagnostics];
  if (goalsText === null) diagnostics.push({ code: "missing-goals-file", file: "goals.md", line: 0, detail: "goals.md is absent" });
  const known = new Set([...parsed.definitions, ...parsed.retired].map((definition) => definition.id));
  if (goalsText !== null) for (const [file, text] of Object.entries(documents).sort(([a], [b]) => a.localeCompare(b, "en"))) {
    const external = authoredElsewhere(file, text);
    for (const reference of scanGoalReferences(file, text, nestedTasks)) {
      if (reference.linkedScope !== null) diagnostics.push({
        code: reference.linkedScope === "outside" ? "outside-goal-reference" : "ambiguous-goal-reference",
        file, line: reference.line, detail: reference.id,
      });
      if (external) continue;
      if (!GOAL_ID.test(reference.id)) diagnostics.push({ code: "malformed-goal-reference", file, line: reference.line, detail: reference.id });
      else if (!known.has(reference.id)) {
        diagnostics.push({ code: "unknown-goal-reference", file, line: reference.line, detail: reference.id });
      }
    }
  }
  for (const anchor of missingAnchors) {
    diagnostics.push({ code: "missing-result-anchor", file: "plan.md", line: anchor.line, detail: `Step ${anchor.step}` });
  }
  for (const file of unreadableMarkdown) {
    diagnostics.push({ code: "incomplete-reference-scan", file, line: 0, detail: "task-local Markdown could not be read" });
  }
  return { reliable: goalsText !== null && diagnostics.length === 0, diagnostics };
}
