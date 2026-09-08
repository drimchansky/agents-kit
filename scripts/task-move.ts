#!/usr/bin/env node
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmdirSync } from "node:fs";
import type { Dirent } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import {
  ARCHIVE_DIR,
  BACKLOG_DIR,
  classifyWalkEntry,
  holdsRoleFile,
  PLAN_VOCAB,
  TASK_STORE_DIR,
  TERMINAL_STATUSES,
  UNSTARTED_STATUS,
} from "./lifecycle-constants.ts";

const CONTAINERS = {
  archive: { match: ARCHIVE_DIR, create: "Archive" },
  backlog: { match: BACKLOG_DIR, create: "Backlog" },
} as const;

type Target = keyof typeof CONTAINERS;
const USAGE = "usage: node scripts/task-move.ts <slug-or-path> --to archive|backlog";

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

function holdsTaskFiles(entries: readonly Dirent[]): boolean {
  return holdsRoleFile(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
}

function isTaskFolder(path: string): boolean {
  if (entryKind(path) !== "dir") return false;
  try {
    return holdsTaskFiles(readdirSync(path, { withFileTypes: true }));
  } catch {
    return false;
  }
}

function physicalPath(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
}

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/") || path.startsWith(`~${sep}`)) return join(homedir(), path.slice(2));
  return path;
}

function looksLikePath(arg: string): boolean {
  return isAbsolute(arg) || arg.includes("/") || arg.includes(sep) || arg.startsWith("~");
}

interface Root {
  readonly path: string;
  readonly identity: string;
}

type RegistryPolicy = "refuse" | "ignore";

function registeredRoots(unreadable: RegistryPolicy): Root[] {
  const file = join(homedir(), ".config", "agents-kit", "config.json");
  const warn = (message: string): void => {
    if (unreadable === "refuse") process.stderr.write(`warning: ${message}\n`);
  };
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    if (!missing(err) && unreadable === "refuse") unsearchable(file, err);
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    warn(`ignoring unparseable ${file}`);
    return [];
  }
  const entries = (parsed as { taskRoots?: unknown } | null)?.taskRoots;
  if (entries === undefined) return [];
  if (!Array.isArray(entries)) {
    warn(`ignoring taskRoots in ${file}: not an array`);
    return [];
  }
  const roots: Root[] = [];
  for (const [index, entry] of entries.entries()) {
    const path = (entry as { path?: unknown } | null)?.path;
    if (typeof path !== "string" || !path.trim()) {
      warn(`ignoring taskRoots[${index}] in ${file}: no path`);
      continue;
    }
    const resolved = resolve(expandHome(path.trim()));
    roots.push({ path: resolved, identity: physicalPath(resolved) });
  }
  return roots;
}

function archiveAncestor(src: string, stopAt: string | null): string | null {
  let dir = dirname(src);
  for (;;) {
    if (stopAt !== null && physicalPath(dir) === stopAt) return null;
    if (CONTAINERS.archive.match.test(basename(dir))) return dir;
    const next = dirname(dir);
    if (next === dir) return null;
    dir = next;
  }
}

