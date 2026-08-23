#!/usr/bin/env node
// Performs one guarded task-folder move for the `archive-task` and `backlog-task` skills: the
// location-relative relocation into a sibling `Archive/` or `Backlog/` container defined by
// references/workflow/task-archiving.md and references/workflow/task-backlog.md, with the
// preconditions those files state — a terminal plan to archive, the unstarted entry gate to park.
// Zero dependencies; runs under Node type stripping — too old a Node fails as a parse error, not a
// version message. Floor in AGENTS.md § The `.ts` sources are unchecked by design.
// Run: node scripts/task-move.ts <slug-or-path> --to archive|backlog
//
// Contract: a completed move writes one line to stdout, `moved <src> -> <dest>` with both paths
// absolute, and exits 0. A refused move writes its one-line reason to stderr and exits 1, having
// changed nothing on disk. A run that never got as far as deciding — bad usage, a slug matching no
// folder or several, or an unexpected failure — writes one line to stderr and exits 2. Those three
// statuses are the convention this script shares with `scripts/task-state.ts` and
// `scripts/pr-comments.ts`: 0 did the job, 1 is an outcome the script decided, 2 is a run that could
// not be carried out at all. The exit status carries the outcome
// here rather than always being 0 as in the reporting scripts beside it, because a caller must be
// able to tell a completed move from a refused one without parsing prose. Warnings — an unreadable
// registry is the only one — also go to stderr and change no outcome.
//
// Resolution is deliberately minimal, since the skills own interactive disambiguation: an argument
// holding a path separator is taken verbatim (resolved against the process directory), while a bare
// slug is looked up as `<root>/<slug>` and inside each root's archive and backlog containers, across
// the canonical `<cwd>/.agents/tasks` plus every `taskRoots` entry of ~/.config/agents-kit/config.json
// (references/workflow/task-store.md). `~` is expanded here because this script reads the registry
// itself rather than being handed an already-resolved root. No match, or more than one, exits 2
// asking for a path rather than guessing at which task was meant.
//
// Either form must name a **task folder**, identified by its contents against the recognition set in
// scripts/lifecycle-constants.ts — the same set the health walk uses. Position never qualifies a
// folder: a registered root's project area and a store root are both directories holding no role
// file, and both would otherwise pass the unstarted gate, which tests only what a task folder does
// *not* hold. A bare slug that matches no task folder exits 2; a path naming one is refused with 1.
//
// The move is a single rename of the whole folder, which is what keeps its internal `./` links intact.
// Inside the folder this reads the directory listing and the plan's status header — the entry gate
// tests a `result.md` for existence alone — and nothing in it is ever written.

import { lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { holdsRoleFile, PLAN_VOCAB, TERMINAL_STATUSES, UNSTARTED_STATUS } from "./lifecycle-constants.ts";

// references/workflow/task-archiving.md and references/workflow/task-backlog.md: a container is
// *created* capitalized but *recognized* case-insensitively, so an existing `archive/` — from a
// pre-rename layout, or the same directory entry seen through a case-insensitive filesystem — is
// moved into under the spelling it already carries. Creating the capitalized name beside it would
// either duplicate the container or collide with it, and renaming it belongs to `maintain`'s format
// sweep rather than to a move.
const CONTAINERS = {
  archive: { match: /^archive$/i, create: "Archive" },
  backlog: { match: /^backlog$/i, create: "Backlog" },
} as const;

type Target = keyof typeof CONTAINERS;


const USAGE = "usage: node scripts/task-move.ts <slug-or-path> --to archive|backlog";

// Every exit path unwinds through this rather than calling process.exit, because stderr is an
// asynchronous stream on a POSIX pipe: exiting immediately after writing the reason can drop it, and
// the reason is the whole of what a refused run reports. Throwing lets Node flush and then exit on
// the status set at the bottom of the file.
class Exit extends Error {
  code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

function fail(message: string): never {
  throw new Exit(2, message);
}

function refuse(message: string): never {
  throw new Exit(1, message);
}

function parseArgs(argv: readonly string[]): { subject: string; target: Target } {
  let subject: string | null = null;
  let target: string | null = null;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--to") target = argv[++index] ?? null;
    else if (arg.startsWith("--to=")) target = arg.slice("--to=".length);
    else if (arg.startsWith("-")) fail(`unknown option ${arg}. ${USAGE}`);
    else if (subject === null) subject = arg;
    else fail(`unexpected argument ${arg}. ${USAGE}`);
  }
  if (subject === null || target === null) fail(USAGE);
  if (!Object.hasOwn(CONTAINERS, target)) fail(`--to takes archive or backlog, not ${target}. ${USAGE}`);
  return { subject, target: target as Target };
}

type EntryKind = "absent" | "dir" | "symlink" | "other";

// lstat rather than stat throughout: a symlink is something this script refuses to move, to move
// through, or to overwrite, so every path must be seen as itself rather than as what it points at.
function entryKind(path: string): EntryKind {
  let stats;
  try {
    stats = lstatSync(path);
  } catch {
    return "absent";
  }
  if (stats.isSymbolicLink()) return "symlink";
  return stats.isDirectory() ? "dir" : "other";
}

function readdirNames(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

// A task folder is identified by its contents, never by its position (references/workflow/task-layout.md
// § One task, one flat folder), and the recognition set is read from scripts/lifecycle-constants.ts so
// this refusal and the health walk that finds task folders cannot disagree. Without the test, existence
// alone would qualify: a registered root's project area (`Tasks/Treasury/`) is a directory holding no
// role file, and moving one relocates every task under it; `..` resolves to the store directory itself
// the same way. Both pass the unstarted gate, which asks only what a *task* folder does not hold.
function isTaskFolder(path: string): boolean {
  if (entryKind(path) !== "dir") return false;
  let names: string[];
  try {
    names = readdirSync(path, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return false;
  }
  return holdsRoleFile(names);
}

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/") || path.startsWith(`~${sep}`)) return join(homedir(), path.slice(2));
  return path;
}

function looksLikePath(arg: string): boolean {
  return isAbsolute(arg) || arg.includes("/") || arg.includes(sep) || arg.startsWith("~");
}

function registeredRoots(): string[] {
  const file = join(homedir(), ".config", "agents-kit", "config.json");
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    process.stderr.write(`warning: ignoring unparseable ${file}\n`);
    return [];
  }
  const entries = (parsed as { taskRoots?: unknown } | null)?.taskRoots;
  if (!Array.isArray(entries)) return [];
  const roots: string[] = [];
  for (const entry of entries) {
    const path = (entry as { path?: unknown } | null)?.path;
    if (typeof path === "string" && path.trim()) roots.push(resolve(expandHome(path.trim())));
  }
  return roots;
}

function resolveSlug(slug: string): string {
  const found = new Set<string>();
  for (const root of [resolve(".agents", "tasks"), ...registeredRoots()]) {
    const containers = readdirNames(root)
      .filter((name) => CONTAINERS.archive.match.test(name) || CONTAINERS.backlog.match.test(name))
      .map((name) => join(root, name));
    for (const dir of [root, ...containers]) {
      const candidate = join(dir, slug);
      if (isTaskFolder(candidate)) found.add(candidate);
    }
  }
  const matches = [...found];
  if (matches.length === 0) {
    fail(`no task folder named ${slug} under the canonical root or a registered one. Pass its path instead.`);
  }
  if (matches.length > 1) fail(`${slug} matches ${matches.join(" and ")}. Pass the one you mean as a path.`);
  return matches[0];
}

// Mirrored in scripts/health-check.ts and scripts/task-state.ts, whose readers must agree with this
// one; change the three together.
const FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*(.*)$/;
// The status spellings references/workflow/doc-task-files.md allows, read as scripts/health-check.ts
// reads them: bounded to the header block above the first `##`, fenced content skipped, the same
// tolerant forms. The two readers have to agree on what a folder's status is — stricter here and a
// plan health-check reports as terminal could not be archived; looser and a move would act on a line
// health-check does not count as a status at all.
const STATUS_PATTERNS = [
  /^\*\*Status\b[^:*\n]*:?\*\*:?[ \t]*(.+)$/im,
  /^\*\*Status\b[^:\n]*:[ \t]*(.+)$/im,
  /^Status:[ \t]*(.+)$/im,
];

// Closing a fence takes the opener's marker at its own length or longer, no further indented than the
// opener, and nothing after it but whitespace, so a shorter run, a different marker, a deeper-indented
// run, or a run carrying an info string is content inside an open block. All three halves matter here:
// closing early on a `` ```md `` or on an indented `` ``` `` inside an open fence hands the rest of a
// fenced example back as header lines, and a `**Status:** done` written there as illustration would
// then archive a live task. The indent test is relative to the opener rather than CommonMark's flat
// 0–3 columns, because a fence nested in a list item is legitimately indented past that and its
// content still has to be skipped.
function headerBlock(text: string): string {
  const lines: string[] = [];
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
    if (fence) continue;
    if (/^#{2,6}[ \t]/.test(line)) break;
    lines.push(line);
  }
  return lines.join("\n");
}

// `raw` is null when the plan carries no status header at all, which reads differently from a header
// holding something the vocabulary cannot place: an absent header leaves nothing to name back to the
// user, so the two cases cannot collapse into one absent-ish value.
interface Status {
  readonly value: string | null;
  readonly raw: string | null;
}

// The recognition set admits the legacy suffix forms, so both gates have to read them: a folder whose
// plan is `<x>.plan.md` is not a plan-less folder, and one holding an `<x>.result.md` has started
// work. Resolved exactly as scripts/health-check.ts's `roleFileName` does — canonical name first, then
// the suffix form, never the bare suffix, which is a dotfile — because a folder this move calls
// unstarted while the health walk calls it live is the disagreement the shared recognition set exists
// to prevent. Only the kit's own canonical root is ever swept, so any other root can hold these
// indefinitely (references/workflow/task-layout.md § One task, one flat folder).
function roleFileName(dir: string, exactName: string, suffix: string): string | null {
  const names = readdirNames(dir);
  if (names.includes(exactName)) return exactName;
  return names.find((name) => name.endsWith(suffix) && name !== suffix) ?? null;
}

function readPlanStatus(dir: string): Status | null {
  const name = roleFileName(dir, "plan.md", ".plan.md");
  if (name === null) return null;
  const file = join(dir, name);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    refuse(`cannot read ${file}: ${(err as Error).message}`);
  }
  const header = headerBlock(text);
  let raw: string | null = null;
  for (const pattern of STATUS_PATTERNS) {
    const match = header.match(pattern);
    if (match?.[1].trim()) {
      raw = match[1].trim();
      break;
    }
  }
  if (raw === null) return { value: null, raw: null };
  const cleaned = raw.replace(/[*_`]/g, "").trim();
  const token = (cleaned.split(/[\s,;.]+/)[0] ?? "").toLowerCase().replace(/[^a-z-]/g, "");
  return { value: PLAN_VOCAB.has(token) ? token : null, raw: cleaned };
}

function requireTerminal(src: string): void {
  const status = readPlanStatus(src);
  const terminal = [...TERMINAL_STATUSES].join(" or ");
  if (status === null) refuse(`${src} has no plan.md, so it cannot be confirmed finished. Only a ${terminal} task archives.`);
  if (!TERMINAL_STATUSES.has(status.value)) {
    refuse(`${src} has plan status \`${status.raw ?? "absent"}\`. Only a ${terminal} task archives.`);
  }
}

