#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";

process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code !== "EPIPE") throw err;
});

const USAGE = [
  "usage: node scripts/cross-capability.ts check <repo> [--engine <e>] [--cli-version <v>] [--model <m>]",
  "                                        [--effort <ef>] [--network-access true|false]",
  "                                        [--network-proxy true|false] [--command \"<pkg dir>: <cmd>\"]...",
  "       node scripts/cross-capability.ts record <repo> --engine <e> --cli-version <v> --model <m>",
  "                                        --effort <ef> --network-access true|false",
  "                                        --network-proxy true|false --command \"<pkg dir>: <cmd>\"",
  "                                        --answer allowed|denied|hung --classes <class> [--classes <class>]...",
  "                                        [--binary <path>] [--state-pins <pin>]...",
  "                                        [--config-files <repo-relative path>]... [--note <text>]",
  "       node scripts/cross-capability.ts sweep",
].join("\n");

const CACHE_FILE = "cross-capability.json";
const LEGACY_DIR = "capabilities";
const TEMP_SUFFIX = ".tmp";
const DEFAULT_SANDBOX_MODE = "workspace-write";
const WRAPPER_EGRESS_CLASS = "package-manager wrapper egress";
const ANSWER_VALUES = new Set<string>(["allowed", "denied", "hung"]);
const HASH_PREFIX_LENGTH = 16;
const LOCKFILE_NAMES = new Set<string>([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "npm-shrinkwrap.json",
]);

