#!/usr/bin/env node
// Performs the coordinator-side worktree merge gates defined by
// references/workflow/parallel-batch.md § Coordinator-side parallel batch — the raw delta against
// the batch baseline, the surface check that bounds it, the verified incorporation, and the removal
// that refuses until the incorporation has been proved to land.
// Zero dependencies; runs under Node type stripping — too old a Node fails as a parse error, not a
// version message. Floor in AGENTS.md § The `.ts` sources are unchecked by design.
// Run: node scripts/worktree-merge.ts baseline <tree> --out <manifest> [--prune <path>]...
//      node scripts/worktree-merge.ts check <worktree> --baseline <manifest> --surface <path>...
//                                     [--prune <path>]...
//      node scripts/worktree-merge.ts apply <worktree> --baseline <manifest> --into <tree>
//                                     --surface <path>... --receipt <file> [--prune <path>]...
//      node scripts/worktree-merge.ts remove <worktree> --receipt <file>
//      node scripts/worktree-merge.ts discard <worktree>
//
// Contract: stdout carries the delta and the outcome, one path per line, and the run exits 0 when it
// did the job. Exit 1 is an outcome the script decided — a surface escape, a conflict, an
// incorporation that did not verify, a removal with no verified receipt or of repository content —
// reported on stderr with nothing further attempted. Exit 2 is a run that could not be carried out at
// all: bad usage, an unreadable tree, a manifest that will not parse, a tree that cannot be measured
// the way the manifest was — all of them before anything is written, since once `apply` has copied,
// a measurement that will not run is an incorporation that did not verify and takes exit 1, naming
// the landed/did-not-land split as uncomputable rather than reporting one it never measured. Those
// three statuses are the convention this script shares with scripts/task-move.ts,
// scripts/task-state.ts, and scripts/pr-comments.ts.
//
// Why a script and not shell: the gates are ordered, and the ordering is the whole protection. Shell
// re-authored per run is where a worktree gets removed before the copy that was supposed to precede
// it has been proved — the failure this file exists to make structurally impossible. `apply` writes
// its receipt only after re-reading every path it wrote and matching it against the worktree's
// content, and `remove` refuses any worktree whose receipt does not carry that verification. A failed
// copy therefore leaves no receipt, and a worktree with no receipt cannot be removed — except through
// `discard`, which is how a worktree that never earned one (surface-escaping, hung, failed) goes.
//
// Manifests carry hashes, never content, so this script **detects and verifies but never
// reconstructs**. The `restore that exact capture` step the cited file names on a conflicting
// incorporation is deliberately not here: it needs the bytes, and the coordinator owns it. What the
// script gives a restore instead is exactness about what happened — the applied set, and on a
// verification failure either the precise split between the paths that landed and the paths that did
// not, or, where the measurement itself could not run, the statement that there is no split to give.
//
// A `baseline` manifest serves three roles: the two the cited file needs — the batch baseline every
// unit's change set is measured against, and the exact pre-unit capture of the shared tree taken at a
// unit's ordered position — and the health-boundary reference of
// references/engineering/boundary-scope.md § Reference and delta, whose delta a later `check`
// against that manifest computes. They are the same operation on a different tree at a different
// moment, so a change to what `baseline` captures or what `--prune` hides reaches all three.
//
// Git-ignored content: on a Git checkout every walk drops the untracked paths the repository ignores,
// and the manifest records `gitignore` so both sides of a comparison measure alike — a tree that
// cannot reproduce a `gitignore: true` measure is refused rather than compared against one. Seeding a
// worktree with `git worktree add` carries no ignored file across, so measuring them reads each of
// the shared tree's own (.DS_Store, editor and agent settings) as a deletion escaping the unit's
// surface, and each of the worktree's build output as an addition. Tracked content is unaffected:
// `check-ignore` lists ignored *untracked* paths only, so a force-added file matching an ignore
// pattern stays measured — Git enforcing the same guard the prune note below states. Each side asks
// its own index, and a worktree's index is HEAD, so a path the baseline measured stays measured on
// the other side whatever that index says: a force-add staged but not yet committed is tracked in
// the shared tree and an ignored untracked file in its worktree, and filtering both alike would read
// it as a deletion that `apply` then carries out.
//
// What the filter must never do is drop a path quietly enough that work goes missing under a verified
// receipt. A path this walk dropped — one the worktree holds and the ignore filter removed — that sits
// inside the unit's **declared surface** and whose content differs from the shared tree's is reported
// as `ignored <path> NOT MEASURED`, counted in the `ignored-divergent` trailer, and refused by `apply`
// before it writes anything — the unit was told to write there, so the difference is its own output,
// and incorporating around it would report `verified` over the loss and clear `remove` to take the
// worktree holding the only copy. The reverse direction needs no check: `git worktree add` carries no
// ignored file across, so an ignored path the shared tree holds and the worktree does not is a seeded
// worktree's steady state, not the unit's lost work. Outside the surface nothing is examined, so a
// worktree's build output stays as unmeasured as it should be; a same-tree comparison reads every path
// against itself and never diverges. This is the only place a path the ignore filter dropped is
// hashed; one `keep` holds is hashed by the walk itself, ignored or not.
//
// Prunes and tracked content: a `--prune` filters the baseline as well as the current walk, so a
// pruned path can never appear in a change set at all. That is what makes it right for tool state and
// wrong for anything the project tracks — a committed bundle, a checked-in generated client, a
// zero-installs cache. Callers name only untracked paths, and only those the ignore rules do not
// already cover *outside every declared surface*. Inside one, an ignored path the worktree holds and
// the shared tree does not is `ignored-divergent` and refuses the `apply` (§ Git-ignored content
// above), and a `--prune` is the remedy: it skips the path before the walk makes it a leaf, so it
// never reaches that report at all. What remains to name: output a project neither tracks nor
// ignores, and any tree outside a checkout, where there is nothing to ask. The caller-facing rule and
// its consequences live with each role
// (references/engineering/boundary-scope.md § Reference and delta,
// references/workflow/parallel-batch.md § Coordinator-side parallel batch).

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  chmodSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

