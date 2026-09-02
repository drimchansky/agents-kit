#!/usr/bin/env node
import { lstatSync, readFileSync, readdirSync, statSync, type Stats } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { corpusFiles } from "./corpus.ts";

process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code !== "EPIPE") throw err;
});

const BYTES_PER_TOKEN = 4;
const CORE_RULES = "CORE_RULES.md";
const AGENTS_CITATION = "./AGENTS.md";
const SKILL_FILE = "SKILL.md";
const SKILL_CITATION = /\.\/(?:references\/(?:[A-Za-z0-9._/-]+|<domain>\/rules)\.md|AGENTS\.md)/g;
const DOMAIN_TEMPLATE = "./references/<domain>/rules.md";
const DEFAULT_PACK = "references/engineering";
const PHASE_FILE = /`([a-z][a-z-]*\.md)`/g;
const REFERENCE_CITATION = /\.\.?\/[A-Za-z0-9._/-]*\.md/g;
const COLD_MARKER = /<!--\s*cold\s*-->/;

const TASK_ARTIFACTS = new Set([
  "CONTEXT.md",
  "goals.md",
  "plan.md",
  "result.md",
  "ticket.md",
  "diagram.md",
  "observations.md",
  "adr.md",
  "rfc.md",
]);

interface FileEntry {
  readonly path: string;
  readonly bytes: number;
  readonly approxTokens: number;
}

interface CountedFile extends FileEntry {
  readonly abs: string;
}

interface MeasuredSet {
  readonly files: readonly FileEntry[];
  readonly bytes: number;
  readonly approxTokens: number;
}

interface DirectCitation {
  readonly citation: string;
  readonly cold: boolean;
}

interface DirectClosure {
  readonly files: readonly CountedFile[];
  readonly coldPaths: ReadonlySet<string>;
}

interface SkillReport {
  readonly skill: string;
  readonly hot: MeasuredSet;
  readonly cold: MeasuredSet;
  readonly transitive: MeasuredSet;
}

interface CorpusTotals {
  readonly files: number;
  readonly bytes: number;
  readonly approxTokens: number;
}

interface Report {
  readonly root: string | null;
  readonly skills: readonly SkillReport[];
  readonly corpus: CorpusTotals;
  readonly warnings: number;
  readonly unresolved: readonly string[];
  readonly corpusMisses: readonly string[];
}

type Measurement =
  | { readonly bytes: number; readonly error?: undefined }
  | { readonly bytes?: undefined; readonly error: string };

const warnings: string[] = [];
const unresolved: string[] = [];
const unresolvedSeen = new Set<string>();
const corpusMisses: string[] = [];
const corpusMissesSeen = new Set<string>();
const approxTokens = (bytes: number): number => Math.round(bytes / BYTES_PER_TOKEN);
const display = (root: string, abs: string): string => relative(root, abs).split(sep).join("/");
const withinRoot = (abs: string, root: string): boolean => abs === root || abs.startsWith(root + sep);

function noteUnresolved(citation: string, from: string, reason: string): void {
  const entry = `${from} -> ${citation}`;
  if (unresolvedSeen.has(entry)) return;
  unresolvedSeen.add(entry);
  unresolved.push(entry);
  warnings.push(`unresolved citation in ${from}: ${citation} (${reason})`);
}

function noteCorpusMiss(where: string, reason: string): void {
  const entry = `${where} -> (${reason})`;
  if (corpusMissesSeen.has(entry)) return;
  corpusMissesSeen.add(entry);
  corpusMisses.push(entry);
  warnings.push(`corpus: cannot measure ${where}: ${reason}`);
}

function measure(abs: string): Measurement {
  try {
    const stat = statSync(abs);
    return stat.isFile() ? { bytes: stat.size } : { error: "not a regular file" };
  } catch (err) {
    return { error: err.code === "ENOENT" ? "no such file" : (err.code ?? err.message) };
  }
}

function readText(abs: string, from: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch (err) {
    noteUnresolved("(contents)", from, err.code ?? err.message);
    return null;
  }
}

