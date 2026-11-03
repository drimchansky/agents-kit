#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, existsSync, linkSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const LEASE_MS = 3600000;
const BODY_LIMIT = 1048576;
const RECORD_LIMIT = 4194304;
const MINUTE_MS = 60000;
const PUBLISHED_BASE_MODE = 0o666;
export interface Retained {
  folder: string;
  identity: string;
  intervalMinutes: number;
  store: string;
  owner: string;
}
interface Attempt { token: string; owner: string; started: number }
interface State { active: Attempt | null; completed: number | null; retry: number | null }
export class Exit extends Error {
  code: number;
  constructor(code: number, message: string) { super(message); this.code = code; }
}
function refuse(message: string): never { throw new Exit(1, message); }
function invalid(message: string): never { throw new Exit(2, message); }
function hash(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function identity(path: string): string {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) refuse("symlink refused");
  return `${stat.dev}:${stat.ino}`;
}
function directory(path: string): void {
  if (!lstatSync(path).isDirectory()) refuse("directory required");
  if (realpathSync(path) !== path) refuse("physical directory changed");
}
function cadence(value: unknown, now: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || !Number.isSafeInteger(value * MINUTE_MS) || !Number.isFinite(new Date(now + value * MINUTE_MS + 3 * MINUTE_MS).getTime())) invalid("invalid intervalMinutes");
  return value;
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function label(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) invalid("invalid owner or token");
  return value;
}
export function configure(home: string, owner: string, now = Date.now()): Retained | null {
  const path = join(home, ".config/agents-kit/config.json");
  if (!existsSync(path)) return null;
  let value: unknown = JSON.parse(readFileSync(path, "utf8"));
  for (const key of ["secretary", "duties", "meeting-sync"]) {
    if (!object(value)) invalid("configuration containers must be objects");
    if (!Object.hasOwn(value, key)) return null;
    value = value[key];
  }
  if (!object(value)) invalid("meeting-sync must be an object");
  if (!Object.hasOwn(value, "folder")) return null;
  const raw = value.folder;
  if (typeof raw !== "string" || !raw || (!isAbsolute(raw) && !raw.startsWith("~/"))) invalid("invalid meeting folder");
  const folder = realpathSync.native(raw.startsWith("~/") ? join(home, raw.slice(2)) : raw);
  directory(folder);
  try { readdirSync(folder); } catch (err) { invalid(`meeting folder ${folder} is unreadable: ${err instanceof Error ? err.message : err}`); }
  return { folder, identity: identity(folder), intervalMinutes: cadence(Object.hasOwn(value, "intervalMinutes") ? value.intervalMinutes : 60, now), store: hash(folder), owner: label(owner) };
}
function validate(retained: Retained, now: number, checkFolder = true): void {
  if (!object(retained) || typeof retained.folder !== "string" || !isAbsolute(retained.folder) || retained.store !== hash(retained.folder)) invalid("invalid retained settings");
  label(retained.owner);
  cadence(retained.intervalMinutes, now);
  if (!checkFolder) return;
  directory(retained.folder);
  if (identity(retained.folder) !== retained.identity) refuse("meeting root identity changed");
}
function storePath(home: string, retained: Retained): string {
  const dir = join(home, ".local/state/agents-kit/secretary/meeting-sync", retained.store);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (!lstatSync(dir).isDirectory()) refuse(`store directory required: ${dir}`);
  chmodSync(dir, 0o700);
  return dir;
}
function readState(dir: string): State {
  const path = join(dir, "state.json");
  if (!existsSync(path)) return { active: null, completed: null, retry: null };
  if (!lstatSync(path).isFile() || lstatSync(path).size > RECORD_LIMIT) refuse("invalid state file");
  return JSON.parse(readFileSync(path, "utf8"));
}
function save(dir: string, state: State): void {
  const temp = join(dir, `.state-${randomUUID()}`);
  writeFileSync(temp, JSON.stringify(state), { mode: 0o600, flag: "wx" });
  renameSync(temp, join(dir, "state.json"));
}
function locked<T>(home: string, retained: Retained, now: number, work: (dir: string, state: State) => T, checkFolder = true): T {
  validate(retained, now, checkFolder);
  const dir = storePath(home, retained);
  return withLock(join(dir, "lock"), () => {
    validate(retained, now, checkFolder);
    return work(dir, readState(dir));
  });
}
function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