function requireUnstarted(src: string): void {
  const plan = readPlanStatus(src);
  if (plan === null) {
    // A result file is created only once execution starts (task-lifecycle.md § Companion result
    // file), so its existence alone fails the entry gate where planning left no plan.md behind. Its
    // contents decide nothing: the result carries no status of its own, and a legacy `**Status:**`
    // line surviving in one is inert. Its *name* still does, which is why this resolves the suffix
    // form too rather than testing the canonical path.
    const result = roleFileName(src, "result.md", ".result.md");
    if (result !== null) {
      refuse(`${src} has a ${result}, so work has already begun. Only an unstarted task parks.`);
    }
    return;
  }
  if (plan.value === UNSTARTED_STATUS) return;
  if (TERMINAL_STATUSES.has(plan.value)) {
    refuse(`${src} has plan status \`${plan.raw}\`, which is finished. A finished task archives instead of parking.`);
  }
  refuse(`${src} has plan status \`${plan.raw ?? "absent"}\`. Only an unstarted task parks; a live one pauses through \`blocked\`.`);
}

function main(): void {
  const { subject, target } = parseArgs(process.argv.slice(2));
  const src = looksLikePath(subject) ? resolve(expandHome(subject)) : resolveSlug(subject);

  const srcKind = entryKind(src);
  if (srcKind === "absent") fail(`no such task folder: ${src}`);
  if (srcKind === "symlink") refuse(`${src} is a symlink. Refusing to move a symlinked task folder.`);
  if (srcKind !== "dir") refuse(`${src} is not a directory.`);
  // The path form is checked here rather than in resolveSlug, so a directory named verbatim gets the
  // same refusal a slug does: an area directory and a store root both pass the unstarted gate below,
  // which tests only what a task folder does not hold.
  if (!isTaskFolder(src)) {
    refuse(`${src} holds no task file, so it is not a task folder. Refusing to move it.`);
  }

  const slug = basename(src);
  let parent = dirname(src);
  const parentName = basename(parent);
  if (target === "archive") {
    if (CONTAINERS.archive.match.test(parentName)) refuse(`${src} is already archived.`);
    // task-archiving.md's backlog exception: a finished task parked in a backlog archives *out* of
    // it, into the backlog's own parent, so frozen history never files inside the container that
    // holds unstarted work as `Backlog/Archive/<slug>`.
    if (CONTAINERS.backlog.match.test(parentName)) parent = dirname(parent);
  } else {
    if (CONTAINERS.backlog.match.test(parentName)) refuse(`${src} is already parked.`);
    if (CONTAINERS.archive.match.test(parentName)) {
      refuse(`${src} is archived. Un-archive it first; an archived task never moves straight into a backlog.`);
    }
  }

  if (target === "archive") requireTerminal(src);
  else requireUnstarted(src);

  const spec = CONTAINERS[target];
  const containerName = readdirNames(parent).find((name) => spec.match.test(name)) ?? spec.create;
  const container = join(parent, containerName);
  const containerKind = entryKind(container);
  if (containerKind === "symlink") refuse(`${container} is a symlink. Refusing to move through it.`);
  if (containerKind === "other") refuse(`${container} exists and is not a directory.`);

  const dest = join(container, slug);
  if (entryKind(dest) !== "absent") refuse(`${dest} already exists. Refusing to overwrite or merge into it.`);

  // Both mutations sit inside the guard: either failing after the gates passed is a refusal, not the
  // exit 2 reserved for a run that never got as far as deciding.
  try {
    if (containerKind === "absent") mkdirSync(container);
    renameSync(src, dest);
  } catch (err) {
    // Removing what this run created restores "changed nothing on disk", which is what exit 1
    // asserts; a container that already existed is the user's and is left alone. `rmdirSync` rather
    // than a recursive remove, so a container something else wrote into in the meantime survives —
    // that content is not this run's to delete. Its own failure is swallowed because the refusal
    // below is the run's whole report, and a throw here would displace it with exit 2.
    if (containerKind === "absent") {
      try {
        rmdirSync(container);
      } catch {
        // Left behind rather than reported: the rename's reason is the one that matters.
      }
    }
    refuse(`could not move ${src} to ${dest}: ${(err as Error).message}`);
  }
  process.stdout.write(`moved ${src} -> ${dest}\n`);
}

try {
  main();
} catch (err) {
  const exit = err instanceof Exit ? err : new Exit(2, `task-move failed: ${(err as Error).message}`);
  process.stderr.write(`${exit.message}\n`);
  process.exitCode = exit.code;
}