// Pruned by name at every depth, whatever their type: `.git` is a directory in a main checkout and a
// file in a linked worktree, `node_modules` an installed tree that seeding links rather than copies
// and that nested packages carry their own of — walking either measures the tool, not the unit.
// A `--prune` is different: a root-relative path hiding that path alone, so `--prune cache` for a
// tool-state directory at the root cannot also hide a unit's edits under `src/cache`.
const ALWAYS_PRUNED = new Set([".git", "node_modules"]);
const MANIFEST_VERSION = 2;
const EXEC_MASK = 0o111;

const USAGE = [
  "usage: node scripts/worktree-merge.ts baseline <tree> --out <manifest> [--prune <path>]...",
  "       node scripts/worktree-merge.ts check <worktree> --baseline <manifest> --surface <path>... [--prune <path>]...",
  "       node scripts/worktree-merge.ts apply <worktree> --baseline <manifest> --into <tree> --surface <path>... --receipt <file> [--prune <path>]...",
  "       node scripts/worktree-merge.ts remove <worktree> --receipt <file>",
  "       node scripts/worktree-merge.ts discard <worktree>",
].join("\n");

type FileEntry = { readonly t: "f"; readonly h: string; readonly x: boolean };
type LinkEntry = { readonly t: "l"; readonly d: string };
type Entry = FileEntry | LinkEntry;

interface Manifest {
  readonly version: number;
  readonly root: string;
  readonly gitignore: boolean;
  readonly prunes: readonly string[];
  readonly entries: Record<string, Entry>;
}

type Op = "added" | "modified" | "deleted";
interface Change {
  readonly path: string;
  readonly op: Op;
}

interface Receipt {
  readonly version: number;
  readonly worktree: string;
  readonly into: string;
  readonly verified: boolean;
  readonly applied: readonly Change[];
}

// Every exit path unwinds through these rather than calling process.exit inline, so stderr is always
// written before the status is set and a partially-written stdout never outlives its own reason.
class Refused extends Error {}
class Unrunnable extends Error {}

function decided(message: string): never {
  throw new Refused(message);
}

function unrunnable(message: string): never {
  throw new Unrunnable(message);
}

// Identity paths go through realpath where they exist, so a receipt written under /private/tmp still
// matches a remove invoked as /tmp; a path that does not exist yet keeps its resolved form.
function canonical(path: string): string {
  try {
    return realpathSync(resolve(path));
  } catch {
    return resolve(path);
  }
}