interface LockOwner {
  readonly pid: number;
  readonly at: string;
  readonly token: string;
}

function readOwner(dir: string): LockOwner | null {
  return readOwnerFile(join(dir, "owner.json"));
}

function readOwnerFile(file: string): LockOwner | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (object(parsed) && typeof parsed.pid === "number" && typeof parsed.at === "string" && typeof parsed.token === "string") {
      return { pid: parsed.pid, at: parsed.at, token: parsed.token };
    }
    return null;
  } catch {
    return null;
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function breakStaleLock(dir: string): boolean {
  const owner = readOwner(dir);
  if (owner === null || alive(owner.pid)) return false;
  const record = join(dir, "owner.json");
  const claim = join(dir, `claim-${process.pid}-${randomUUID()}.json`);
  try {
    renameSync(record, claim);
  } catch (err) {
    if (["ENOENT", "ENOTDIR"].includes((err as NodeJS.ErrnoException).code ?? "")) return false;
    throw err;
  }
  if (readOwnerFile(claim)?.token !== owner.token) {
    try {
      renameSync(claim, record);
    } catch {
      return false;
    }
    return false;
  }
  removeLock(dir);
  return true;
}

function removeLock(dir: string): void {
  const aside = `${dir}.stale-${process.pid}-${randomUUID()}`;
  try {
    renameSync(dir, aside);
  } catch {
    return;
  }
  rmSync(aside, { recursive: true, force: true });
}

function withLock<T>(dir: string, work: () => T): T {
  const owner: LockOwner = { pid: process.pid, at: new Date().toISOString(), token: randomUUID() };
  const staged = `${dir}.new-${process.pid}-${owner.token}`;
  try {
    mkdirSync(staged, { mode: 0o700 });
    writeFileSync(join(staged, "owner.json"), JSON.stringify(owner), { flag: "wx", mode: 0o600 });
  } catch (err) {
    rmSync(staged, { recursive: true, force: true });
    invalid(`cannot prepare lock ${staged}: ${String(err)}`);
  }
  let held = false;
  try {
    for (let attempt = 0; attempt < 40 && !held; attempt++) {
      try {
        renameSync(staged, dir);
        held = true;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "EEXIST" && code !== "ENOTEMPTY") invalid(`cannot create lock ${dir}: ${String(err)}`);
        if (!breakStaleLock(dir)) sleep(50);
      }
    }
  } finally {
    if (!held) rmSync(staged, { recursive: true, force: true });
  }
  if (!held) {
    const holder = readOwner(dir);
    const detail = holder === null ? "no readable owner record, which another process may be reclaiming" : `pid ${holder.pid} since ${holder.at}`;
    invalid(`secretary records are busy: ${dir} is held by ${detail}. Retry shortly; remove the lock only if that process is gone.`);
  }
  try {
    return work();
  } finally {
    if (readOwner(dir)?.token === owner.token) removeLock(dir);
  }
}


