#!/usr/bin/env node
// Walks task roots and reports lifecycle health findings for the `maintain` skill.
// Zero dependencies; Node >= 18.
// Run: node scripts/health-check.mjs [--stale-days N] [--result-max-kb N] <root> [<root>...]
//  or: node scripts/health-check.mjs --installs <kit-root> <home> [<home>...]
// Emitted `check` values: the task walk reports `stale`, `done-unarchived`, `unknown-status`,
// `dead-anchor`, `goal-id`, `no-current-state`, and `oversized-result`; `--installs` walks no tasks
// and reports `install-drift` instead. Archived folders are counted in `scanned` but exempt from
// every check.
// Contract: stdout is exactly one JSON object,
// {"findings":[…],"scanned":N,"unreadable":N,"unreadablePaths":[…]}. Task findings are
// {check,path,detail,root}, with `root` the resolved absolute task root; `--installs` findings are
// {check,path,detail}. `scanned` counts the task folders walked — or, under `--installs`, the
// marker-owned items compared — and `unreadablePaths` names everything this run could not open, so
// findings alone are never read as coverage (`scanned` is a floor while it is non-empty). Warnings
// go to stderr and the exit status is always 0, so a partly unreadable store still parses.

import { lstatSync, readdirSync, readFileSync, readlinkSync, statSync } from "node:fs";
import { join, resolve, basename } from "node:path";

// stdout is asynchronous on a macOS pipe, so the report is written and the module then ends: calling
// process.exit after the write would discard whatever the pipe buffer could not take, truncating the
// JSON above 64 KB. A reader that closes early then raises EPIPE on a stream nothing awaits, and
// swallowing that is what keeps the always-zero exit status the contract above promises.
process.stdout.on("error", (err) => {
  if (err.code !== "EPIPE") throw err;
});

// Pruned at every depth because the walk would never finish otherwise. A helper directory needs no
// entry here — isTaskDir already rejects a folder holding no role file — and a name-based prune costs
// a real task its scan, silently: `.git` and every other dotted name are skipped by the walk itself.
const SKIP_DIRS = new Set(["node_modules"]);
const ROLE_FILES = ["CONTEXT.md", "goals.md", "plan.md", "result.md", "ticket.md"];
const ROLE_SUFFIXES = [".plan.md", ".result.md", ".spec.md", ".ticket.md"];
// Closed plan vocabulary defined by references/workflow/task-lifecycle.md § Status values; a value
// outside it is "unknown" rather than a guess, so a typo never reads as a lifecycle state.
const PLAN_VOCAB = new Set(["to-do", "executing", "blocked", "in-review", "done", "skipped"]);
// Closed result vocabulary from the same section; the result file has no `to-do` or `skipped` state.
const RESULT_VOCAB = new Set(["executing", "blocked", "in-review", "done"]);
// Terminal (finished) plan states per references/workflow/task-lifecycle.md § Terminal vs. live
// states. Read here rather than baked into the skill so a vocabulary change lands in one place.
const TERMINAL_STATUSES = new Set(["done", "skipped"]);
// The non-terminal complement of the plan vocabulary, from the same section.
const LIVE_STATUSES = new Set(["to-do", "executing", "blocked", "in-review"]);
// The same complement over the result vocabulary: references/workflow/task-lifecycle.md § Files
// expects a `## Current state` block on a live result, and carves out a legacy `done` one, which
// keeps its last rewrite frozen and never gains a block retroactively.
const LIVE_RESULT_STATUSES = new Set([...RESULT_VOCAB].filter((v) => !TERMINAL_STATUSES.has(v)));
// references/workflow/task-layout.md § Archiving finished tasks: new archives are created as
// `Archive/`, but an existing one is recognized case-insensitively, so a pre-rename `archive/`
// (or the same folder on a case-insensitive filesystem) still counts as archived.
const ARCHIVE_DIR = /^archive$/i;
const DEFAULT_STALE_DAYS = 30;
const DAY_MS = 86_400_000;
// The compaction trigger is owned by references/workflow/reconciliation.md § Compaction, which
// `maintain` reads at run time and passes as --result-max-kb; this default only keeps a bare run
// honest when no value is supplied.
const DEFAULT_RESULT_MAX_KB = 20;