function isInside(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}${sep}`);
}

// Absent covers a parent that is no longer a directory as well as a missing entry: after a unit turns
// `src/zoo/` into the file `src/zoo`, the shared tree's `src/zoo/x.ts` answers ENOTDIR, not ENOENT.
function lstatOrAbsent(path: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw error;
  }
}

// A path is present for the gates when a file or symlink sits there. A directory is not an entry
// (see walk), so a file the unit turned into a directory reads as deleted, exactly as the manifest
// has it, rather than as a deletion that failed to land.
function leafAt(path: string): ReturnType<typeof lstatSync> | undefined {
  const stat = lstatOrAbsent(path);
  return stat && (stat.isFile() || stat.isSymbolicLink()) ? stat : undefined;
}

// The one definition of what an entry is, taking a stat its caller already has. apply verifies the
// shared tree through entryAt and the worktree through walk and compares the two, so both go through
// here: a change made on one side alone would fail every incorporation with nothing naming why.
function entryFor(path: string, stat: ReturnType<typeof lstatSync>): Entry {
  if (stat.isSymbolicLink()) return { t: "l", d: readlinkSync(path) };
  return {
    t: "f",
    h: createHash("sha256").update(readFileSync(path)).digest("hex"),
    x: (stat.mode & EXEC_MASK) !== 0,
  };
}

function entryAt(path: string): Entry | undefined {
  const stat = leafAt(path);
  return stat && entryFor(path, stat);
}

// Node's rmSync refuses a symlink to a directory unless told to recurse, and recursing through one
// removes the link alone; unlinking a link outright keeps neither shape from depending on that.
function clearPath(target: string): void {
  const stat = lstatOrAbsent(target);
  if (!stat) return;
  if (stat.isSymbolicLink()) unlinkSync(target);
  else rmSync(target, { recursive: true, force: true });
}

// --- Walking -----------------------------------------------------------------------------------

// A declared prune is root-relative, exactly as a surface is: an absolute one inside the root is
// relativized rather than left to match nothing, and one outside it is a usage error. Silence is the
// failure that matters here — a prune that quietly matches nothing leaves the tool-state tree it was
// meant to hide measured, escaping every unit's surface. A prune resolving to the root itself is
// refused too, since hiding every path is never what a caller meant.
function normalizePrune(prune: string, root: string): string {
  const raw = isAbsolute(prune) ? relative(root, canonical(prune)) : prune.replace(/^\.\//, "");
  if (raw.startsWith("..")) unrunnable(`prune outside the root: ${prune}`);
  const normalized = raw.split(sep).join("/").replace(/\/+$/, "");
  if (normalized === "" || normalized === ".") unrunnable(`prune covers the whole tree: ${prune}`);
  return normalized;
}

function isPruned(path: string, prunes: readonly string[]): boolean {
  return (
    path.split("/").some((name) => ALWAYS_PRUNED.has(name)) ||
    prunes.some((prune) => prune !== "" && (path === prune || path.startsWith(`${prune}/`)))
  );
}

// The untracked paths of `root` the repository ignores, or undefined when `root` is not a Git
// checkout. One call carries the whole list, streamed over stdin because a few hundred paths would
// overflow argv, and read back unbounded because a pnpm store or a framework cache alone runs past
// Node's default 1 MiB reply buffer, failing the walk on exactly the trees the filter exists to
// drop. Exit 1 is success with nothing matched; the "not a git repository" stderr is what tells a
// missing checkout from a failure, the same discrimination checkoutHolding makes and for the same
// reason — a guard that could not read the tree refuses rather than reporting it unfiltered.
function gitIgnored(root: string, paths: readonly string[]): Set<string> | undefined {
  try {
    const listed = execFileSync("git", ["-C", root, "check-ignore", "-z", "--stdin"], {
      input: paths.join("\0"),
      stdio: "pipe",
      encoding: "utf8",
      maxBuffer: Infinity,
    });
    return new Set(listed.split("\0").filter((path) => path !== ""));
  } catch (error) {
    if ((error as { status?: number }).status === 1) return new Set();
    const stderr = String((error as { stderr?: Buffer }).stderr ?? "").trim();
    if (/not a git repository/i.test(stderr)) return undefined;
    unrunnable(`cannot list the git-ignored paths of ${root}: ${stderr || (error as Error).message}`);
  }
}

interface Walked {
  readonly entries: Record<string, Entry>;
  readonly gitignore: boolean;
  readonly ignoredDropped: readonly string[];
}

// Symlinks are recorded by their target and never followed: seeding links `node_modules` and the
// pinned tool-state directories into a worktree, and following one would walk an installed tree or
// escape the root entirely. A directory is not itself an entry — the contract measures paths whose
// content, presence, or absence differs, and an empty directory carries none of the three.
//
// `gitignore` is the manifest's own value, and omitting it makes this the walk that decides one —
// `baseline`'s. A later walk obeys what the baseline recorded instead of re-deciding it, so a
// `gitignore: false` baseline keeps measuring ignored paths even against a checkout and the two sides
// of a comparison can never be measured differently. `keep` is the set of paths the comparison has
// already decided to measure — the baseline's entries under `check`, the change set under `apply`'s
// verification — and they stay measured whatever this tree's index says (the header's note on the
// staged force-add).
function walk(
  root: string,
  prunes: readonly string[],
  gitignore?: boolean,
  keep: ReadonlySet<string> = new Set(),
): Walked {
  // Leaves are collected first and hashed after the ignore filter: an ignored cache is the largest
  // tree a walk meets, and hashing it only to drop every entry is the cost the filter removes.
  const leaves: { path: string; full: string; stat: ReturnType<typeof lstatSync> }[] = [];
  const unreadable: { path: string; dir: string; reason: string }[] = [];

  const visit = (dir: string): void => {
    let names: string[];
    try {
      names = readdirSync(dir).sort();
    } catch (error) {
      // Deferred, not fatal. The ignore filter has not run yet, and a directory the repository
      // ignores is content this walk was going to drop entirely — refusing here would fail the run on
      // exactly the trees the filter exists to remove, and a caller told an ignored path needs no
      // `--prune` has nothing left to reach for. The refusal below fires for whatever the filter does
      // not cover. The root itself is exempt: it has no path relative to itself to ask about.
      if (dir === root) unrunnable(`cannot read ${dir}: ${(error as Error).message}`);
      unreadable.push({ path: relative(root, dir).split(sep).join("/"), dir, reason: (error as Error).message });
      return;
    }
    for (const name of names) {
      const full = join(dir, name);
      const path = relative(root, full).split(sep).join("/");
      if (isPruned(path, prunes)) continue;
      const stat = lstatSync(full, { throwIfNoEntry: false });
      if (!stat) continue;
      if (stat.isDirectory()) {
        visit(full);
        continue;
      }
      if (stat.isSymbolicLink() || stat.isFile()) leaves.push({ path, full, stat });
    }
  };

  const stat = statSync(root, { throwIfNoEntry: false });
  if (!stat?.isDirectory()) unrunnable(`not a directory: ${root}`);
  visit(root);
  const ignored =
    gitignore === false
      ? undefined
      : gitIgnored(root, [...leaves.map((leaf) => leaf.path), ...unreadable.map((entry) => entry.path)]);
  if (ignored === undefined && gitignore) {
    unrunnable(`${root} is not a Git checkout, and the baseline it is measured against excluded git-ignored paths`);
  }
  for (const entry of unreadable) {
    if (!ignored?.has(entry.path)) unrunnable(`cannot read ${entry.dir}: ${entry.reason}`);
  }
  const entries: Record<string, Entry> = {};
  const ignoredDropped: string[] = [];
  for (const { path, full, stat } of leaves) {
    if (keep.has(path) || !ignored?.has(path)) entries[path] = entryFor(full, stat);
    else ignoredDropped.push(path);
  }
  return { entries, gitignore: ignored !== undefined, ignoredDropped };
}

function sameEntry(a: Entry, b: Entry): boolean {
  if (a.t !== b.t) return false;
  return a.t === "f" ? a.h === (b as FileEntry).h && a.x === (b as FileEntry).x : a.d === (b as LinkEntry).d;
}

// The change set: every path whose content, presence, or absence differs from the seed, tracked or
// untracked, never git-ignored. Sorted, so a delta reads the same on every run and a diff of two runs
// is a diff of substance.
function delta(baseline: Record<string, Entry>, current: Record<string, Entry>): Change[] {
  const changes: Change[] = [];
  for (const [path, entry] of Object.entries(current)) {
    const before = baseline[path];
    if (!before) changes.push({ path, op: "added" });
    else if (!sameEntry(entry, before)) changes.push({ path, op: "modified" });
  }
  for (const path of Object.keys(baseline)) {
    if (!current[path]) changes.push({ path, op: "deleted" });
  }
  return changes.sort((a, b) => a.path.localeCompare(b.path, "en"));
}

// --- Surfaces ----------------------------------------------------------------------------------

// A declared surface is repo-relative. An absolute one inside the baseline root is relativized
// rather than refused, because a packet often states absolute paths; one outside it is a usage
// error, not an empty surface that would silently pass every path as an escape.
function normalizeSurface(surface: string, root: string): string {
  const raw = isAbsolute(surface) ? relative(root, canonical(surface)) : surface.replace(/^\.\//, "");
  if (raw.startsWith("..")) unrunnable(`surface outside the baseline root: ${surface}`);
  const normalized = raw.split(sep).join("/").replace(/\/+$/, "");
  // The root itself — `.`, or an absolute surface equal to the root — is the surface every path is in.
  return normalized === "." ? "" : normalized;
}

// A surface matches a path exactly, or as a directory prefix. Prefix matching is what lets a unit
// declare a directory it owns without enumerating files it has not created yet.
function inSurface(path: string, surfaces: readonly string[]): boolean {
  return surfaces.some((s) => s === "" || path === s || path.startsWith(`${s}/`));
}

// --- Manifests and receipts ---------------------------------------------------------------------

function readManifest(file: string): Manifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    unrunnable(`cannot read manifest ${file}: ${(error as Error).message}`);
  }
  const manifest = parsed as Manifest;
  if (
    manifest?.version !== MANIFEST_VERSION ||
    typeof manifest.root !== "string" ||
    typeof manifest.gitignore !== "boolean" ||
    !Array.isArray(manifest.prunes) ||
    !manifest.entries
  ) {
    unrunnable(`not a worktree-merge manifest: ${file}`);
  }
  return manifest;
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

// --- Subcommands ---------------------------------------------------------------------------------

function cmdBaseline(tree: string, out: string, rawPrunes: readonly string[]): string[] {
  const root = canonical(tree);
  const prunes = rawPrunes.map((prune) => normalizePrune(prune, root));
  const { entries, gitignore } = walk(root, prunes);
  const manifest: Manifest = { version: MANIFEST_VERSION, root, gitignore, prunes: [...prunes], entries };
  writeJson(resolve(out), manifest);
  return [`baseline ${root} -> ${resolve(out)}`, `paths ${Object.keys(entries).length}`];
}

interface Checked {
  readonly changes: readonly Change[];
  readonly divergentIgnored: readonly string[];
  readonly escapes: readonly Change[];
  readonly gitignore: boolean;
  readonly lines: readonly string[];
  readonly prunes: readonly string[];
  readonly surfaces: readonly string[];
}

// The git-ignore filter drops a path from both sides silently, and a path inside the unit's declared
// surface is the one place that silence costs work: the unit was told to write there, so a path this
// walk dropped whose content differs from the baseline tree's is the unit's own output going nowhere —
// never incorporated, and `apply` would otherwise report `verified` over the loss. Only the surface is
// examined, so a worktree's build output stays as unmeasured as it should be, and only here is a
// dropped one ever hashed. The baseline's own drops need no such check: `git worktree add` seeds no
// ignored file into a worktree, so an ignored path only the baseline holds is that worktree's steady
// state, not lost work. A same-tree comparison — the boundary role, where the walked tree is the
// baseline's own root — reads every path against itself and so can never diverge.
function divergentIgnored(
  root: string,
  manifest: Manifest,
  dropped: readonly string[],
  surfaces: readonly string[],
): string[] {
  if (root === manifest.root) return [];
  return dropped.filter((path) => {
    if (!inSurface(path, surfaces)) return false;
    const here = treeEntryAt(root, path);
    const there = treeEntryAt(manifest.root, path);
    if (here === undefined || there === undefined) return here !== there;
    return !sameEntry(here, there);
  });
}

function checkWorktree(
  worktree: string,
  manifest: Manifest,
  surfaces: readonly string[],
  prunes: readonly string[],
): Checked {
  const root = canonical(worktree);
  // The baseline's own prunes travel with it, and a prune given only now filters the baseline as
  // well: a directory measured on one side and excluded on the other would read as an added tree on
  // every unit, or as a deletion of every seed file beneath it that apply would then carry out.
  // A prune given now is root-relative to the baseline's root, the same root the surfaces below
  // resolve against; the manifest's own were normalized when it was written.
  const allPrunes = [...manifest.prunes, ...prunes.map((prune) => normalizePrune(prune, manifest.root))];
  const { entries: current, ignoredDropped } = walk(
    root,
    allPrunes,
    manifest.gitignore,
    new Set(Object.keys(manifest.entries)),
  );
  const baseline = Object.fromEntries(
    Object.entries(manifest.entries).filter(([path]) => !isPruned(path, allPrunes)),
  );
  const changes = delta(baseline, current);
  const normalized = surfaces.map((s) => normalizeSurface(s, manifest.root));
  const divergent = divergentIgnored(root, manifest, ignoredDropped, normalized);
  const escapes = changes.filter((c) => !inSurface(c.path, normalized));
  const lines = changes.map((c) => `${c.op.padEnd(8)} ${c.path}${inSurface(c.path, normalized) ? "" : "  ESCAPE"}`);
  return {
    changes,
    divergentIgnored: divergent,
    escapes,
    gitignore: manifest.gitignore,
    // The trailer's third segment joins only when something diverged, so the two-segment form the
    // boundary role documents stays exactly as it was and the segment's presence is itself the signal.
    lines: [
      ...lines,
      ...divergent.map((path) => `ignored  ${path}  NOT MEASURED`),
      `delta ${changes.length} · escapes ${escapes.length}` +
        (divergent.length > 0 ? ` · ignored-divergent ${divergent.length}` : ""),
    ],
    prunes: allPrunes,
    surfaces: normalized,
  };
}

function cmdCheck(
  worktree: string,
  manifestFile: string,
  surfaces: readonly string[],
  prunes: readonly string[],
): string[] {
  const checked = checkWorktree(worktree, readManifest(manifestFile), surfaces, prunes);
  if (checked.escapes.length > 0) {
    process.stdout.write(`${checked.lines.join("\n")}\n`);
    decided(`surface escape: ${checked.escapes.map((c) => c.path).join(", ")}`);
  }
  return [...checked.lines];
}

// The first ancestor of a path, below the root, that is a symlink — or none. A path under one is not
// a path of the tree: walk never descends into a link, so no read that verifies against the walk
// may go through one either, or it would report the link's target as the tree's own content.
function symlinkAncestor(root: string, path: string): string | undefined {
  const parts = path.split("/");
  for (let depth = 1; depth < parts.length; depth += 1) {
    const ancestor = parts.slice(0, depth).join("/");
    if (lstatOrAbsent(join(root, ancestor))?.isSymbolicLink()) return ancestor;
  }
  return undefined;
}

function treeEntryAt(root: string, path: string): Entry | undefined {
  return symlinkAncestor(root, path) === undefined ? entryAt(join(root, path)) : undefined;
}

function presentInTree(root: string, path: string): boolean {
  return symlinkAncestor(root, path) === undefined && leafAt(join(root, path)) !== undefined;
}

// Whatever occupies the exact path, a directory included — the question the conflict gate asks,
// where treeEntryAt asks what the manifest records. leafAt sees only files and symlinks, so a
// directory sitting where a unit adds a file reads as absent to every other read here.
function occupantAt(root: string, path: string): ReturnType<typeof lstatSync> | undefined {
  return symlinkAncestor(root, path) === undefined ? lstatOrAbsent(join(root, path)) : undefined;
}

// Every leaf under a directory of the tree, root-relative. Deliberately unpruned: the caller asks
// whether a change set accounts for everything there, and a pruned subtree would read as accounted
// for when nothing accounts for it.
function leavesUnder(root: string, path: string): string[] {
  const found: string[] = [];
  const visit = (rel: string): void => {
    for (const name of readdirSync(join(root, rel))) {
      const child = `${rel}/${name}`;
      const stat = lstatSync(join(root, child), { throwIfNoEntry: false });
      if (!stat) continue;
      if (stat.isDirectory()) visit(child);
      else found.push(child);
    }
  };
  visit(path);
  return found;
}

// Every target is refused when an ancestor below the shared root is a symlink that the change set is
// not itself about to remove: a unit that swapped a directory for a link pointing outside the tree
// would otherwise have that directory's baseline descendants deleted through the link, outside the
// tree. A link the unit replaced with a real directory is deleted first (see the ordering below),
// so the paths beneath it are written into the directory, never through the link.
function assertContained(shared: string, changes: readonly Change[]): void {
  const deleted = new Set(changes.filter((c) => c.op === "deleted").map((c) => c.path));
  for (const change of changes) {
    const ancestor = symlinkAncestor(shared, change.path);
    if (ancestor !== undefined && !deleted.has(ancestor)) {
      decided(`refusing ${change.path}: ${ancestor} is a symlink in the shared tree, nothing applied`);
    }
  }
}

// An absolute link into the transient worktree would dangle once that worktree is removed, so it is
// re-pointed at the same path under the shared tree. Every other target is mirrored verbatim.
function mirrorLinkTarget(target: string, from: string, shared: string): string {
  return isInside(target, from) ? join(shared, relative(from, target)) : target;
}

// A directory is not an entry, so emptying one leaves it standing in the shared tree while the
// worktree has no such path. Remove what a deletion emptied, deepest first, stopping at the first
// ancestor that is non-empty, is not a plain directory, or lies outside the unit's declared surface —
// the surface bounds this cleanup exactly as it bounds every other write. It runs only after a clean
// copy and swallows its own errors: a directory that will not go is cosmetic, never a failed merge.
function pruneEmptied(shared: string, changes: readonly Change[], surfaces: readonly string[]): void {
  const seen = new Set<string>();
  for (const change of changes) {
    if (change.op !== "deleted") continue;
    let dir = dirname(change.path);
    while (dir !== "." && dir !== sep && !seen.has(dir) && inSurface(dir, surfaces)) {
      seen.add(dir);
      try {
        const full = join(shared, dir);
        if (!lstatOrAbsent(full)?.isDirectory() || readdirSync(full).length > 0) break;
        rmdirSync(full);
      } catch {
        break;
      }
      dir = dirname(dir);
    }
  }
}

// The usage checks come first: a run that could not be carried out at all owes exit 2, and letting
// a misdirected run's surface check answer ahead of them would report it as exit 1 instead.
function applyTargets(worktree: string, into: string, manifest: Manifest): { from: string; shared: string } {
  const from = canonical(worktree);
  const shared = canonical(into);
  if (!statSync(shared, { throwIfNoEntry: false })?.isDirectory()) unrunnable(`not a directory: ${shared}`);
  if (shared !== manifest.root) unrunnable(`--into ${shared} is not the baseline's root ${manifest.root}`);
  if (isInside(from, shared) || isInside(shared, from)) {
    unrunnable(`worktree ${from} and --into ${shared} must be disjoint trees`);
  }
  return { from, shared };
}