function active(state: State, retained: Retained, token: string): void {
  label(token);
  if (state.active?.token !== token || state.active.owner !== retained.owner) refuse("attempt stopped or superseded");
}
export function status(home: string, retained: Retained, now = Date.now()) {
  return locked(home, retained, now, (_dir, state) => {
    const due = Math.max(state.completed === null ? now : state.completed + retained.intervalMinutes * MINUTE_MS, state.retry ?? 0);
    const eligible = Math.max(due, state.active ? state.active.started + LEASE_MS : 0);
    return { enabled: true, retained, active: state.active, completed: state.completed, retry: state.retry, due: now >= eligible, eligible, eligibleAt: new Date(eligible).toISOString() };
  });
}
export function start(home: string, retained: Retained, options: { now?: number; explicit?: boolean } = {}): string {
  const now = options.now ?? Date.now();
  return locked(home, retained, now, (dir, state) => {
    if (state.active && now < state.active.started + LEASE_MS) refuse("attempt leased");
    if (!options.explicit && now < Math.max(state.retry ?? 0, state.completed === null ? 0 : state.completed + retained.intervalMinutes * MINUTE_MS)) refuse("not due");
    const token = randomUUID();
    state.active = { token, owner: retained.owner, started: now };
    save(dir, state);
    return token;
  });
}
export function finish(home: string, retained: Retained, options: { token: string; outcome: "complete" | "partial" | "failed" | "stopped"; now?: number }): void {
  const now = options.now ?? Date.now();
  locked(home, retained, now, (dir, state) => {
    active(state, retained, options.token);
    if (!["complete", "partial", "failed", "stopped"].includes(options.outcome)) invalid("invalid outcome");
    if (options.outcome === "complete" || options.outcome === "partial") { state.completed = now; state.retry = null; }
    if (options.outcome === "failed") state.retry = now + retained.intervalMinutes * MINUTE_MS;
    state.active = null;
    save(dir, state);
  }, options.outcome !== "stopped");
}
function missing(err: unknown): boolean { return ["ENOENT", "ENOTDIR"].includes((err as NodeJS.ErrnoException).code ?? ""); }
function target(retained: Retained, path: string): string {
  if (typeof path !== "string" || !path || isAbsolute(path) || path.split("/").some(part => !part || part === "." || part === "..") || !path.endsWith(".md")) invalid("relative Markdown target required");
  const full = join(retained.folder, path);
  let parent = retained.folder;
  for (const part of path.split("/").slice(0, -1)) {
    parent = join(parent, part);
    try { directory(parent); } catch (err) { if (missing(err)) refuse(`missing parent: ${relative(retained.folder, parent)}`); throw err; }
  }
  return full;
}
export function create(home: string, retained: Retained, options: { token: string; path: string; body: string; now?: number; beforeLock?: () => void; beforePublish?: () => void }): void {
  const now = options.now ?? Date.now();
  options.beforeLock?.();
  locked(home, retained, now, (dir, state) => {
    active(state, retained, options.token);
    if (typeof options.body !== "string" || Buffer.byteLength(options.body) > BODY_LIMIT) invalid("invalid note body");
    const full = target(retained, options.path);
    if (existsSync(full)) refuse("destination exists");
    const parentIdentity = identity(dirname(full));
    const stageDir = join(dirname(full), `.meeting-sync-${randomUUID()}`);
    mkdirSync(stageDir, { mode: 0o700 });
    const stage = join(stageDir, "body");
    writeFileSync(stage, options.body, { mode: 0o600, flag: "wx" });
    const stageIdentity = identity(stage);
    try {
      options.beforePublish?.();
      validate(retained, now);
      active(readState(dir), retained, options.token);
      if (target(retained, options.path) !== full || identity(dirname(full)) !== parentIdentity) refuse("target parent changed");
      if (identity(stage) !== stageIdentity || hash(readFileSync(stage)) !== hash(options.body)) refuse("staged body changed");
      chmodSync(stage, PUBLISHED_BASE_MODE & ~process.umask());
      try { linkSync(stage, full); } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EEXIST") refuse("create refused; destination raced");
        invalid(`create publication unavailable: ${String(err)}`);
      }
    } finally {
      if (existsSync(stage) && identity(stage) === stageIdentity) { unlinkSync(stage); rmdirSync(stageDir); }
    }
  });
}