class Exit extends Error {
  code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

function fail(message: string): never {
  throw new Exit(2, message);
}

function refuse(message: string): never {
  throw new Exit(1, message);
}

type AnswerValue = "allowed" | "denied" | "hung";

interface Answer {
  classes: string[];
  answer: AnswerValue;
  binary?: string;
  statePins?: string[];
  configFiles?: string[];
  configSha256Prefix?: string;
  note?: string;
}

interface Entry {
  engine: string;
  cliVersion: string;
  pin: { model: string; effort: string };
  lockfileSha256Prefixes: string[];
  configSha256Prefix: string;
  sandbox: { mode: string; networkAccess: boolean; networkProxy: boolean };
  probed: string;
  answers: Record<string, Answer>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validAnswer(value: unknown): Answer | null {
  if (!isRecord(value)) return null;
  if (!isStringArray(value.classes) || value.classes.length === 0) return null;
  if (typeof value.answer !== "string" || !ANSWER_VALUES.has(value.answer)) return null;
  if (value.binary !== undefined && typeof value.binary !== "string") return null;
  if (value.statePins !== undefined && !isStringArray(value.statePins)) return null;
  if (value.configFiles !== undefined && !isStringArray(value.configFiles)) return null;
  if (value.configSha256Prefix !== undefined && typeof value.configSha256Prefix !== "string") return null;
  if (value.note !== undefined && typeof value.note !== "string") return null;
  return value as unknown as Answer;
}

function validEntry(value: unknown): Entry | null {
  if (!isRecord(value)) return null;
  if (typeof value.engine !== "string" || typeof value.cliVersion !== "string") return null;
  const pin = value.pin;
  if (!isRecord(pin) || typeof pin.model !== "string" || typeof pin.effort !== "string") return null;
  if (!isStringArray(value.lockfileSha256Prefixes)) return null;
  if (typeof value.configSha256Prefix !== "string") return null;
  const sandbox = value.sandbox;
  if (!isRecord(sandbox)) return null;
  if (typeof sandbox.mode !== "string") return null;
  if (typeof sandbox.networkAccess !== "boolean" || typeof sandbox.networkProxy !== "boolean") return null;
  if (typeof value.probed !== "string") return null;
  if (!isRecord(value.answers)) return null;
  const answers: Record<string, Answer> = {};
  for (const [key, raw] of Object.entries(value.answers)) {
    const answer = validAnswer(raw);
    if (answer === null) return null;
    answers[key] = answer;
  }
  return {
    engine: value.engine,
    cliVersion: value.cliVersion,
    pin: { model: pin.model, effort: pin.effort },
    lockfileSha256Prefixes: value.lockfileSha256Prefixes,
    configSha256Prefix: value.configSha256Prefix,
    sandbox: { mode: sandbox.mode, networkAccess: sandbox.networkAccess, networkProxy: sandbox.networkProxy },
    probed: value.probed,
    answers,
  };
}

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/") || path.startsWith(`~${sep}`)) return join(homedir(), path.slice(2));
  return path;
}

function stateDir(): string {
  const override = process.env.AGENTS_KIT_STATE_DIR?.trim();
  if (override) return resolve(expandHome(override));
  return join(homedir(), ".local", "state", "agents-kit");
}

function sha256Prefix(input: Buffer): string {
  return createHash("sha256").update(input).digest("hex").slice(0, HASH_PREFIX_LENGTH);
}

function readBinary(path: string): Buffer | null {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
}

function trackedLockfiles(repo: string): string[] | null {
  const listed = spawnSync("git", ["-C", repo, "ls-files", "-z"], { encoding: "utf8", maxBuffer: Infinity });
  if (listed.error || listed.status !== 0 || typeof listed.stdout !== "string") return null;
  return listed.stdout.split("\0").filter((path) => path !== "" && LOCKFILE_NAMES.has(basename(path)));
}

function rootLockfiles(repo: string): string[] {
  let names: string[];
  try {
    names = readdirSync(repo);
  } catch {
    return [];
  }
  return names.filter((name) => LOCKFILE_NAMES.has(name));
}

function lockfilePrefixes(repo: string): string[] {
  const paths = (trackedLockfiles(repo) ?? rootLockfiles(repo)).slice().sort();
  const prefixes: string[] = [];
  for (const path of paths) {
    const content = readBinary(join(repo, path));
    if (content === null) continue;
    prefixes.push(sha256Prefix(content));
  }
  return prefixes;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

interface ConfigFingerprint {
  readonly prefix: string;
  readonly missing: string[];
}

function configFingerprint(repo: string, files: readonly string[]): ConfigFingerprint {
  const parts: Buffer[] = [];
  const missing: string[] = [];
  for (const path of sortedUnique(files)) {
    const content = readBinary(join(repo, path));
    if (content === null) {
      missing.push(path);
      continue;
    }
    parts.push(Buffer.from(`${path}\0`, "utf8"), content, Buffer.from("\0", "utf8"));
  }
  return { prefix: sha256Prefix(Buffer.concat(parts)), missing };
}

function unionConfigFiles(answers: Record<string, Answer>): string[] {
  return sortedUnique(Object.values(answers).flatMap((answer) => answer.configFiles ?? []));
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function legacyFiles(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => join(dir, name));
}

interface Cache {
  readonly entries: Record<string, unknown>;
  readonly present: boolean;
  readonly parsed: boolean;
}

function readCache(file: string): Cache {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { entries: {}, present: false, parsed: true };
    throw err;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { entries: {}, present: true, parsed: false };
  }
  if (!isRecord(value)) return { entries: {}, present: true, parsed: false };
  return { entries: value, present: true, parsed: true };
}

function removeQuietly(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    return;
  }
}

function removeDirQuietly(dir: string): void {
  try {
    rmdirSync(dir);
  } catch {
    return;
  }
}

