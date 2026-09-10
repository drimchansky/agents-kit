#!/usr/bin/env node
import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync, statSync } from "node:fs";
import type { Dirent, Stats } from "node:fs";
import { join, resolve, basename, dirname, relative, sep } from "node:path";
import {
  ARCHIVE_DIR,
  BACKLOG_DIR,
  angledTargetText,
  classifyWalkEntry,
  LIVE_STATUSES,
  PLAN_VOCAB,
  RECORD_MAX_KB as DEFAULT_RECORD_MAX_KB,
  RESULT_MAX_KB as DEFAULT_RESULT_MAX_KB,
  TASK_MAX_KB as DEFAULT_TASK_MAX_KB,
  TERMINAL_STATUSES,
  UNSTARTED_STATUS,
} from "./lifecycle-constants.ts";
import { resultSize } from "./task-state.ts";

process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code !== "EPIPE") throw err;
});

const DEFAULT_STALE_DAYS = 30;
const DAY_MS = 86_400_000;
const CURRENT_STATE = /^##[ \t]+Current state\b/im;
const COMPLETED_LINE = /^[ \t]*(?:[-*+][ \t]+)?\*\*Completed:\*\*[ \t]*\d{4}-\d{2}-\d{2}\b/i;
const GOALS_HEADING = /^##[ \t]+Goals\b/;
const GOAL_ID = /^G\d+$/;
const STEP_HEADING = /^#{2,6}[ \t]+Step\b/i;
const RECORD_TITLE = /^(?:Step|Full Run)\b/;
const TICKET_FILE = "ticket.md";
const HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*$/;
const HEADING_LEVEL = /^(#{1,6})[ \t]/;
const FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*(.*)$/;
const CHECKED_STEP = /^[ \t]*-[ \t]+\[[xX]\]/;
const RESULT_LINK = /\(\[result\]\(([^()]*)\)\)/g;
const LINK_TARGET = /\]\([ \t]*(?:<([^<>\n]*)>|((?:[^()\s>]|\([^()\s]*\))+))/g;
const TRAILING_NOISE = /[>\].,;:!?]+$/;
const TARGET_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const STORE_LEVEL_DOCS = new Set<string>(["DECISIONS.md", "DOC_CONVENTIONS.md", "GROUP_CONTEXT.md"]);
const STORE_LEVEL_CITATION = /(?<![A-Za-z0-9_.-])(?:DECISIONS|DOC_CONVENTIONS|GROUP_CONTEXT)\.md(?![A-Za-z0-9])/g;
const PATH_RUN_CHAR = /[A-Za-z0-9._~\/-]/;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const BLOCKQUOTE = /^[ \t]*>/;
const LIST_START = /^[ \t]*(?:[-*+]|1[.)])[ \t]/;
const THEMATIC_BREAK = /^[ \t]*(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const MARKER = ".agents-kit";
const CORE_RULES_MARKER = ".agents-kit-core-rules";
const AGENT_MARKER_PREFIX = ".agents-kit-";
const AGENT_EXTENSIONS = new Map([[".claude", "md"], [".codex", "toml"]]);
const OS_ARTIFACTS = new Set<string>([".DS_Store", ".localized", "Thumbs.db"]);
const STAGING_PREFIX = ".agents-kit-staging.";
const skipInInstalls = (name: string): boolean => name === MARKER || OS_ARTIFACTS.has(name) || name.startsWith("._");

type TaskCheck =
  | "stale"
  | "done-unarchived"
  | "started-in-backlog"
  | "unknown-status"
  | "legacy-result-status"
  | "dead-anchor"
  | "dead-citation"
  | "citation-form"
  | "goal-id"
  | "no-current-state"
  | "oversized-result"
  | "oversized-task"
  | "oversized-record"
  | "duplicate-slug"
  | "nested-task";

interface TaskFinding {
  readonly check: TaskCheck;
  readonly path: string;
  readonly detail: string;
  readonly root: string;
}

type UnrootedFinding = Omit<TaskFinding, "root">;

interface InstallFinding {
  readonly check: "install-drift";
  readonly path: string;
  readonly detail: string;
}

type Finding = TaskFinding | InstallFinding;

interface Report {
  readonly findings: readonly Finding[];
  readonly scanned: number;
  readonly unreadable: number;
  readonly unreadablePaths: readonly string[];
}

const warnings: string[] = [];
const unreadablePaths: string[] = [];
const unreadableSeen = new Set<string>();

interface ErrorLike {
  readonly code?: string;
  readonly message?: string;
}

function unreachable(kind: string, abs: string, display: string, err: ErrorLike): void {
  if (unreadableSeen.has(abs)) return;
  unreadableSeen.add(abs);
  warnings.push(`unreadable ${kind} ${display}: ${err.code ?? err.message}`);
  unreadablePaths.push(abs);
}

function sortedEntries(dir: string): Dirent[] {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"));
}

function listEntries(dir: string, display: string): Dirent[] {
  try {
    return sortedEntries(dir);
  } catch (err) {
    unreachable("dir", dir, display, err);
    return [];
  }
}

function listEntriesIfPresent(dir: string, display: string): Dirent[] {
  try {
    return sortedEntries(dir);
  } catch (err) {
    if (err.code !== "ENOENT") unreachable("dir", dir, display, err);
    return [];
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function pathExists(path: string): boolean {
  try {
    statSync(resolve(path));
    return true;
  } catch {
    return false;
  }
}

type MarkerState = "owned" | "unowned" | "unreadable";

function markerState(markerPath: string, display: string): MarkerState {
  try {
    return statSync(markerPath).isFile() ? "owned" : "unowned";
  } catch (err) {
    if (err.code === "ENOENT") return "unowned";
    unreachable("marker", markerPath, display, err);
    return "unreadable";
  }
}

function canonicalRoot(rootDir: string): string {
  try {
    return realpathSync.native(rootDir);
  } catch {
    return rootDir;
  }
}

function isDirectory(pathArg: string, label: string): boolean {
  try {
    if (statSync(resolve(pathArg)).isDirectory()) return true;

    unreachable(label, resolve(pathArg), pathArg, { code: "not a directory" });
  } catch (err) {
    unreachable(label, resolve(pathArg), pathArg, err);
  }
  return false;
}

function isAbsent(pathArg: string): boolean {
  try {
    statSync(resolve(pathArg));
    return false;
  } catch (err) {
    return err.code === "ENOENT";
  }
}

function fileText(path: string, display: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    unreachable("file", path, display, err);
    return null;
  }
}

function clip(text: string, max = 60): string {
  const line = text.trim();
  return line.length > max ? line.slice(0, max - 1) + "…" : line;
}

const STATUS_PATTERNS = [
  /^\*\*Status\b[^:*\n]*:?\*\*:?[ \t]*(.+)$/im,
  /^\*\*Status\b[^:\n]*:[ \t]*(.+)$/im,
  /^Status:[ \t]*(.+)$/im,
];

interface ScannedLine {
  readonly line: string;
  readonly live: boolean;
}

function* scanLines(text: string): Generator<ScannedLine> {
  let fence: { indent: number; char: string; len: number } | null = null;
  for (const line of text.split("\n")) {
    const marker = line.match(FENCE);
    if (marker) {
      const [, pad, run, rest] = marker;
      if (!fence) fence = { indent: pad.length, char: run[0], len: run.length };
      else if (pad.length <= fence.indent && run[0] === fence.char && run.length >= fence.len && rest === "") {
        fence = null;
      }
      yield { line, live: false };
      continue;
    }
    yield { line, live: fence === null };
  }
}

function* liveLines(text: string): Generator<string> {
  for (const scanned of scanLines(text)) if (scanned.live) yield scanned.line;
}

function rawStatus(text: string): string | null {
  const header: string[] = [];
  for (const line of liveLines(text)) {
    if (/^#{2,6}[ \t]/.test(line)) break;
    header.push(line);
  }
  const live = header.join("\n");
  for (const pattern of STATUS_PATTERNS) {
    const matched = live.match(pattern);
    if (matched && matched[1].trim()) return matched[1].trim();
  }
  return null;
}

interface StatusFields {
  readonly value: string | null;
  readonly raw: string | null;
}

function normalize(raw: string | null): StatusFields {
  if (raw == null) return { value: null, raw: null };
  const cleaned = raw.replace(/[*_`]/g, "").trim();
  const token = (cleaned.split(/[\s,;.]+/)[0] ?? "").toLowerCase().replace(/[^a-z-]/g, "");
  if (PLAN_VOCAB.has(token)) return { value: token, raw: cleaned };
  return { value: "unknown", raw: cleaned.length > 60 ? cleaned.slice(0, 57) + "…" : cleaned };
}

interface RoleFile {
  readonly file: string;
  readonly text: string | null;
}

type RoleStatus = RoleFile & StatusFields;

function roleFileName(entries: readonly Dirent[], exactName: string, suffix: string | null): string | undefined {
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  if (files.includes(exactName)) return exactName;
  return suffix ? files.find((name) => name.endsWith(suffix) && name !== suffix) : undefined;
}

type MarkdownTexts = ReadonlyMap<string, string | null>;

function markdownTexts(dir: string, display: string, entries: readonly Dirent[]): MarkdownTexts {
  const texts = new Map<string, string | null>();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    texts.set(entry.name, fileText(join(dir, entry.name), join(display, entry.name)));
  }
  return texts;
}

interface Artifact {
  readonly file: string;
  readonly text: string;
}

function readableArtifacts(texts: MarkdownTexts): Artifact[] {
  const out: Artifact[] = [];
  for (const [file, text] of texts) {
    if (text !== null) out.push({ file, text });
  }
  return out;
}

function readRoleFile(
  entries: readonly Dirent[],
  texts: MarkdownTexts,
  exactName: string,
  suffix: string | null,
): RoleFile | null {
  const name = roleFileName(entries, exactName, suffix);
  if (!name) return null;
  return { file: name, text: texts.get(name) ?? null };
}

function readStatusFrom(
  entries: readonly Dirent[],
  texts: MarkdownTexts,
  exactName: string,
  suffix: string | null,
): RoleStatus | null {
  const role = readRoleFile(entries, texts, exactName, suffix);
  if (!role) return null;
  if (role.text == null) return { ...role, value: "unknown", raw: "unreadable" };
  return { ...role, ...normalize(rawStatus(role.text)) };
}

function statsOrNull(path: string): Stats | null {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

interface FolderStats {
  readonly updated: number;
  readonly markdownBytes: number;
}

function folderStats(dir: string, entries: readonly Dirent[]): FolderStats {
  let updated = 0;
  let markdownBytes = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const stats = statsOrNull(join(dir, entry.name));
    if (stats === null) continue;
    if (stats.mtimeMs > updated) updated = stats.mtimeMs;
    if (entry.name !== TICKET_FILE && !entry.name.endsWith(".ticket.md")) markdownBytes += stats.size;
  }
  return { updated, markdownBytes };
}

interface Task {
  readonly dir: string;
  readonly path: string;
  readonly archived: boolean;
  readonly backlogged: boolean;
  readonly plan: RoleStatus | null;
  readonly result: RoleFile | null;
  readonly goals: RoleFile | null;
  readonly artifacts: readonly Artifact[];
  readonly updated: number;
  readonly markdownBytes: number;
  readonly nested: readonly string[];
}

function nestedTaskDirs(dir: string, display: string, entries: readonly Dirent[]): string[] {
  const found: string[] = [];
  for (const entry of entries) {
    const child = join(dir, entry.name);
    const childDisplay = join(display, entry.name);
    const { step, childEntries } = classifyWalkEntry(entry, () => listEntries(child, childDisplay));
    if (step === "prune") continue;
    if (step === "claimed") {
      found.push(childDisplay);
      continue;
    }
    found.push(...nestedTaskDirs(child, childDisplay, childEntries));
  }
  return found;
}

function collect(rootDir: string, rootDisplay: string): Task[] {
  const tasks: Task[] = [];

  const walk = (
    dir: string,
    display: string,
    entries: readonly Dirent[],
    archived: boolean,
    backlogged: boolean,
  ): void => {
    for (const entry of entries) {
      const child = join(dir, entry.name);
      const childDisplay = join(display, entry.name);
      const { step, childEntries } = classifyWalkEntry(entry, () => listEntries(child, childDisplay));
      if (step === "prune") continue;
      if (step === "container") {
        walk(child, childDisplay, childEntries, archived || ARCHIVE_DIR.test(entry.name), BACKLOG_DIR.test(entry.name));
        continue;
      }
      if (step === "claimed") {
        const texts = markdownTexts(child, childDisplay, childEntries);
        tasks.push({
          dir: child,
          path: childDisplay,
          archived,
          backlogged,
          plan: readStatusFrom(childEntries, texts, "plan.md", ".plan.md"),
          result: readRoleFile(childEntries, texts, "result.md", ".result.md"),
          goals: readRoleFile(childEntries, texts, "goals.md", null),
          artifacts: readableArtifacts(texts),
          ...folderStats(child, childEntries),
          nested: nestedTaskDirs(child, childDisplay, childEntries),
        });
        continue;
      }
      walk(child, childDisplay, childEntries, archived, false);
    }
  };
  walk(rootDir, rootDisplay, listEntries(rootDir, rootDisplay), false, false);
  return tasks;
}

interface Lifecycle {
  readonly value: string | null;
  readonly source: string | null;
}

function lifecycleStatus(task: Task): Lifecycle {
  if (task.plan) return { value: task.plan.value, source: task.plan.file };
  if (task.result?.text == null) return { value: null, source: null };
  return { value: hasCompletedLine(task.result.text) ? "done" : "executing", source: task.result.file };
}

interface SlugHolder {
  readonly path: string;
  readonly dir: string;
  readonly archived: boolean;
  readonly backlogged: boolean;
  readonly root: string;
}

function containerNote(holder: SlugHolder): string {
  if (holder.archived) return " (archived)";
  return holder.backlogged ? " (backlogged)" : "";
}

function duplicateSlugFindings(bySlug: ReadonlyMap<string, readonly SlugHolder[]>): TaskFinding[] {
  const out: TaskFinding[] = [];
  for (const [slug, holders] of bySlug) {
    if (holders.length < 2) continue;
    for (const holder of holders) {
      const peers = holders
        .filter((other) => other !== holder)
        .map((other) => `${other.dir}${containerNote(other)}`)
        .join(", ");
      out.push({
        check: "duplicate-slug",
        path: holder.path,
        detail: `slug "${slug}"${containerNote(holder)} also at ${peers}`,
        root: holder.root,
      });
    }
  }
  return out;
}

function staleFinding(task: Task, now: number, staleDays: number): UnrootedFinding | null {
  if (task.archived) return null;
  if (task.backlogged) return null;
  const { value, source } = lifecycleStatus(task);
  if (value != null && !LIVE_STATUSES.has(value)) return null;
  if (!task.updated) {
    warnings.push(`no .md mtime for ${task.path}: skipping the stale check`);
    return null;
  }
  const days = Math.floor((now - task.updated) / DAY_MS);
  if (days < staleDays) return null;

  const label = source == null ? "no-plan" : (value ?? "no-status");
  const origin = value != null && !task.plan ? ` (derived from ${source})` : "";
  return { check: "stale", path: task.path, detail: `${label}${origin}, ${days} days stale` };
}

function unknownStatusFinding(task: Task): UnrootedFinding | null {
  if (task.archived) return null;
  const plan = task.plan;
  if (plan?.text == null || plan.value !== "unknown") return null;
  return {
    check: "unknown-status",
    path: task.path,
    detail: `${plan.file} carries an unrecognized status: ${plan.raw}`,
  };
}

function legacyResultStatusFinding(task: Task): UnrootedFinding | null {
  if (task.archived || task.result?.text == null) return null;
  const raw = rawStatus(task.result.text);
  if (raw == null) return null;
  return {
    check: "legacy-result-status",
    path: task.path,
    detail: `${task.result.file} carries a legacy **Status:** header (${clip(raw)}); plan.md owns the lifecycle`,
  };
}

function doneUnarchivedFinding(task: Task): UnrootedFinding | null {
  if (task.archived) return null;
  const { value, source } = lifecycleStatus(task);
  if (!TERMINAL_STATUSES.has(value)) return null;
  const origin = task.plan ? "" : ` (derived from ${source})`;

  const place = task.backlogged ? "parked in Backlog/ — belongs in Archive/" : "outside Archive/";
  return { check: "done-unarchived", path: task.path, detail: `${value}${origin}, ${place}` };
}

function startedInBacklogFinding(task: Task): UnrootedFinding | null {
  if (task.archived || !task.backlogged) return null;
  const value = task.plan?.value;
  if (task.plan != null && value == null) {
    return {
      check: "started-in-backlog",
      path: task.path,
      detail: "no parseable plan status, parked in Backlog/ — cannot judge the entry gate",
    };
  }
  if (task.plan == null) {
    if (task.result == null) return null;
    return {
      check: "started-in-backlog",
      path: task.path,
      detail: `no plan.md but ${task.result.file} exists, parked in Backlog/ — a parked task must be unstarted`,
    };
  }
  if (value === UNSTARTED_STATUS || !LIVE_STATUSES.has(value)) return null;
  return {
    check: "started-in-backlog",
    path: task.path,
    detail: `${value}, parked in Backlog/ — a parked task must be unstarted`,
  };
}

function nestedTaskFinding(task: Task): UnrootedFinding | null {
  if (task.nested.length === 0) return null;
  return {
    check: "nested-task",
    path: task.path,
    detail: `claimed as a task folder, hiding the task folders beneath it: ${task.nested.join(", ")}`,
  };
}

function slugify(heading: string): string {
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-");
}

const COMPACTED_HEADING = /^Compacted\b/;
const TOMBSTONE_BULLET = /^[ \t]*-[ \t]+(.+?)[ \t]*$/;

function headingSlugs(text: string): Set<string> {
  const seen = new Map<string, number>();
  const slugs = new Set<string>();

  const taken = new Set<string>();
  let inCompacted = false;
  for (const line of liveLines(text)) {
    const heading = line.match(HEADING);
    if (heading) {
      inCompacted = COMPACTED_HEADING.test(heading[1]);
      const base = slugify(heading[1]);
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

function stepLabel(heading: string): string {
  const step = heading.match(/^Step[ \t]+(\d+[a-z]*)/i);
  return step ? `Step ${step[1]}` : clip(heading, 40);
}

function anchorFindings(task: Task): UnrootedFinding[] {
  const out: UnrootedFinding[] = [];
  if (!task.plan?.text) return out;
  const slugCache = new Map<string, Set<string> | null>();
  const report = (step: string, detail: string) => out.push({ check: "dead-anchor", path: task.path, detail: `${step}: ${detail}` });
  let step: string | null = null;
  for (const line of liveLines(task.plan.text)) {
    const heading = line.match(HEADING);
    if (heading) {
      step = STEP_HEADING.test(line) ? stepLabel(heading[1]) : null;
      continue;
    }
    if (step == null || !CHECKED_STEP.test(line)) continue;
    const matches = [...line.matchAll(RESULT_LINK)];
    if (matches.length === 0) {
      report(step, "checked step missing result link");
      continue;
    }
    const target = matches[matches.length - 1][1].trim();
    const hash = target.indexOf("#");
    if (hash === -1) {
      report(step, `result link missing anchor: ${target}`);
      continue;
    }
    const file = target.slice(0, hash).trim();
    const anchor = target.slice(hash + 1).trim();
    if (!file) {
      report(step, `result link missing file target: ${target}`);
      continue;
    }
    if (!anchor) {
      report(step, `result link missing anchor: ${target}`);
      continue;
    }
    const targetPath = resolve(task.dir, file);
    if (!isFile(targetPath)) {
      report(step, `link target missing: ${target}`);
      continue;
    }
    if (!task.result || targetPath !== resolve(task.dir, task.result.file)) {
      report(step, `result link must target the task result file: ${target}`);
      continue;
    }
    if (!slugCache.has(targetPath)) {
      const text = fileText(targetPath, join(task.path, file));
      slugCache.set(targetPath, text == null ? null : headingSlugs(text));
    }
    const slugs = slugCache.get(targetPath);
    if (slugs && !slugs.has(anchor)) report(step, `anchor not found: #${anchor} in ${file}`);
  }
  return out;
}

type DirNames = ReadonlySet<string> | "missing" | "unreadable";

interface Resolved {
  readonly path: string | null;
  readonly concealed: boolean;
}

function listedNames(dir: string, dirs: Map<string, DirNames>, rootDirs: readonly string[]): DirNames {
  const cached = dirs.get(dir);
  if (cached !== undefined) return cached;
  let names: DirNames;
  try {
    names = new Set(readdirSync(dir));
  } catch (err) {
    const code = (err as ErrorLike).code;
    if (code === "ENOENT" || code === "ENOTDIR") names = "missing";
    else {
      const root = rootHolding(dir, rootDirs);
      if (root !== null) unreachable("dir", dir, join(basename(root), relative(root, dir)), err as ErrorLike);
      names = "unreadable";
    }
  }
  dirs.set(dir, names);
  return names;
}

function resolveListed(
  fromDir: string,
  target: string,
  dirs: Map<string, DirNames>,
  rootDirs: readonly string[],
): Resolved {
  let current = fromDir;
  for (const segment of target.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      current = dirname(current);
      continue;
    }
    const names = listedNames(current, dirs, rootDirs);
    if (names === "unreadable") return { path: null, concealed: true };
    if (names === "missing" || !names.has(segment)) return { path: null, concealed: false };
    current = join(current, segment);
  }
  return { path: current, concealed: false };
}

function decodePath(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function localTarget(written: string): string | null {
  if (written === "" || written.startsWith("#") || TARGET_SCHEME.test(written)) return null;
  const hash = written.indexOf("#");
  const bare = hash === -1 ? written : written.slice(0, hash);
  return bare === "" ? null : decodePath(bare);
}

interface CitationContext {
  readonly rootDir: string;
  readonly rootDirs: readonly string[];
  readonly bySlug: ReadonlyMap<string, readonly SlugHolder[]>;
  readonly holders: readonly SlugHolder[];
  readonly dirs: Map<string, DirNames>;
}

function holderOf(abs: string, holders: readonly SlugHolder[]): SlugHolder | null {
  let deepest: SlugHolder | null = null;
  for (const holder of holders) {
    if (abs !== holder.dir && !abs.startsWith(holder.dir + sep)) continue;
    if (deepest === null || holder.dir.length > deepest.dir.length) deepest = holder;
  }
  return deepest;
}

function slugResolves(dir: string, rootDir: string): boolean {
  const parent = dirname(dir);
  if (parent === rootDir) return true;
  const container = basename(parent);
  return dirname(parent) === rootDir && (ARCHIVE_DIR.test(container) || BACKLOG_DIR.test(container));
}

function conformantForm(abs: string, fromDir: string, ctx: CitationContext): string {
  const holder = holderOf(abs, ctx.holders);
  if (holder?.dir === fromDir) {
    const inFolder = relative(holder.dir, abs);
    return inFolder === "" ? "cite this folder as ./" : `cite ./${inFolder} inside this folder`;
  }
  if (holder && slugResolves(holder.dir, holder.root)) {
    const slug = basename(holder.dir);
    if (ctx.bySlug.get(slug)?.length === 1) {
      const inFolder = relative(holder.dir, abs);
      const named = inFolder === "" ? "" : ` (${inFolder})`;
      return `cite task \`${slug}\` by its bare slug${named}`;
    }
  }
  const owner = rootHolding(abs, ctx.rootDirs);
  if (owner === null) return "the target lies outside the store root";
  const fromRoot = relative(owner, abs);
  const named = owner === ctx.rootDir ? "" : ` in the root ${owner}`;
  if (STORE_LEVEL_DOCS.has(basename(abs))) return `cite ${fromRoot} as plain text${named}`;
  if (fromRoot === "") return "the target is the store root itself";
  return `cite the folder path ${fromRoot}${named}`;
}

function rootHolding(abs: string, rootDirs: readonly string[]): string | null {
  let deepest: string | null = null;
  for (const root of rootDirs) {
    if (abs !== root && !abs.startsWith(root + sep)) continue;
    if (deepest === null || root.length > deepest.length) deepest = root;
  }
  return deepest;
}

type Span = readonly [number, number];

function storeLevelFindings(
  task: Task,
  file: string,
  line: string,
  linked: readonly Span[],
  ctx: CitationContext,
): UnrootedFinding[] {
  const out: UnrootedFinding[] = [];
  for (const match of line.matchAll(STORE_LEVEL_CITATION)) {
    const at = match.index;
    if (linked.some(([from, to]) => at >= from && at < to)) continue;
    const stop = at + match[0].length;
    let start = at;
    while (start > 0 && PATH_RUN_CHAR.test(line[start - 1])) start--;
    if (!line.slice(start, at).includes("/")) continue;
    const written = line.slice(start, stop);
    if (written.startsWith("/") || written.startsWith("~")) continue;
    if (written.startsWith("./") || written.startsWith("../")) continue;
    let resolved = resolveListed(ctx.rootDir, written, ctx.dirs, ctx.rootDirs);
    for (let from = start; resolved.path === null && !resolved.concealed; ) {
      if (from === 0 || line[from - 1] !== " ") break;
      let prior = from - 1;
      while (prior > 0 && PATH_RUN_CHAR.test(line[prior - 1])) prior--;
      if (prior === from - 1) break;
      resolved = resolveListed(ctx.rootDir, line.slice(prior, stop), ctx.dirs, ctx.rootDirs);
      from = prior;
    }
    if (resolved.path !== null || resolved.concealed) continue;
    out.push({
      check: "dead-citation",
      path: task.path,
      detail: `${file}: store-level citation ${written} resolves to nothing from the root`,
    });
  }
  return out;
}

function backtickRuns(line: string): Span[] {
  const runs: Span[] = [];
  let at = 0;
  while (at < line.length) {
    if (line[at] !== "`") {
      at++;
      continue;
    }
    let end = at;
    while (end < line.length && line[end] === "`") end++;
    runs.push([at, end]);
    at = end;
  }
  return runs;
}

function withoutCodeSpans(line: string): string {
  if (!line.includes("`")) return line;
  const runs = backtickRuns(line);
  const width = (run: Span): number => run[1] - run[0];
  let blanked = line;
  let index = 0;
  while (index < runs.length) {
    const open = runs[index];
    let closing = index + 1;
    while (closing < runs.length && width(runs[closing]) !== width(open)) closing++;
    if (closing === runs.length) {
      index++;
      continue;
    }
    const spanEnd = runs[closing][1];
    blanked = blanked.slice(0, open[0]) + " ".repeat(spanEnd - open[0]) + blanked.slice(spanEnd);
    index = closing + 1;
  }
  return blanked;
}

function withoutHtmlComments(lines: Iterable<string>): string[] {
  const raw = [...lines];
  const live = raw.join("\n");
  const scan = raw.map(withoutCodeSpans).join("\n");
  let blanked = live;
  for (const span of scan.matchAll(HTML_COMMENT)) {
    const start = span.index;
    const end = start + span[0].length;
    blanked = blanked.slice(0, start) + blanked.slice(start, end).replace(/[^\n]/g, " ") + blanked.slice(end);
  }
  return blanked.split("\n");
}

function opensBlock(line: string): boolean {
  return HEADING.test(line) || LIST_START.test(line) || THEMATIC_BREAK.test(line);
}

function citationFindings(task: Task, ctx: CitationContext): UnrootedFinding[] {
  const out: UnrootedFinding[] = [];
  for (const artifact of task.artifacts) {
    let quoted = false;
    for (const line of withoutHtmlComments(liveLines(artifact.text))) {
      if (BLOCKQUOTE.test(line)) {
        quoted = true;
        continue;
      }
      if (quoted) {
        if (line.trim() !== "" && !opensBlock(line)) continue;
        quoted = false;
      }
      const scan = withoutCodeSpans(line);
      const linked: Span[] = [];
      for (const match of scan.matchAll(LINK_TARGET)) {
        const angled = match[1] !== undefined;
        const raw = angled ? match[1] : match[2];
        const stop = match.index + match[0].length - (angled ? 1 : 0);
        const text = scan.lastIndexOf("[", match.index);
        linked.push([text === -1 ? stop - raw.length : text, stop]);
        const written = angled ? angledTargetText(raw) : raw.replace(TRAILING_NOISE, "");
        const target = localTarget(written);
        if (target === null) continue;
        const rootAbsolute = target.startsWith("/");
        const from = rootAbsolute ? ctx.rootDir : task.dir;
        const resolved = resolveListed(from, target, ctx.dirs, ctx.rootDirs);
        const fromTask = resolve(task.dir, target);
        const crossFolder = !rootAbsolute
          && (target.startsWith("../")
            || (fromTask !== task.dir && !fromTask.startsWith(task.dir + sep)));
        const storeDocLink = !crossFolder
          && !target.startsWith("./")
          && target.includes("/")
          && STORE_LEVEL_DOCS.has(basename(target));
        const abs = resolved.path
          ?? resolve(storeDocLink || rootAbsolute ? ctx.rootDir : from, target.replace(/^\/+/, ""));
        if (crossFolder || storeDocLink || rootAbsolute) {
          const kind = crossFolder
            ? "cross-folder link"
            : storeDocLink ? "store-level doc link" : "root-absolute link";
          out.push({
            check: "citation-form",
            path: task.path,
            detail: `${artifact.file}: ${kind} ${written} — ${conformantForm(abs, task.dir, ctx)}`,
          });
        }
        if (resolved.path === null && !resolved.concealed) {
          out.push({
            check: "dead-citation",
            path: task.path,
            detail: `${artifact.file}: link target ${written} resolves to nothing`,
          });
        }
      }
      out.push(...storeLevelFindings(task, artifact.file, scan, linked, ctx));
    }
  }
  return out;
}

function goalIdFindings(task: Task): UnrootedFinding[] {
  const out: UnrootedFinding[] = [];
  if (!task.goals?.text) return out;
  const seen = new Set<string>();
  let inGoals = false;
  for (const line of liveLines(task.goals.text)) {
    if (HEADING.test(line)) {
      inGoals = GOALS_HEADING.test(line);
      continue;
    }
    if (!inGoals) continue;

    const bullet = line.match(/^[-*+][ \t]+(\S+)/);
    if (!bullet) continue;
    const id = bullet[1];
    if (!GOAL_ID.test(id)) {
      out.push({ check: "goal-id", path: task.path, detail: `malformed goal ID in ${task.goals.file}: ${clip(line)}` });
      continue;
    }
    if (seen.has(id)) {
      out.push({ check: "goal-id", path: task.path, detail: `duplicate goal ID ${id} in ${task.goals.file}` });
    }
    seen.add(id);
  }
  return out;
}

function hasCurrentState(text: string): boolean {
  for (const line of liveLines(text)) {
    if (CURRENT_STATE.test(line)) return true;
  }
  return false;
}

function hasCompletedLine(text: string): boolean {
  for (const line of liveLines(text)) {
    if (COMPLETED_LINE.test(line)) return true;
  }
  return false;
}

function currentStateFinding(task: Task): UnrootedFinding | null {
  if (!task.result?.text) return null;
  const { value } = lifecycleStatus(task);
  if (value == null || value === UNSTARTED_STATUS || !LIVE_STATUSES.has(value)) return null;
  if (hasCurrentState(task.result.text)) return null;
  return {
    check: "no-current-state",
    path: task.path,
    detail: `${value} ${task.result.file} has no "## Current state" block`,
  };
}

function oversizedResultFinding(task: Task, resultMaxKb: number): UnrootedFinding | null {
  if (!task.result?.text) return null;
  const size = resultSize(task.result.text, resultMaxKb);
  if (!size.over) return null;
  return {
    check: "oversized-result",
    path: task.path,
    detail: `${task.result.file} is ${size.kb.toFixed(1)} KB, over the ${resultMaxKb} KB compaction trigger`,
  };
}

function oversizedTaskFinding(task: Task, taskMaxKb: number): UnrootedFinding | null {
  if (task.markdownBytes <= taskMaxKb * 1024) return null;
  return {
    check: "oversized-task",
    path: task.path,
    detail: `folder holds ${(task.markdownBytes / 1024).toFixed(1)} KB of .md excluding ${TICKET_FILE}, over the ${taskMaxKb} KB folder budget`,
  };
}

function oversizedRecordFindings(task: Task, recordMaxKb: number): UnrootedFinding[] {
  const result = task.result;
  if (!result?.text) return [];
  const out: UnrootedFinding[] = [];
  let heading: string | null = null;
  let section: string[] = [];
  const close = (): void => {
    if (heading === null) return;
    const kb = Buffer.byteLength(section.join("\n"), "utf8") / 1024;
    if (kb > recordMaxKb) {
      out.push({
        check: "oversized-record",
        path: task.path,
        detail: `${result.file} section "${heading}" is ${kb.toFixed(1)} KB, over the ${recordMaxKb} KB record budget`,
      });
    }
    heading = null;
    section = [];
  };
  for (const { line, live } of scanLines(result.text)) {
    const title = live ? line.match(HEADING)?.[1] : undefined;
    if (title !== undefined && line.match(HEADING_LEVEL)?.[1].length === 2) {
      close();
      if (RECORD_TITLE.test(title)) {
        heading = title;
        section = [line];
      }
      continue;
    }
    if (heading !== null) section.push(line);
  }
  close();
  return out;
}

type PathKind = "missing" | "unreadable" | "link" | "dir" | "file" | "other";

function kindOf(path: string, display: string): PathKind {
  let st: Stats;
  try {
    st = lstatSync(path);
  } catch (err) {
    if (err.code === "ENOENT") return "missing";
    unreachable("path", path, display, err);
    return "unreadable";
  }
  if (st.isSymbolicLink()) return "link";
  if (st.isDirectory()) return "dir";
  if (st.isFile()) return "file";
  return "other";
}

function linkTarget(path: string, display: string): string | null {
  try {
    return readlinkSync(path);
  } catch (err) {
    unreachable("symlink", path, display, err);
    return null;
  }
}

function bytesOf(path: string, display: string): Buffer | null {
  try {
    return readFileSync(path);
  } catch (err) {
    unreachable("file", path, display, err);
    return null;
  }
}

function filesUnder(path: string, display: string, kind: PathKind): string[] {
  if (kind !== "dir") return [display];
  const files: string[] = [];
  for (const entry of listEntries(path, display)) {
    if (skipInInstalls(entry.name)) continue;
    files.push(...filesUnder(join(path, entry.name), join(display, entry.name), entry.isDirectory() ? "dir" : "file"));
  }
  return files;
}

function unionNames(kitPath: string, installPath: string, display: string): string[] {
  const names = new Set<string>();
  for (const entry of listEntries(kitPath, kitPath)) names.add(entry.name);
  for (const entry of listEntries(installPath, display)) names.add(entry.name);
  return [...names].sort((a, b) => a.localeCompare(b, "en"));
}

function comparePath(kitPath: string, installPath: string, display: string, out: InstallFinding[]): void {
  const drift = (path: string, detail: string) => out.push({ check: "install-drift", path, detail });
  const kitKind = kindOf(kitPath, kitPath);
  const installKind = kindOf(installPath, display);
  if (kitKind === "unreadable" || installKind === "unreadable") return;
  if (kitKind === "missing" && installKind === "missing") return;
  if (kitKind === "missing") {
    for (const path of filesUnder(installPath, display, installKind)) drift(path, "extra in install");
    return;
  }
  if (installKind === "missing") {
    for (const path of filesUnder(kitPath, display, kitKind)) drift(path, "missing in install");
    return;
  }
  if (kitKind === "link" && installKind === "link") {
    const kitLink = linkTarget(kitPath, kitPath);
    const installLink = linkTarget(installPath, display);
    if (kitLink == null || installLink == null) return;
    if (kitLink !== installLink) drift(display, "differs from kit source");
    return;
  }
  if (kitKind === "link" || installKind === "link") {
    drift(display, kitKind === "link" ? "symlink replaced by a copy" : "kit path replaced by a symlink");
    return;
  }
  if (kitKind === "dir" && installKind === "dir") {
    for (const name of unionNames(kitPath, installPath, display)) {
      if (skipInInstalls(name)) continue;
      comparePath(join(kitPath, name), join(installPath, name), join(display, name), out);
    }
    return;
  }
  if (kitKind === "file" && installKind === "file") {
    const kitBytes = bytesOf(kitPath, kitPath);
    const installBytes = bytesOf(installPath, display);
    if (kitBytes == null || installBytes == null) return;
    if (!kitBytes.equals(installBytes)) drift(display, "differs from kit source");
    return;
  }
  drift(display, "differs from kit source");
}

function sharedPayloadConflict(home: string, display: string, rel: string): InstallFinding | null {
  if (kindOf(join(home, rel), join(display, rel)) === "missing") return null;
  return {
    check: "install-drift",
    path: join(display, rel),
    detail: "present but not kit-owned — every kit skill resolves into it; move it aside and rerun setup.ts",
  };
}

interface InstallResult {
  readonly findings: InstallFinding[];
  readonly items: number;
}

function installFindings(kitRoot: string, homeArg: string): InstallResult {
  const home = resolve(homeArg);
  const display = basename(home) || homeArg;
  const findings: InstallFinding[] = [];
  let items = 0;

  const compared = new Set<string>();
  const conflicts: InstallFinding[] = [];

  for (const entry of listEntriesIfPresent(join(home, "skills"), join(display, "skills"))) {
    if (!entry.isDirectory() || entry.name.startsWith(STAGING_PREFIX)) continue;
    const skillDisplay = join(display, "skills", entry.name);
    if (markerState(join(home, "skills", entry.name, MARKER), join(skillDisplay, MARKER)) === "unowned") continue;
    items++;
    compared.add(join("skills", entry.name));
    comparePath(join(kitRoot, "skills", entry.name), join(home, "skills", entry.name), skillDisplay, findings);
  }

  if (markerState(join(home, "references", MARKER), join(display, "references", MARKER)) === "unowned") {
    const conflict = sharedPayloadConflict(home, display, "references");
    if (conflict) conflicts.push(conflict);
  } else {
    items++;
    compared.add("references");
    comparePath(join(kitRoot, "references"), join(home, "references"), join(display, "references"), findings);
  }

  if (markerState(join(home, CORE_RULES_MARKER), join(display, CORE_RULES_MARKER)) === "unowned") {
    const conflict = sharedPayloadConflict(home, display, "CORE_RULES.md");
    if (conflict) conflicts.push(conflict);
  } else {
    items++;
    compared.add("CORE_RULES.md");
    comparePath(join(kitRoot, "CORE_RULES.md"), join(home, "CORE_RULES.md"), join(display, "CORE_RULES.md"), findings);
  }

  const markers = listEntriesIfPresent(join(home, "agents"), join(display, "agents"))
    .filter((entry) => entry.isFile() && entry.name.startsWith(AGENT_MARKER_PREFIX));
  const extension = AGENT_EXTENSIONS.get(basename(home));
  if (markers.length > 0 && !extension) {
    warnings.push(`${display}: kit agent markers found but the home name matches no known agent format; skipping agents/`);
  } else {
    for (const marker of markers) {
      const file = `${marker.name.slice(AGENT_MARKER_PREFIX.length)}.${extension}`;
      items++;
      compared.add(join("agents", file));
      comparePath(join(kitRoot, "agents", file), join(home, "agents", file), join(display, "agents", file), findings);
    }
  }

  if (items === 0) {
    const named = conflicts.map((conflict) => basename(conflict.path)).join(" and ");
    findings.push({
      check: "install-drift",
      path: display,
      detail: named
        ? `no kit markers — never installed; ${named} present but not kit-owned — move aside and rerun setup.ts`
        : "no kit markers — never installed",
    });
    return { findings, items };
  }
  findings.push(...conflicts);

  const absent = (rel: string) => !compared.has(rel) && kindOf(join(home, rel), join(display, rel)) === "missing";
  const kitOnly: string[] = [];
  if (absent("CORE_RULES.md")) kitOnly.push("CORE_RULES.md");
  if (absent("references")) kitOnly.push("references");
  const kitSkills = join(kitRoot, "skills");
  for (const entry of listEntriesIfPresent(kitSkills, kitSkills)) {
    if (entry.isDirectory() && absent(join("skills", entry.name))) kitOnly.push(join("skills", entry.name));
  }
  if (extension) {
    const kitAgents = join(kitRoot, "agents");
    for (const entry of listEntriesIfPresent(kitAgents, kitAgents)) {
      if (entry.isFile() && entry.name.endsWith(`.${extension}`) && absent(join("agents", entry.name))) {
        kitOnly.push(join("agents", entry.name));
      }
    }
  }
  for (const rel of kitOnly) {
    const kitPath = join(kitRoot, rel);
    for (const path of filesUnder(kitPath, join(display, rel), kindOf(kitPath, kitPath))) {
      findings.push({ check: "install-drift", path, detail: "missing in install" });
    }
  }
  return { findings, items };
}

type NumericKey = "staleDays" | "resultMaxKb" | "taskMaxKb" | "recordMaxKb";

const NUMERIC_OPTIONS: readonly { flag: string; key: NumericKey; fallback: number }[] = [
  { flag: "--stale-days", key: "staleDays", fallback: DEFAULT_STALE_DAYS },
  { flag: "--result-max-kb", key: "resultMaxKb", fallback: DEFAULT_RESULT_MAX_KB },
  { flag: "--task-max-kb", key: "taskMaxKb", fallback: DEFAULT_TASK_MAX_KB },
  { flag: "--record-max-kb", key: "recordMaxKb", fallback: DEFAULT_RECORD_MAX_KB },
];

interface Options {
  readonly roots: string[];
  readonly installs: boolean;
  readonly staleDays: number;
  readonly resultMaxKb: number;
  readonly taskMaxKb: number;
  readonly recordMaxKb: number;
}

function parseArgs(argv: readonly string[]): Options {
  const roots: string[] = [];
  const values: Record<NumericKey, number> = {
    staleDays: DEFAULT_STALE_DAYS,
    resultMaxKb: DEFAULT_RESULT_MAX_KB,
    taskMaxKb: DEFAULT_TASK_MAX_KB,
    recordMaxKb: DEFAULT_RECORD_MAX_KB,
  };
  let installs = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--installs") {
      installs = true;
      continue;
    }
    const option = NUMERIC_OPTIONS.find((candidate) => arg === candidate.flag || arg.startsWith(`${candidate.flag}=`));
    if (option) {
      const inline = arg.includes("=");

      const raw = inline ? arg.slice(arg.indexOf("=") + 1) : argv[i + 1];
      if (/^\d+$/.test(String(raw ?? "").trim())) {
        values[option.key] = Number(raw);
        if (!inline) i++;
      } else {
        warnings.push(`ignoring ${option.flag} "${raw ?? ""}" (want a non-negative integer); using ${option.fallback}`);

        const fallsThrough =
          !inline && typeof raw === "string" && raw !== "" && (raw.startsWith("-") || pathExists(raw));
        if (!inline && !fallsThrough) i++;
      }
      continue;
    }
    if (arg === "--") continue;
    if (arg.startsWith("-")) {
      warnings.push(`ignoring unknown option ${arg}`);
      continue;
    }
    roots.push(arg);
  }
  return { roots, installs, ...values };
}

const { roots, installs, staleDays, resultMaxKb, taskMaxKb, recordMaxKb } = parseArgs(process.argv.slice(2));

const now = Date.now();
const findings: Finding[] = [];
let scanned = 0;

interface RootCandidate {
  readonly rootArg: string;
  readonly rootDir: string;
  readonly canonical: string;
}

if (installs) {
  const [kitRootArg, ...homes] = roots;
  if (kitRootArg == null || homes.length === 0) {
    warnings.push("usage: node scripts/health-check.ts --installs <kit-root> <home> [<home>...]");
  } else if (isDirectory(kitRootArg, "kit root")) {
    for (const homeArg of homes) {
      if (isAbsent(homeArg)) {
        const result = installFindings(resolve(kitRootArg), homeArg);
        findings.push(...result.findings);
        scanned += result.items;
        continue;
      }
      if (!isDirectory(homeArg, "install home")) continue;
      const result = installFindings(resolve(kitRootArg), homeArg);
      findings.push(...result.findings);
      scanned += result.items;
    }
  }
} else {
  if (roots.length === 0) {
    warnings.push("no task root given; usage: node scripts/health-check.ts [--stale-days N] [--result-max-kb N] [--task-max-kb N] [--record-max-kb N] <root> [<root>...]");
  }

  const bySlug = new Map<string, SlugHolder[]>();
  const walkedTasks: { readonly rootDir: string; readonly tasks: readonly Task[] }[] = [];
  const candidates: RootCandidate[] = roots
    .filter((rootArg) => isDirectory(rootArg, "root"))
    .map((rootArg) => {
      const rootDir = resolve(rootArg);

      return { rootArg, rootDir, canonical: canonicalRoot(rootDir) };
    });

  const walked: string[] = [];
  const kept = new Set<RootCandidate>();
  const byDepth = [...candidates].sort((a, b) =>
    (a.canonical < b.canonical ? -1 : a.canonical > b.canonical ? 1 : 0));
  for (const candidate of byDepth) {
    const { canonical } = candidate;
    if (walked.some((seen) => canonical === seen || canonical.startsWith(seen + sep))) continue;
    walked.push(canonical);
    kept.add(candidate);
  }
  for (const candidate of candidates) {
    if (!kept.has(candidate)) {
      warnings.push(`skipping root already covered by another: ${candidate.rootArg}`);
      continue;
    }
    const { rootArg, rootDir } = candidate;

    const tasks = collect(rootDir, basename(rootDir) || rootArg);
    walkedTasks.push({ rootDir, tasks });
    for (const task of tasks) {
      const slug = basename(task.dir);

      const holder = {
        path: task.path,
        dir: task.dir,
        archived: task.archived,
        backlogged: task.backlogged,
        root: rootDir,
      };
      const holders = bySlug.get(slug);
      if (holders) holders.push(holder);
      else bySlug.set(slug, [holder]);
    }
    const rootFindings: UnrootedFinding[] = [];
    scanned += tasks.length;
    for (const task of tasks) {
      const single = [
        staleFinding(task, now, staleDays),
        doneUnarchivedFinding(task),
        startedInBacklogFinding(task),
        nestedTaskFinding(task),
      ];

      if (!task.archived) {
        single.push(
          currentStateFinding(task),
          oversizedResultFinding(task, resultMaxKb),
          oversizedTaskFinding(task, taskMaxKb),
          unknownStatusFinding(task),
          legacyResultStatusFinding(task),
        );
        rootFindings.push(
          ...anchorFindings(task),
          ...goalIdFindings(task),
          ...oversizedRecordFindings(task, recordMaxKb),
        );
      }
      for (const finding of single) {
        if (finding) rootFindings.push(finding);
      }
    }
    findings.push(...rootFindings.map((finding) => ({ ...finding, root: rootDir })));
  }
  const dirs = new Map<string, DirNames>();
  const holders = [...bySlug.values()].flat();
  const rootDirs = walkedTasks.map(({ rootDir }) => rootDir);
  for (const { rootDir, tasks } of walkedTasks) {
    const ctx: CitationContext = { rootDir, rootDirs, bySlug, holders, dirs };
    for (const task of tasks) {
      findings.push(...citationFindings(task, ctx).map((finding) => ({ ...finding, root: rootDir })));
    }
  }
  findings.push(...duplicateSlugFindings(bySlug));
}

process.stdout.write(JSON.stringify({
  findings,
  scanned,
  unreadable: unreadablePaths.length,
  unreadablePaths,
} satisfies Report) + "\n");
for (const w of warnings) console.error(`[health-check] ${w}`);