function fileEntry(root: string, abs: string, bytes: number): CountedFile {
  return { abs, path: display(root, abs), bytes, approxTokens: approxTokens(bytes) };
}

const citationTarget = (citation: string, fromDir: string, root: string): string =>
  citation === AGENTS_CITATION ? join(root, CORE_RULES) : resolve(fromDir, citation);

function countCitation(
  citation: string,
  fromDir: string,
  from: string,
  root: string,
  seen: Set<string>,
  files: CountedFile[],
): string | null {
  const abs = citationTarget(citation, fromDir, root);
  if (seen.has(abs)) return null;

  if (!withinRoot(abs, root)) {
    noteUnresolved(citation, from, "outside the kit root");
    return null;
  }
  const result = measure(abs);
  if (result.error) {
    if (!TASK_ARTIFACTS.has(basename(citation))) noteUnresolved(citation, from, result.error);
    return null;
  }
  seen.add(abs);
  files.push(fileEntry(root, abs, result.bytes));
  return abs;
}

function lineAround(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? text.length : end);
}

function skillCitations(text: string): DirectCitation[] {
  const citations: DirectCitation[] = [];
  for (const match of text.matchAll(SKILL_CITATION)) {
    const line = lineAround(text, match.index);
    const cold = COLD_MARKER.test(line);
    if (match[0] !== DOMAIN_TEMPLATE) {
      citations.push({ citation: match[0], cold });
      continue;
    }
    citations.push({ citation: `./${DEFAULT_PACK}/rules.md`, cold });
    for (const phase of line.matchAll(PHASE_FILE)) {
      citations.push({ citation: `./${DEFAULT_PACK}/${phase[1]}`, cold });
    }
  }
  return citations;
}

function directSet(root: string, skill: string): DirectClosure | null {
  const skillFile = join(root, "skills", skill, SKILL_FILE);
  const from = display(root, skillFile);
  const result = measure(skillFile);
  if (result.error) {
    warnings.push(`skipping ${from}: ${result.error}`);
    return null;
  }
  const seen = new Set([skillFile]);
  const files = [fileEntry(root, skillFile, result.bytes)];

  const gating = new Map<string, boolean>();
  const text = readText(skillFile, from);
  if (text != null) {
    for (const { citation, cold } of skillCitations(text)) {
      countCitation(citation, root, from, root, seen, files);

      const marked = cold && citation !== AGENTS_CITATION;
      const abs = citationTarget(citation, root, root);
      gating.set(abs, marked && (gating.get(abs) ?? true));
    }
  }
  const coldPaths = new Set<string>();
  for (const [abs, isCold] of gating) {
    if (isCold) coldPaths.add(abs);
  }
  return { files, coldPaths };
}

function transitiveSet(root: string, direct: readonly CountedFile[]): CountedFile[] {
  const seen = new Set(direct.map((entry) => entry.abs));
  const files = [...direct];
  const queue = direct.map((entry) => entry.abs);
  while (queue.length > 0) {
    const abs = queue.shift();
    if (basename(abs) === SKILL_FILE) continue;
    const from = display(root, abs);
    const text = readText(abs, from);
    if (text == null) continue;
    for (const match of text.matchAll(REFERENCE_CITATION)) {
      const cited = countCitation(match[0], dirname(abs), from, root, seen, files);
      if (cited) queue.push(cited);
    }
  }
  return files;
}

function summarize(files: readonly CountedFile[]): MeasuredSet {
  const bytes = files.reduce((total, entry) => total + entry.bytes, 0);
  return {
    files: files.map(({ path, bytes: fileBytes, approxTokens: tokens }) => ({
      path,
      bytes: fileBytes,
      approxTokens: tokens,
    })),
    bytes,
    approxTokens: approxTokens(bytes),
  };
}

function isDanglingSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function corpusEntry(root: string, abs: string): Stats | null {
  try {
    return lstatSync(abs);
  } catch (err) {
    noteCorpusMiss(display(root, abs), err.code ?? err.message);
    return null;
  }
}

