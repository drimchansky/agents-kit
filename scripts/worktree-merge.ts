#!/usr/bin/env node
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

class Refused extends Error {}
class Unrunnable extends Error {}

function decided(message: string): never {
  throw new Refused(message);
}

function unrunnable(message: string): never {
  throw new Unrunnable(message);
}

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

function lstatOrAbsent(path: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw error;
  }
}

function leafAt(path: string): ReturnType<typeof lstatSync> | undefined {
  const stat = lstatOrAbsent(path);
  return stat && (stat.isFile() || stat.isSymbolicLink()) ? stat : undefined;
}

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

function clearPath(target: string): void {
  const stat = lstatOrAbsent(target);
  if (!stat) return;
  if (stat.isSymbolicLink()) unlinkSync(target);
  else rmSync(target, { recursive: true, force: true });
}

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

function walk(
  root: string,
  prunes: readonly string[],
  gitignore?: boolean,
  keep: ReadonlySet<string> = new Set(),
): Walked {
  const leaves: { path: string; full: string; stat: ReturnType<typeof lstatSync> }[] = [];
  const unreadable: { path: string; dir: string; reason: string }[] = [];

  const visit = (dir: string): void => {
    let names: string[];
    try {
      names = readdirSync(dir).sort();
    } catch (error) {
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

function normalizeSurface(surface: string, root: string): string {
  const raw = isAbsolute(surface) ? relative(root, canonical(surface)) : surface.replace(/^\.\//, "");
  if (raw.startsWith("..")) unrunnable(`surface outside the baseline root: ${surface}`);
  const normalized = raw.split(sep).join("/").replace(/\/+$/, "");

  return normalized === "." ? "" : normalized;
}

function inSurface(path: string, surfaces: readonly string[]): boolean {
  return surfaces.some((surface) => surface === "" || path === surface || path.startsWith(`${surface}/`));
}

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
  const normalized = surfaces.map((surface) => normalizeSurface(surface, manifest.root));
  const divergent = divergentIgnored(root, manifest, ignoredDropped, normalized);
  const escapes = changes.filter((change) => !inSurface(change.path, normalized));
  const lines = changes.map((change) => `${change.op.padEnd(8)} ${change.path}${inSurface(change.path, normalized) ? "" : "  ESCAPE"}`);
  return {
    changes,
    divergentIgnored: divergent,
    escapes,
    gitignore: manifest.gitignore,
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
    decided(`surface escape: ${checked.escapes.map((change) => change.path).join(", ")}`);
  }
  return [...checked.lines];
}

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

function occupantAt(root: string, path: string): ReturnType<typeof lstatSync> | undefined {
  return symlinkAncestor(root, path) === undefined ? lstatOrAbsent(join(root, path)) : undefined;
}

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

function assertContained(shared: string, changes: readonly Change[]): void {
  const deleted = new Set(changes.filter((change) => change.op === "deleted").map((change) => change.path));
  for (const change of changes) {
    const ancestor = symlinkAncestor(shared, change.path);
    if (ancestor !== undefined && !deleted.has(ancestor)) {
      decided(`refusing ${change.path}: ${ancestor} is a symlink in the shared tree, nothing applied`);
    }
  }
}

function mirrorLinkTarget(target: string, from: string, shared: string): string {
  return isInside(target, from) ? join(shared, relative(from, target)) : target;
}

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

function assertBaselineIntact(shared: string, manifest: Manifest, checked: Checked): void {
  const deletedPaths = new Set(checked.changes.filter((change) => change.op === "deleted").map((change) => change.path));
  const conflicts = checked.changes.filter((change) => {
    const before = manifest.entries[change.path];
    if (before !== undefined) {
      const now = treeEntryAt(shared, change.path);
      return now === undefined || !sameEntry(before, now);
    }

    const occupant = occupantAt(shared, change.path);
    if (occupant === undefined) return false;
    if (!occupant.isDirectory()) return true;
    return !leavesUnder(shared, change.path).every((leaf) => deletedPaths.has(leaf));
  });
  if (conflicts.length === 0) return;
  process.stdout.write(`${checked.lines.join("\n")}\n`);
  decided(
    `conflict, nothing applied — the shared tree no longer matches the baseline at: ${conflicts
      .map((change) => change.path)
      .join(", ")}`,
  );
}

function incorporate(from: string, shared: string, checked: Checked): string | undefined {
  const ordered = [
    ...checked.changes.filter((change) => change.op === "deleted"),
    ...checked.changes.filter((change) => change.op !== "deleted"),
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
    decided(`surface escape, nothing applied: ${checked.escapes.map((change) => change.path).join(", ")}`);
  }

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
      `incorporation did not verify (${[copyFailure, verifyFailure].filter((failure) => failure !== undefined).join("; ")}), ` +
        "no receipt written; which paths landed cannot be computed — " +
        "restore the shared tree from the pre-unit capture in full",
    );
  }
  const { landed, missed } = split;
  if (missed.length > 0 || copyFailure !== undefined) {
    process.stdout.write(`${checked.lines.join("\n")}\n`);
    if (landed.length > 0) process.stdout.write(`${landed.map((change) => `landed   ${change.path}`).join("\n")}\n`);
    decided(
      `incorporation did not verify${copyFailure === undefined ? "" : ` (${copyFailure})`}, ` +
        `no receipt written; landed ${landed.length}, did not land ${missed.length}: ` +
        missed.map((change) => change.path).join(", "),
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

  const lost = receipt.applied.filter((change) => {
    const present = presentInTree(receipt.into, change.path);
    return change.op === "deleted" ? present : !present;
  });
  if (lost.length > 0) decided(`applied paths are no longer as recorded: ${lost.map((change) => change.path).join(", ")}`);

  const target = canonical(worktree);
  removeTree(target, receipt.into);
  return [`removed ${target}`];
}

function cmdDiscard(worktree: string): string[] {
  const target = canonical(worktree);
  if (!statSync(target, { throwIfNoEntry: false })?.isDirectory()) unrunnable(`not a directory: ${target}`);
  const gitFile = join(target, ".git");
  const pointer = leafAt(gitFile)?.isFile() ? readFileSync(gitFile, "utf8") : "";
  const checkout = /^gitdir: (.+?)\/\.git\/worktrees\/[^/\n]+\s*$/m.exec(pointer)?.[1];
  removeTree(target, checkout ?? target);
  return [`discarded ${target}`];
}

interface Args {
  readonly command: string;
  readonly positional: string;
  readonly values: Record<string, string[]>;
}

const REPEATABLE = new Set(["--surface", "--prune"]);
const SINGLE = new Set(["--out", "--baseline", "--into", "--receipt"]);

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
