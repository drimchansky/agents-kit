#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmodSync, linkSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const USAGE = [
  "usage: node scripts/orca-status-timer.ts arm --run <run-id> --at <iso-utc-instant> --orca <executable>",
  "       node scripts/orca-status-timer.ts status --run <run-id>",
  "       node scripts/orca-status-timer.ts cancel --run <run-id>",
].join("\n");
export const WAKE_MARKER = "agents-kit start-orca status-wake v1";
export const WAKE_SUBJECT = "agents-kit start-orca status wake";
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(timer\.json|claim|result\.json)$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;
const MAX_SLEEP_MS = 60_000;
const SEND_TIMEOUT_MS = 60_000;
const STOP_WAIT_MS = 2_000;
const STOP_POLL_MS = 50;
const OUTPUT_MAX_CHARS = 4096;

export class Exit extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

function fail(message: string): never {
  throw new Exit(2, message);
}

type Claim = "send" | "cancel";
type TimerState = "pending" | "lost" | "sending" | "sent" | "failed" | "cancelled";
type ProcessOutcome = "stopped" | "signalled" | "not-running" | "untouched";

interface TimerRecord {
  readonly run: string;
  readonly token: string;
  readonly at: string;
  readonly armedAt: string;
  readonly pid: number;
  readonly orca: string;
}

interface SendResult {
  readonly outcome: "sent" | "failed";
  readonly at: string;
  readonly status: number | null;
  readonly signal: string | null;
  readonly error: string | null;
  readonly stdout: string;
  readonly stderr: string;
}

interface TimerView extends TimerRecord {
  readonly state: TimerState;
  readonly result: SendResult | null;
}

export type Command =
  | { readonly kind: "arm"; readonly run: string; readonly at: string; readonly orca: string }
  | { readonly kind: "status"; readonly run: string }
  | { readonly kind: "cancel"; readonly run: string }
  | { readonly kind: "fire"; readonly run: string; readonly token: string; readonly at: string; readonly orca: string };

function parseOptions(args: readonly string[], flags: readonly string[]): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flags.includes(flag)) fail(flag.startsWith("-") ? `unknown option ${flag}.\n${USAGE}` : `unexpected argument ${flag}.\n${USAGE}`);
    if (values.has(flag)) fail(`${flag} given twice.\n${USAGE}`);
    if (value === undefined) fail(`${flag} needs a value.\n${USAGE}`);
    values.set(flag, value);
  }
  for (const flag of flags) if (!values.has(flag)) fail(`${flag} is required.\n${USAGE}`);
  return values;
}

function runOption(options: ReadonlyMap<string, string>): string {
  const run = options.get("--run") ?? "";
  if (!RUN_ID.test(run)) fail(`--run takes an Orca Run id of letters, digits, _, or -, at most 128 characters, not ${run}.`);
  return run;
}

function instantOption(options: ReadonlyMap<string, string>): string {
  const value = options.get("--at") ?? "";
  const at = new Date(value);
  if (!ISO_INSTANT.test(value) || !Number.isFinite(at.getTime()) || at.toISOString() !== value.replace(/(?<!\.\d{3})Z$/, ".000Z")) {
    fail(`--at takes an ISO UTC instant such as 2026-01-01T12:15:00Z, not ${value}.`);
  }
  return at.toISOString();
}

function orcaOption(options: ReadonlyMap<string, string>): string {
  const orca = options.get("--orca") ?? "";
  if (orca.length === 0) fail("--orca takes the Orca executable.");
  return orca;
}

export function parseArgs(argv: readonly string[], now: Date): Command {
  const [command, ...rest] = argv;
  switch (command) {
    case "arm": {
      const options = parseOptions(rest, ["--run", "--at", "--orca"]);
      const at = instantOption(options);
      if (Date.parse(at) <= now.getTime()) fail(`--at must be in the future; ${at} is not after ${now.toISOString()}.`);
      return { kind: "arm", run: runOption(options), at, orca: orcaOption(options) };
    }
    case "status":
      return { kind: "status", run: runOption(parseOptions(rest, ["--run"])) };
    case "cancel":
      return { kind: "cancel", run: runOption(parseOptions(rest, ["--run"])) };
    case "fire": {
      const options = parseOptions(rest, ["--run", "--token", "--at", "--orca"]);
      const token = options.get("--token") ?? "";
      if (!TOKEN.test(token)) fail(`--token takes a timer token, not ${token}.`);
      return { kind: "fire", run: runOption(options), token, at: instantOption(options), orca: orcaOption(options) };
    }
    default:
      fail(USAGE);
  }
}

export function runDir(home: string, run: string): string {
  return join(home, ".local", "state", "agents-kit", "orca-status-timer", run);
}

function errorCode(err: unknown): string | undefined {
  return err instanceof Error && "code" in err && typeof err.code === "string" ? err.code : undefined;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function ensureDir(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true, mode: DIR_MODE });
    chmodSync(dir, DIR_MODE);
  } catch (err) {
    fail(`cannot prepare timer state ${dir}: ${describe(err)}`);
  }
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    if (errorCode(err) === "ENOENT") return null;
    fail(`cannot read timer state ${path}: ${describe(err)}`);
  }
}