const CURRENT_STATE = /^##[ \t]+Current state\b/im;
// references/workflow/task-layout.md § The goals file: every `## Goals` bullet leads with a durable
// `G<n>` ID (optionally followed by an `(external)` token) and the IDs are unique across the file.
const GOALS_HEADING = /^##[ \t]+Goals\b/;
const GOAL_ID = /^G\d+$/;
// implement-task appends `([result](<file>#<anchor>))` to each step it checks off, so a `- [x]`
// step whose link is absent or unresolvable has lost the evidence that justifies the checkbox.
const STEP_HEADING = /^#{2,6}[ \t]+Step\b/;
const HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*$/;
const FENCE = /^[ \t]*(`{3,}|~{3,})/;
const CHECKED_STEP = /^[ \t]*-[ \t]+\[[xX]\]/;
// implement-task appends the evidence link at the end of the step line, but the step's own prose
// may cite a literal `([result](…))` as an example — so the last match is the link, never the first.
const RESULT_LINK = /\(\[result\]\(([^()]*)\)\)/g;

// Ownership markers written by setup.sh; only a marked item is kit-managed and comparable.
const MARKER = ".agents-kit";
const CORE_RULES_MARKER = ".agents-kit-core-rules";
const AGENT_MARKER_PREFIX = ".agents-kit-";
// setup.sh installs each host's native agent format only, keyed by the home's own directory name.
const AGENT_EXTENSIONS = new Map([[".claude", "md"], [".codex", "toml"]]);
// setup.sh's recursive copies carry OS-generated files into the homes, where each side is then
// rewritten independently — drift no redeploy can durably clear. Matched by name rather than by a
// dotfile rule, because a skill may legitimately ship one (a template's `.gitignore`) and it stays
// comparable.
const OS_ARTIFACTS = new Set([".DS_Store", ".localized", "Thumbs.db"]);
const skipInInstalls = (name) => name === MARKER || OS_ARTIFACTS.has(name) || name.startsWith("._");

const warnings = [];
// What this run could not read, reported in the contract rather than only on stderr: a caller reading
// findings alone would take a store it never opened for a clean one. `scanned` is a floor while this
// is non-empty. Warnings that are not coverage gaps — an ignored flag, a missing root — stay stderr-only.
const unreadablePaths = [];

// What kind of thing could not be read rides on the warning; `unreadablePaths` carries the path
// alone, in the same display shape a finding's own `path` uses, so a caller can line a coverage gap
// up against the findings instead of parsing a label back out of it.
function unreachable(kind, path, err) {
  warnings.push(`unreadable ${kind} ${path}: ${err.code ?? err.message}`);
  unreadablePaths.push(path);
}

function listEntries(dir, display, optional = false) {
  try {
    return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"));
  } catch (err) {
    if (!(optional && err.code === "ENOENT")) unreachable("dir", display, err);
    return [];
  }
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isDirectory(pathArg, label) {
  try {
    if (statSync(resolve(pathArg)).isDirectory()) return true;
    warnings.push(`not a directory: ${pathArg}`);
  } catch (err) {
    unreachable(label, pathArg, err);
  }
  return false;
}

function isAbsent(pathArg) {
  try {
    statSync(resolve(pathArg));
    return false;
  } catch (err) {
    return err.code === "ENOENT";
  }
}

function fileText(path, display) {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    unreachable("file", display, err);
    return null;
  }
}

function clip(text, max = 60) {
  const line = text.trim();
  return line.length > max ? line.slice(0, max - 1) + "…" : line;
}

function isTaskDir(entries) {
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  return files.some((f) => ROLE_FILES.includes(f) || ROLE_SUFFIXES.some((s) => f.endsWith(s) && f !== s));
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
// opener's marker at its own length or longer (CommonMark), so a shorter or different-marker run
// inside an open block is content: a boolean flag would invert on it and hand back what it skipped.
function* liveLines(text) {
  let fence = null;
  for (const line of text.split("\n")) {
    const marker = line.match(FENCE)?.[1];
    if (marker) {
      if (!fence) fence = { char: marker[0], len: marker.length };
      else if (marker[0] === fence.char && marker.length >= fence.len) fence = null;
      continue;
    }
    if (!fence) yield line;
  }
}

// references/workflow/task-layout.md § Doc-task files bounds a status header to the file's header
// block — under the `#` title, above the first `##` section, never inside fenced or quoted content —
// so the scan stops at the first `##`-or-deeper heading and a status-shaped body line (a log entry,
// a quoted example) is not a candidate.
function rawStatus(text) {
  const header = [];
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

function normalize(raw, vocab) {
  if (raw == null) return { value: null, raw: null };
  const cleaned = raw.replace(/[*_`]/g, "").trim();
  const token = (cleaned.split(/[\s,;.]+/)[0] ?? "").toLowerCase().replace(/[^a-z-]/g, "");
  if (vocab.has(token)) return { value: token, raw: cleaned };
  return { value: "unknown", raw: cleaned.length > 60 ? cleaned.slice(0, 57) + "…" : cleaned };
}

function roleFileName(entries, exactName, suffix) {
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  if (files.includes(exactName)) return exactName;
  return suffix ? files.find((f) => f.endsWith(suffix) && f !== suffix) : undefined;
}

function readRoleFile(dir, display, entries, exactName, suffix) {
  const name = roleFileName(entries, exactName, suffix);
  if (!name) return null;
  return { file: name, text: fileText(join(dir, name), join(display, name)) };
}

function readStatusFrom(dir, display, entries, exactName, suffix, vocab) {
  const role = readRoleFile(dir, display, entries, exactName, suffix);
  if (!role) return null;
  if (role.text == null) return { ...role, value: "unknown", raw: "unreadable" };
  return { ...role, ...normalize(rawStatus(role.text), vocab) };
}

function lastModified(dir, entries) {
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

function collect(rootDir, rootDisplay) {
  const tasks = [];
  // Every directory is listed exactly once and its entries handed down: the listing that decides
  // whether a folder is a task is the same one the recursion walks. Listing it a second time would
  // report an unreadable directory as two coverage gaps, one per pass.
  const walk = (dir, display, entries, archived) => {
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
      const child = join(dir, e.name);
      const childDisplay = join(display, e.name);
      const childEntries = listEntries(child, childDisplay);
      if (ARCHIVE_DIR.test(e.name)) {
        walk(child, childDisplay, childEntries, true);
        continue;
      }
      if (isTaskDir(childEntries)) {
        tasks.push({
          dir: child,
          path: childDisplay,
          archived,
          plan: readStatusFrom(child, childDisplay, childEntries, "plan.md", ".plan.md", PLAN_VOCAB),
          result: readStatusFrom(child, childDisplay, childEntries, "result.md", ".result.md", RESULT_VOCAB),
          goals: readRoleFile(child, childDisplay, childEntries, "goals.md", null),
          updated: lastModified(child, childEntries),
        });
        continue;
      }
      walk(child, childDisplay, childEntries, archived);
    }
  };
  walk(rootDir, rootDisplay, listEntries(rootDir, rootDisplay), false);
  return tasks;
}

// The plan owns the lifecycle, so it wins whenever it exists; the result file only stands in for a
// folder that has no plan at all, where it is the sole remaining record of how the task ended.
function lifecycleStatus(task) {
  if (task.plan) return { value: task.plan.value, source: task.plan.file };
  if (task.result) return { value: task.result.value, source: task.result.file };
  return { value: null, source: null };
}

// A folder with no status-bearing file at all (context- or ticket-only) counts as live rather than
// being skipped, so a task abandoned before it ever got a plan still surfaces once it ages.
function staleFinding(task, now, staleDays) {
  if (task.archived) return null;
  const { value, source } = lifecycleStatus(task);
  if (value != null && !LIVE_STATUSES.has(value)) return null;
  if (!task.updated) {
    warnings.push(`no .md mtime for ${task.path}: skipping the stale check`);
    return null;
  }
  const days = Math.floor((now - task.updated) / DAY_MS);
  if (days < staleDays) return null;
  // Three distinct facts, and the label keeps them apart: no status-bearing file at all, a file
  // whose `**Status:**` wouldn't parse, and a real status. The last names its file when the result
  // stood in for a missing plan, the way the done-unarchived detail does.
  const label = source == null ? "no-plan" : (value ?? "no-status");
  const origin = value != null && !task.plan ? ` (status from ${source})` : "";
  return { check: "stale", path: task.path, detail: `${label}${origin}, ${days} days stale` };
}

// A value the vocabulary doesn't hold is not a lifecycle state, so the stale and archive checks below
// both skip it — and a task no check reaches is exactly what this sweep exists to surface. Report the
// value the file actually carries, per file, so a typo or a vocabulary renamed out from under
// PLAN_VOCAB is visible rather than quietly unsupervised.
function unknownStatusFindings(task) {
  if (task.archived) return [];
  const out = [];
  for (const role of [task.plan, task.result]) {
    if (role?.text == null || role.value !== "unknown") continue;
    out.push({
      check: "unknown-status",
      path: task.path,
      detail: `${role.file} carries an unrecognized status: ${role.raw}`,
    });
  }
  return out;
}

function doneUnarchivedFinding(task) {
  if (task.archived) return null;
  const { value, source } = lifecycleStatus(task);
  if (!TERMINAL_STATUSES.has(value)) return null;
  const origin = task.plan ? "" : ` (status from ${source})`;
  return { check: "done-unarchived", path: task.path, detail: `${value}${origin}, outside Archive/` };
}

// GitHub's heading-anchor rule: lowercase, drop every character that is not a letter, digit,
// hyphen, underscore, or space, then map each space to a hyphen — so an em-dash vanishes and
// leaves the double hyphen the kit's own step anchors carry, while a `FLAG_LIKE_THIS` token keeps
// its underscores.
function slugify(heading) {
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-");
}

// Compaction removes a section but leaves its title as a tombstone bullet under a `## Compacted`
// stub (references/workflow/reconciliation.md § Compaction), so a step link pointing at one is
// documented state, not a dead anchor.
const COMPACTED_HEADING = /^Compacted\b/;
const TOMBSTONE_BULLET = /^[ \t]*-[ \t]+(.+?)[ \t]*$/;

// A repeated heading takes GitHub's `-1`, `-2`, … suffix, so occurrences are counted rather than
// deduplicated; a result file with two `## Acceptance` sections really does have two anchors. GitHub
// also walks a candidate past every slug already assigned — `Foo`, `Foo-1`, `Foo` yields `foo-2` for
// the third — so allocation advances to an unclaimed slug rather than trusting the per-base count.
// Headings inside a fenced block are illustrative markdown, not anchors, so fences are tracked.
function headingSlugs(text) {
  const seen = new Map();
  const slugs = new Set();
  // Heading-assigned slugs only: a tombstone bullet's slug resolves links but reserves nothing,
  // since compaction removed its rendered heading.
  const taken = new Set();
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

function stepLabel(heading) {
  const m = heading.match(/^Step[ \t]+(\d+)/);
  return m ? `Step ${m[1]}` : clip(heading, 40);
}

function anchorFindings(task) {
  const out = [];
  if (!task.plan?.text) return out;
  const slugCache = new Map();
  const report = (step, detail) => out.push({ check: "dead-anchor", path: task.path, detail: `${step}: ${detail}` });
  let step = null;
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

function goalIdFindings(task) {
  const out = [];
  if (!task.goals?.text) return out;
  const seen = new Set();
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

function hasCurrentState(text) {
  for (const line of liveLines(text)) {
    if (CURRENT_STATE.test(line)) return true;
  }
  return false;
}

function currentStateFinding(task) {
  if (!task.result?.text) return null;
  if (!LIVE_RESULT_STATUSES.has(task.result.value)) return null;
  if (hasCurrentState(task.result.text)) return null;
  return {
    check: "no-current-state",
    path: task.path,
    detail: `${task.result.value} ${task.result.file} has no "## Current state" block`,
  };
}

function oversizedResultFinding(task, resultMaxKb) {
  if (!task.result?.text) return null;
  const kb = Buffer.byteLength(task.result.text, "utf8") / 1024;
  if (kb <= resultMaxKb) return null;
  return {
    check: "oversized-result",
    path: task.path,
    detail: `${task.result.file} is ${kb.toFixed(1)} KB, over the ${resultMaxKb} KB compaction trigger`,
  };
}

function kindOf(path, display) {
  let st;
  try {
    st = lstatSync(path);
  } catch (err) {
    if (err.code === "ENOENT") return "missing";
    unreachable("path", display, err);
    return "unreadable";
  }
  if (st.isSymbolicLink()) return "link";
  if (st.isDirectory()) return "dir";
  if (st.isFile()) return "file";
  return "other";
}

function followedKind(path) {
  try {
    const st = statSync(path);
    return st.isDirectory() ? "dir" : st.isFile() ? "file" : "other";
  } catch {
    return "missing";
  }
}

function linkTarget(path, display) {
  try {
    return readlinkSync(path);
  } catch (err) {
    unreachable("symlink", display, err);
    return null;
  }
}

function bytesOf(path, display) {
  try {
    return readFileSync(path);
  } catch (err) {
    unreachable("file", display, err);
    return null;
  }
}

// Every file under a one-sided item, so a whole missing or unmanaged subtree reports per path
// rather than as a single opaque line. A Dirent reflects lstat, so a symlink counts as a file.
function filesUnder(path, display, kind) {
  if (kind !== "dir") return [display];
  const files = [];
  for (const e of listEntries(path, display)) {
    if (skipInInstalls(e.name)) continue;
    files.push(...filesUnder(join(path, e.name), join(display, e.name), e.isDirectory() ? "dir" : "file"));
  }
  return files;
}

function unionNames(kitPath, installPath, display) {
  const names = new Set();
  for (const e of listEntries(kitPath, kitPath)) names.add(e.name);
  for (const e of listEntries(installPath, display)) names.add(e.name);
  return [...names].sort((a, b) => a.localeCompare(b, "en"));
}

// setup.sh copies skills with `cp -R` (symlinks preserved) and references with `cp -RfL` (symlinks
// materialized), so the two sides can legitimately disagree on link-ness: compare two links by
// their targets, and a link facing a regular file by the content each resolves to.
function comparePath(kitPath, installPath, display, out) {
  const drift = (path, detail) => out.push({ check: "install-drift", path, detail });
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
  const kit = kitKind === "link" ? followedKind(kitPath) : kitKind;
  const install = installKind === "link" ? followedKind(installPath) : installKind;
  if (kit === "dir" && install === "dir") {
    for (const name of unionNames(kitPath, installPath, display)) {
      if (skipInInstalls(name)) continue;
      comparePath(join(kitPath, name), join(installPath, name), join(display, name), out);
    }
    return;
  }
  if (kit === "file" && install === "file") {
    const kitBytes = bytesOf(kitPath, kitPath);
    const installBytes = bytesOf(installPath, display);
    if (kitBytes == null || installBytes == null) return;
    if (!kitBytes.equals(installBytes)) drift(display, "differs from kit source");
    return;
  }
  drift(display, "differs from kit source");
}

// Only the items setup.sh marked as its own are compared; an unmarked same-named skill, references
// dir, or agent file belongs to the user, so its content is none of this check's business. The
// kit-side pass at the end covers what marker-scoping structurally cannot see: an item that was
// never installed carries no marker to be found.
function installFindings(kitRoot, homeArg) {
  const home = resolve(homeArg);
  const display = basename(home) || homeArg;
  const findings = [];
  let items = 0;
  // Paths the marker-owned pass compared, so the kit-side sweep below never walks them again: a
  // payload deleted out from under its surviving sibling marker (CORE_RULES.md, an agent file)
  // would otherwise report "missing in install" once per pass.
  const compared = new Set();

  for (const entry of listEntries(join(home, "skills"), join(display, "skills"), true)) {
    if (!entry.isDirectory() || !isFile(join(home, "skills", entry.name, MARKER))) continue;
    items++;
    compared.add(join("skills", entry.name));
    comparePath(
      join(kitRoot, "skills", entry.name),
      join(home, "skills", entry.name),
      join(display, "skills", entry.name),
      findings,
    );
  }

  if (isFile(join(home, "references", MARKER))) {
    items++;
    compared.add("references");
    comparePath(join(kitRoot, "references"), join(home, "references"), join(display, "references"), findings);
  }

  if (isFile(join(home, CORE_RULES_MARKER))) {
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

  // A home setup.sh never installed into would otherwise report every kit file one by one; no marker
  // of any kind is a single fact about the home, so it reports as a single line.
  if (items === 0) {
    findings.push({ check: "install-drift", path: display, detail: "no kit markers — never installed" });
    return { findings, items };
  }

  // Absence is tested against the home path itself rather than its marker: a path that does not
  // exist cannot be a user's, so naming it claims no ownership the marker scheme withholds. Once
  // any marker proves setup.sh installed this home, every payload setup.sh would copy is expected;
  // an existing unmarked same-named path remains user-owned and is neither compared nor missing.
  // A path the marker pass compared is excluded — its verdict, missing included, is already filed.
  const absent = (rel) => !compared.has(rel) && kindOf(join(home, rel), join(display, rel)) === "missing";
  const kitOnly = [];
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

const NUMERIC_OPTIONS = [
  { flag: "--stale-days", key: "staleDays", fallback: DEFAULT_STALE_DAYS },
  { flag: "--result-max-kb", key: "resultMaxKb", fallback: DEFAULT_RESULT_MAX_KB },
];

function parseArgs(argv) {
  const roots = [];
  const values = { staleDays: DEFAULT_STALE_DAYS, resultMaxKb: DEFAULT_RESULT_MAX_KB };
  let installs = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--installs") {
      installs = true;
      continue;
    }
    const option = NUMERIC_OPTIONS.find((o) => arg === o.flag || arg.startsWith(`${o.flag}=`));
    if (option) {
      const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++i];
      if (/^\d+$/.test(String(raw ?? "").trim())) values[option.key] = Number(raw);
      else warnings.push(`ignoring ${option.flag} "${raw ?? ""}" (want a non-negative integer); using ${option.fallback}`);
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
const findings = [];
let scanned = 0;

if (installs) {
  const [kitRootArg, ...homes] = roots;
  if (kitRootArg == null || homes.length === 0) {
    warnings.push("usage: node scripts/health-check.mjs --installs <kit-root> <home> [<home>...]");
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
    warnings.push("no task root given; usage: node scripts/health-check.mjs [--stale-days N] [--result-max-kb N] <root> [<root>...]");
  }
  for (const rootArg of roots) {
    if (!isDirectory(rootArg, "root")) continue;
    // The display path stays compact, while the resolved root keeps same-basename roots distinct.
    const rootDir = resolve(rootArg);
    const tasks = collect(rootDir, basename(rootDir) || rootArg);
    const rootFindings = [];
    scanned += tasks.length;
    for (const task of tasks) {
      const single = [staleFinding(task, now, staleDays), doneUnarchivedFinding(task)];
      // The content checks skip archived folders: they are frozen history no reconciler repairs
      // (references/workflow/task-layout.md § Archiving finished tasks), so re-reporting their
      // imperfections every run would be permanent noise.
      if (!task.archived) {
        single.push(currentStateFinding(task), oversizedResultFinding(task, resultMaxKb));
        rootFindings.push(...anchorFindings(task), ...goalIdFindings(task), ...unknownStatusFindings(task));
      }
      for (const finding of single) {
        if (finding) rootFindings.push(finding);
      }
    }
    findings.push(...rootFindings.map((finding) => ({ ...finding, root: rootDir })));
  }
}

process.stdout.write(JSON.stringify({
  findings,
  scanned,
  unreadable: unreadablePaths.length,
  unreadablePaths,
}) + "\n");
for (const w of warnings) console.error(`[health-check] ${w}`);