function writeAtomic(file: string, text: string): void {
  const temp = `${file}${TEMP_SUFFIX}`;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(temp, text);
    renameSync(temp, file);
  } catch (err) {
    removeQuietly(temp);
    fail(`could not write ${file}: ${(err as Error).message}`);
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Args {
  readonly command: string;
  readonly positional: readonly string[];
  readonly values: Record<string, string[]>;
}

const REPEATABLE = new Set<string>(["--classes", "--state-pins", "--config-files", "--command"]);
const SINGLE = new Set<string>([
  "--engine",
  "--cli-version",
  "--model",
  "--effort",
  "--network-access",
  "--network-proxy",
  "--answer",
  "--binary",
  "--note",
]);

const COMMAND_OPTIONS: Record<string, readonly string[]> = {
  check: [
    "--engine",
    "--cli-version",
    "--model",
    "--effort",
    "--network-access",
    "--network-proxy",
    "--command",
  ],
  record: [
    "--engine",
    "--cli-version",
    "--model",
    "--effort",
    "--network-access",
    "--network-proxy",
    "--command",
    "--answer",
    "--classes",
    "--binary",
    "--state-pins",
    "--config-files",
    "--note",
  ],
  sweep: [],
};

const COMMAND_POSITIONALS: Record<string, number> = { check: 1, record: 1, sweep: 0 };

function parseArgs(argv: readonly string[]): Args {
  const [command, ...rest] = argv;
  if (!command) fail(USAGE);
  const allowed = COMMAND_OPTIONS[command];
  if (!allowed) fail(`unknown command ${command}\n${USAGE}`);
  const values: Record<string, string[]> = {};
  const positional: string[] = [];
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    if (!REPEATABLE.has(token) && !SINGLE.has(token)) fail(`unknown option ${token}\n${USAGE}`);
    if (!allowed.includes(token)) fail(`${command} does not take ${token}\n${USAGE}`);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) fail(`${token} takes a value\n${USAGE}`);
    if (SINGLE.has(token) && values[token]) fail(`${token} given twice\n${USAGE}`);
    (values[token] ??= []).push(value);
    index += 1;
  }
  const wanted = COMMAND_POSITIONALS[command];
  if (positional.length !== wanted) {
    fail(`${command} takes exactly ${wanted} path argument${wanted === 1 ? "" : "s"}\n${USAGE}`);
  }
  return { command, positional, values };
}

function one(args: Args, option: string): string {
  const value = args.values[option]?.[0];
  if (value === undefined) fail(`${args.command} requires ${option}\n${USAGE}`);
  return value;
}

function optional(args: Args, option: string): string | undefined {
  return args.values[option]?.[0];
}

function many(args: Args, option: string): string[] {
  return args.values[option] ?? [];
}

function flag(args: Args, option: string): boolean | undefined {
  const raw = optional(args, option);
  if (raw === undefined) return undefined;
  if (raw !== "true" && raw !== "false") fail(`${option} takes true or false, not ${raw}\n${USAGE}`);
  return raw === "true";
}

function requiredFlag(args: Args, option: string): boolean {
  const value = flag(args, option);
  if (value === undefined) fail(`${args.command} requires ${option}\n${USAGE}`);
  return value;
}

type Verdict = "match" | "stale" | "absent";

interface CommandVerdict {
  verdict: Verdict;
  reasons?: string[];
  answer?: AnswerValue;
  binary?: string;
  statePins?: string[];
}

interface Report {
  repo: string;
  entry: Verdict;
  reasons: string[];
  legacy: string[];
  commands: Record<string, CommandVerdict>;
  summary: string;
}

function staleReasons(args: Args, repo: string, entry: Entry): string[] {
  const reasons: string[] = [];
  const engine = optional(args, "--engine");
  if (engine !== undefined && engine !== entry.engine) reasons.push("engine");
  const cliVersion = optional(args, "--cli-version");
  if (cliVersion !== undefined && cliVersion !== entry.cliVersion) reasons.push("cliVersion");
  const model = optional(args, "--model");
  const effort = optional(args, "--effort");
  if ((model !== undefined && model !== entry.pin.model) || (effort !== undefined && effort !== entry.pin.effort)) {
    reasons.push("pin");
  }
  const networkAccess = flag(args, "--network-access");
  const networkProxy = flag(args, "--network-proxy");
  if (
    (networkAccess !== undefined && networkAccess !== entry.sandbox.networkAccess) ||
    (networkProxy !== undefined && networkProxy !== entry.sandbox.networkProxy)
  ) {
    reasons.push("sandbox");
  }
  if (!sameList(lockfilePrefixes(repo), entry.lockfileSha256Prefixes)) reasons.push("lockfiles");
  if (configFingerprint(repo, unionConfigFiles(entry.answers)).prefix !== entry.configSha256Prefix) {
    reasons.push("config");
  }
  return reasons;
}