// The shared tree must still be the baseline at every path this unit changes. A path another unit
// or the user has moved since is a conflict the coordinator restores from and falls back on
// (the cited file's step 2); overwriting it here would lose that work with a verified receipt.
function assertBaselineIntact(shared: string, manifest: Manifest, checked: Checked): void {
  const deletedPaths = new Set(checked.changes.filter((c) => c.op === "deleted").map((c) => c.path));
  const conflicts = checked.changes.filter((change) => {
    const before = manifest.entries[change.path];
    if (before !== undefined) {
      const now = treeEntryAt(shared, change.path);
      return now === undefined || !sameEntry(before, now);
    }
    // An added path: whatever already sits there is a conflict, a directory included — the copy
    // clears the path before writing, so an unaccounted-for directory would go recursively under a
    // verified receipt. The one legitimate occupant is a directory this change set empties, which
    // is the unit that replaced a directory with a file or a link.
    const occupant = occupantAt(shared, change.path);
    if (occupant === undefined) return false;
    if (!occupant.isDirectory()) return true;
    return !leavesUnder(shared, change.path).every((leaf) => deletedPaths.has(leaf));
  });
  if (conflicts.length === 0) return;
  process.stdout.write(`${checked.lines.join("\n")}\n`);
  decided(
    `conflict, nothing applied — the shared tree no longer matches the baseline at: ${conflicts
      .map((c) => c.path)
      .join(", ")}`,
  );
}

