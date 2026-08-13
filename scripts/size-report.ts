#!/usr/bin/env node
// Reports the runtime context each skill loads, in bytes and approximate tokens, so a
// contract-slimming change can be measured against a captured baseline.
// Zero dependencies; runs under Node type stripping — too old a Node fails as a parse error, not a
// version message. Floor in AGENTS.md § The `.ts` sources are unchecked by design.
// Run: node scripts/size-report.ts [--skill NAME]... <kit-root>
//
// Two sets per skill. The `direct` set is what the skill itself pulls in: its own SKILL.md plus every
// distinct `./references/<path>.md` and `./AGENTS.md` the file cites, resolved against <kit-root> — the
// installed layout resolves a skill's `./AGENTS.md` to its copy of CORE_RULES.md, so that is the file
// counted, never this repository's maintainer-facing AGENTS.md. A SKILL.md whose Core Rules step cites
// the domain pack as the literal template `./references/<domain>/rules.md` loads a real pack at run
// time, so the direct scan resolves the template against the kit's default pack (`engineering`, the
// default the template's own sentence names) and counts each phase file the same line names in
// backticks (`execution.md`, …) beside it — without this the template's unconditional loads would be
// invisible to the byte totals. The template is counted only in a SKILL.md; a reference file's prose
// mention of `<domain>` stays unexpanded. The `transitive` set is an upper bound:
// the direct set plus, recursively, every `./<path>.md` or `../<path>.md` a counted reference file
// cites, resolved against the citing file's own directory. Cycles terminate and each file is counted
// once per set. Reference files expand; a SKILL.md never does, so a composite skill's sibling-skill
// loads are outside both sets. Citations are matched wherever they appear in the text, fenced examples
// included — the transitive number is a bound, so over-counting is the safe direction. Section anchors
// are ignored: the unit of loading is the file.
//
// approxTokens is round(bytes / 4) — the flat approximation, applied to a set's total bytes rather than
// summed from its per-file values.
//
// Contract: stdout is exactly one JSON object,
// {"root":<absolute kit root, or null>,"skills":[…],"warnings":N,"unresolved":[…]}. Each skill is
// {skill,direct:{files,bytes,approxTokens},transitive:{files,bytes,approxTokens}}, and each `files`
// entry is {path,bytes,approxTokens} with `path` relative to the kit root — direct in citation order,
// transitive in breadth-first order. `unresolved` names every citation that reached no readable file as
// "<citing file> -> <citation>", and a file whose own contents could not be read as
// "<file> -> (contents)", so a byte total is never read as complete coverage while it is
// non-empty. Warnings go to stderr and the exit status is always 0, so a partly unreadable kit still
// parses.

import { lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

// stdout is asynchronous on a macOS pipe, so the report is written and the module then ends: calling
// process.exit after the write would discard whatever the pipe buffer could not take, truncating the
// JSON above 64 KB. A reader that closes early then raises EPIPE on a stream nothing awaits, and
// swallowing that is what keeps the always-zero exit status the contract above promises.
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code !== "EPIPE") throw err;
});

const BYTES_PER_TOKEN = 4;
const CORE_RULES = "CORE_RULES.md";
const AGENTS_CITATION = "./AGENTS.md";
const SKILL_FILE = "SKILL.md";

// What a SKILL.md pulls in at run time. All three forms are rooted at the kit root rather than at the
// skill directory, which is why the direct scan resolves them there and not against the citing file.
const SKILL_CITATION = /\.\/(?:references\/(?:[A-Za-z0-9._/-]+|<domain>\/rules)\.md|AGENTS\.md)/g;
const DOMAIN_TEMPLATE = "./references/<domain>/rules.md";
const DEFAULT_PACK = "references/engineering";
// A phase file named in backticks on the template's own line (`execution.md`, `verification.md`, …).
// Lowercase-only on purpose: the same line names task artifacts like `CONTEXT.md`, which are not pack
// files and must stay uncounted.
const PHASE_FILE = /`([a-z][a-z-]*\.md)`/g;
// What a reference file pulls in: any relative Markdown citation, resolved against its own directory.
const REFERENCE_CITATION = /\.\.?\/[A-Za-z0-9._/-]*\.md/g;

// The task folder's role-named files, plus the two named deliverable roles
// (references/workflow/task-layout.md § One task, one flat folder and references/workflow/doc-task-files.md). A reference
// file cites these to describe the user's task folder, so a citation to one that resolves to nothing is
// not a broken kit citation and reporting it would give every healthy run a permanent false warning.
// The suppression is warning-only: a path that resolves is counted whatever its name.
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

