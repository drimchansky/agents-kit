#!/usr/bin/env node
// Walks task roots and reports lifecycle health findings for the `maintain` skill.
// Zero dependencies; runs under Node type stripping — too old a Node fails as a parse error, not a
// version message. Floor in AGENTS.md § The `.ts` sources are unchecked by design.
// Run: node scripts/health-check.ts [--stale-days N] [--result-max-kb N] <root> [<root>...]
//  or: node scripts/health-check.ts --installs <kit-root> <home> [<home>...]
// Emitted `check` values: the task walk reports `stale`, `done-unarchived`, `started-in-backlog`,
// `unknown-status`, `legacy-result-status`, `dead-anchor`, `goal-id`, `no-current-state`,
// `oversized-result`, and `duplicate-slug`; `--installs` walks no tasks and reports `install-drift`
// instead. Archived folders are counted in `scanned` and exempt from every check but
// `duplicate-slug`, which sees them because a bare slug falls back into `Archive/`
// (references/workflow/task-layout.md § Discovery rules for skills), so an archived slug stays
// citable and must stay unique.
// Backlogged folders are exempt from `stale` alone — parked work is deliberately dormant
// (references/workflow/task-backlog.md) — and stay in every other check, `duplicate-slug` included,
// since the same slug fallback reaches `Backlog/` and a parked task's docs are future work a later
// reconcile repairs rather than the frozen history an archived folder holds. Two checks read the
// location itself: `done-unarchived` names the backlog for a terminal task, which belongs in
// `Archive/`, and `started-in-backlog` fires for a plan past `to-do`, which no longer meets the
// backlog's unstarted entry gate, and for a plan with no parseable status, which cannot be judged
// against it — the stale exemption would otherwise leave that shape silent. A plan-less folder
// fires it too once a `result.md` exists at all, since a result file exists only once execution
// starts. `duplicate-slug` is also the one check that spans roots: a slug must be unique across
// every root walked and within each one, since the walk is recursive. It emits one finding per
// colliding folder, each keeping its own `root`, so every finding still carries the single root its
// consumer attributes it by, and names its peers by absolute directory rather than by the
// root-basename-prefixed display path.
// `plan.md` is the sole lifecycle-status home (references/workflow/task-lifecycle.md § `result.md` —
// no status field), so every status this walk reads is the plan's and `unknown-status` judges the
// plan alone; a `result.md` still carrying a `**Status:**` header is the legacy shape that section
// tolerates, reported once as `legacy-result-status` and never validated against a vocabulary that
// no longer governs the file. Where a folder holds no plan at all the result stands in through its
// content rather than a status of its own: the file existing means execution started, and its
// closing `**Completed:**` line is the only finished-ness left to read.
// Contract: stdout is exactly one JSON object,
// {"findings":[…],"scanned":N,"unreadable":N,"unreadablePaths":[…]}. Task findings are
// {check,path,detail,root}, with `root` the resolved absolute task root; `--installs` findings are
// {check,path,detail}. `scanned` counts the task folders walked — or, under `--installs`, the
// marker-owned items compared — and `unreadablePaths` names everything this run could not open, by
// absolute path, so a coverage gap is attributable to its root the way a finding is and two roots
// sharing a basename stay distinct; findings alone are never read as coverage (`scanned` is a floor
// while it is non-empty). Warnings go to stderr and the exit status is always 0, so a partly
// unreadable store still parses.

import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync, statSync } from "node:fs";
import type { Dirent, Stats } from "node:fs";
import { join, resolve, basename, sep } from "node:path";
import { holdsRoleFile, LIVE_STATUSES, PLAN_VOCAB, RESULT_MAX_KB as DEFAULT_RESULT_MAX_KB, TERMINAL_STATUSES, UNSTARTED_STATUS } from "./lifecycle-constants.ts";

// stdout is asynchronous on a macOS pipe, so the report is written and the module then ends: calling
// process.exit after the write would discard whatever the pipe buffer could not take, truncating the
// JSON above 64 KB. A reader that closes early then raises EPIPE on a stream nothing awaits, and
// swallowing that is what keeps the always-zero exit status the contract above promises.
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code !== "EPIPE") throw err;
});