export interface Observation { path: string; identity: string; hash: string }
export interface Operation { provider: string; id: string }
interface Receipt {
  operation: Operation;
  path: string;
  bodyHash: string;
  parentIdentity: string;
  incoming: Observation | null;
  template: Observation | null;
  stage: Observation;
  stageDirectory: string;
  archive: Observation | null;
  removed: boolean;
  removing?: boolean;
}
function snapshot(retained: Retained, path: string): Observation {
  const full = target(retained, path);
  let stat;
  try { stat = lstatSync(full); } catch (err) { if (missing(err)) refuse(`missing note: ${path}`); throw err; }
  if (!stat.isFile() || stat.size > BODY_LIMIT) refuse("regular bounded note required");
  return { path, identity: identity(full), hash: hash(readFileSync(full)) };
}
function unchanged(retained: Retained, observed: Observation): void {
  if (!object(observed) || typeof observed.identity !== "string" || typeof observed.hash !== "string") invalid("invalid observation");
  const current = snapshot(retained, observed.path);
  if (current.identity !== observed.identity || current.hash !== observed.hash) refuse("observed note changed");
}
function matches(retained: Retained, observed: Observation): boolean {
  if (!existsSync(join(retained.folder, observed.path))) return false;
  const current = snapshot(retained, observed.path);
  return current.identity === observed.identity && current.hash === observed.hash;
}
function operationFile(dir: string, operation: Operation): string {
  if (!object(operation) || typeof operation.provider !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(operation.provider) || typeof operation.id !== "string" || !operation.id.trim() || operation.id.length > 2048) invalid("stable provider operation identity required");
  return join(dir, `archive-${hash(JSON.stringify([operation.provider, operation.id]))}.json`);
}
function readReceipt(file: string): Receipt | null {
  if (!existsSync(file)) return null;
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.size > RECORD_LIMIT) refuse("invalid archive receipt");
  return JSON.parse(readFileSync(file, "utf8"));
}
function saveReceipt(file: string, receipt: Receipt): void {
  const temporary = `${file}.${randomUUID()}`;
  writeFileSync(temporary, JSON.stringify(receipt), { flag: "wx", mode: 0o600 });
  renameSync(temporary, file);
}
function cleanStage(retained: Retained, receipt: Receipt): void {
  if (!existsSync(join(retained.folder, receipt.stage.path))) return;
  const full = target(retained, receipt.stage.path);
  if (identity(dirname(full)) !== receipt.stageDirectory) refuse("staging directory changed");
  unchanged(retained, receipt.stage);
  unlinkSync(full);
  rmdirSync(dirname(full));
}
function published(retained: Retained, receipt: Receipt, observed: Observation): boolean {
  if (observed.identity !== receipt.stage.identity) return false;
  if (observed.hash === receipt.bodyHash) return true;
  const stage = join(retained.folder, receipt.stage.path);
  return existsSync(stage) && identity(stage) === receipt.stage.identity;
}
function unlinkStage(retained: Retained, receipt: Receipt): void {
  const full = target(retained, receipt.stage.path);
  if (identity(dirname(full)) !== receipt.stageDirectory || identity(full) !== receipt.stage.identity) refuse("staging directory changed");
  unlinkSync(full);
  rmdirSync(dirname(full));
}
function linkedElsewhere(retained: Retained, receipt: Receipt): boolean {
  const stage = join(retained.folder, receipt.stage.path);
  return existsSync(stage) && identity(dirname(stage)) === receipt.stageDirectory && identity(stage) === receipt.stage.identity && lstatSync(stage).nlink > 1;
}
function unchangedArchiveParent(retained: Retained, receipt: Receipt): void {
  if (identity(dirname(target(retained, receipt.path))) !== receipt.parentIdentity) refuse(`archive parent changed; recorded stage: ${receipt.stage.path}`);
}
function settle(retained: Retained, file: string, receipt: Receipt): Receipt {
  if (receipt.removed) return receipt;
  if (receipt.removing && receipt.incoming && !existsSync(join(retained.folder, receipt.incoming.path))) {
    receipt.removed = true;
    saveReceipt(file, receipt);
    return receipt;
  }
  if (receipt.archive) {
    const stage = join(retained.folder, receipt.stage.path);
    if (existsSync(stage) && identity(dirname(stage)) === receipt.stageDirectory) unlinkStage(retained, receipt);
    return receipt;
  }
  unchangedArchiveParent(retained, receipt);
  const destination = target(retained, receipt.path);
  if (existsSync(destination)) {
    const observed = snapshot(retained, receipt.path);
    if (!published(retained, receipt, observed)) refuse("unrelated archive collision");
    receipt.archive = observed;
    saveReceipt(file, receipt);
    if (observed.hash === receipt.bodyHash) cleanStage(retained, receipt);
    else unlinkStage(retained, receipt);
  } else if (linkedElsewhere(retained, receipt)) {
    receipt.archive = { path: receipt.path, identity: receipt.stage.identity, hash: hash(readFileSync(join(retained.folder, receipt.stage.path))) };
    saveReceipt(file, receipt);
    unlinkStage(retained, receipt);
  }
  return receipt;
}
export function observe(home: string, retained: Retained, options: { token: string; path: string; now?: number }): Observation {
  return locked(home, retained, options.now ?? Date.now(), (_dir, state) => {
    active(state, retained, options.token);
    return snapshot(retained, options.path);
  });
}
export function reconcile(home: string, retained: Retained, options: { token: string; operation: Operation; now?: number }): Receipt | null {
  return locked(home, retained, options.now ?? Date.now(), (dir, state) => {
    active(state, retained, options.token);
    const file = operationFile(dir, options.operation);
    const receipt = readReceipt(file);
    return receipt ? settle(retained, file, receipt) : null;
  });
}
function shouldRestart(retained: Retained, receipt: Receipt, body: string): boolean {
  unchangedArchiveParent(retained, receipt);
  return hash(body) !== receipt.bodyHash
    || (receipt.incoming !== null && !matches(retained, receipt.incoming))
    || (receipt.template !== null && !matches(retained, receipt.template))
    || !existsSync(join(retained.folder, receipt.stage.path));
}
export function archive(home: string, retained: Retained, options: { token: string; operation: Operation; path: string; body: string; incoming: Observation | null; template: Observation | null; now?: number; beforeLock?: () => void; beforePublish?: () => void; afterPublish?: () => void }): Receipt {
  const now = options.now ?? Date.now();
  options.beforeLock?.();
  return locked(home, retained, now, (dir, state) => {
    active(state, retained, options.token);
    const file = operationFile(dir, options.operation);
    let receipt = readReceipt(file);
    if (receipt?.archive) return settle(retained, file, receipt);
    let collision = false;
    if (receipt && existsSync(target(retained, receipt.path))) {
      const observed = snapshot(retained, receipt.path);
      collision = !published(retained, receipt, observed);
      if (!collision || options.path === receipt.path) return settle(retained, file, receipt);
    }
    if (receipt && !collision && linkedElsewhere(retained, receipt)) return settle(retained, file, receipt);
    if (typeof options.body !== "string" || Buffer.byteLength(options.body) > BODY_LIMIT) invalid("invalid note body");
    if (options.incoming !== null) unchanged(retained, options.incoming);
    if (options.template !== null) unchanged(retained, options.template);
    if (receipt && shouldRestart(retained, receipt, options.body)) {
      const stage = join(retained.folder, receipt.stage.path);
      if (existsSync(stage) && lstatSync(stage).nlink !== 1) refuse("recorded stage is linked elsewhere");
      cleanStage(retained, receipt);
      receipt = null;
    }
    if (receipt) {
      if (collision) {
        const full = target(retained, options.path);
        if (existsSync(full)) refuse("unrelated archive collision");
        if ([receipt.incoming?.path, receipt.template?.path].includes(options.path)) invalid("archive must differ from observed notes");
        receipt.path = options.path;
        receipt.parentIdentity = identity(dirname(full));
        saveReceipt(file, receipt);
      }
    } else {
      const full = target(retained, options.path);
      if (existsSync(full)) refuse("unrelated archive collision");
      if ([options.incoming?.path, options.template?.path].includes(options.path)) invalid("archive must differ from observed notes");
      const stageDir = join(dirname(full), `.meeting-sync-${randomUUID()}`);
      mkdirSync(stageDir, { mode: 0o700 });
      const stagePath = join(stageDir, "body.md");
      writeFileSync(stagePath, options.body, { mode: 0o600, flag: "wx" });
      receipt = { operation: options.operation, path: options.path, bodyHash: hash(options.body), parentIdentity: identity(dirname(full)), incoming: options.incoming, template: options.template, stage: snapshot(retained, relative(retained.folder, stagePath)), stageDirectory: identity(stageDir), archive: null, removed: false };
      saveReceipt(file, receipt);
    }
    options.beforePublish?.();
    validate(retained, now);
    active(readState(dir), retained, options.token);
    unchangedArchiveParent(retained, receipt);
    if (receipt.incoming) unchanged(retained, receipt.incoming);
    if (receipt.template) unchanged(retained, receipt.template);
    if (identity(dirname(target(retained, receipt.stage.path))) !== receipt.stageDirectory) refuse("staging directory changed");
    unchanged(retained, receipt.stage);
    chmodSync(target(retained, receipt.stage.path), PUBLISHED_BASE_MODE & ~process.umask());
    try { linkSync(target(retained, receipt.stage.path), target(retained, receipt.path)); } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") refuse("unrelated archive collision");
      invalid(`archive publication unavailable: ${String(err)}`);
    }
    options.afterPublish?.();
    return settle(retained, file, receipt);
  });
}
export function remove(home: string, retained: Retained, options: { token: string; operation?: Operation; covered?: boolean; incoming?: Observation; template?: Observation; completeSource?: boolean; now?: number; beforeLock?: () => void; beforeDelete?: () => void; afterDelete?: () => void }): void {
  const now = options.now ?? Date.now();
  options.beforeLock?.();
  locked(home, retained, now, (dir, state) => {
    active(state, retained, options.token);
    const file = options.operation ? operationFile(dir, options.operation) : null;
    const receipt = file ? readReceipt(file) : null;
    let incoming = options.incoming;
    let template = options.template;
    if (file) {
      if (!receipt || options.covered !== true) refuse("archive coverage proof required");
      settle(retained, file, receipt);
      if (!receipt.archive || !receipt.incoming || !receipt.template) refuse("archive observations incomplete");
      if (receipt.removed) return;
      incoming = receipt.incoming;
      template = receipt.template;
    } else if (options.completeSource !== true || !incoming || !template || incoming.hash !== template.hash) refuse("complete source and template-copy proof required");
    if (!incoming || !template || incoming.path === template.path || incoming.identity === template.identity) refuse("distinct incoming and template required");
    options.beforeDelete?.();
    validate(retained, now);
    active(readState(dir), retained, options.token);
    if (receipt?.archive) unchanged(retained, receipt.archive);
    unchanged(retained, template);
    unchanged(retained, incoming);
    if (receipt && file) { receipt.removing = true; saveReceipt(file, receipt); }
    unlinkSync(target(retained, incoming.path));
    options.afterDelete?.();
    if (receipt && file) { receipt.removed = true; saveReceipt(file, receipt); }
  });
}