function readJson(path: string): unknown {
  const text = readText(path);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    fail(`timer state ${path} is not valid JSON.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTimer(dir: string, token: string): TimerRecord | null {
  const value = readJson(join(dir, `${token}.timer.json`));
  if (value === null) return null;
  if (!isRecord(value) || typeof value.run !== "string" || value.token !== token || typeof value.at !== "string"
    || typeof value.armedAt !== "string" || typeof value.pid !== "number" || typeof value.orca !== "string") {
    fail(`timer state ${join(dir, `${token}.timer.json`)} is malformed.`);
  }
  return { run: value.run, token, at: value.at, armedAt: value.armedAt, pid: value.pid, orca: value.orca };
}

function readCurrentToken(dir: string): string | null {
  const value = readJson(join(dir, "current.json"));
  if (value === null) return null;
  if (!isRecord(value) || typeof value.token !== "string" || !TOKEN.test(value.token)) fail(`timer state ${join(dir, "current.json")} is malformed.`);
  return value.token;
}

function readCurrent(dir: string): TimerRecord | null {
  const token = readCurrentToken(dir);
  if (token === null) return null;
  const record = readTimer(dir, token);
  if (record === null) fail(`timer state ${dir} names current token ${token} without its record.`);
  return record;
}

function readClaim(dir: string, token: string): Claim | null {
  const text = readText(join(dir, `${token}.claim`));
  if (text === null) return null;
  if (text === "send" || text === "cancel") return text;
  fail(`timer claim ${join(dir, `${token}.claim`)} is malformed.`);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function readResult(dir: string, token: string): SendResult | null {
  const path = join(dir, `${token}.result.json`);
  const value = readJson(path);
  if (value === null) return null;
  if (!isRecord(value)) fail(`timer result ${path} is malformed.`);
  const { outcome, at, status, signal, error, stdout, stderr } = value;
  if ((outcome !== "sent" && outcome !== "failed") || typeof at !== "string" || (status !== null && typeof status !== "number")
    || !nullableString(signal) || !nullableString(error) || typeof stdout !== "string" || typeof stderr !== "string") {
    fail(`timer result ${path} is malformed.`);
  }
  return { outcome, at, status, signal, error, stdout, stderr };
}

function writeAtomic(dir: string, name: string, text: string): void {
  const temporary = join(dir, `.tmp-${randomUUID()}`);
  try {
    writeFileSync(temporary, text, { mode: FILE_MODE, flag: "wx" });
    renameSync(temporary, join(dir, name));
  } catch (err) {
    rmSync(temporary, { force: true });
    fail(`cannot write timer state ${join(dir, name)}: ${describe(err)}`);
  }
}

function tryClaim(dir: string, token: string, claim: Claim): boolean {
  const temporary = join(dir, `.tmp-${randomUUID()}`);
  try {
    writeFileSync(temporary, claim, { mode: FILE_MODE, flag: "wx" });
    linkSync(temporary, join(dir, `${token}.claim`));
    return true;
  } catch (err) {
    if (errorCode(err) === "EEXIST") return false;
    fail(`cannot claim timer ${token}: ${describe(err)}`);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function fireMarker(run: string, token: string): string {
  return `orca-status-timer.ts fire --run ${run} --token ${token}`;
}

function isOwnedRunning(record: TimerRecord): boolean {
  const listing = spawnSync("ps", ["-ww", "-p", String(record.pid), "-o", "command="], { encoding: "utf8" });
  return listing.status === 0 && listing.stdout.includes(fireMarker(record.run, record.token));
}

function pause(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function stopProcess(record: TimerRecord): ProcessOutcome {
  if (!isOwnedRunning(record)) return "not-running";
  try {
    process.kill(record.pid, "SIGTERM");
  } catch (err) {
    if (errorCode(err) === "ESRCH") return "stopped";
    fail(`cannot stop timer process ${record.pid}: ${describe(err)}`);
  }
  for (let waited = 0; waited < STOP_WAIT_MS; waited += STOP_POLL_MS) {
    if (!isOwnedRunning(record)) return "stopped";
    pause(STOP_POLL_MS);
  }
  return isOwnedRunning(record) ? "signalled" : "stopped";
}

function view(dir: string, record: TimerRecord): TimerView {
  const claim = readClaim(dir, record.token);
  const result = readResult(dir, record.token);
  const state: TimerState = claim === "cancel" ? "cancelled"
    : result !== null ? result.outcome
    : isOwnedRunning(record) ? (claim === "send" ? "sending" : "pending")
    : "lost";
  return { ...record, state, result };
}

function cancelTimer(dir: string, record: TimerRecord): { readonly timer: TimerView; readonly process: ProcessOutcome } {
  const outcome: ProcessOutcome = tryClaim(dir, record.token, "cancel") ? stopProcess(record) : "untouched";
  return { timer: view(dir, record), process: outcome };
}

function prune(dir: string, current: string): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch (err) {
    fail(`cannot list timer state ${dir}: ${describe(err)}`);
  }
  const tokens = new Set<string>();
  for (const name of names) {
    const match = TOKEN_FILE.exec(name);
    if (match !== null && match[1] !== current) tokens.add(match[1]);
  }
  for (const token of tokens) {
    const record = readTimer(dir, token);
    if (record !== null && isOwnedRunning(record)) continue;
    for (const suffix of ["claim", "result.json", "timer.json"]) rmSync(join(dir, `${token}.${suffix}`), { force: true });
  }
}

function launchDetached(args: readonly string[]): number {
  const child = spawn(process.execPath, [SCRIPT, ...args], { detached: true, stdio: "ignore" });
  if (child.pid === undefined) fail("cannot launch the timer process.");
  child.unref();
  return child.pid;
}

function arm(home: string, command: Extract<Command, { kind: "arm" }>, now: Date) {
  const dir = runDir(home, command.run);
  ensureDir(dir);
  const previous = readCurrent(dir);
  let superseded: { readonly token: string; readonly state: TimerState; readonly process: ProcessOutcome } | null = null;
  if (previous !== null) {
    const before = view(dir, previous);
    if (before.state === "pending" || before.state === "sending" || before.state === "lost") {
      const cancelled = cancelTimer(dir, previous);
      superseded = { token: previous.token, state: cancelled.timer.state, process: cancelled.process };
    }
  }
  const token = randomUUID();
  const pid = launchDetached(["fire", "--run", command.run, "--token", token, "--at", command.at, "--orca", command.orca]);
  const record: TimerRecord = { run: command.run, token, at: command.at, armedAt: now.toISOString(), pid, orca: command.orca };
  writeAtomic(dir, `${token}.timer.json`, `${JSON.stringify(record)}\n`);
  writeAtomic(dir, "current.json", `${JSON.stringify({ token })}\n`);
  prune(dir, token);
  return { timer: view(dir, record), superseded };
}

function status(home: string, run: string) {
  const dir = runDir(home, run);
  const record = readCurrent(dir);
  return { run, timer: record === null ? null : view(dir, record) };
}

function cancel(home: string, run: string) {
  const dir = runDir(home, run);
  const record = readCurrent(dir);
  if (record === null) return { run, timer: null, process: null };
  return { run, ...cancelTimer(dir, record) };
}

export function wakeBody(run: string, token: string): string {
  return `${WAKE_MARKER}\nrun: ${run}\ntoken: ${token}`;
}

function clip(text: string | null | undefined): string {
  if (typeof text !== "string") return "";
  return text.length > OUTPUT_MAX_CHARS ? text.slice(text.length - OUTPUT_MAX_CHARS) : text;
}

async function sleepUntil(at: string): Promise<void> {
  const deadline = Date.parse(at);
  for (let remaining = deadline - Date.now(); remaining > 0; remaining = deadline - Date.now()) {
    await new Promise<void>((resolve) => setTimeout(resolve, Math.min(remaining, MAX_SLEEP_MS)));
  }
}

async function fire(home: string, command: Extract<Command, { kind: "fire" }>): Promise<SendResult | null> {
  await sleepUntil(command.at);
  const dir = runDir(home, command.run);
  if (readCurrentToken(dir) !== command.token) return null;
  if (!tryClaim(dir, command.token, "send")) return null;
  const sent = spawnSync(command.orca, [
    "orchestration", "send",
    "--to", `run:${command.run}`,
    "--subject", WAKE_SUBJECT,
    "--body", wakeBody(command.run, command.token),
    "--json",
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: SEND_TIMEOUT_MS });
  const result: SendResult = {
    outcome: sent.error === undefined && sent.status === 0 ? "sent" : "failed",
    at: new Date().toISOString(),
    status: sent.status,
    signal: sent.signal,
    error: sent.error === undefined ? null : describe(sent.error),
    stdout: clip(sent.stdout),
    stderr: clip(sent.stderr),
  };
  writeAtomic(dir, `${command.token}.result.json`, `${JSON.stringify(result)}\n`);
  return result;
}

function report(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function main(argv: readonly string[]): Promise<void> {
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EPIPE" && err.code !== "ENOTCONN") throw err;
  });
  const command = parseArgs(argv, new Date());
  switch (command.kind) {
    case "arm":
      report(arm(homedir(), command, new Date()));
      return;
    case "status":
      report(status(homedir(), command.run));
      return;
    case "cancel":
      report(cancel(homedir(), command.run));
      return;
    case "fire": {
      const result = await fire(homedir(), command);
      if (result?.outcome === "failed") {
        throw new Exit(1, `wake for run ${command.run} token ${command.token} was not sent: ${result.error ?? `status ${result.status ?? result.signal}`}`);
      }
      return;
    }
    default:
      command satisfies never;
  }
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === SCRIPT;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  main(process.argv.slice(2)).catch((err: unknown) => {
    const exit = err instanceof Exit ? err : new Exit(2, `orca-status-timer failed: ${describe(err)}`);
    console.error(`[orca-status-timer] ${exit.message}`);
    process.exitCode = exit.code;
  });
}