// Pruned at every depth because the walk would never finish otherwise. A helper directory needs no
// entry here — isTaskDir already rejects a folder holding no role file — and a name-based prune costs
// a real task its scan, silently: `.git` and every other dotted name bar `.agents` are skipped by
// the walk itself.
const SKIP_DIRS = new Set<string>(["node_modules"]);
// The recognition set and its membership test come from scripts/lifecycle-constants.ts, so this
// walk and the move that refuses a non-task folder agree on what a task folder is.
// references/workflow/task-archiving.md: new archives are created as
// `Archive/`, but an existing one is recognized case-insensitively, so a pre-rename `archive/`
// (or the same folder on a case-insensitive filesystem) still counts as archived.
const ARCHIVE_DIR = /^archive$/i;
// references/workflow/task-backlog.md: the parked counterpart of the archive, and recognized by the
// same rule — new backlogs are created as `Backlog/`, an existing one is matched case-insensitively.
const BACKLOG_DIR = /^backlog$/i;
const DEFAULT_STALE_DAYS = 30;
const DAY_MS = 86_400_000;

const CURRENT_STATE = /^##[ \t]+Current state\b/im;
// The closing line a `done` plan owes its result (references/workflow/task-lifecycle.md § Companion
// result file). Scanned over the whole file rather than the header block, because it closes a result
// rather than heading one, and it is the only finished-ness a plan-less folder still carries — which
// is why the colon and the date are both required rather than the word alone: on a plan-less folder
// this match *is* the lifecycle, so a prose header like `**Completed steps:** 3 of 7` reading as
// `done` would file unfinished work under a status nothing else can contradict.
const COMPLETED_LINE = /^[ \t]*(?:[-*+][ \t]+)?\*\*Completed:\*\*[ \t]*\d{4}-\d{2}-\d{2}\b/i;
// references/workflow/task-goals.md: every `## Goals` bullet leads with a durable
// `G<n>` ID (optionally followed by an `(external)` token) and the IDs are unique across the file.
const GOALS_HEADING = /^##[ \t]+Goals\b/;
const GOAL_ID = /^G\d+$/;
// implement-task appends `([result](<file>#<anchor>))` to each step it checks off, so a `- [x]`
// step whose link is absent or unresolvable has lost the evidence that justifies the checkbox.
const STEP_HEADING = /^#{2,6}[ \t]+Step\b/;
const HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*$/;
// The markdown-reading constants and helpers below — this regex and `liveLines`, `HEADING`,
// `RESULT_LINK`, `STATUS_PATTERNS` with its normalizer, and `slugify`/`headingSlugs` with
// `COMPACTED_HEADING`/`TOMBSTONE_BULLET` — are mirrored in scripts/task-state.ts, and the fence and
// status halves again in scripts/task-move.ts. Those readers must agree with this one: this walk's
// dead-anchor check against task-state's `anchorResolves`, and its terminal read against task-move's
// archive gate. Change a copy here and change every mirror in the same edit.
const FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*(.*)$/;
const CHECKED_STEP = /^[ \t]*-[ \t]+\[[xX]\]/;
// implement-task appends the evidence link at the end of the step line, but the step's own prose
// may cite a literal `([result](…))` as an example — so the last match is the link, never the first.
const RESULT_LINK = /\(\[result\]\(([^()]*)\)\)/g;

