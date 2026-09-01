#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { holdsRoleFile } from "./lifecycle-constants.ts";

const PLAN_FILE = "plan.md";
const RESULT_FILE = "result.md";
const USAGE = "usage: node scripts/commit-scan.ts <task-dir>";
const COMMIT_CAP = 20;
const LOG_FORMAT = "--pretty=format:%x00%h %ad %s";
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

const FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*(.*)$/;
const HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*$/;
const STEP_TITLE = /^Step[ \t]+(\d+[a-z]*)\b/i;
const CHECKBOX = /^[ \t]*-[ \t]+\[([ xX])\]/;
const WHAT_FIELD = /\*\*What:?\*\*:?[ \t]*(.*)$/i;
const TOUCHES_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Touches:?\*\*:?[ \t]*(.*)$/i;
const CURRENT_STATE_HEADING = /^Current state\b/i;
const POINTERS_FIELD = /^[ \t]*[-*+]?[ \t]*\*\*Pointers:?\*\*:?[ \t]*(.*)$/i;
const WATERMARK_ENTRY = /\bSHA[ \t]+([0-9a-fA-F]{7,40})\b/;
const BRANCH_ENTRY = /\bbranch[ \t]+`([^`]+)`[ \t]*(?:\((removed[^)]*)\))?/i;
const CODE_SPAN = /`([^`]+)`/g;
const PATH_TOKEN = /^[A-Za-z0-9._@+*-]+(?:\/[A-Za-z0-9._@+*-]+)*$/;
const FILE_SUFFIX = /\.[A-Za-z0-9]+$/;
const COMMIT_HEADER = /^([0-9a-fA-F]+)[ \t]+(\d{4}-\d{2}-\d{2})[ \t]+(.*)$/;
const NOT_A_REPOSITORY = /not a git repository/i;

export type ScanState = "ok" | "no-watermark" | "orphaned" | "no-checkout";
export type StepClassification = "candidate" | "info";

export interface PlanStep {
  readonly number: string;
  readonly checked: boolean;
  readonly paths: readonly string[];
}

export interface Pointers {
  readonly watermark: string | null;
  readonly branch: string | null;
  readonly branchRemoved: boolean;
}

export interface ScanCommit {
  readonly sha: string;
  readonly date: string;
  readonly subject: string;
  readonly paths: readonly string[];
}

export interface ScanStep {
  readonly number: string;
  readonly checked: boolean;
  readonly paths: readonly string[];
  readonly pathExists: boolean;
  readonly classification: StepClassification | null;
  readonly commits: readonly string[];
}

export interface CommitScan {
  readonly taskDir: string;
  readonly repo: string | null;
  readonly pathsInRepo: boolean;
  readonly watermark: string | null;
  readonly branch: string | null;
  readonly ref: string | null;
  readonly refFallback: string | null;
  readonly state: ScanState;
  readonly commits: readonly ScanCommit[];
  readonly total: number;
  readonly steps: readonly ScanStep[];
}

const warnings: string[] = [];

class Exit extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

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

function headingText(line: string): string | null {
  return line.match(HEADING)?.[1] ?? null;
}

export function pathsIn(text: string): readonly string[] {
  const found: string[] = [];
  for (const span of text.matchAll(CODE_SPAN)) {
    const raw = span[1].trim().replace(/^\.\//, "");
    const token = raw.replace(/\/+$/, "");
    if (token === "" || !PATH_TOKEN.test(token)) continue;
    if (raw === token && !token.includes("/") && !FILE_SUFFIX.test(token)) continue;
    found.push(token);
  }
  return found;
}

interface DraftStep {
  readonly number: string;
  checked: boolean;
  sawCheckbox: boolean;
  sawTouches: boolean;
  readonly paths: string[];
}

export function parsePlanSteps(text: string): readonly PlanStep[] {
  const drafts: DraftStep[] = [];
  let step: DraftStep | null = null;
  for (const line of liveLines(text)) {
    const heading = headingText(line);
    if (heading !== null) {
      const title = heading.match(STEP_TITLE);
      step = null;
      if (!title) continue;
      step = { number: title[1].toLowerCase(), checked: false, sawCheckbox: false, sawTouches: false, paths: [] };
      drafts.push(step);
      continue;
    }
    if (step === null) continue;
    const box = line.match(CHECKBOX);
    if (box && !step.sawCheckbox) {
      step.sawCheckbox = true;
      step.checked = box[1].toLowerCase() === "x";
      const what = line.match(WHAT_FIELD);
      if (what) step.paths.push(...pathsIn(what[1]));
      continue;
    }
    const touches = line.match(TOUCHES_FIELD);
    if (touches && !step.sawTouches) {
      step.sawTouches = true;
      step.paths.push(...pathsIn(touches[1]));
    }
  }
  return drafts.map((draft) => ({
    number: draft.number,
    checked: draft.checked,
    paths: [...new Set(draft.paths)],
  }));
}

function pointersLine(text: string): string | null {
  let inCurrentState = false;
  let sawCurrentState = false;
  let blockLevel = 0;
  let scoped: string | null = null;
  let anywhere: string | null = null;
  for (const line of liveLines(text)) {
    const heading = headingText(line);
    if (heading !== null) {
      const level = line.match(/^#+/)?.[0].length ?? 0;
      if (CURRENT_STATE_HEADING.test(heading)) {
        inCurrentState = true;
        sawCurrentState = true;
        blockLevel = level;
      } else if (inCurrentState && level <= blockLevel) {
        inCurrentState = false;
      }
      continue;
    }
    const pointers = line.match(POINTERS_FIELD);
    if (!pointers) continue;
    if (inCurrentState && scoped === null) scoped = pointers[1];
    if (anywhere === null) anywhere = pointers[1];
  }
  return sawCurrentState ? scoped : anywhere;
}

export function parsePointers(text: string): Pointers {
  const line = pointersLine(text);
  if (line === null) return { watermark: null, branch: null, branchRemoved: false };
  const watermark = line.match(WATERMARK_ENTRY)?.[1] ?? null;
  const branch = line.match(BRANCH_ENTRY);
  return {
    watermark: watermark === null ? null : watermark.toLowerCase(),
    branch: branch?.[1].trim() ?? null,
    branchRemoved: branch?.[2] !== undefined,
  };
}

export function parseCommitLog(text: string): readonly ScanCommit[] {
  const commits: ScanCommit[] = [];
  for (const record of text.split("\0")) {
    const lines = record.replace(/^\n+/, "").split("\n");
    const header = lines[0].match(COMMIT_HEADER);
    if (!header) continue;
    const paths = lines.slice(1).map((line) => line.trim()).filter((line) => line !== "");
    commits.push({
      sha: header[1],
      date: header[2],
      subject: header[3].trim(),
      paths: [...new Set(paths)],
    });
  }
  return commits;
}

function touches(commitPath: string, stepPath: string): boolean {
  return commitPath === stepPath || commitPath.startsWith(`${stepPath}/`);
}

export function classifySteps(
  steps: readonly PlanStep[],
  commits: readonly ScanCommit[],
  present: ReadonlySet<string>,
): readonly ScanStep[] {
  return steps.map((step) => {
    const pathExists = step.paths.some((path) => present.has(path));
    const nominating = commits
      .filter((commit) => commit.paths.some((path) => step.paths.some((named) => touches(path, named))))
      .map((commit) => commit.sha);
    const classification: StepClassification | null =
      nominating.length === 0 ? null : step.checked ? "info" : pathExists ? "candidate" : null;
    return { number: step.number, checked: step.checked, paths: step.paths, pathExists, classification, commits: nominating };
  });
}

interface GitRun {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

function git(cwd: string, args: readonly string[]): GitRun {
  try {
    const stdout = execFileSync("git", ["-C", cwd, ...args], {
      stdio: "pipe",
      encoding: "utf8",
      maxBuffer: GIT_MAX_BUFFER,
    });
    return { ok: true, stdout, stderr: "" };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    if (failure.code === "ENOENT") throw new Exit(2, `git is not available: ${failure.message}`);
    return { ok: false, stdout: failure.stdout ?? "", stderr: (failure.stderr ?? "").trim() };
  }
}

function checkoutHolding(target: string): string | null {
  const top = git(target, ["rev-parse", "--show-toplevel"]);
  if (top.ok) {
    const root = top.stdout.trim();
    return root === "" ? null : root;
  }
  if (NOT_A_REPOSITORY.test(top.stderr)) return null;
  throw new Exit(2, `cannot tell whether ${target} sits inside a checkout: ${top.stderr || "git failed"}`);
}

function branchResolves(repo: string, branch: string): boolean {
  const ref = `refs/heads/${branch}`;
  const listed = git(repo, ["for-each-ref", "--format=%(refname)", ref]);
  if (!listed.ok) throw new Exit(2, `cannot list refs in ${repo}: ${listed.stderr || "git failed"}`);
  return listed.stdout.split("\n").some((line) => line.trim() === ref);
}

function readOptional(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") warnings.push(`unreadable ${path}: ${code ?? (err as Error).message}`);
    return null;
  }
}

function scan(taskDir: string): CommitScan {
  let names: string[];
  try {
    names = readdirSync(taskDir);
  } catch (err) {
    throw new Exit(2, `cannot read ${taskDir}: ${(err as NodeJS.ErrnoException).code ?? (err as Error).message}`);
  }
  if (!holdsRoleFile(names)) throw new Exit(2, `${taskDir} is not a task folder. ${USAGE}`);

  const steps = parsePlanSteps(readOptional(join(taskDir, PLAN_FILE)) ?? "");
  const pointers = parsePointers(readOptional(join(taskDir, RESULT_FILE)) ?? "");
  const repo = checkoutHolding(taskDir);
  const present = new Set(
    repo === null ? [] : steps.flatMap((step) => step.paths).filter((path) => existsSync(join(repo, path))),
  );
  const pathsInRepo = present.size > 0;

  let ref: string | null = null;
  let refFallback: string | null = null;
  let state: ScanState = "no-checkout";
  let enumerated: readonly ScanCommit[] = [];

  if (repo !== null && pathsInRepo) {
    let target = "HEAD";
    if (pointers.branch !== null) {
      if (pointers.branchRemoved) {
        refFallback = `**Pointers:** records branch ${pointers.branch} as removed; scanned HEAD instead`;
      } else if (!branchResolves(repo, pointers.branch)) {
        refFallback = `recorded branch ${pointers.branch} no longer resolves in ${repo}; scanned HEAD instead`;
      } else {
        target = pointers.branch;
      }
    }
    ref = target;

    if (pointers.watermark === null) state = "no-watermark";
    else if (!git(repo, ["merge-base", "--is-ancestor", pointers.watermark, target]).ok) state = "orphaned";
    else {
      const range = `${pointers.watermark}..${target}`;
      const log = git(repo, ["-c", "core.quotepath=false", "log", "--name-only", "--date=short", LOG_FORMAT, range, "--"]);
      if (!log.ok) throw new Exit(2, `cannot enumerate ${range} in ${repo}: ${log.stderr || "git failed"}`);
      enumerated = parseCommitLog(log.stdout);
      state = "ok";
    }
  }

  return {
    taskDir,
    repo,
    pathsInRepo,
    watermark: pointers.watermark,
    branch: pointers.branch,
    ref,
    refFallback,
    state,
    commits: enumerated.slice(0, COMMIT_CAP),
    total: enumerated.length,
    steps: classifySteps(steps, enumerated, present),
  };
}

function main(): void {
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EPIPE") throw err;
  });

  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Exit(2, USAGE);
  process.stdout.write(JSON.stringify(scan(resolve(args[0]))) + "\n");
  for (const warning of warnings) console.error(`[commit-scan] ${warning}`);
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  try {
    main();
  } catch (err) {
    const exit = err instanceof Exit ? err : new Exit(2, `commit-scan failed: ${(err as Error).message}`);
    console.error(`[commit-scan] ${exit.message}`);
    process.exitCode = exit.code;
  }
}
