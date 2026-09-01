#!/usr/bin/env node
import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync, statSync } from "node:fs";
import type { Dirent, Stats } from "node:fs";
import { join, resolve, basename, sep } from "node:path";
import { holdsRoleFile, LIVE_STATUSES, PLAN_VOCAB, RESULT_MAX_KB as DEFAULT_RESULT_MAX_KB, TERMINAL_STATUSES, UNSTARTED_STATUS } from "./lifecycle-constants.ts";
import { resultSize } from "./task-state.ts";

process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code !== "EPIPE") throw err;
});

const SKIP_DIRS = new Set<string>(["node_modules"]);
const TASK_STORE_DIR = ".agents";
const ARCHIVE_DIR = /^archive$/i;
const BACKLOG_DIR = /^backlog$/i;
const DEFAULT_STALE_DAYS = 30;
const DAY_MS = 86_400_000;
const CURRENT_STATE = /^##[ \t]+Current state\b/im;
const COMPLETED_LINE = /^[ \t]*(?:[-*+][ \t]+)?\*\*Completed:\*\*[ \t]*\d{4}-\d{2}-\d{2}\b/i;
const GOALS_HEADING = /^##[ \t]+Goals\b/;
const GOAL_ID = /^G\d+$/;
const STEP_HEADING = /^#{2,6}[ \t]+Step\b/;
const HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*$/;
const FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*(.*)$/;
const CHECKED_STEP = /^[ \t]*-[ \t]+\[[xX]\]/;
const RESULT_LINK = /\(\[result\]\(([^()]*)\)\)/g;
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
  | "goal-id"
  | "no-current-state"
  | "oversized-result"
  | "duplicate-slug";

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

interface ErrorLike {
  readonly code?: string;
  readonly message?: string;
}

function unreachable(kind: string, abs: string, display: string, err: ErrorLike): void {
  warnings.push(`unreadable ${kind} ${display}: ${err.code ?? err.message}`);
  unreadablePaths.push(abs);
}

function listEntries(dir: string, display: string, optional = false): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"));
  } catch (err) {
    if (!(optional && err.code === "ENOENT")) unreachable("dir", dir, display, err);
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

function isTaskDir(entries: readonly Dirent[]): boolean {
  return holdsRoleFile(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
}

const STATUS_PATTERNS = [
  /^\*\*Status\b[^:*\n]*:?\*\*:?[ \t]*(.+)$/im,
  /^\*\*Status\b[^:\n]*:[ \t]*(.+)$/im,
  /^Status:[ \t]*(.+)$/im,
];

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

function readRoleFile(
  dir: string,
  display: string,
  entries: readonly Dirent[],
  exactName: string,
  suffix: string | null,
): RoleFile | null {
  const name = roleFileName(entries, exactName, suffix);
  if (!name) return null;
  return { file: name, text: fileText(join(dir, name), join(display, name)) };
}

function readStatusFrom(
  dir: string,
  display: string,
  entries: readonly Dirent[],
  exactName: string,
  suffix: string | null,
): RoleStatus | null {
  const role = readRoleFile(dir, display, entries, exactName, suffix);
  if (!role) return null;
  if (role.text == null) return { ...role, value: "unknown", raw: "unreadable" };
  return { ...role, ...normalize(rawStatus(role.text)) };
}

function modifiedTimeOrZero(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function lastModified(dir: string, entries: readonly Dirent[]): number {
  let newest = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const modified = modifiedTimeOrZero(join(dir, entry.name));
    if (modified > newest) newest = modified;
  }
  return newest;
}

interface Task {
  readonly dir: string;
  readonly path: string;
  readonly archived: boolean;
  readonly backlogged: boolean;
  readonly plan: RoleStatus | null;
  readonly result: RoleFile | null;
  readonly goals: RoleFile | null;
  readonly updated: number;
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
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith(".") && entry.name !== TASK_STORE_DIR) continue;
      const child = join(dir, entry.name);
      const childDisplay = join(display, entry.name);
      const childEntries = listEntries(child, childDisplay);
      if (ARCHIVE_DIR.test(entry.name)) {
        walk(child, childDisplay, childEntries, true, backlogged);
        continue;
      }
      if (BACKLOG_DIR.test(entry.name)) {
        walk(child, childDisplay, childEntries, archived, true);
        continue;
      }
      if (isTaskDir(childEntries)) {
        tasks.push({
          dir: child,
          path: childDisplay,
          archived,
          backlogged,
          plan: readStatusFrom(child, childDisplay, childEntries, "plan.md", ".plan.md"),
          result: readRoleFile(child, childDisplay, childEntries, "result.md", ".result.md"),
          goals: readRoleFile(child, childDisplay, childEntries, "goals.md", null),
          updated: lastModified(child, childEntries),
        });
        continue;
      }
      walk(child, childDisplay, childEntries, archived, backlogged);
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
  const step = heading.match(/^Step[ \t]+(\d+)/);
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

  for (const entry of listEntries(join(home, "skills"), join(display, "skills"), true)) {
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

  const markers = listEntries(join(home, "agents"), join(display, "agents"), true)
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
  for (const entry of listEntries(kitSkills, kitSkills, true)) {
    if (entry.isDirectory() && absent(join("skills", entry.name))) kitOnly.push(join("skills", entry.name));
  }
  if (extension) {
    const kitAgents = join(kitRoot, "agents");
    for (const entry of listEntries(kitAgents, kitAgents, true)) {
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

type NumericKey = "staleDays" | "resultMaxKb";

const NUMERIC_OPTIONS: readonly { flag: string; key: NumericKey; fallback: number }[] = [
  { flag: "--stale-days", key: "staleDays", fallback: DEFAULT_STALE_DAYS },
  { flag: "--result-max-kb", key: "resultMaxKb", fallback: DEFAULT_RESULT_MAX_KB },
];

interface Options {
  readonly roots: string[];
  readonly installs: boolean;
  readonly staleDays: number;
  readonly resultMaxKb: number;
}

function parseArgs(argv: readonly string[]): Options {
  const roots: string[] = [];
  const values: Record<NumericKey, number> = { staleDays: DEFAULT_STALE_DAYS, resultMaxKb: DEFAULT_RESULT_MAX_KB };
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

const { roots, installs, staleDays, resultMaxKb } = parseArgs(process.argv.slice(2));

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
    warnings.push("no task root given; usage: node scripts/health-check.ts [--stale-days N] [--result-max-kb N] <root> [<root>...]");
  }

  const bySlug = new Map<string, SlugHolder[]>();
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
      ];

      if (!task.archived) {
        single.push(
          currentStateFinding(task),
          oversizedResultFinding(task, resultMaxKb),
          unknownStatusFinding(task),
          legacyResultStatusFinding(task),
        );
        rootFindings.push(...anchorFindings(task), ...goalIdFindings(task));
      }
      for (const finding of single) {
        if (finding) rootFindings.push(finding);
      }
    }
    findings.push(...rootFindings.map((finding) => ({ ...finding, root: rootDir })));
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