function main(): void {
  const [command, file] = process.argv.slice(2);
  if (!file || process.argv.length !== 4) invalid("usage: meeting-sync-state.ts <configure|status|start|finish|create|observe|archive|reconcile|remove> <request.json|->");
  const input = readFileSync(file === "-" ? 0 : file, "utf8");
  if (Buffer.byteLength(input) > 6 * BODY_LIMIT + 16384) invalid("request too large");
  const request = JSON.parse(input);
  const home = homedir();
  let result: unknown;
  if (command === "configure") result = configure(home, request.owner);
  else if (command === "status") result = status(home, request.retained);
  else if (command === "start") result = { token: start(home, request.retained, { explicit: request.explicit === true }) };
  else if (command === "finish") { finish(home, request.retained, { token: request.token, outcome: request.outcome }); result = { outcome: request.outcome }; }
  else if (command === "create") { create(home, request.retained, { token: request.token, path: request.path, body: request.body }); result = { created: request.path }; }
  else if (command === "observe") result = observe(home, request.retained, { token: request.token, path: request.path });
  else if (command === "reconcile") result = reconcile(home, request.retained, { token: request.token, operation: request.operation });
  else if (command === "archive") result = archive(home, request.retained, { token: request.token, operation: request.operation, path: request.path, body: request.body, incoming: request.incoming, template: request.template });
  else if (command === "remove") { remove(home, request.retained, { token: request.token, operation: request.operation, covered: request.covered, incoming: request.incoming, template: request.template, completeSource: request.completeSource }); result = { removed: true }; }
  else invalid("unknown command");
  const output = JSON.stringify(result);
  if (Buffer.byteLength(output) > 32768) invalid("output exceeds limit");
  process.stdout.write(output + "\n");
}
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try { return realpathSync(entry) === fileURLToPath(import.meta.url); } catch { return false; }
}
if (isDirectRun()) {
  process.stdout.on("error", error => { if (!["EPIPE", "ENOTCONN"].includes(error.code ?? "")) throw error; });
  try { main(); } catch (error) { process.stderr.write(`${error instanceof Error ? error.message : error}\n`); process.exitCode = error instanceof Exit ? error.code : 2; }
}