// Mirror deletions, then modify and copy. No commit, no branch, no merge — the cited file's rule, and
// the reason this is a copy rather than a Git operation. Deletions go first so a directory's baseline
// descendants are gone before anything the unit put at that directory's path (a file, a symlink) is
// installed there. A copy that throws part-way (a read-only parent, a full disk) is returned rather
// than rethrown, so the caller's verification still runs instead of the exit-2 path: the shared tree
// has already changed, and what the coordinator needs is the split between what landed and what did
// not.
function incorporate(from: string, shared: string, checked: Checked): string | undefined {
  const ordered = [
    ...checked.changes.filter((c) => c.op === "deleted"),
    ...checked.changes.filter((c) => c.op !== "deleted"),
  ];
  try {
    for (const change of ordered) {
      const source = join(from, change.path);
      const target = join(shared, change.path);
      if (change.op === "deleted") {
        if (leafAt(target)) clearPath(target);
        continue;
      }
      mkdirSync(dirname(target), { recursive: true });
      const stat = lstatSync(source);
      // Clear whatever holds the path first: copyFileSync onto a symlink writes through it into the
      // link's target, which may sit outside the unit's surface, and a path whose type changed (a
      // directory become a file) cannot be overwritten in place.
      clearPath(target);
      if (stat.isSymbolicLink()) {
        symlinkSync(mirrorLinkTarget(readlinkSync(source), from, shared), target);
        continue;
      }
      copyFileSync(source, target);
      chmodSync(target, stat.mode);
    }
  } catch (error) {
    return (error as Error).message;
  }
  pruneEmptied(shared, checked.changes, checked.surfaces);
  return undefined;
}

