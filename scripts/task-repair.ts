import { execFileSync } from "node:child_process";
import { chmodSync, closeSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, unlinkSync, writeSync, type Dirent } from "node:fs";
import { join, relative } from "node:path";
import { holdsRoleFile, WALK_SKIP_DIRS } from "./lifecycle-constants.ts";
import { adjacentGoalMentions, anchorLines, fieldGoalTokens, indentedBlockLines, parseGoalDefinitions, sameDiagnostic, scanGoalReferences, validateGoalStructure, type StructureDiagnostic, type StructureReport } from "./goal-structure.ts";

interface Snapshot {
  readonly bytes: Buffer;
  readonly text: string;
  readonly dev: number;
  readonly ino: number;
  readonly mode: number;
}

interface DirectoryIdentity {
  readonly dev: number;
  readonly ino: number;
}

export interface ReadFailure {
  readonly path: string;
  readonly kind: "dir" | "file";
  readonly code: string;
}

interface TaskSnapshot {
  readonly files: Map<string, Snapshot>;
  readonly directories: Map<string, DirectoryIdentity>;
  readonly gaps: readonly string[];
  readonly failures: readonly ReadFailure[];
  readonly staging: readonly string[];
  readonly nested: readonly string[];
}

export interface TaskMarkdown {
  readonly documents: Readonly<Record<string, string>>;
  readonly gaps: readonly string[];
  readonly nested: readonly string[];
  readonly failures: readonly ReadFailure[];
}

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly replacement: string;
}

export interface AppliedRepair {
  readonly file: string;
  readonly changes: number;
}

export interface IdentifierMapping {
  readonly from: string;
  readonly to: string;
}

export interface RepairReport {
  readonly taskDir: string;
  readonly applied: readonly AppliedRepair[];
  readonly mappings: readonly IdentifierMapping[];
  readonly unresolved: readonly StructureDiagnostic[];
  readonly recovery: "none" | "restored" | "partial";
  readonly unrecovered: readonly string[];
  readonly recoveryErrors: readonly { readonly file: string; readonly error: string }[];
  readonly error: string | null;
  readonly swept: readonly string[];
}

export interface RepairResult {
  readonly report: RepairReport;
  readonly documents: Readonly<Record<string, string>>;
  readonly gaps: readonly string[];
  readonly nested: readonly string[];
  readonly failed: boolean;
}

export interface RepairHooks {
  readonly beforeReplace?: (file: string, index: number) => void;
  readonly afterReplace?: (file: string, index: number) => void;
  readonly beforeRollback?: (file: string, index: number) => void;
}

export type StructureValidator = (
  documents: Readonly<Record<string, string>>,
  options: { readonly unreadableMarkdown?: readonly string[]; readonly nestedTasks: readonly string[] },
) => StructureReport;

const validateDocuments: StructureValidator = (documents, options) => validateGoalStructure(documents["goals.md"] ?? null, documents, options);

interface RollbackContext {
  readonly taskDir: string;
  readonly original: TaskSnapshot;
  readonly files: ReadonlyMap<string, Snapshot>;
  readonly proposed: ReadonlyMap<string, string>;
  readonly staged: readonly string[];
  readonly replaced: readonly string[];
  readonly hooks: RepairHooks;
}

type ApplyContext = Pick<RollbackContext, "taskDir" | "original" | "proposed" | "hooks">;

type Recovery = Pick<RepairReport, "recovery" | "unrecovered" | "recoveryErrors">;

type ApplyOutcome =
  | { readonly failed: false; readonly current: TaskSnapshot }
  | { readonly failed: true; readonly error: unknown; readonly recovery: Recovery };

interface ExitState {
  readonly documents: Readonly<Record<string, string>>;
  readonly nested: readonly string[];
  readonly gaps?: readonly string[];
  readonly unresolved?: readonly StructureDiagnostic[];
  readonly applied?: readonly AppliedRepair[];
  readonly mappings?: readonly IdentifierMapping[];
  readonly recovery?: Recovery;
}

type RepairExit = ExitState & ({ readonly failed: false } | { readonly failed: true; readonly error: unknown });