function commandVerdict(
  repo: string,
  answer: Answer | undefined,
  shared: readonly string[],
  configStale: boolean,
): CommandVerdict {
  if (answer === undefined) return { verdict: "absent" };
  const reasons = [...shared];
  const files = answer.configFiles ?? [];
  if (files.length === 0) {
    if (configStale) reasons.push("config");
  } else {
    const fingerprint = configFingerprint(repo, files);
    for (const path of fingerprint.missing) reasons.push(`config file missing: ${path}`);
    if (fingerprint.missing.length === 0) {
      if (answer.configSha256Prefix === undefined) {
        if (configStale) reasons.push("config");
      } else if (fingerprint.prefix !== answer.configSha256Prefix) {
        reasons.push("config");
      }
    }
  }
  const verdict: CommandVerdict = { verdict: reasons.length > 0 ? "stale" : "match" };
  if (reasons.length > 0) verdict.reasons = reasons;
  verdict.answer = answer.answer;
  if (answer.binary !== undefined) verdict.binary = answer.binary;
  if (answer.statePins !== undefined) verdict.statePins = answer.statePins;
  return verdict;
}

function summarize(report: Omit<Report, "summary">): string {
  const head =
    report.reasons.length > 0 ? `entry ${report.entry} (${report.reasons.join(", ")})` : `entry ${report.entry}`;
  const counts = { match: 0, stale: 0, absent: 0 };
  const keys = Object.keys(report.commands);
  for (const key of keys) counts[report.commands[key].verdict] += 1;
  const commands =
    keys.length === 0
      ? "commands: none"
      : `commands: ${counts.match} match, ${counts.stale} stale, ${counts.absent} absent`;
  const parts = [head, commands];
  if (report.legacy.length > 0) parts.push(`legacy: ${report.legacy.length}`);
  return parts.join("; ");
}

function cmdCheck(args: Args): void {
  const repo = resolve(args.positional[0]);
  const dir = stateDir();
  const cache = readCache(join(dir, CACHE_FILE));
  const stored = cache.parsed ? cache.entries[repo] : undefined;
  const entry = cache.parsed ? validEntry(stored) : null;

  const reasons: string[] = [];
  let verdict: Verdict = "absent";
  if (entry === null) {
    if (!cache.present) reasons.push("no cache file");
    else if (!cache.parsed) reasons.push("unreadable cache");
    else if (stored === undefined) reasons.push("no entry");
    else reasons.push("entry shape");
  } else {
    reasons.push(...staleReasons(args, repo, entry));
    verdict = reasons.length > 0 ? "stale" : "match";
  }

  const shared = reasons.filter((reason) => reason !== "config");
  const configStale = reasons.includes("config");
  const commands: Record<string, CommandVerdict> = {};
  for (const key of [...new Set(many(args, "--command"))]) {
    commands[key] = commandVerdict(repo, entry?.answers[key], shared, configStale);
  }

  const report = { repo, entry: verdict, reasons, legacy: legacyFiles(join(dir, LEGACY_DIR)), commands };
  process.stdout.write(`${JSON.stringify({ ...report, summary: summarize(report) })}\n`);
}