function corpusSet(root: string): CorpusTotals {
  let files = 0;
  let bytes = 0;

  for (const abs of corpusFiles(root, {
    onSymlink: (abs, kind) =>
      kind === "required"
        ? noteCorpusMiss(display(root, abs), "symlink")
        : warnings.push(`corpus: skipping symlink ${display(root, abs)}`),
    onUnreadable: (abs, code) => noteCorpusMiss(display(root, abs), code === "ENOENT" ? "no such directory" : code),
    onMissing: (abs, reason) => noteCorpusMiss(display(root, abs), reason),
  })) {
    const stat = corpusEntry(root, abs);
    if (stat == null) continue;
    files++;
    bytes += stat.size;
  }

  return { files, bytes, approxTokens: approxTokens(bytes) };
}

function skillNames(root: string): string[] {
  const skillsDir = join(root, "skills");
  let entries;
  try {
    entries = readdirSync(skillsDir, { withFileTypes: true });
  } catch (err) {
    const reason = err.code === "ENOENT" ? "no such directory" : (err.code ?? err.message);
    warnings.push(`cannot list ${display(root, skillsDir)}: ${reason}`);
    return [];
  }
  const names: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = join(skillsDir, entry.name, SKILL_FILE);
    const result = measure(skillFile);
    if (result.bytes != null) {
      names.push(entry.name);
      continue;
    }

    let reason = result.error === "no such file" ? null : result.error;
    if (reason == null && isDanglingSymlink(skillFile)) reason = "dangling symlink";
    if (reason != null) noteUnresolved("(unmeasurable)", display(root, skillFile), reason);
  }
  return names.sort((a, b) => a.localeCompare(b, "en"));
}

function parseArgs(argv: readonly string[]): { roots: string[]; only: string[] } {
  const roots: string[] = [];
  const only: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--skill" || arg.startsWith("--skill=")) {
      const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++i];
      if (value) only.push(value);
      else warnings.push("ignoring --skill with no name");
      continue;
    }
    if (arg === "--") continue;
    if (arg.startsWith("-")) {
      warnings.push(`ignoring unknown option ${arg}`);
      continue;
    }
    roots.push(arg);
  }
  return { roots, only };
}

const { roots, only } = parseArgs(process.argv.slice(2));

let root: string | null = null;
let corpus: CorpusTotals = { files: 0, bytes: 0, approxTokens: 0 };
const skills: SkillReport[] = [];

if (roots.length === 0) {
  warnings.push("no kit root given; usage: node scripts/size-report.ts [--skill NAME]... <kit-root>");
} else {
  for (const extra of roots.slice(1)) warnings.push(`ignoring extra kit root ${extra}`);
  const candidate = resolve(roots[0]);
  let isDir = false;
  try {
    isDir = statSync(candidate).isDirectory();
    if (!isDir) warnings.push(`not a directory: ${roots[0]}`);
  } catch (err) {
    warnings.push(`unreadable kit root ${roots[0]}: ${err.code ?? err.message}`);
  }
  if (isDir) {
    root = candidate;
    const available = skillNames(root);
    corpus = corpusSet(root);

    for (const name of only) {
      if (!available.includes(name)) warnings.push(`no such skill: ${name}`);
    }
    const selected = only.length > 0 ? available.filter((name) => only.includes(name)) : available;
    for (const name of selected) {
      const direct = directSet(root, name);
      if (!direct) continue;
      const { files, coldPaths } = direct;
      skills.push({
        skill: name,
        hot: summarize(files.filter((entry) => !coldPaths.has(entry.abs))),
        cold: summarize(files.filter((entry) => coldPaths.has(entry.abs))),
        transitive: summarize(transitiveSet(root, files)),
      });
    }
  }
}

process.stdout.write(JSON.stringify({
  root,
  skills,
  corpus,
  warnings: warnings.length,
  unresolved,
  corpusMisses,
} satisfies Report) + "\n");
for (const warning of warnings) console.error(`[size-report] ${warning}`);