// Verify before the receipt, not after: this is the read that would have caught a copy which
// silently did nothing, while the worktree it came from is still on disk to re-apply from.
function splitVerified(from: string, shared: string, checked: Checked): { landed: Change[]; missed: Change[] } {
  const landed: Change[] = [];
  const missed: Change[] = [];
  const { entries: worktreeEntries } = walk(
    from,
    checked.prunes,
    checked.gitignore,
    new Set(checked.changes.map((change) => change.path)),
  );
  for (const change of checked.changes) {
    const actual = treeEntryAt(shared, change.path);
    if (change.op === "deleted") {
      (actual ? missed : landed).push(change);
      continue;
    }
    const written = worktreeEntries[change.path];
    const expected: Entry | undefined =
      written?.t === "l" ? { t: "l", d: mirrorLinkTarget(written.d, from, shared) } : written;
    (expected && actual && sameEntry(expected, actual) ? landed : missed).push(change);
  }
  return { landed, missed };
}

// The gates in the order the cited file sets them, each phase above refusing before the next may run.
// The ordering is the whole protection, so it stays visible in this one sequence rather than being
// threaded through the phases themselves.
function cmdApply(
  worktree: string,
  manifestFile: string,
  into: string,
  surfaces: readonly string[],
  receiptFile: string,
  prunes: readonly string[],
): string[] {
  const manifest = readManifest(manifestFile);
  const { from, shared } = applyTargets(worktree, into, manifest);

  const checked = checkWorktree(worktree, manifest, surfaces, prunes);
  if (checked.escapes.length > 0) {
    process.stdout.write(`${checked.lines.join("\n")}\n`);
    decided(`surface escape, nothing applied: ${checked.escapes.map((c) => c.path).join(", ")}`);
  }
  // Before anything is written: a divergent ignored path inside the surface is work this run cannot
  // carry, and applying around it would report `verified` over the loss and clear `remove` to take
  // the worktree holding the only copy. Refusing here leaves both trees and the worktree intact.
  if (checked.divergentIgnored.length > 0) {
    process.stdout.write(`${checked.lines.join("\n")}\n`);
    decided(
      "git-ignored paths inside the surface differ between the trees and cannot be incorporated, " +
        `nothing applied: ${checked.divergentIgnored.join(", ")}` +
        " — a unit's own build output under its surface takes --prune <path> at the baseline",
    );
  }
  assertBaselineIntact(shared, manifest, checked);
  assertContained(shared, checked.changes);

  const copyFailure = incorporate(from, shared, checked);
  // Past the copy the shared tree has already changed, so a verification that cannot run owes the
  // caller exit 1 — never the exit 2 that means a run was not carried out at all. What it cannot owe
  // is the split: that needs the walk, and calling every change did-not-land would state as fact the
  // one thing this branch cannot know, at the one moment a restore depends on knowing it. It names
  // the split uncomputable instead, and the restore from the pre-unit capture is unconditional.
  let split: { landed: Change[]; missed: Change[] } | undefined;
  let verifyFailure: string | undefined;
  try {
    split = splitVerified(from, shared, checked);
  } catch (error) {
    verifyFailure = `cannot verify the incorporation: ${(error as Error).message}`;
  }
  if (split === undefined) {
    process.stdout.write(`${checked.lines.join("\n")}\n`);
    decided(
      `incorporation did not verify (${[copyFailure, verifyFailure].filter((r) => r !== undefined).join("; ")}), ` +
        "no receipt written; which paths landed cannot be computed — " +
        "restore the shared tree from the pre-unit capture in full",
    );
  }
  const { landed, missed } = split;
  if (missed.length > 0 || copyFailure !== undefined) {
    process.stdout.write(`${checked.lines.join("\n")}\n`);
    if (landed.length > 0) process.stdout.write(`${landed.map((c) => `landed   ${c.path}`).join("\n")}\n`);
    decided(
      `incorporation did not verify${copyFailure === undefined ? "" : ` (${copyFailure})`}, ` +
        `no receipt written; landed ${landed.length}, did not land ${missed.length}: ` +
        missed.map((c) => c.path).join(", "),
    );
  }

  const receipt: Receipt = {
    version: MANIFEST_VERSION,
    worktree: from,
    into: shared,
    verified: true,
    applied: checked.changes,
  };
  writeJson(resolve(receiptFile), receipt);
  return [...checked.lines, `applied ${checked.changes.length} · verified`, `receipt ${resolve(receiptFile)}`];
}