interface SkillReport {
  readonly skill: string;
  readonly direct: MeasuredSet;
  readonly transitive: MeasuredSet;
}

interface Report {
  readonly root: string | null;
  readonly skills: readonly SkillReport[];
  readonly warnings: number;
  readonly unresolved: readonly string[];
}

// `bytes` when the path is a regular file, `error` for every other outcome — which is what the
// callers below branch on, and why the union keeps the two exclusive.
type Measurement =
  | { readonly bytes: number; readonly error?: undefined }
  | { readonly bytes?: undefined; readonly error: string };

const warnings: string[] = [];
// Citations that reached no readable file, in the contract rather than only on stderr: a caller reading
// byte totals alone would take a path whose references it never opened for a fully measured one.
const unresolved: string[] = [];
const unresolvedSeen = new Set<string>();

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

function measure(abs: string): Measurement {
  try {
    const st = statSync(abs);
    return st.isFile() ? { bytes: st.size } : { error: "not a regular file" };
  } catch (err) {
    return { error: err.code === "ENOENT" ? "no such file" : (err.code ?? err.message) };
  }
}

function readText(abs: string, from: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch (err) {
    // Its citations go unread, so everything they would have reached is missing from the closure
    // while its own bytes still count. Recorded in `unresolved`, which is what the contract ties
    // completeness to — a stat-level failure already lands there through `measure`, and only the
    // read-level one, the likelier of the two, escaped.
    noteUnresolved("(contents)", from, err.code ?? err.message);
    return null;
  }
}

function fileEntry(root: string, abs: string, bytes: number): CountedFile {
  return { abs, path: display(root, abs), bytes, approxTokens: approxTokens(bytes) };
}

// `seen` carries the per-set dedup, which is also what terminates citation cycles.
function countCitation(
  citation: string,
  fromDir: string,
  from: string,
  root: string,
  seen: Set<string>,
  files: CountedFile[],
): string | null {
  const abs = citation === AGENTS_CITATION ? join(root, CORE_RULES) : resolve(fromDir, citation);
  if (seen.has(abs)) return null;
  // A citation climbing out of the kit root names something no installed home carries, so it is
  // reported rather than measured: counting it would put a file outside the kit in a kit load path.
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

function directSet(root: string, skill: string): CountedFile[] | null {
  const skillFile = join(root, "skills", skill, SKILL_FILE);
  const from = display(root, skillFile);
  const result = measure(skillFile);
  if (result.error) {
    warnings.push(`skipping ${from}: ${result.error}`);
    return null;
  }
  const seen = new Set([skillFile]);
  const files = [fileEntry(root, skillFile, result.bytes)];
  const text = readText(skillFile, from);
  if (text != null) {
    for (const match of text.matchAll(SKILL_CITATION)) {
      if (match[0] !== DOMAIN_TEMPLATE) {
        countCitation(match[0], root, from, root, seen, files);
        continue;
      }
      countCitation(`./${DEFAULT_PACK}/rules.md`, root, from, root, seen, files);
      const lineStart = text.lastIndexOf("\n", match.index) + 1;
      const lineEnd = text.indexOf("\n", match.index);
      const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
      for (const phase of line.matchAll(PHASE_FILE)) {
        countCitation(`./${DEFAULT_PACK}/${phase[1]}`, root, from, root, seen, files);
      }
    }
  }
  return files;
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
    // Only a genuinely absent SKILL.md marks a non-skill directory. Every other miss — EACCES, a
    // SKILL.md that is itself a directory, a dangling symlink (stat fails while lstat succeeds) —
    // is a skill the report would otherwise omit with no trace, and `unresolved` is what
    // size-check.ts's incomplete-measurement refusal keys on.
    let reason = result.error === "no such file" ? null : result.error;
    if (reason == null) {
      try {
        lstatSync(skillFile);
        reason = "dangling symlink";
      } catch {
        // truly absent — a directory that simply isn't a skill
      }
    }
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
    // A name that matches nothing is reported rather than silently narrowing the report to nothing,
    // so a typo in the filter never reads as a skill that loads no context.
    for (const name of only) {
      if (!available.includes(name)) warnings.push(`no such skill: ${name}`);
    }
    const selected = only.length > 0 ? available.filter((name) => only.includes(name)) : available;
    for (const name of selected) {
      const direct = directSet(root, name);
      if (!direct) continue;
      skills.push({
        skill: name,
        direct: summarize(direct),
        transitive: summarize(transitiveSet(root, direct)),
      });
    }
  }
}

process.stdout.write(JSON.stringify({
  root,
  skills,
  warnings: warnings.length,
  unresolved,
} satisfies Report) + "\n");
for (const warning of warnings) console.error(`[size-report] ${warning}`);