class StagingLeftover extends Error {
  readonly temporary: string;
  constructor(temporary: string, cause: unknown) {
    super((cause as Error).message, { cause });
    this.temporary = temporary;
  }
}

const STAGING = /\.md\.agents-kit-repair\.(\d+)\.[a-z0-9]+$/;
const REPAIRABLE_FILES: ReadonlySet<string> = new Set(["CONTEXT.md", "goals.md", "plan.md", "result.md"]);

function targetsDirectory(path: string): boolean {
  try { return statSync(path).isDirectory(); }
  catch { return false; }
}

function snapshotTask(taskDir: string): TaskSnapshot {
  const files = new Map<string, Snapshot>();
  const directories = new Map<string, DirectoryIdentity>();
  const gaps: string[] = [];
  const failures: ReadFailure[] = [];
  const staging: string[] = [];
  const nested: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    const beforeDir = lstatSync(dir);
    if (!beforeDir.isDirectory()) throw new Error(`unsafe task directory ${prefix || taskDir}`);
    let entries: Dirent[];
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch (error) {
      if (!prefix) throw error;
      gaps.push(prefix);
      failures.push({ path: prefix, kind: "dir", code: (error as NodeJS.ErrnoException).code ?? (error as Error).message });
      return;
    }
    if (prefix && holdsRoleFile(entries.filter((entry) => entry.isFile()).map((entry) => entry.name))) {
      nested.push(prefix);
      return;
    }
    directories.set(prefix, { dev: beforeDir.dev, ino: beforeDir.ino });
    for (const entry of entries) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      const path = join(dir, entry.name);
      if (entry.name.startsWith(".") || WALK_SKIP_DIRS.has(entry.name)) continue;
      if (entry.isSymbolicLink()) {
        if (entry.name.endsWith(".md") || targetsDirectory(path)) gaps.push(name);
        continue;
      }
      if (entry.isDirectory()) {
        walk(path, name);
        continue;
      }
      if (entry.isFile() && STAGING.test(entry.name)) { staging.push(name); continue; }
      if (!entry.name.endsWith(".md")) continue;
      if (!entry.isFile()) { gaps.push(name); continue; }
      const before = lstatSync(path);
      let bytes: Buffer;
      try { bytes = readFileSync(path); }
      catch (error) {
        gaps.push(name);
        failures.push({ path: name, kind: "file", code: (error as NodeJS.ErrnoException).code ?? (error as Error).message });
        continue;
      }
      const after = lstatSync(path);
      if (!before.isFile() || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size) {
        throw new Error(`changed input ${name}`);
      }
      const text = bytes.toString("utf8");
      if (!Buffer.from(text, "utf8").equals(bytes)) { gaps.push(name); continue; }
      files.set(name, { bytes, text, dev: after.dev, ino: after.ino, mode: after.mode });
    }
    const afterDir = lstatSync(dir);
    if (!afterDir.isDirectory() || beforeDir.dev !== afterDir.dev || beforeDir.ino !== afterDir.ino) {
      throw new Error(`changed directory ${prefix || taskDir}`);
    }
  };
  walk(taskDir, "");
  return { files, directories, gaps, failures, staging, nested };
}

function documentsOf(files: ReadonlyMap<string, Snapshot>): Record<string, string> {
  const documents: Record<string, string> = Object.create(null);
  for (const [file, snapshot] of files) documents[file] = snapshot.text;
  return documents;
}

export function readTaskMarkdown(taskDir: string): TaskMarkdown {
  const snapshot = snapshotTask(taskDir);
  return { documents: documentsOf(snapshot.files), gaps: snapshot.gaps, nested: snapshot.nested, failures: snapshot.failures };
}

