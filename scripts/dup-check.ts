#!/usr/bin/env node
import { lstatSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { SKILL_FILE, corpusFiles } from "./corpus.ts";

process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code !== "EPIPE") throw err;
});

const MIN_WORDS = 12;
const DEFAULT_ALLOW = ["tests", "dup-allow.json"] as const;
const CORE_RULES_HEADING = "core rules";
const SANCTIONED_COPY = "a sanctioned copy per";
const SENTENCE_EXCERPT = 60;

const FRONTMATTER_OPEN = "---";
const FRONTMATTER_CLOSE = /^(?:-{3,}|\.{3})\s*$/;
const CODE_FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*)$/;
const TRAILING_HASHES = /\s+#+\s*$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;
const BLOCKQUOTE = /^\s*(?:>\s?)+/;
const TABLE_ROW = /^\s*\|/;
const SENTENCE_END = /[.!?;](?=\s|$)/g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const INLINE_LINK = /!?\[([^\]]*)\]\([^()]*\)/g;
const REFERENCE_LINK = /!?\[([^\]]*)\]\[[^\]]*\]/g;
const INLINE_MARKUP = /[`*_~|]/g;
const WORD_CHARACTER = /[a-z0-9]/;

interface SourceLine {
  readonly number: number;
  readonly text: string;
}

interface Block {
  readonly text: string;
  readonly starts: readonly { readonly offset: number; readonly line: number }[];
}

interface Sentence {
  readonly text: string;
  readonly line: number;
}

interface Occurrence {
  readonly file: string;
  readonly line: number;
}

interface Group {
  readonly sentence: string;
  readonly occurrences: readonly Occurrence[];
}

interface AllowEntry {
  readonly sentence: string;
  readonly reason: string;
  readonly files?: readonly string[];
}

interface Allowance {
  readonly key: string;
  readonly entry: AllowEntry;
}

interface Report {
  readonly root: string;
  readonly files: number;
  readonly groups: readonly Group[];
  readonly allowed: number;
  readonly stale: readonly AllowEntry[];
}

class Refused extends Error {}

const skipped: string[] = [];

function refuse(message: string): never {
  throw new Refused(message);
}

const display = (root: string, abs: string): string => relative(root, abs).split(sep).join("/");

const reason = (err: NodeJS.ErrnoException): string => err.code ?? err.message;

function excerpt(sentence: string): string {
  return sentence.length <= SENTENCE_EXCERPT ? sentence : `${sentence.slice(0, SENTENCE_EXCERPT)}…`;
}

function corpusHandlers(root: string) {
  return {
    onSymlink: (abs: string): void => {
      skipped.push(display(root, abs));
    },
    onUnreadable: (abs: string, code: string): never => refuse(`cannot list ${display(root, abs)}: ${code}`),
    onMissing: (): void => {},
  };
}

function blocks(text: string, isSkill: boolean): Block[] {
  const lines = text.split("\n");
  const collected: Block[] = [];
  let current: SourceLine[] = [];

  const flush = (): void => {
    if (current.length === 0) return;
    const starts: { offset: number; line: number }[] = [];
    let joined = "";
    for (const line of current) {
      if (joined.length > 0) joined += " ";
      starts.push({ offset: joined.length, line: line.number });
      joined += line.text;
    }
    collected.push({ text: joined, starts });
    current = [];
  };

  let index = 0;
  if (lines[0] === FRONTMATTER_OPEN) {
    for (let i = 1; i < lines.length; i++) {
      if (!FRONTMATTER_CLOSE.test(lines[i])) continue;
      index = i + 1;
      break;
    }
  }

  let fence: string | null = null;
  let fenceQuoted = false;
  let inCoreRules = false;
  let inQuote = false;
  for (; index < lines.length; index++) {
    const quoted = BLOCKQUOTE.test(lines[index]);
    const raw = quoted ? lines[index].replace(BLOCKQUOTE, "") : lines[index];
    const fenceMatch = CODE_FENCE.exec(raw);
    if (fenceMatch) {
      flush();
      const marker = fenceMatch[1];
      if (fence === null) {
        fence = marker;
        fenceQuoted = quoted;
      } else if (marker[0] === fence[0] && marker.length >= fence.length && fenceMatch[2].trim() === "") {
        fence = null;
      }
      continue;
    }
    if (fence !== null) {
      if (!fenceQuoted || quoted) continue;
      fence = null;
    }

    const heading = HEADING.exec(raw);
    if (heading) {
      flush();
      const level = heading[1].length;
      const title = heading[2].replace(TRAILING_HASHES, "").trim().toLowerCase();
      if (isSkill && level === 2 && title === CORE_RULES_HEADING) inCoreRules = true;
      else if (level <= 2) inCoreRules = false;
      continue;
    }
    if (inCoreRules) continue;
    if (raw.trim() === "") {
      flush();
      inQuote = false;
      continue;
    }
    if (LIST_ITEM.test(raw) || TABLE_ROW.test(raw) || (quoted && !inQuote)) flush();
    inQuote = quoted;
    current.push({ number: index + 1, text: raw.trim() });
  }
  flush();
  return collected;
}

function lineAt(block: Block, offset: number): number {
  let line = block.starts[0].line;
  for (const start of block.starts) {
    if (start.offset > offset) break;
    line = start.line;
  }
  return line;
}

const blanks = (count: number): string => " ".repeat(count);

function blankAround(match: string, text: string): string {
  const lead = match.indexOf("[") + 1;
  return blanks(lead) + text + blanks(match.length - lead - text.length);
}

function blankMarkup(text: string): string {
  return text
    .replace(HTML_COMMENT, (match) => blanks(match.length))
    .replace(INLINE_LINK, blankAround)
    .replace(REFERENCE_LINK, blankAround)
    .replace(INLINE_MARKUP, " ");
}

function sentences(block: Block): Sentence[] {
  const found: Sentence[] = [];
  const take = (offset: number, end: number): void => {
    const raw = block.text.slice(offset, end);
    const lead = raw.length - raw.trimStart().length;
    if (raw.trim() === "") return;
    found.push({ text: raw, line: lineAt(block, offset + lead) });
  };
  let start = 0;
  for (const match of blankMarkup(block.text).matchAll(SENTENCE_END)) {
    take(start, match.index + 1);
    start = match.index + 1;
  }
  take(start, block.text.length);
  return found;
}

function normalize(sentence: string): string {
  return sentence
    .replace(LIST_ITEM, "")
    .replace(HTML_COMMENT, " ")
    .replace(INLINE_LINK, "$1")
    .replace(REFERENCE_LINK, "$1")
    .replace(INLINE_MARKUP, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(normalized: string): number {
  let words = 0;
  for (const token of normalized.split(" ")) {
    if (WORD_CHARACTER.test(token)) words++;
  }
  return words;
}

function occurrencesIn(root: string, files: readonly string[]): Map<string, Occurrence[]> {
  const found = new Map<string, Occurrence[]>();
  for (const abs of files) {
    const file = display(root, abs);
    let text: string;
    try {
      text = readFileSync(abs, "utf8");
    } catch (err) {
      refuse(`cannot read ${file}: ${reason(err)}`);
    }
    for (const block of blocks(text, basename(abs) === SKILL_FILE)) {
      if (block.text.toLowerCase().includes(SANCTIONED_COPY)) continue;
      for (const sentence of sentences(block)) {
        const normalized = normalize(sentence.text);
        if (wordCount(normalized) < MIN_WORDS) continue;
        const list = found.get(normalized);
        if (list) list.push({ file, line: sentence.line });
        else found.set(normalized, [{ file, line: sentence.line }]);
      }
    }
  }
  return found;
}

function allowFiles(value: unknown, path: string, index: number, key: string): string[] {
  const malformed =
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((file) => typeof file !== "string" || file.trim() === "");
  if (malformed) {
    refuse(
      `the allow-file ${path} entry ${index} ("${excerpt(key)}") names files that are not a non-empty array of kit-relative paths`,
    );
  }
  return value as string[];
}

function sameFiles(declared: readonly string[], list: readonly Occurrence[]): boolean {
  const observed = new Set(list.map((entry) => entry.file));
  const expected = new Set(declared);
  return observed.size === expected.size && [...expected].every((file) => observed.has(file));
}

function allowList(path: string): Allowance[] {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return [];
    refuse(`cannot read the allow-file ${path}: ${reason(err)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    refuse(`the allow-file ${path} is not readable as JSON: ${err.message}`);
  }
  if (!Array.isArray(parsed)) {
    refuse(`the allow-file ${path} is not an array of {sentence, reason} entries`);
  }
  return parsed.map((entry, index) => {
    const sentence = typeof entry?.sentence === "string" ? entry.sentence : "";
    const key = normalize(sentence);
    const reason = typeof entry?.reason === "string" ? entry.reason : "";
    if (key === "") refuse(`the allow-file ${path} entry ${index} carries no sentence`);
    if (reason.trim() === "") {
      refuse(`the allow-file ${path} entry ${index} ("${excerpt(key)}") carries no reason`);
    }
    const files = entry.files === undefined ? undefined : allowFiles(entry.files, path, index, key);
    return { key, entry: files === undefined ? { sentence, reason } : { sentence, reason, files } };
  });
}