function cmdRecord(args: Args): void {
  const repo = resolve(args.positional[0]);
  let repoIsDir = false;
  try {
    repoIsDir = statSync(repo).isDirectory();
  } catch {
    repoIsDir = false;
  }
  if (!repoIsDir) {
    refuse(`record refuses ${repo}: no such directory — a mistyped repository path would file the answer under a key no check will match.`);
  }
  const engine = one(args, "--engine");
  const cliVersion = one(args, "--cli-version");
  const model = one(args, "--model");
  const effort = one(args, "--effort");
  const networkAccess = requiredFlag(args, "--network-access");
  const networkProxy = requiredFlag(args, "--network-proxy");
  const keys = many(args, "--command");
  if (keys.length !== 1) fail(`record takes exactly one --command\n${USAGE}`);
  const key = keys[0];
  const value = one(args, "--answer");
  const classes = [...new Set(many(args, "--classes"))];
  const binary = optional(args, "--binary");
  const statePins = many(args, "--state-pins");
  const configFiles = many(args, "--config-files");
  const note = optional(args, "--note");

  if (classes.length === 0) {
    refuse(`record refuses ${key} with no --classes: an answer that names no class answers for none.`);
  }
  if (!ANSWER_VALUES.has(value)) {
    refuse(`record refuses --answer ${value}: an answer is allowed, denied or hung.`);
  }
  if (binary !== undefined && classes.includes(WRAPPER_EGRESS_CLASS)) {
    refuse(`record refuses ${WRAPPER_EGRESS_CLASS} on ${key}, recorded with --binary ${binary}: a direct binary makes no wrapper call.`);
  }
  for (const path of sortedUnique(configFiles)) {
    if (readBinary(join(repo, path)) === null) refuse(`record refuses --config-files ${path}: no such file under ${repo}.`);
  }

  const file = join(stateDir(), CACHE_FILE);
  const cache = readCache(file);
  if (!cache.parsed) {
    refuse(`record refuses to merge into ${file}: it holds no JSON object. Move it aside and probe again.`);
  }
  const entries: Record<string, unknown> = { ...cache.entries };
  const existing = validEntry(entries[repo]);
  const answers: Record<string, Answer> = existing === null ? {} : { ...existing.answers };

  const answer: Answer = { classes, answer: value as AnswerValue };
  if (binary !== undefined) answer.binary = binary;
  if (statePins.length > 0) answer.statePins = statePins;
  if (configFiles.length > 0) {
    answer.configFiles = sortedUnique(configFiles);
    answer.configSha256Prefix = configFingerprint(repo, answer.configFiles).prefix;
  }
  if (note !== undefined) answer.note = note;
  answers[key] = answer;

  entries[repo] = {
    engine,
    cliVersion,
    pin: { model, effort },
    lockfileSha256Prefixes: lockfilePrefixes(repo),
    configSha256Prefix: configFingerprint(repo, unionConfigFiles(answers)).prefix,
    sandbox: { mode: existing?.sandbox.mode ?? DEFAULT_SANDBOX_MODE, networkAccess, networkProxy },
    probed: today(),
    answers,
  } satisfies Entry;

  writeAtomic(file, `${JSON.stringify(entries, null, 2)}\n`);
  process.stdout.write(`recorded ${key} (${value}) for ${repo}\n`);
}

function cmdSweep(): void {
  const dir = join(stateDir(), LEGACY_DIR);
  for (const path of legacyFiles(dir)) {
    unlinkSync(path);
    process.stdout.write(`removed ${path}\n`);
  }
  removeDirQuietly(dir);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case "check":
      return cmdCheck(args);
    case "record":
      return cmdRecord(args);
    case "sweep":
      return cmdSweep();
    default:
      fail(`unknown command ${args.command}\n${USAGE}`);
  }
}

try {
  main();
} catch (err) {
  const exit = err instanceof Exit ? err : new Exit(2, `cross-capability failed: ${(err as Error).message}`);
  process.stderr.write(`${exit.message}\n`);
  process.exitCode = exit.code;
}