function boundingRoot(src: string): string | null {
  const physical = physicalPath(src);
  let registered: string | null = null;
  for (const root of distinctRoots(registeredRoots("ignore"))) {
    const under = physical === root.identity || physical.startsWith(`${root.identity}${sep}`);
    if (under && (registered === null || root.identity.length > registered.length)) registered = root.identity;
  }
  if (registered !== null) return registered;

  for (let dir = dirname(src); ; ) {
    if (basename(dir) === TASK_STORE_DIR) {
      const store = join(dir, "tasks");
      return physicalPath(src.startsWith(`${store}${sep}`) ? store : dir);
    }
    const next = dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return null;
}

function distinctRoots(roots: readonly Root[]): Root[] {
  const kept: Root[] = [];
  const byIdentity = [...roots].sort((a, b) => (a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0));
  for (const root of byIdentity) {
    if (kept.some((seen) => root.identity === seen.identity)) continue;
    kept.push(root);
  }
  return kept;
}

function unsearchable(path: string, err: unknown): never {
  const cause = (err as NodeJS.ErrnoException).code ?? (err as Error).message;
  fail(`cannot read ${path}: ${cause}. Refusing to resolve a slug against a store it could not read in full. Pass its path instead.`);
}

function missing(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

function sortedEntries(dir: string): Dirent[] {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"));
}

function readOrRefuse(dir: string): Dirent[] | null {
  try {
    return sortedEntries(dir);
  } catch (err) {
    if (missing(err)) return null;
    unsearchable(dir, err);
  }
}

function searchRoot(root: Root, slug: string, record: (dir: string) => void): void {
  const entries = readOrRefuse(root.identity);
  if (entries === null) {
    process.stderr.write(`warning: skipping registered root ${root.path}: absent or not a directory\n`);
    return;
  }
  const walk = (dir: string, dirEntries: readonly Dirent[]): void => {
    for (const entry of dirEntries) {
      const child = join(dir, entry.name);
      const { step, childEntries } = classifyWalkEntry(entry, () => readOrRefuse(child) ?? []);
      if (step === "prune") continue;
      if (step === "claimed") {
        if (entry.name === slug) record(child);
        continue;
      }
      walk(child, childEntries);
    }
  };
  walk(root.identity, entries);
}

interface Resolved {
  readonly path: string;
  readonly root: string;
}

function resolveSlug(slug: string): Resolved {
  const found = new Map<string, Resolved>();
  const record = (dir: string, root: string): void => {
    const key = physicalPath(dir);
    const prior = found.get(key);
    if (prior === undefined || root.length > prior.root.length) found.set(key, { path: dir, root });
  };

  const canonical = resolve(".agents", "tasks");
  const canonicalEntries = readOrRefuse(canonical);
  if (canonicalEntries !== null) {
    const canonicalIdentity = physicalPath(canonical);
    const matchIn = (dir: string, entries: readonly Dirent[]): void => {
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name !== slug) continue;
        if (CONTAINERS.archive.match.test(entry.name) || CONTAINERS.backlog.match.test(entry.name)) continue;
        const child = join(dir, entry.name);
        if (holdsTaskFiles(readOrRefuse(child) ?? [])) record(child, canonicalIdentity);
      }
    };
    matchIn(canonical, canonicalEntries);
    for (const entry of canonicalEntries) {
      if (!entry.isDirectory()) continue;
      if (!CONTAINERS.archive.match.test(entry.name) && !CONTAINERS.backlog.match.test(entry.name)) continue;
      const container = join(canonical, entry.name);
      const containerEntries = readOrRefuse(container);
      if (containerEntries !== null) matchIn(container, containerEntries);
    }
  }
  for (const root of distinctRoots(registeredRoots("refuse"))) {
    searchRoot(root, slug, (dir) => record(dir, root.identity));
  }

  const matches = [...found.values()];
  if (matches.length === 0) {
    fail(`no task folder named ${slug} under the canonical root or a registered one. Pass its path instead.`);
  }
  if (matches.length > 1) {
    fail(`${slug} matches ${matches.map((match) => match.path).join(" and ")}. Pass the one you mean as a path.`);
  }
  return matches[0];
}

const FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*(.*)$/;

const STATUS_PATTERNS = [
  /^\*\*Status\b[^:*\n]*:?\*\*:?[ \t]*(.+)$/im,
  /^\*\*Status\b[^:\n]*:[ \t]*(.+)$/im,
  /^Status:[ \t]*(.+)$/im,
];

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

interface Status {
  readonly value: string | null;
  readonly raw: string | null;
}

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

function removeIfEmpty(dir: string): void {
  try {
    rmdirSync(dir);
  } catch {
    return;
  }
}

function main(): void {
  const { subject, target } = parseArgs(process.argv.slice(2));
  const resolved: Resolved | null = looksLikePath(subject) ? null : resolveSlug(subject);
  const src = resolved?.path ?? resolve(expandHome(subject));

  const srcKind = entryKind(src);
  if (srcKind === "absent") fail(`no such task folder: ${src}`);
  if (srcKind === "symlink") refuse(`${src} is a symlink. Refusing to move a symlinked task folder.`);
  if (srcKind !== "dir") refuse(`${src} is not a directory.`);

  if (!isTaskFolder(src)) {
    refuse(`${src} holds no task file, so it is not a task folder. Refusing to move it.`);
  }

  const slug = basename(src);
  let parent = dirname(src);
  const parentName = basename(parent);
  const archived = archiveAncestor(src, resolved?.root ?? boundingRoot(src));
  if (target === "archive") {
    if (archived) refuse(`${src} is already archived under ${archived}.`);

    if (CONTAINERS.backlog.match.test(parentName)) parent = dirname(parent);
  } else {
    if (CONTAINERS.backlog.match.test(parentName)) refuse(`${src} is already parked.`);
    if (archived) {
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

  try {
    if (containerKind === "absent") mkdirSync(container);
    renameSync(src, dest);
  } catch (err) {
    if (containerKind === "absent") removeIfEmpty(container);
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