function parseArgs(argv: readonly string[]): { root: string; allow: string } {
  const roots: string[] = [];
  let allowArg: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--allow" || arg.startsWith("--allow=")) {
      allowArg = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++i];
      if (!allowArg) refuse("--allow needs a file path");
      continue;
    }
    if (arg === "--") continue;
    if (arg.startsWith("-")) refuse(`unknown option ${arg}`);
    roots.push(arg);
  }
  if (roots.length !== 1) refuse("usage: node scripts/dup-check.ts [--allow FILE] <kit-root>");
  const root = resolve(roots[0]);
  let isDir = false;
  try {
    isDir = lstatSync(root).isDirectory();
  } catch (err) {
    refuse(`unreadable kit root ${roots[0]}: ${reason(err)}`);
  }
  if (!isDir) refuse(`not a directory: ${roots[0]}`);
  return { root, allow: allowArg ? resolve(allowArg) : join(root, ...DEFAULT_ALLOW) };
}

function main(): void {
  const { root, allow } = parseArgs(process.argv.slice(2));
  const files = corpusFiles(root, corpusHandlers(root));
  const occurrences = occurrencesIn(root, files);

  const repeated = new Map<string, Occurrence[]>();
  for (const [sentence, list] of occurrences) {
    if (new Set(list.map((entry) => entry.file)).size >= 2) repeated.set(sentence, list);
  }

  const allowances = allowList(allow);
  const byKey = new Map(allowances.map((allowance) => [allowance.key, allowance]));
  const stale = allowances.filter((allowance) => !repeated.has(allowance.key)).map((allowance) => allowance.entry);

  const groups: Group[] = [];
  let suppressed = 0;
  for (const [sentence, list] of repeated) {
    const allowance = byKey.get(sentence);
    if (allowance && (allowance.entry.files === undefined || sameFiles(allowance.entry.files, list))) {
      suppressed++;
      continue;
    }
    groups.push({
      sentence,
      occurrences: [...list].sort((a, b) => a.file.localeCompare(b.file, "en") || a.line - b.line),
    });
  }
  groups.sort(
    (a, b) =>
      b.occurrences.length - a.occurrences.length || a.sentence.localeCompare(b.sentence, "en"),
  );
  stale.sort((a, b) => a.sentence.localeCompare(b.sentence, "en"));

  process.stdout.write(
    JSON.stringify({
      root,
      files: files.length,
      groups,
      allowed: suppressed,
      stale,
    } satisfies Report) + "\n",
  );
  for (const path of skipped) console.error(`[dup-check] skipping symlink ${path}`);
  if (groups.length === 0 && stale.length === 0) return;

  if (groups.length > 0) {
    console.error(
      `[dup-check] ${groups.length} sentence(s) of ${MIN_WORDS}+ words occur in more than one file — ` +
        `collapse each to a citation of its home, or record it in ${allow} with a reason`,
    );
  }
  if (stale.length > 0) {
    console.error(
      `[dup-check] ${stale.length} allow-file entr(ies) no longer occur in two files — ` +
        `drop them from ${allow}`,
    );
  }
  process.exitCode = 1;
}

try {
  main();
} catch (err) {
  if (!(err instanceof Refused)) throw err;
  console.error(`[dup-check] ${err.message}`);
  process.exitCode = 2;
}