function writerGone(pid: number): boolean {
  try { process.kill(pid, 0); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ESRCH"; }
}

function sweepStaging(taskDir: string, staging: readonly string[]): string[] {
  return staging.filter((name) => {
    if (!writerGone(Number(name.match(STAGING)![1]))) return false;
    try { unlinkSync(join(taskDir, name)); return true; }
    catch { return false; }
  });
}

function historicalNextId(taskDir: string): number | null {
  try {
    const root = execFileSync("git", ["-C", taskDir, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: "pipe" }).trim();
    const shallow = execFileSync("git", ["-C", taskDir, "rev-parse", "--is-shallow-repository"], { encoding: "utf8", stdio: "pipe" }).trim();
    if (shallow !== "false") return null;
    execFileSync("git", ["-C", taskDir, "ls-files", "--error-unmatch", "--", ":(literal)goals.md"], { stdio: "pipe" });
    const history = execFileSync("git", ["-C", root, "log", "--all", "--follow", "--format=", "--patch", "--", `:(literal)${relative(realpathSync(root), realpathSync(join(taskDir, "goals.md")))}`], {
      encoding: "utf8", stdio: "pipe", maxBuffer: 64 * 1024 * 1024,
    });
    if (!/^new file mode /m.test(history)) return null;
    const ids = [...history.matchAll(/^[ +\-][-*+][ \t]+(?:\*\*|`)?G(\d+)\b/gm)].map((match) => Number(match[1]));
    return Math.max(0, ...ids) + 1;
  } catch {
    return null;
  }
}

function addEdit(edits: Map<string, Edit[]>, file: string, edit: Edit): void {
  const list = edits.get(file) ?? [];
  list.push(edit);
  edits.set(file, list);
}

function proposedEdits(taskDir: string, files: ReadonlyMap<string, Snapshot>, nested: readonly string[]): { edits: Map<string, Edit[]>; mappings: IdentifierMapping[]; unresolved: StructureDiagnostic[] } {
  const edits = new Map<string, Edit[]>();
  const mappings: IdentifierMapping[] = [];
  const unresolved: StructureDiagnostic[] = [];
  const goals = files.get("goals.md");
  if (!goals) return { edits, mappings, unresolved };
  const definitions = parseGoalDefinitions(goals.text);
  const validIds = new Set([...definitions.definitions, ...definitions.retired].map((item) => item.id));
  const malformed = definitions.diagnostics.filter((item) => item.code === "malformed-goal-id");
  const tokens = malformed.map((item) => item.detail.match(/^[-*+][ \t]+((?:\*\*|`)?G\d+[A-Za-z]*(?::|\.)?(?:\*\*|`)?)(?=\s|$)/)?.[1] ?? null);
  const identities = tokens.map((token) => token?.replace(/^(?:\*\*|`)/, "").replace(/(?:\*\*|`)$/, "").replace(/[:.]$/, "") ?? null);
  const counts = new Map<string, number>();
  for (const identity of identities) if (identity !== null) counts.set(identity, (counts.get(identity) ?? 0) + 1);
  const blocked = new Set<string>();
  const guarded: { id: string; file: string; line: number }[] = [];
  for (const [file, snapshot] of files) {
    const anchors = anchorLines(snapshot.text);
    const indented = indentedBlockLines(snapshot.text);
    const references = scanGoalReferences(file, snapshot.text, nested);
    for (const reference of references) {
      if (reference.linkedScope !== null) blocked.add(reference.id);
      if (!REPAIRABLE_FILES.has(file) || anchors.has(reference.line) || indented.has(reference.line)) guarded.push(reference);
    }
    for (const mention of adjacentGoalMentions(file, snapshot.text)) guarded.push({ ...mention, file });
    if (file === "plan.md") {
      const scanned = new Set(references.map((reference) => reference.start));
      for (const token of fieldGoalTokens(snapshot.text)) if (!scanned.has(token.start)) guarded.push({ id: token.id, file, line: token.line });
    }
  }
  const needsFresh = identities.some((identity) => identity !== null && /^G\d+[A-Za-z]+$/.test(identity));
  let nextId = needsFresh ? historicalNextId(taskDir) : null;
  if (nextId !== null) {
    const mentioned = [...files.values()].flatMap((snapshot) => [...snapshot.text.matchAll(/(?<![\p{L}\p{N}])G(\d+)(?![\p{L}\p{N}])/gu)].map((match) => `G${match[1]}`));
    const numericIds = [...validIds, ...identities, ...mentioned].filter((id): id is string => id !== null && /^G\d+$/.test(id));
    const currentMax = Math.max(0, ...numericIds.map((id) => Number(id.slice(1))));
    nextId = Math.max(nextId, currentMax + 1);
  }
  const mapping = new Map<string, string>();
  for (const [index, issue] of malformed.entries()) {
    const token = tokens[index];
    const unwrapped = identities[index];
    if (token === null || unwrapped === null || counts.get(unwrapped) !== 1 || blocked.has(unwrapped)) { unresolved.push(issue); continue; }
    let target: string;
    if (/^G\d+$/.test(unwrapped)) {
      if (validIds.has(unwrapped)) { unresolved.push(issue); continue; }
      target = unwrapped;
    } else if (/^G\d+[A-Za-z]+$/.test(unwrapped)) {
      const guards = guarded.filter((reference) => reference.id === unwrapped);
      if (guards.length > 0) {
        unresolved.push(issue, ...guards.map((reference) => ({ code: "blocked-goal-remap" as const, file: reference.file, line: reference.line, detail: reference.id })));
        continue;
      }
      if (nextId === null) { unresolved.push(issue); continue; }
      target = `G${nextId++}`;
    } else { unresolved.push(issue); continue; }
    if (validIds.has(target)) { unresolved.push(issue); continue; }
    validIds.add(target);
    const sourceLine = goals.text.split("\n").slice(0, issue.line - 1).reduce((count, line) => count + line.length + 1, 0);
    const at = issue.detail.indexOf(token);
    addEdit(edits, "goals.md", { start: sourceLine + at, end: sourceLine + at + token.length, replacement: target });
    mappings.push({ from: token, to: target });
    if (token !== target && /^G\d+[A-Za-z]+$/.test(unwrapped)) mapping.set(unwrapped, target);
  }
  for (const issue of definitions.diagnostics) if (issue.code === "duplicate-goal-id") unresolved.push(issue);
  for (const [file, snapshot] of files) {
    for (const reference of scanGoalReferences(file, snapshot.text, nested)) {
      const target = mapping.get(reference.id);
      if (target !== undefined) addEdit(edits, file, { start: reference.start, end: reference.end, replacement: target });
    }
  }
  return { edits, mappings, unresolved };
}

function revisedText(text: string, edits: readonly Edit[]): string {
  let revised = text;
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  for (const [index, edit] of sorted.entries()) {
    if (index > 0 && edit.end > sorted[index - 1].start) throw new Error("overlapping repair edits");
    revised = revised.slice(0, edit.start) + edit.replacement + revised.slice(edit.end);
  }
  return revised;
}

function assertDirectoryIdentity(taskDir: string, file: string, directories: ReadonlyMap<string, DirectoryIdentity>): void {
  const parts = file.split("/").slice(0, -1);
  for (let length = 0; length <= parts.length; length++) {
    const name = parts.slice(0, length).join("/");
    const original = directories.get(name);
    const current = lstatSync(name ? join(taskDir, name) : taskDir);
    if (!original || !current.isDirectory() || current.dev !== original.dev || current.ino !== original.ino) {
      throw new Error(`changed directory ${name || taskDir}`);
    }
  }
}

function assertTaskSnapshot(
  taskDir: string,
  original: TaskSnapshot,
  replaced: readonly string[],
  proposed: ReadonlyMap<string, string>,
): TaskSnapshot {
  const current = snapshotTask(taskDir);
  if (current.gaps.length > 0) throw new Error(`changed task inventory ${current.gaps[0]}`);
  for (const [name, identity] of original.directories) {
    const actual = current.directories.get(name);
    if (!actual || actual.dev !== identity.dev || actual.ino !== identity.ino) throw new Error(`changed directory ${name || taskDir}`);
  }
  for (const name of current.directories.keys()) {
    if (!original.directories.has(name)) throw new Error(`added directory ${name}`);
  }
  for (const [file, snapshot] of original.files) {
    const actual = current.files.get(file);
    if (!actual) throw new Error(`removed Markdown ${file}`);
    if (replaced.includes(file)) {
      if (!actual.bytes.equals(Buffer.from(proposed.get(file)!, "utf8"))) throw new Error(`changed repaired file ${file}`);
    } else if (actual.dev !== snapshot.dev || actual.ino !== snapshot.ino || actual.mode !== snapshot.mode || !actual.bytes.equals(snapshot.bytes)) {
      throw new Error(`changed input ${file}`);
    }
  }
  for (const file of current.files.keys()) {
    if (!original.files.has(file)) throw new Error(`added Markdown ${file}`);
  }
  return current;
}

function stage(path: string, bytes: Buffer, mode: number): string {
  const temporary = `${path}.agents-kit-repair.${process.pid}.${Math.random().toString(36).slice(2)}`;
  const descriptor = openSync(temporary, "wx", mode);
  try {
    try {
      for (let written = 0; written < bytes.length;) written += writeSync(descriptor, bytes, written);
    } finally {
      closeSync(descriptor);
    }
    chmodSync(temporary, mode & 0o7777);
  } catch (error) {
    try { unlinkSync(temporary); } catch { throw new StagingLeftover(temporary, error); }
    throw error;
  }
  return temporary;
}

function leftoverOf(error: unknown): string[] {
  return error instanceof StagingLeftover ? [error.temporary] : [];
}

function rollBack({ taskDir, original, files, proposed, staged, replaced, hooks }: RollbackContext): Recovery {
  let recovery: "none" | "restored" | "partial" = replaced.length === 0 ? "none" : "restored";
  const unrecovered: string[] = [];
  const recoveryErrors: { file: string; error: string }[] = [];
  const leftovers = [...staged];
  for (const [index, file] of [...replaced].reverse().entries()) {
    try {
      hooks.beforeRollback?.(file, index);
      assertDirectoryIdentity(taskDir, file, original.directories);
      const path = join(taskDir, file);
      const current = lstatSync(path);
      const snapshot = files.get(file)!;
      if (!current.isFile() || current.mode !== snapshot.mode || !readFileSync(path).equals(Buffer.from(proposed.get(file)!, "utf8"))) {
        throw new Error(`changed repaired file ${file}`);
      }
      const restoreTemp = stage(path, snapshot.bytes, snapshot.mode);
      try { renameSync(restoreTemp, path); } finally { try { unlinkSync(restoreTemp); } catch {} }
    } catch (rollbackError) {
      recovery = "partial";
      unrecovered.push(file);
      recoveryErrors.push({ file, error: (rollbackError as Error).message });
      leftovers.push(...leftoverOf(rollbackError));
    }
  }
  for (const temp of leftovers) try { unlinkSync(temp); } catch (cleanupError) {
    recovery = "partial";
    unrecovered.push(temp);
    recoveryErrors.push({ file: temp, error: (cleanupError as Error).message });
  }
  return { recovery, unrecovered, recoveryErrors };
}

function repairResult(taskDir: string, swept: readonly string[], exit: RepairExit): RepairResult {
  const { recovery, unrecovered, recoveryErrors }: Recovery = exit.recovery ?? { recovery: "none", unrecovered: [], recoveryErrors: [] };
  return {
    report: {
      taskDir,
      applied: exit.applied ?? [],
      mappings: exit.mappings ?? [],
      unresolved: exit.unresolved ?? [],
      recovery,
      unrecovered,
      recoveryErrors,
      error: exit.failed ? (exit.error as Error).message : null,
      swept,
    },
    documents: exit.documents,
    gaps: exit.gaps ?? [],
    nested: exit.nested,
    failed: exit.failed,
  };
}

function applyProposed({ taskDir, original, proposed, hooks }: ApplyContext): ApplyOutcome {
  const files = original.files;
  const staged = new Map<string, string>();
  const replaced: string[] = [];
  try {
    assertTaskSnapshot(taskDir, original, replaced, proposed);
    for (const [file, text] of proposed) staged.set(file, stage(join(taskDir, file), Buffer.from(text, "utf8"), files.get(file)!.mode));
    for (const [index, file] of [...proposed.keys()].entries()) {
      hooks.beforeReplace?.(file, index);
      assertTaskSnapshot(taskDir, original, replaced, proposed);
      const temporary = staged.get(file)!;
      if (!lstatSync(temporary).isFile() || !readFileSync(temporary).equals(Buffer.from(proposed.get(file)!, "utf8"))) {
        throw new Error(`changed staged file ${file}`);
      }
      renameSync(staged.get(file)!, join(taskDir, file));
      staged.delete(file);
      replaced.push(file);
      hooks.afterReplace?.(file, index);
    }
    return { failed: false, current: assertTaskSnapshot(taskDir, original, replaced, proposed) };
  } catch (error) {
    const recovery = rollBack({ taskDir, original, files, proposed, staged: [...staged.values(), ...leftoverOf(error)], replaced, hooks });
    return { failed: true, error, recovery };
  }
}

export function repairTask(taskDir: string, hooks: RepairHooks = {}, validate: StructureValidator = validateDocuments): RepairResult {
  let original: TaskSnapshot;
  let swept: string[] = [];
  try {
    original = snapshotTask(taskDir);
    swept = sweepStaging(taskDir, original.staging);
    if (swept.length > 0) original = snapshotTask(taskDir);
  } catch (error) {
    return repairResult(taskDir, swept, { documents: Object.create(null), nested: [], failed: true, error });
  }
  const files = original.files;
  const originalDocuments = documentsOf(files);
  if (original.gaps.length > 0) {
    const scan = validate(originalDocuments, { unreadableMarkdown: original.gaps, nestedTasks: original.nested });
    const goalsUnread = original.gaps.includes("goals.md");
    const unresolved = scan.diagnostics.filter((issue) => !(goalsUnread && issue.code === "missing-goals-file"));
    return repairResult(taskDir, swept, { documents: originalDocuments, gaps: original.gaps, nested: original.nested, unresolved, failed: false });
  }
  let edits: Map<string, Edit[]>;
  let mappings: IdentifierMapping[];
  let unresolved: StructureDiagnostic[] = [];
  const proposed = new Map<string, string>();
  try {
    ({ edits, mappings, unresolved } = proposedEdits(taskDir, files, original.nested));
    for (const [file, changes] of edits) proposed.set(file, revisedText(files.get(file)!.text, changes));
  } catch (error) {
    return repairResult(taskDir, swept, { documents: originalDocuments, nested: original.nested, unresolved, failed: true, error });
  }
  const finalDocuments = { ...originalDocuments, ...Object.fromEntries(proposed) };
  const validation = validate(finalDocuments, { nestedTasks: original.nested });
  const baseline = proposed.size === 0 ? validation : validate(originalDocuments, { nestedTasks: original.nested });
  const added = validation.diagnostics.filter((issue) => !baseline.diagnostics.some((existing) => sameDiagnostic(existing, issue)));
  const refused = added.length > 0;
  for (const issue of refused ? [...baseline.diagnostics, ...added] : validation.diagnostics) {
    if (!unresolved.some((existing) => sameDiagnostic(existing, issue))) unresolved.push(issue);
  }
  if (refused) return repairResult(taskDir, swept, { documents: originalDocuments, nested: original.nested, unresolved, failed: false });
  const outcome = applyProposed({ taskDir, original, proposed, hooks });
  if (outcome.failed) {
    return repairResult(taskDir, swept, { documents: originalDocuments, nested: original.nested, unresolved, recovery: outcome.recovery, failed: true, error: outcome.error });
  }
  const { current } = outcome;
  const actualDocuments = documentsOf(current.files);
  const actualValidation = validate(actualDocuments, { nestedTasks: current.nested });
  for (const issue of actualValidation.diagnostics) {
    if (!unresolved.some((existing) => sameDiagnostic(existing, issue))) unresolved.push(issue);
  }
  const applied = [...edits].map(([file, changes]) => ({ file, changes: changes.length }));
  return repairResult(taskDir, swept, { documents: actualDocuments, nested: current.nested, unresolved, applied, mappings, failed: false });
}