// Ownership markers written by setup.ts; only a marked item is kit-managed and comparable.
const MARKER = ".agents-kit";
const CORE_RULES_MARKER = ".agents-kit-core-rules";
const AGENT_MARKER_PREFIX = ".agents-kit-";
// setup.ts installs each host's native agent format only, keyed by the home's own directory name.
const AGENT_EXTENSIONS = new Map([[".claude", "md"], [".codex", "toml"]]);
// setup.ts's recursive copies carry OS-generated files into the homes, where each side is then
// rewritten independently — drift no redeploy can durably clear. Matched by name rather than by a
// dotfile rule, because a skill may legitimately ship one (a template's `.gitignore`) and it stays
// comparable.
const OS_ARTIFACTS = new Set<string>([".DS_Store", ".localized", "Thumbs.db"]);
// setup.ts builds each skill under `skills/.agents-kit-staging.<pid>-<name>` and marks it before
// copying into it, so a marked entry with this prefix is an interrupted install rather than a
// payload. Comparing one reports phantom drift for files the next setup.ts run sweeps on its own,
// and counting it as an item defeats the never-installed line below.
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
// What this run could not read, reported in the contract rather than only on stderr: a caller reading
// findings alone would take a store it never opened for a clean one. `scanned` is a floor while this
// is non-empty. Warnings that are not coverage gaps — an ignored flag value, a usage error — stay stderr-only.
const unreadablePaths: string[] = [];

interface ErrorLike {
  readonly code?: string;
  readonly message?: string;
}

// What kind of thing could not be read rides on the warning, which keeps the compact display path.
// `unreadablePaths` carries the absolute one: every finding is attributed by its absolute `root`,
// and a display path prefixed with a root's basename alone cannot be lined up against them once two
// roots share that basename.
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

// Presence alone, of anything: used to tell a rejected flag value that names a real path (a root the
// flag would otherwise swallow) from one that names nothing (a typed value). Deliberately not
// `isDirectory` — a root pointing at a file must still reach the coverage list through that check.
function pathExists(path: string): boolean {
  try {
    statSync(resolve(path));
    return true;
  } catch {
    return false;
  }
}

type MarkerState = "owned" | "unowned" | "unreadable";

// Whether setup.ts owns a path, by the marker beside it. A marker that cannot be read is not the
// user's: answering "unowned" there would drop a kit-managed item from the comparison, leaving
// `scanned` short and `unreadable` at zero — a clean-looking report over an item never compared.
// It is recorded as a coverage gap and compared anyway, where each unreadable path reports on its
// own. Only ENOENT means the marker is genuinely absent.
function markerState(markerPath: string, display: string): MarkerState {
  try {
    return statSync(markerPath).isFile() ? "owned" : "unowned";
  } catch (err) {
    if (err.code === "ENOENT") return "unowned";
    unreachable("marker", markerPath, display, err);
    return "unreadable";
  }
}

// Collapses symlinked, repeated, and nested root arguments to one identity. `.native` returns the
// spelling the filesystem holds, where the JS implementation returns the caller's own: on a
// case-insensitive volume two roots differing only in case are one directory, and only the on-disk
// spelling makes the overlap comparison below see that. A path that vanishes between the directory
// check and this call falls back to its resolved form rather than throwing: the contract above is
// one JSON object on stdout and exit 0, so no step of the walk may raise.
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
    // The same fact for a caller as a path that could not be opened at all: this argument
    // contributed nothing to the walk. Left on stderr it would let a registry entry pointing at a
    // file report as a clean root, which is what the other arm of this function already prevents.
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
  return holdsRoleFile(entries.filter((e) => e.isFile()).map((e) => e.name));
}

// Tolerant status extraction: canonical `**Status:** value`, parenthetical qualifiers
// (`**Status (2026-05-11):** …`), colon-inside-bold (`**Status: done…**`), unterminated bold.
const STATUS_PATTERNS = [
  /^\*\*Status\b[^:*\n]*:?\*\*:?[ \t]*(.+)$/im,
  /^\*\*Status\b[^:\n]*:[ \t]*(.+)$/im,
  /^Status:[ \t]*(.+)$/im,
];

// Every scan over a task file skips fenced content, because a heading, a bullet, or a status line
// inside a fence is illustrative markdown rather than the file's own. Closing a fence takes the
// opener's marker at its own length or longer, no further indented than the opener, and nothing after
// it but whitespace, so a shorter run, a different marker, a deeper-indented run, or a run carrying an
// info string is content inside an open block: a boolean flag would invert on it and hand back what it
// skipped. All three halves matter as much as the length one — a doc that shows a fenced example opens
// with ``` and carries ```md or an indented ``` inside it, and closing on either hands back the rest of
// the example as the file's own lines. The indent test is relative to the opener rather than
// CommonMark's flat 0–3 columns, because a fence nested in a list item is legitimately indented past
// that and its content still has to be skipped.
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