// The checkout a directory sits inside, or none. `git -C` walks up from the directory itself, so a
// scratch tree outside any repository answers with a failure rather than a path. That one answer is
// the only failure meaning "no checkout": an absent git, dubious ownership, and a broken repository
// all fail too, and the caller's next step is a recursive delete, so a guard that could not read the
// tree refuses rather than reporting it unguarded.
function checkoutHolding(target: string): string | undefined {
  try {
    const top = execFileSync("git", ["-C", target, "rev-parse", "--show-toplevel"], {
      stdio: "pipe",
      encoding: "utf8",
    }).trim();
    return top === "" ? undefined : top;
  } catch (error) {
    const stderr = String((error as { stderr?: Buffer }).stderr ?? "").trim();
    if (/not a git repository/i.test(stderr)) return undefined;
    unrunnable(`cannot tell whether ${target} sits inside a checkout: ${stderr || (error as Error).message}`);
  }
}

// A linked worktree carries `.git` as a file and goes through Git; a plain scratch directory carries
// none and is removed directly. A `.git` directory is a checkout, and the one thing this never
// removes — and a Git refusal is reported as one, never turned into a recursive delete.
function removeTree(target: string, repo: string): void {
  const gitEntry = lstatOrAbsent(join(target, ".git"));
  if (gitEntry?.isDirectory()) {
    decided(`refusing to remove ${target}: it holds a .git directory, so it is a checkout, not a worktree`);
  }
  if (gitEntry?.isFile()) {
    try {
      execFileSync("git", ["-C", repo, "worktree", "remove", "--force", target], { stdio: "pipe" });
    } catch (error) {
      const stderr = String((error as { stderr?: Buffer }).stderr ?? "").trim();
      decided(`git worktree remove refused ${target}${stderr ? `: ${stderr}` : ""}`);
    }
    return;
  }
  // A coordinator worktree is either the linked worktree above or scratch outside any checkout. A
  // plain directory inside one is repository content, and the recursive delete below is the only
  // removal with nothing but a path behind it, so it refuses rather than trusting what it was handed.
  const holding = checkoutHolding(target);
  if (holding !== undefined) {
    decided(
      `refusing to remove ${target}: it sits inside the ${holding} checkout and carries no worktree ` +
        `pointer, so it is repository content, not a coordinator worktree`,
    );
  }
  rmSync(target, { recursive: true, force: true });
}

function cmdRemove(worktree: string, receiptFile: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolve(receiptFile), "utf8"));
  } catch {
    decided(`no readable receipt at ${resolve(receiptFile)} — nothing proves this worktree's work landed`);
  }
  const receipt = parsed as Receipt;
  if (
    receipt?.version !== MANIFEST_VERSION ||
    !Array.isArray(receipt.applied) ||
    typeof receipt.worktree !== "string" ||
    typeof receipt.into !== "string"
  ) {
    decided(`not a worktree-merge receipt: ${resolve(receiptFile)}`);
  }
  if (receipt.verified !== true) decided(`receipt records an unverified incorporation: ${resolve(receiptFile)}`);
  if (receipt.worktree !== canonical(worktree)) {
    decided(`receipt is for ${receipt.worktree}, not ${canonical(worktree)}`);
  }

  // A presence re-check, not a hash one. The receipt already carries the exact verification; what a
  // wholesale loss of the shared tree between apply and remove would defeat is presence, and a path
  // a later ordered unit legitimately rewrote must not read here as a failure.
  const lost = receipt.applied.filter((change) => {
    const present = presentInTree(receipt.into, change.path);
    return change.op === "deleted" ? present : !present;
  });
  if (lost.length > 0) decided(`applied paths are no longer as recorded: ${lost.map((c) => c.path).join(", ")}`);

  const target = canonical(worktree);
  removeTree(target, receipt.into);
  return [`removed ${target}`];
}

// Removes a worktree that never earned a receipt — surface-escaping, hung, failed — through the same
// refusals as remove. The checkout a linked worktree belongs to is read from its `.git` file.
function cmdDiscard(worktree: string): string[] {
  const target = canonical(worktree);
  if (!statSync(target, { throwIfNoEntry: false })?.isDirectory()) unrunnable(`not a directory: ${target}`);
  const gitFile = join(target, ".git");
  const pointer = leafAt(gitFile)?.isFile() ? readFileSync(gitFile, "utf8") : "";
  const checkout = /^gitdir: (.+?)\/\.git\/worktrees\/[^/\n]+\s*$/m.exec(pointer)?.[1];
  removeTree(target, checkout ?? target);
  return [`discarded ${target}`];
}

// --- CLI ------------------------------------------------------------------------------------------

interface Args {
  readonly command: string;
  readonly positional: string;
  readonly values: Record<string, string[]>;
}

const REPEATABLE = new Set(["--surface", "--prune"]);
const SINGLE = new Set(["--out", "--baseline", "--into", "--receipt"]);

// Which options each command takes. A command that silently accepts an option meaning nothing to it
// is how `discard <worktree> --receipt <file>` — one word away from `remove` — removes a worktree
// without the receipt gate and reports success.
const COMMAND_OPTIONS: Record<string, readonly string[]> = {
  baseline: ["--out", "--prune"],
  check: ["--baseline", "--surface", "--prune"],
  apply: ["--baseline", "--into", "--surface", "--receipt", "--prune"],
  remove: ["--receipt"],
  discard: [],
};

function parseArgs(argv: readonly string[]): Args {
  const [command, ...rest] = argv;
  if (!command) unrunnable(USAGE);
  const allowed = COMMAND_OPTIONS[command];
  if (!allowed) unrunnable(`unknown command ${command}\n${USAGE}`);
  const values: Record<string, string[]> = {};
  const positionals: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    if (!REPEATABLE.has(token) && !SINGLE.has(token)) unrunnable(`unknown option ${token}\n${USAGE}`);
    if (!allowed.includes(token)) unrunnable(`${command} does not take ${token}\n${USAGE}`);
    const value = rest[i + 1];
    if (!value || value.startsWith("--")) unrunnable(`${token} takes a value\n${USAGE}`);
    if (SINGLE.has(token) && values[token]) unrunnable(`${token} given twice\n${USAGE}`);
    (values[token] ??= []).push(value);
    i += 1;
  }
  if (positionals.length !== 1) unrunnable(`${command} takes exactly one path argument\n${USAGE}`);
  return { command, positional: positionals[0], values };
}

function one(args: Args, option: string): string {
  const value = args.values[option]?.[0];
  if (!value) unrunnable(`${args.command} requires ${option}\n${USAGE}`);
  return value;
}

function many(args: Args, option: string, required: boolean): string[] {
  const values = args.values[option] ?? [];
  if (required && values.length === 0) unrunnable(`${args.command} requires at least one ${option}\n${USAGE}`);
  return values;
}

function main(argv: readonly string[]): string[] {
  const args = parseArgs(argv);
  const prunes = many(args, "--prune", false);
  switch (args.command) {
    case "baseline":
      return cmdBaseline(args.positional, one(args, "--out"), prunes);
    case "check":
      return cmdCheck(args.positional, one(args, "--baseline"), many(args, "--surface", true), prunes);
    case "apply":
      return cmdApply(
        args.positional,
        one(args, "--baseline"),
        one(args, "--into"),
        many(args, "--surface", true),
        one(args, "--receipt"),
        prunes,
      );
    case "remove":
      return cmdRemove(args.positional, one(args, "--receipt"));
    case "discard":
      return cmdDiscard(args.positional);
    // Unreachable — parseArgs refuses a command COMMAND_OPTIONS has no entry for. It stays as the
    // exhaustiveness guard: without it a case added there and forgotten here returns undefined, and
    // the caller's join fails as an exit-2 TypeError instead of naming the command.
    default:
      unrunnable(`unknown command ${args.command}\n${USAGE}`);
  }
}

try {
  process.stdout.write(`${main(process.argv.slice(2)).join("\n")}\n`);
} catch (error) {
  if (error instanceof Refused) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  } else if (error instanceof Unrunnable) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  } else {
    process.stderr.write(`worktree-merge failed: ${(error as Error).message}\n`);
    process.exitCode = 2;
  }
}