// references/workflow/doc-task-files.md bounds a status header to the file's header
// block — under the `#` title, above the first `##` section, never inside fenced or quoted content —
// so the scan stops at the first `##`-or-deeper heading and a status-shaped body line (a log entry,
// a quoted example) is not a candidate.
function rawStatus(text: string): string | null {
  const header: string[] = [];
  for (const line of liveLines(text)) {
    if (/^#{2,6}[ \t]/.test(line)) break;
    header.push(line);
  }
  const live = header.join("\n");
  for (const re of STATUS_PATTERNS) {
    const m = live.match(re);
    if (m && m[1].trim()) return m[1].trim();
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
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  if (files.includes(exactName)) return exactName;
  return suffix ? files.find((f) => f.endsWith(suffix) && f !== suffix) : undefined;
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

function lastModified(dir: string, entries: readonly Dirent[]): number {
  let max = 0;
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".md")) continue;
    try {
      const t = statSync(join(dir, e.name)).mtimeMs;
      if (t > max) max = t;
    } catch {
      /* an unreadable entry only lowers the observed age — skip it */
    }
  }
  return max;
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
  // Every directory is listed exactly once and its entries handed down: the listing that decides
  // whether a folder is a task is the same one the recursion walks. Listing it a second time would
  // report an unreadable directory as two coverage gaps, one per pass.
  const walk = (
    dir: string,
    display: string,
    entries: readonly Dirent[],
    archived: boolean,
    backlogged: boolean,
  ): void => {
    for (const e of entries) {
      if (!e.isDirectory() || SKIP_DIRS.has(e.name)) continue;
      // `.agents` is the one dotted name entered: the canonical root `<project>/.agents/tasks` sits
      // inside it, so pruning it costs a root registered as a project directory every task it
      // holds — silently, since an unwalked root and an empty one report the same zero.
      if (e.name.startsWith(".") && e.name !== ".agents") continue;
      const child = join(dir, e.name);
      const childDisplay = join(display, e.name);
      const childEntries = listEntries(child, childDisplay);
      // Neither container clears the other's flag, so a `Backlog/` under an `Archive/` stays
      // archived: the archived exemptions are the wider set, and every check reading `backlogged`
      // honors `archived` first.
      if (ARCHIVE_DIR.test(e.name)) {
        walk(child, childDisplay, childEntries, true, backlogged);
        continue;
      }
      if (BACKLOG_DIR.test(e.name)) {
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

// The plan owns the lifecycle, so it wins whenever it exists. For a folder that has no plan at all
// the result stands in through its content, since it carries no status: it exists only once
// execution started, and only its closing `**Completed:**` line says that execution finished.
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

// Which container a colliding folder sits in, since neither is in the active listing a reader looks
// through first. A folder inside both is named archived alone — the wider fact, matching the
// exemptions it gets.
function containerNote(holder: SlugHolder): string {
  if (holder.archived) return " (archived)";
  return holder.backlogged ? " (backlogged)" : "";
}

// One finding per colliding folder rather than one per collision: each keeps its own `root`, which is
// what consumers attribute a finding by, and naming the peers in `detail` is what makes the pair
// actionable from either side. Peers are named by absolute directory, not by the compact display
// path the other findings use: that path is prefixed by its root's basename alone, and two roots
// sharing a basename would leave the peer unresolvable in the one check whose payload is which
// other folder.
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

// A folder with no status-bearing file at all (context- or ticket-only) counts as live rather than
// being skipped, so a task abandoned before it ever got a plan still surfaces once it ages.
function staleFinding(task: Task, now: number, staleDays: number): UnrootedFinding | null {
  if (task.archived) return null;
  // Parked work is dormant by intent (references/workflow/task-backlog.md), so age says nothing
  // about a backlogged folder — this is the only check parking exempts.
  if (task.backlogged) return null;
  const { value, source } = lifecycleStatus(task);
  if (value != null && !LIVE_STATUSES.has(value)) return null;
  if (!task.updated) {
    warnings.push(`no .md mtime for ${task.path}: skipping the stale check`);
    return null;
  }
  const days = Math.floor((now - task.updated) / DAY_MS);
  if (days < staleDays) return null;
  // Three distinct facts, and the label keeps them apart: no status-bearing file at all, a plan
  // whose `**Status:**` wouldn't parse, and a real status. The last names its file when the result
  // stood in for a missing plan, the way the done-unarchived detail does.
  const label = source == null ? "no-plan" : (value ?? "no-status");
  const origin = value != null && !task.plan ? ` (derived from ${source})` : "";
  return { check: "stale", path: task.path, detail: `${label}${origin}, ${days} days stale` };
}

// A value the vocabulary doesn't hold is not a lifecycle state, so the stale and archive checks below
// both skip it — and a task no check reaches is exactly what this sweep exists to surface. Report the
// value the plan actually carries, so a typo or a vocabulary renamed out from under PLAN_VOCAB is
// visible rather than quietly unsupervised.
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

// A result written before the plan became the single status home may still carry a `**Status:**`
// header. Nothing repairs it and no reader acts on it, so it is reported as the legacy shape it is
// rather than judged: validating the value would resurrect the second lifecycle the contract
// deleted, and any value it holds — vocabulary or not — is equally inert.
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
  // A terminal task under a `Backlog/` is misfiled rather than merely unarchived — the backlog holds
  // unstarted work only (references/workflow/task-backlog.md) — so the detail names where it sits.
  const place = task.backlogged ? "parked in Backlog/ — belongs in Archive/" : "outside Archive/";
  return { check: "done-unarchived", path: task.path, detail: `${value}${origin}, ${place}` };
}

// The backlog's entry gate is *unstarted*: no `plan.md`, or a plan at `to-do`
// (references/workflow/task-backlog.md). Any other live status means work began where the folder
// lies, which parking cannot express — a live task pauses through `blocked` instead of moving. A
// plan that carries no parseable status can't be judged against the gate at all, and stale — the
// check that reports that shape everywhere else — is the one check parking exempts, so it is
// reported here rather than left silent. The gate is written on the plan, and an absent plan is the
// parked-intended state — unless a `result.md` exists: the file is created only once execution
// starts, so its presence alone fails the gate, whatever it does or does not say inside.
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

// GitHub's heading-anchor rule: lowercase, drop every character that is not a letter, digit,
// hyphen, underscore, or space, then map each space to a hyphen — so an em-dash vanishes and
// leaves the double hyphen the kit's own step anchors carry, while a `FLAG_LIKE_THIS` token keeps
// its underscores.
function slugify(heading: string): string {
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-");
}

// Compaction removes a section but leaves its title as a tombstone bullet under a `## Compacted`
// stub (references/workflow/reconciliation-compaction.md § The procedure), so a step link pointing at one is
// documented state, not a dead anchor.
const COMPACTED_HEADING = /^Compacted\b/;
const TOMBSTONE_BULLET = /^[ \t]*-[ \t]+(.+?)[ \t]*$/;

// A repeated heading takes GitHub's `-1`, `-2`, … suffix, so occurrences are counted rather than
// deduplicated; a result file with two `## Acceptance` sections really does have two anchors. GitHub
// also walks a candidate past every slug already assigned — `Foo`, `Foo-1`, `Foo` yields `foo-2` for
// the third — so allocation advances to an unclaimed slug rather than trusting the per-base count.
// Headings inside a fenced block are illustrative markdown, not anchors, so fences are tracked.
function headingSlugs(text: string): Set<string> {
  const seen = new Map<string, number>();
  const slugs = new Set<string>();
  // Heading-assigned slugs only: a tombstone bullet's slug resolves links but reserves nothing,
  // since compaction removed its rendered heading.
  const taken = new Set<string>();
  let inCompacted = false;
  for (const line of liveLines(text)) {
    const m = line.match(HEADING);
    if (m) {
      inCompacted = COMPACTED_HEADING.test(m[1]);
      const base = slugify(m[1]);
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
  const m = heading.match(/^Step[ \t]+(\d+)/);
  return m ? `Step ${m[1]}` : clip(heading, 40);
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
    // Any CommonMark list marker opens a goal bullet. The column-0 anchor is deliberate: a goal's
    // indented child bullet is prose, and reading it as a goal would report it as a malformed ID.
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

// references/workflow/task-authorship.md § Files expects a `## Current state` block on the result of
// a task whose plan is live, which is now the plan's state to declare. Terminal states are exempt —
// a legacy `done` result keeps its last rewrite frozen and never gains a block retroactively — and so
// is `to-do`, which owes no result file at all, so one found there is another check's drift.
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
  const kb = Buffer.byteLength(task.result.text, "utf8") / 1024;
  if (kb <= resultMaxKb) return null;
  return {
    check: "oversized-result",
    path: task.path,
    detail: `${task.result.file} is ${kb.toFixed(1)} KB, over the ${resultMaxKb} KB compaction trigger`,
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

// Every file under a one-sided item, so a whole missing or unmanaged subtree reports per path
// rather than as a single opaque line. A Dirent reflects lstat, so a symlink counts as a file.
function filesUnder(path: string, display: string, kind: PathKind): string[] {
  if (kind !== "dir") return [display];
  const files: string[] = [];
  for (const e of listEntries(path, display)) {
    if (skipInInstalls(e.name)) continue;
    files.push(...filesUnder(join(path, e.name), join(display, e.name), e.isDirectory() ? "dir" : "file"));
  }
  return files;
}

function unionNames(kitPath: string, installPath: string, display: string): string[] {
  const names = new Set<string>();
  for (const e of listEntries(kitPath, kitPath)) names.add(e.name);
  for (const e of listEntries(installPath, display)) names.add(e.name);
  return [...names].sort((a, b) => a.localeCompare(b, "en"));
}

// setup.ts copies skills with `verbatimSymlinks` (symlinks preserved) and references with
// `dereference` (symlinks materialized), so two links are compared by their targets. One side being
// a link and the other not is drift rather than a copy-mode difference: `dereference` reaches only
// references/, which carries no symlinks, while skills/ is copied link-preserving precisely so each
// skill's AGENTS.md and references resolve to the install-root originals. A materialized link holds
// the same bytes, so no comparison below would see the loss.
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

// The two install-root shared payloads are unlike a skill or an agent file: every installed skill's
// own `AGENTS.md` and `references` symlinks resolve into them, so an unmarked one is not a private
// file this check should ignore — it is what all of them now load, and setup.ts refuses the whole
// home over it. Reported with the remedy setup.ts names, because the usual answer to install-drift,
// rerunning setup.ts, exits 1 on this state instead of repairing it.
// Returned rather than filed, because where it lands depends on whether anything else was compared:
// in a home with no markers at all it is folded into the single never-installed line below.
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

// Only the items setup.ts marked as its own are compared; an unmarked same-named skill or agent
// file belongs to the user, so its content is none of this check's business — the two shared
// payloads above are the exception, and say why. The kit-side pass at the end covers what
// marker-scoping structurally cannot see: an item that was never installed carries no marker to be
// found.
function installFindings(kitRoot: string, homeArg: string): InstallResult {
  const home = resolve(homeArg);
  const display = basename(home) || homeArg;
  const findings: InstallFinding[] = [];
  let items = 0;
  // Paths the marker-owned pass compared, so the kit-side sweep below never walks them again: a
  // payload deleted out from under its surviving sibling marker (CORE_RULES.md, an agent file)
  // would otherwise report "missing in install" once per pass.
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
    .filter((e) => e.isFile() && e.name.startsWith(AGENT_MARKER_PREFIX));
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

  // A home setup.ts never installed into would otherwise report every kit file one by one; no marker
  // of any kind is a single fact about the home, so it reports as a single line. A shared-payload
  // conflict folds into that line rather than stacking beside it: it is why setup.ts refuses this
  // home, so dropping it would leave the never-installed state with no reason attached.
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

  // Absence is tested against the home path itself rather than its marker: a path that does not
  // exist cannot be a user's, so naming it claims no ownership the marker scheme withholds. Once
  // any marker proves setup.ts installed this home, every payload setup.ts would copy is expected;
  // an existing unmarked same-named path remains user-owned and is neither compared nor missing.
  // A path the marker pass compared is excluded — its verdict, missing included, is already filed.
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
    const option = NUMERIC_OPTIONS.find((o) => arg === o.flag || arg.startsWith(`${o.flag}=`));
    if (option) {
      const inline = arg.includes("=");
      // A separate value is peeked and consumed only once it validates: `argv[++i]` would take the
      // next argument whatever it is, and a swallowed task root leaves the walk short with nothing
      // in the JSON to say so.
      const raw = inline ? arg.slice(arg.indexOf("=") + 1) : argv[i + 1];
      if (/^\d+$/.test(String(raw ?? "").trim())) {
        values[option.key] = Number(raw);
        if (!inline) i++;
      } else {
        warnings.push(`ignoring ${option.flag} "${raw ?? ""}" (want a non-negative integer); using ${option.fallback}`);
        // A rejected value falls through to the positional branch only when it names something on
        // disk — that swallowed root is the case this peek exists for — or when it is itself a flag:
        // no numeric value can start with `-`, and the branches above intercept such a token before
        // it could reach the roots, so consuming one loses a flag and gains nothing. Anything else
        // was a typed flag value, so consume it: as a root it would be named in `unreadablePaths` as
        // store the sweep did not see, or, under `--installs`, take the kit-root slot and skip the
        // whole probe. An empty value is consumed for the same reason — `resolve("")` is the process
        // directory, which would walk the caller's own checkout as a store.
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
  // Slug → every folder carrying it, across all roots. A slug is globally unique by contract, so
  // this stays empty on a healthy set; it is filled during the per-root walk and judged after it,
  // because a collision can span roots and no root can be ruled out until every one is walked.
  const bySlug = new Map<string, SlugHolder[]>();
  const candidates: RootCandidate[] = roots
    .filter((rootArg) => isDirectory(rootArg, "root"))
    .map((rootArg) => {
      const rootDir = resolve(rootArg);
      // Canonicalize for the overlap comparison alone — findings keep the caller's own resolved
      // path, which is what a consumer matches them against.
      return { rootArg, rootDir, canonical: canonicalRoot(rootDir) };
    });
  // A root repeated, reached through a symlink, or overlapping another walks the same folders
  // twice: `scanned` overcounts, every finding doubles, and duplicate-slug reports a folder as
  // colliding with itself. Which roots to walk is therefore settled before any of them is
  // walked: the containment test only catches a root nested inside one already kept, so deciding
  // it in argument order would let the caller's ordering of an overlapping pair determine
  // whether the overlap is caught at all. An ancestor is a strict path prefix of its
  // descendants, so a pass over the candidates sorted by canonical path always reaches the outer
  // root first, and the sort is stable, so of two spellings of one root the caller's first
  // survives. The walk below then runs in argument order, which is the order findings are
  // emitted in.
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
    // The display path stays compact, while the resolved root keeps same-basename roots distinct.
    const tasks = collect(rootDir, basename(rootDir) || rootArg);
    for (const task of tasks) {
      const slug = basename(task.dir);
      // Only the fields the collision report reads: a whole-task copy would pin every parsed
      // plan.md, goals.md, and result.md body in memory until the process exits.
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
      // The content checks skip archived folders: they are frozen history no reconciler repairs
      // (references/workflow/task-archiving.md), so re-reporting their
      // imperfections every run would be permanent noise. A backlogged folder is not frozen — it is
      // future work a later reconcile still repairs — so it stays in them.
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
