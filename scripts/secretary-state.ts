#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
  type Stats,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const OUTPUT_MAX_BYTES = 32768;
const EVENT_MAX_BYTES = 16384;
export const BODY_MAX_BYTES = 1048576;
export const BODY_CHUNK_MAX_BYTES = 16384;
export const HISTORY_SCAN_MAX = 1000;
export const RECOVER_BATCH = 1000;
export const REVIEW_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const ATTEMPT_LEASE_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const WAKE_LEAD_MS = MINUTE_MS;
const EARLY_FIRE_MINUTES = 30;
const EARLY_FIRE_SHIFT_MINUTES = 2;
const UTF8_CHAR_MAX_BYTES = 4;
const JSON_BUDGET = OUTPUT_MAX_BYTES - 1;
const SEQ_DIGITS = 12;
const ID_MAX_CHARS = 128;
const TARGET_MAX_CHARS = 1024;
const LOCK_ATTEMPTS = 40;
const LOCK_RETRY_MS = 50;
const RUNBOOK_ID_HASH_CHARS = 16;
const RUNBOOK_LABEL_MAX_CHARS = 238;
const RECORD_DIR_MODE = 0o700;
const RECORD_FILE_MODE = 0o600;
const APPLY_TEMP_MODE = 0o600;
const NEW_TARGET_BASE_MODE = 0o666;

const APPEND_TYPES = ["attempt-started", "attempt-stopped", "review-completed", "proposal", "decision", "correction"] as const;
const APPLY_TYPES = ["apply-intent", "apply-result"] as const;
const EVENT_TYPES = [...APPEND_TYPES, ...APPLY_TYPES] as const;
const JOBS = ["review", "apply"] as const;
const STOP_REASONS = ["stopped", "interrupted"] as const;
const OUTCOMES = ["complete", "partial"] as const;
const DECISIONS = ["accepted", "rejected", "deferred"] as const;
const APPLY_OUTCOMES = ["applied", "conflict", "held"] as const;

export type AppendType = (typeof APPEND_TYPES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
type Job = (typeof JOBS)[number];
type StopReason = (typeof STOP_REASONS)[number];
type Outcome = (typeof OUTCOMES)[number];
type DecisionValue = (typeof DECISIONS)[number];
type ApplyOutcome = (typeof APPLY_OUTCOMES)[number];

const DAY_NAME = /^\d{4}-\d{2}-\d{2}$/;
const EVENT_NAME = /^(\d{12})\.json$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const PROPOSAL_ID = /^p([1-9]\d*)$/;
const DIGITS = /^\d+$/;
const EVIDENCE_DATE = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:Z|[+-](\d{2}):(\d{2})))?$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const CREDENTIAL_SHAPES: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: "private-key", pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY/ },
  { name: "aws-access-key-id", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "github-token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/ },
  { name: "slack-token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: "jwt", pattern: /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
];

const USAGE = [
  "usage: node scripts/secretary-state.ts append --type <type> --json <file|->",
  "       node scripts/secretary-state.ts apply --attempt <token> --proposal <id> --revision <n>",
  "       node scripts/secretary-state.ts hold --attempt <token> --proposal <id> --revision <n>",
  "       node scripts/secretary-state.ts recover",
  "       node scripts/secretary-state.ts status [--cursor <cursor>]",
  "       node scripts/secretary-state.ts rejected [--cursor <target>]",
  "       node scripts/secretary-state.ts history [--after <seq>] [--type <type>] [--proposal <id>]",
  "       node scripts/secretary-state.ts event --seq <seq>",
  "       node scripts/secretary-state.ts body --hash <sha256> [--offset <n>] [--limit <n>]",
].map((line) => `${line} [--expect-runbook <physical-root>]`).join("\n");

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

function refuse(message: string): never {
  throw new Exit(1, message);
}

function errorCode(err: unknown): string | undefined {
  return (err as NodeJS.ErrnoException).code;
}

function describe(err: unknown): string {
  return errorCode(err) ?? (err as Error).message;
}

function missing(err: unknown): boolean {
  const code = errorCode(err);
  return code === "ENOENT" || code === "ENOTDIR";
}

function sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function byteSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function padSeq(seq: number): string {
  return String(seq).padStart(SEQ_DIGITS, "0");
}

export interface Store {
  readonly id: string;
  readonly runbook: string;
  readonly dir: string;
  readonly guarded: readonly string[];
}

export function openStore(home: string, expectedRunbook?: string): Store {
  if (expectedRunbook !== undefined && !isAbsolute(expectedRunbook)) fail("--expect-runbook takes an absolute physical runbook path.");
  const file = join(home, ".config", "agents-kit", "config.json");
  const unconfigured = `no runbookRoot is configured in ${file}; the secretary has no runbook.`;
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    if (missing(err)) refuse(unconfigured);
    fail(`cannot read ${file}: ${describe(err)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail(`${file} is not valid JSON.`);
  }
  if (!isRecord(parsed)) fail(`${file} does not hold a JSON object.`);
  if (!Object.hasOwn(parsed, "runbookRoot")) refuse(unconfigured);
  const value = parsed.runbookRoot;
  if (typeof value !== "string" || value === "") fail(`runbookRoot in ${file} must be a nonempty path string.`);
  if (!isAbsolute(value) && !value.startsWith("~/")) fail(`runbookRoot in ${file} must be an absolute or ~/ path.`);
  const expanded = value.startsWith("~/") ? join(home, value.slice(2)) : resolve(value);
  let physical: string;
  try {
    physical = realpathSync.native(expanded);
    if (!statSync(physical).isDirectory()) fail(`configured runbook ${expanded} is not a directory.`);
    readdirSync(physical);
  } catch (err) {
    if (err instanceof Exit) throw err;
    fail(`configured runbook ${expanded} is unavailable: ${describe(err)}`);
  }
  if (expectedRunbook !== undefined && physical !== expectedRunbook) {
    refuse(`configured runbook ${physical} differs from expected runbook ${expectedRunbook}; no records were accessed.`);
  }
  const label = (basename(physical).replace(/[^A-Za-z0-9._-]+/g, "-") || "runbook").slice(0, RUNBOOK_LABEL_MAX_CHARS);
  const id = `${label}-${sha256(physical).slice(0, RUNBOOK_ID_HASH_CHARS)}`;
  const guarded = [join(home, ".local", "state", "agents-kit"), join(home, ".config", "agents-kit")];
  return { id, runbook: physical, dir: join(home, ".local", "state", "agents-kit", "secretary", "runbook", id), guarded };
}

function historyDir(store: Store): string {
  return join(store.dir, "history");
}

function bodiesDir(store: Store): string {
  return join(store.dir, "bodies");
}

function checkpointPath(store: Store): string {
  return join(store.dir, "state.json");
}

function progressPath(store: Store): string {
  return join(store.dir, "recovery.json");
}

function lockPath(store: Store): string {
  return join(store.dir, "lock");
}

function removeQuietly(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    return;
  }
}

export function publishFile(dir: string, name: string, bytes: string | Buffer): "created" | "exists" {
  const temp = join(dir, `.tmp-${process.pid}-${randomUUID()}`);
  writeFileSync(temp, bytes, { flag: "wx", mode: RECORD_FILE_MODE });
  try {
    linkSync(temp, join(dir, name));
    return "created";
  } catch (err) {
    if (errorCode(err) === "EEXIST") return "exists";
    throw err;
  } finally {
    removeQuietly(temp);
  }
}

interface Evidence {
  readonly source: string;
  readonly published: string | null;
  readonly observed: string | null;
  readonly detail?: string;
}

interface AttemptStarted {
  readonly attempt: string;
  readonly owner: string;
  readonly job: Job;
}

interface AttemptStopped {
  readonly attempt: string;
  readonly reason: StopReason;
}

interface ReviewCompleted {
  readonly attempt: string;
  readonly outcome: Outcome;
  readonly summary: string;
  readonly unavailable: readonly string[];
}

interface ProposalRecord {
  readonly proposal: string;
  readonly revision: number;
  readonly attempt: string;
  readonly target: string;
  readonly summary: string;
  readonly evidence: readonly Evidence[];
  readonly before: string | null;
  readonly bodyHash: string;
  readonly bodyBytes: number;
}

interface ProposalInput {
  readonly proposal: string | null;
  readonly attempt: string;
  readonly target: string;
  readonly summary: string;
  readonly evidence: readonly Evidence[];
  readonly before: string | null;
  readonly body: string;
}

interface DecisionRecord {
  readonly proposal: string;
  readonly revision: number;
  readonly decision: DecisionValue;
  readonly source: string;
}

interface CorrectionRecord {
  readonly attempt: string;
  readonly corrects: number;
  readonly note: string;
}

interface ApplyIntent {
  readonly attempt: string;
  readonly proposal: string;
  readonly revision: number;
  readonly target: string;
  readonly before: string | null;
  readonly after: string;
}

interface ApplyResult {
  readonly attempt: string;
  readonly proposal: string;
  readonly revision: number;
  readonly target: string;
  readonly outcome: ApplyOutcome;
  readonly observed: string | null;
  readonly recovered: boolean;
}

interface Envelope<T extends EventType, P> {
  readonly seq: number;
  readonly id: string;
  readonly at: string;
  readonly type: T;
  readonly payload: P;
}

export type SecretaryEvent =
  | Envelope<"attempt-started", AttemptStarted>
  | Envelope<"attempt-stopped", AttemptStopped>
  | Envelope<"review-completed", ReviewCompleted>
  | Envelope<"proposal", ProposalRecord>
  | Envelope<"decision", DecisionRecord>
  | Envelope<"correction", CorrectionRecord>
  | Envelope<"apply-intent", ApplyIntent>
  | Envelope<"apply-result", ApplyResult>;

type Input =
  | { readonly type: "attempt-started"; readonly payload: AttemptStarted }
  | { readonly type: "attempt-stopped"; readonly payload: AttemptStopped }
  | { readonly type: "review-completed"; readonly payload: ReviewCompleted }
  | { readonly type: "proposal"; readonly payload: ProposalInput }
  | { readonly type: "decision"; readonly payload: DecisionRecord }
  | { readonly type: "correction"; readonly payload: CorrectionRecord };

type Invalid = (message: string) => never;

function fields(value: unknown, where: string, required: readonly string[], optional: readonly string[], invalid: Invalid): Record<string, unknown> {
  if (!isRecord(value)) invalid(`${where} must be a JSON object`);
  for (const key of Object.keys(value)) {
    if (!required.includes(key) && !optional.includes(key)) invalid(`${where} has unexpected field ${JSON.stringify(key)}`);
  }
  for (const key of required) if (!Object.hasOwn(value, key)) invalid(`${where} is missing ${key}`);
  return value;
}

function text(value: unknown, where: string, invalid: Invalid): string {
  if (typeof value !== "string" || value.trim() === "") invalid(`${where} must be a nonempty string`);
  return value;
}

function token(value: unknown, where: string, invalid: Invalid): string {
  if (typeof value !== "string" || value.length > ID_MAX_CHARS || !TOKEN.test(value)) {
    invalid(`${where} must be a token of letters, digits, '.', '_', ':', or '-' that starts with a letter or digit, at most ${ID_MAX_CHARS} characters`);
  }
  return value;
}

function positive(value: unknown, where: string, invalid: Invalid): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) invalid(`${where} must be a positive integer`);
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], where: string, invalid: Invalid): T {
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) invalid(`${where} must be one of ${allowed.join(", ")}`);
  return match;
}

function proposalId(value: unknown, where: string, invalid: Invalid): string {
  if (typeof value !== "string" || !PROPOSAL_ID.test(value) || value.length > ID_MAX_CHARS) invalid(`${where} must be a proposal id such as p12`);
  return value;
}

function fingerprint(value: unknown, where: string, invalid: Invalid): string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) invalid(`${where} must be a lowercase sha256 hex digest`);
  return value;
}

function optionalFingerprint(value: unknown, where: string, invalid: Invalid): string | null {
  return value === null ? null : fingerprint(value, where, invalid);
}

function target(value: unknown, where: string, invalid: Invalid): string {
  const path = text(value, where, invalid);
  const segments = path.split("/");
  const relative = path.length <= TARGET_MAX_CHARS
    && !path.startsWith("/")
    && !path.includes("\\")
    && !path.includes("\0")
    && posix.normalize(path) === path
    && !segments.includes("..")
    && !segments.includes(".")
    && !segments.includes("");
  if (!relative) invalid(`${where} must be a normalized runbook-relative path of at most ${TARGET_MAX_CHARS} characters`);
  return path;
}

function evidenceDate(value: unknown, where: string, invalid: Invalid): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !validEvidenceDate(value)) invalid(`${where} must be null or a valid ISO date`);
  return value;
}

function validEvidenceDate(value: string | null): boolean {
  if (value === null) return true;
  const match = EVIDENCE_DATE.exec(value);
  if (match === null) return false;
  const [, date, hour, minute, second, fraction, offsetHour, offsetMinute] = match;
  const time = Date.parse(`${date}T00:00:00.000Z`);
  const isEndOfDay = hour === "24"
    && minute === "00"
    && (second === undefined || second === "00")
    && (fraction === undefined || /^0+$/.test(fraction));
  return Number.isFinite(time)
    && new Date(time).toISOString().slice(0, 10) === date
    && (Number(hour ?? 0) < 24 || isEndOfDay)
    && Number(minute ?? 0) < 60
    && Number(second ?? 0) < 60
    && Number(offsetHour ?? 0) < 24
    && Number(offsetMinute ?? 0) < 60;
}

function evidenceList(value: unknown, where: string, invalid: Invalid): Evidence[] {
  if (!Array.isArray(value) || value.length === 0) invalid(`${where} must be a nonempty array`);
  return value.map((item: unknown, index) => {
    const at = `${where}[${index}]`;
    const record = fields(item, at, ["source", "published", "observed"], ["detail"], invalid);
    const evidence: Evidence = {
      source: text(record.source, `${at}.source`, invalid),
      published: evidenceDate(record.published, `${at}.published`, invalid),
      observed: evidenceDate(record.observed, `${at}.observed`, invalid),
    };
    return Object.hasOwn(record, "detail") ? { ...evidence, detail: text(record.detail, `${at}.detail`, invalid) } : evidence;
  });
}

function textList(value: unknown, where: string, invalid: Invalid): string[] {
  if (!Array.isArray(value)) invalid(`${where} must be an array`);
  return value.map((item: unknown, index) => text(item, `${where}[${index}]`, invalid));
}

function attemptStarted(value: unknown, invalid: Invalid): AttemptStarted {
  const record = fields(value, "payload", ["attempt", "owner", "job"], [], invalid);
  const attempt = token(record.attempt, "attempt", invalid);
  const { owner } = record;
  if (typeof owner !== "string" || owner.trim() === "" || owner.length > ID_MAX_CHARS) {
    invalid(`owner must be a nonempty string of at most ${ID_MAX_CHARS} characters`);
  }
  return { attempt, owner, job: oneOf(record.job, JOBS, "job", invalid) };
}

function attemptStopped(value: unknown, invalid: Invalid): AttemptStopped {
  const record = fields(value, "payload", ["attempt", "reason"], [], invalid);
  return { attempt: token(record.attempt, "attempt", invalid), reason: oneOf(record.reason, STOP_REASONS, "reason", invalid) };
}

function applyIntent(value: unknown, invalid: Invalid): ApplyIntent {
  const record = fields(value, "payload", ["attempt", "proposal", "revision", "target", "before", "after"], [], invalid);
  return {
    attempt: token(record.attempt, "attempt", invalid),
    proposal: proposalId(record.proposal, "proposal", invalid),
    revision: positive(record.revision, "revision", invalid),
    target: target(record.target, "target", invalid),
    before: optionalFingerprint(record.before, "before", invalid),
    after: fingerprint(record.after, "after", invalid),
  };
}

function applyResult(value: unknown, invalid: Invalid): ApplyResult {
  const record = fields(value, "payload", ["attempt", "proposal", "revision", "target", "outcome", "observed", "recovered"], [], invalid);
  if (typeof record.recovered !== "boolean") invalid("recovered must be a boolean");
  return {
    attempt: token(record.attempt, "attempt", invalid),
    proposal: proposalId(record.proposal, "proposal", invalid),
    revision: positive(record.revision, "revision", invalid),
    target: target(record.target, "target", invalid),
    outcome: oneOf(record.outcome, APPLY_OUTCOMES, "outcome", invalid),
    observed: optionalFingerprint(record.observed, "observed", invalid),
    recovered: record.recovered,
  };
}

function reviewCompleted(value: unknown, invalid: Invalid): ReviewCompleted {
  const record = fields(value, "payload", ["attempt", "outcome", "summary", "unavailable"], [], invalid);
  const outcome = oneOf(record.outcome, OUTCOMES, "outcome", invalid);
  const unavailable = textList(record.unavailable, "unavailable", invalid);
  if (outcome === "partial" && unavailable.length === 0) invalid("a partial review must list its unavailable evidence");
  if (outcome === "complete" && unavailable.length > 0) invalid("a review with unavailable evidence is partial, not complete");
  return {
    attempt: token(record.attempt, "attempt", invalid),
    outcome,
    summary: text(record.summary, "summary", invalid),
    unavailable,
  };
}

function decisionRecord(value: unknown, invalid: Invalid): DecisionRecord {
  const record = fields(value, "payload", ["proposal", "revision", "decision", "source"], [], invalid);
  return {
    proposal: proposalId(record.proposal, "proposal", invalid),
    revision: positive(record.revision, "revision", invalid),
    decision: oneOf(record.decision, DECISIONS, "decision", invalid),
    source: text(record.source, "source", invalid),
  };
}

function correctionRecord(value: unknown, invalid: Invalid): CorrectionRecord {
  const record = fields(value, "payload", ["attempt", "corrects", "note"], [], invalid);
  return {
    corrects: positive(record.corrects, "corrects", invalid),
    note: text(record.note, "note", invalid),
    attempt: token(record.attempt, "attempt", invalid),
  };
}

function proposalInput(value: unknown, invalid: Invalid): ProposalInput {
  const record = fields(value, "payload", ["attempt", "target", "summary", "evidence", "before", "body"], ["proposal"], invalid);
  if (typeof record.body !== "string") invalid("body must be a string");
  if (Buffer.byteLength(record.body) > BODY_MAX_BYTES) invalid(`body exceeds ${BODY_MAX_BYTES} bytes`);
  const evidence = evidenceList(record.evidence, "evidence", invalid);
  return {
    proposal: Object.hasOwn(record, "proposal") ? proposalId(record.proposal, "proposal", invalid) : null,
    attempt: token(record.attempt, "attempt", invalid),
    target: target(record.target, "target", invalid),
    summary: text(record.summary, "summary", invalid),
    evidence,
    before: optionalFingerprint(record.before, "before", invalid),
    body: record.body,
  };
}

function proposalRecord(value: unknown, invalid: Invalid): ProposalRecord {
  const keys = ["proposal", "revision", "attempt", "target", "summary", "evidence", "before", "bodyHash", "bodyBytes"];
  const record = fields(value, "payload", keys, [], invalid);
  const bodyBytes = record.bodyBytes;
  if (typeof bodyBytes !== "number" || !Number.isSafeInteger(bodyBytes) || bodyBytes < 0) invalid("bodyBytes must be a nonnegative integer");
  return {
    proposal: proposalId(record.proposal, "proposal", invalid),
    revision: positive(record.revision, "revision", invalid),
    attempt: token(record.attempt, "attempt", invalid),
    target: target(record.target, "target", invalid),
    summary: text(record.summary, "summary", invalid),
    evidence: evidenceList(record.evidence, "evidence", invalid),
    before: optionalFingerprint(record.before, "before", invalid),
    bodyHash: fingerprint(record.bodyHash, "bodyHash", invalid),
    bodyBytes,
  };
}

function parseInput(type: AppendType, value: unknown): Input {
  const invalid: Invalid = (message) => refuse(`invalid ${type} payload: ${message}.`);
  switch (type) {
    case "attempt-started":
      return { type, payload: attemptStarted(value, invalid) };
    case "attempt-stopped":
      return { type, payload: attemptStopped(value, invalid) };
    case "review-completed":
      return { type, payload: reviewCompleted(value, invalid) };
    case "proposal":
      return { type, payload: proposalInput(value, invalid) };
    case "decision":
      return { type, payload: decisionRecord(value, invalid) };
    case "correction":
      return { type, payload: correctionRecord(value, invalid) };
    default:
      return assertNever(type);
  }
}

function assertNever(value: never): never {
  throw new Exit(2, `unhandled value ${String(value)}`);
}

function parseCommitted(value: unknown, seq: number, path: string): SecretaryEvent {
  const invalid: Invalid = (message) => fail(`malformed committed event ${path}: ${message}. Dependent work holds until it is repaired.`);
  const record = fields(value, "event", ["seq", "id", "at", "type", "payload"], [], invalid);
  if (record.seq !== seq) invalid(`seq does not match its file name`);
  if (typeof record.id !== "string" || !UUID.test(record.id)) invalid("id must be a UUID");
  if (typeof record.at !== "string" || !validInstant(record.at)) invalid("at must be an ISO UTC instant");
  const type = oneOf(record.type, EVENT_TYPES, "type", invalid);
  const head = { seq, id: record.id, at: record.at };
  switch (type) {
    case "attempt-started":
      return { ...head, type, payload: attemptStarted(record.payload, invalid) };
    case "attempt-stopped":
      return { ...head, type, payload: attemptStopped(record.payload, invalid) };
    case "review-completed":
      return { ...head, type, payload: reviewCompleted(record.payload, invalid) };
    case "proposal":
      return { ...head, type, payload: proposalRecord(record.payload, invalid) };
    case "decision":
      return { ...head, type, payload: decisionRecord(record.payload, invalid) };
    case "correction":
      return { ...head, type, payload: correctionRecord(record.payload, invalid) };
    case "apply-intent":
      return { ...head, type, payload: applyIntent(record.payload, invalid) };
    case "apply-result":
      return { ...head, type, payload: applyResult(record.payload, invalid) };
    default:
      return assertNever(type);
  }
}

function hasUrlPassword(value: string): boolean {
  const userInfo = /[^\s\/:@]*:(?!(?:\$[A-Z_][A-Z0-9_]*|\$\{[^\s@\/{}]+\}|\$?\{\{[^\s@\/{}]+\}\}|<[^\s<>@\/]+>|\{[^\s{}@]+\})@)[^\s\/@]+@/y;
  for (const token of value.matchAll(/[A-Za-z0-9+.-]+/g)) {
    const end = token.index + token[0].length;
    if (!value.startsWith("://", end)) continue;
    if (!/\b[A-Za-z]/.test((value[token.index - 1] ?? "") + token[0])) continue;
    userInfo.lastIndex = end + 3;
    if (userInfo.test(value)) return true;
  }
  return false;
}

function hasApiKey(value: string): boolean {
  for (const token of value.matchAll(/[A-Za-z0-9_-]+/g)) {
    const text = token[0];
    if (/\bAIza[0-9A-Za-z_-]{35}\b/.test(text)) return true;
    const start = /\bsk-/.exec(text);
    if (start === null) continue;
    let end = text.length;
    while (text[end - 1] === "-") end--;
    const suffix = text.slice(start.index + 3, end);
    if (suffix.length >= 20 && /\d/.test(suffix) && /[A-Z]/.test(suffix)) return true;
  }
  return false;
}

function shapeOf(value: string): string | null {
  const shape = CREDENTIAL_SHAPES.find((candidate) => candidate.pattern.test(value))?.name;
  if (shape !== undefined) return shape;
  if (hasUrlPassword(value)) return "url-password";
  return hasApiKey(value) ? "api-key" : null;
}

function credentialMatch(value: unknown, where: string): { readonly where: string; readonly shape: string } | null {
  if (typeof value === "string") {
    const shape = shapeOf(value);
    return shape === null ? null : { where, shape };
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const match = credentialMatch(item, `${where}[${index}]`);
      if (match !== null) return match;
    }
    return null;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      const keyShape = shapeOf(key);
      if (keyShape !== null) return { where: `a field name in ${where}`, shape: keyShape };
      const match = credentialMatch(item, `${where}.${key}`);
      if (match !== null) return match;
    }
  }
  return null;
}

function guardCredentials(action: string, value: unknown): void {
  const match = credentialMatch(value, "payload");
  if (match === null) return;
  refuse(`refusing to ${action}: ${match.where} matches the ${match.shape} credential shape. Record the access method or credential-manager reference instead of the value.`);
}

interface Position {
  readonly seq: number;
}

interface ReviewPointer {
  readonly attempt: string;
  readonly outcome: Outcome;
  readonly at: string;
  readonly seq: number;
}

interface AttemptPointer {
  readonly attempt: string;
  readonly owner: string;
  readonly job: Job;
  readonly at: string;
  readonly seq: number;
}

export interface ApplyState {
  readonly state: "intent" | "conflict" | "held";
  readonly attempt: string;
  readonly seq: number;
}

export interface PendingPointer {
  readonly proposal: string;
  readonly revision: number;
  readonly target: string;
  readonly seq: number;
  readonly bodyHash: string;
  readonly bodyBytes: number;
  readonly decision: "accepted" | "deferred" | null;
  readonly decisionSeq: number | null;
  readonly apply: ApplyState | null;
}

export interface RejectedPointer {
  readonly target: string;
  readonly proposal: string;
  readonly revision: number;
  readonly bodyHash: string;
  readonly seq: number;
}

interface Checkpoint {
  readonly runbook: string;
  readonly processed: Position;
  readonly lastReview: ReviewPointer | null;
  readonly activeAttempt: AttemptPointer | null;
  readonly pending: readonly PendingPointer[];
  readonly rejected: readonly RejectedPointer[];
  readonly attempts: readonly string[];
}

function freshCheckpoint(store: Store): Checkpoint {
  return { runbook: store.runbook, processed: { seq: 0 }, lastReview: null, activeAttempt: null, pending: [], rejected: [], attempts: [] };
}

function proposalNumber(id: string): number {
  const match = PROPOSAL_ID.exec(id);
  return match === null ? Number.NaN : Number(match[1]);
}

function withApply(pending: readonly PendingPointer[], proposal: string, revision: number, apply: ApplyState): PendingPointer[] {
  return pending.map((entry) => (entry.proposal === proposal && entry.revision === revision ? { ...entry, apply } : entry));
}

function reduce(checkpoint: Checkpoint, event: SecretaryEvent): Checkpoint {
  const next = { ...checkpoint, processed: { seq: event.seq } };
  switch (event.type) {
    case "attempt-started": {
      const { attempt, owner, job } = event.payload;
      return { ...next, activeAttempt: { attempt, owner, job, at: event.at, seq: event.seq }, attempts: [...checkpoint.attempts, attempt] };
    }
    case "attempt-stopped":
      return { ...next, activeAttempt: null };
    case "review-completed":
      return {
        ...next,
        activeAttempt: null,
        lastReview: { attempt: event.payload.attempt, outcome: event.payload.outcome, at: event.at, seq: event.seq },
      };
    case "proposal": {
      const pointer: PendingPointer = {
        proposal: event.payload.proposal,
        revision: event.payload.revision,
        target: event.payload.target,
        seq: event.seq,
        bodyHash: event.payload.bodyHash,
        bodyBytes: event.payload.bodyBytes,
        decision: null,
        decisionSeq: null,
        apply: null,
      };
      const kept = checkpoint.pending.filter((entry) => entry.proposal !== pointer.proposal);
      const pending = [...kept, pointer].sort((a, b) => proposalNumber(a.proposal) - proposalNumber(b.proposal));
      return { ...next, pending };
    }
    case "decision": {
      const { proposal, decision } = event.payload;
      if (decision === "rejected") {
        const entry = checkpoint.pending.find((candidate) => candidate.proposal === proposal);
        const rejected = entry === undefined ? checkpoint.rejected : [
          ...checkpoint.rejected.filter((kept) => kept.target !== entry.target),
          { target: entry.target, proposal, revision: entry.revision, bodyHash: entry.bodyHash, seq: event.seq },
        ].sort((a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : 0));
        return { ...next, pending: checkpoint.pending.filter((candidate) => candidate.proposal !== proposal), rejected };
      }
      const pending = checkpoint.pending.map((entry) => (entry.proposal === proposal ? { ...entry, decision, decisionSeq: event.seq } : entry));
      return { ...next, pending };
    }
    case "correction":
      return next;
    case "apply-intent": {
      const { proposal, revision, attempt } = event.payload;
      return { ...next, pending: withApply(checkpoint.pending, proposal, revision, { state: "intent", attempt, seq: event.seq }) };
    }
    case "apply-result": {
      const { proposal, revision, attempt, outcome } = event.payload;
      const settled = { ...next, activeAttempt: null };
      if (outcome === "applied") return { ...settled, pending: checkpoint.pending.filter((entry) => entry.proposal !== proposal) };
      return { ...settled, pending: withApply(checkpoint.pending, proposal, revision, { state: outcome, attempt, seq: event.seq }) };
    }
    default:
      return assertNever(event);
  }
}

function leaseEnd(active: AttemptPointer): number {
  return Date.parse(active.at) + ATTEMPT_LEASE_MS;
}

function attemptRefusal(checkpoint: Checkpoint, attempt: string, job: Job | null): string | null {
  const active = checkpoint.activeAttempt;
  if (active === null) return `no attempt is active, so attempt ${attempt} records nothing`;
  if (active.attempt !== attempt) return `attempt ${attempt} is not the active attempt ${active.attempt}; a stopped, superseded, or unknown attempt records nothing`;
  if (job !== null && active.job !== job) return `attempt ${attempt} runs the ${active.job} job, not ${job}`;
  return null;
}

function intentRefusal(entry: PendingPointer): string | null {
  const apply = entry.apply;
  if (apply === null || apply.state !== "intent") return null;
  return `${entry.proposal}@${entry.revision} has an unsettled apply intent at seq ${apply.seq}; settle it with apply first`;
}

function admissionRefusal(checkpoint: Checkpoint, lastSeq: number, input: Input, now: Date): string | null {
  switch (input.type) {
    case "attempt-started": {
      const { attempt } = input.payload;
      const active = checkpoint.activeAttempt;
      if (checkpoint.attempts.includes(attempt)) {
        return `attempt ${attempt} is already recorded; start with a fresh attempt token`;
      }
      if (active !== null && now.getTime() < leaseEnd(active)) {
        const until = new Date(leaseEnd(active)).toISOString();
        return `${active.job} attempt ${active.attempt} by ${active.owner}, started ${active.at}, holds its lease until ${until} and may still be live elsewhere`;
      }
      return null;
    }
    case "attempt-stopped":
      return attemptRefusal(checkpoint, input.payload.attempt, null);
    case "review-completed":
      return attemptRefusal(checkpoint, input.payload.attempt, "review");
    case "proposal": {
      const inactive = attemptRefusal(checkpoint, input.payload.attempt, null);
      if (inactive !== null) return inactive;
      const id = input.payload.proposal;
      if (id === null) {
        if (checkpoint.activeAttempt?.job === "apply") return "an apply attempt records only a new revision of a pending proposal";
        const holder = checkpoint.pending.find((candidate) => candidate.target === input.payload.target);
        return holder === undefined ? null : `${holder.proposal}@${holder.revision} already proposes ${holder.target}; record its next revision instead`;
      }
      const entry = checkpoint.pending.find((candidate) => candidate.proposal === id);
      if (entry === undefined) return `${id} is not pending; record a new proposal without a proposal id instead`;
      if (entry.target !== input.payload.target) return `${id} targets ${entry.target}; a revision keeps its target, so propose ${input.payload.target} as a new proposal`;
      return intentRefusal(entry);
    }
    case "decision": {
      const { proposal, revision, decision } = input.payload;
      const entry = checkpoint.pending.find((candidate) => candidate.proposal === proposal);
      if (entry === undefined) return `${proposal} is not pending`;
      if (entry.revision !== revision) return `${proposal} is at revision ${entry.revision}; a decision for revision ${revision} does not apply`;
      const unsettled = intentRefusal(entry);
      if (unsettled !== null) return unsettled;
      if (decision === "accepted" && entry.apply?.state === "conflict") {
        return `${proposal}@${revision} conflicted when applied at seq ${entry.apply.seq}; only a new revision can be accepted`;
      }
      return null;
    }
    case "correction":
      return attemptRefusal(checkpoint, input.payload.attempt, "review")
        ?? (input.payload.corrects > lastSeq ? `no event ${input.payload.corrects} exists to correct` : null);
    default:
      return assertNever(input);
  }
}

function committedEvent(checkpoint: Checkpoint, input: Input, seq: number, at: string): { readonly event: SecretaryEvent; readonly body: string | null } {
  const head = { seq, id: randomUUID(), at };
  switch (input.type) {
    case "proposal": {
      const { proposal, body, ...rest } = input.payload;
      const prior = proposal === null ? undefined : checkpoint.pending.find((entry) => entry.proposal === proposal);
      const payload: ProposalRecord = {
        proposal: prior?.proposal ?? `p${seq}`,
        revision: prior === undefined ? 1 : prior.revision + 1,
        ...rest,
        bodyHash: sha256(body),
        bodyBytes: Buffer.byteLength(body),
      };
      return { event: { ...head, type: input.type, payload }, body };
    }
    case "attempt-started":
      return { event: { ...head, type: input.type, payload: input.payload }, body: null };
    case "attempt-stopped":
      return { event: { ...head, type: input.type, payload: input.payload }, body: null };
    case "review-completed":
      return { event: { ...head, type: input.type, payload: input.payload }, body: null };
    case "decision":
      return { event: { ...head, type: input.type, payload: input.payload }, body: null };
    case "correction":
      return { event: { ...head, type: input.type, payload: input.payload }, body: null };
    default:
      return assertNever(input);
  }
}

function listDays(store: Store): string[] {
  try {
    return readdirSync(historyDir(store)).filter((name) => DAY_NAME.test(name)).sort();
  } catch (err) {
    if (missing(err)) return [];
    fail(`cannot read ${historyDir(store)}: ${describe(err)}`);
  }
}

function listSeqs(store: Store, day: string): number[] {
  const dir = join(historyDir(store), day);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch (err) {
    fail(`cannot read ${dir}: ${describe(err)}`);
  }
  const seqs: number[] = [];
  for (const name of names) {
    const match = EVENT_NAME.exec(name);
    if (match !== null) seqs.push(Number(match[1]));
  }
  return seqs.sort((a, b) => a - b);
}

interface Tail {
  readonly seq: number;
  readonly newestDay: string | null;
}

function historyTail(store: Store): Tail {
  const days = listDays(store);
  for (let index = days.length - 1; index >= 0; index--) {
    const seqs = listSeqs(store, days[index]);
    if (seqs.length > 0) return { seq: seqs[seqs.length - 1], newestDay: days[days.length - 1] };
  }
  return { seq: 0, newestDay: days.at(-1) ?? null };
}

function firstDayAfter(days: readonly string[], after: number, seqsOf: (day: string) => number[]): number {
  let low = 0;
  let high = days.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    let probe = middle;
    while (probe < high && seqsOf(days[probe]).length === 0) probe++;
    if (probe === high) {
      high = middle;
      continue;
    }
    const seqs = seqsOf(days[probe]);
    if (seqs[seqs.length - 1] > after) high = middle;
    else low = probe + 1;
  }
  return low;
}

interface Located {
  readonly seq: number;
  readonly day: string;
}

function* locatedAfter(store: Store, after: number): Generator<Located> {
  const days = listDays(store);
  const cache = new Map<string, number[]>();
  const seqsOf = (day: string): number[] => {
    const known = cache.get(day);
    if (known !== undefined) return known;
    const seqs = listSeqs(store, day);
    cache.set(day, seqs);
    return seqs;
  };
  let expected = after + 1;
  for (let index = firstDayAfter(days, after, seqsOf); index < days.length; index++) {
    for (const seq of seqsOf(days[index])) {
      if (seq <= after) continue;
      if (seq !== expected) fail(`history under ${historyDir(store)} is missing or misorders seq ${expected} (found ${seq} in ${days[index]}).`);
      expected++;
      yield { seq, day: days[index] };
    }
  }
}

function readCommitted(store: Store, located: Located): SecretaryEvent {
  const path = join(historyDir(store), located.day, `${padSeq(located.seq)}.json`);
  let raw: string;
  try {
    if (lstatSync(path).size > EVENT_MAX_BYTES) fail(`malformed committed event ${path}: larger than ${EVENT_MAX_BYTES} bytes.`);
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if (err instanceof Exit) throw err;
    fail(`cannot read committed event ${path}: ${describe(err)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail(`malformed committed event ${path}: not valid JSON. Dependent work holds until it is repaired.`);
  }
  return parseCommitted(parsed, located.seq, path);
}

function counted(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validInstant(value: unknown): boolean {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function reviewValid(value: unknown): boolean {
  return value === null || (isRecord(value) && typeof value.attempt === "string" && validInstant(value.at) && counted(value.seq));
}

function attemptValid(value: unknown): boolean {
  return value === null || (reviewValid(value) && isRecord(value) && typeof value.owner === "string" && JOBS.some((job) => job === value.job));
}

function applyStateValid(value: unknown): boolean {
  if (value === null) return true;
  return isRecord(value)
    && (value.state === "intent" || value.state === "conflict" || value.state === "held")
    && typeof value.attempt === "string" && counted(value.seq);
}

function pointerValid(entry: unknown): entry is PendingPointer {
  if (!isRecord(entry)) return false;
  return typeof entry.proposal === "string" && PROPOSAL_ID.test(entry.proposal)
    && counted(entry.revision) && counted(entry.seq) && counted(entry.bodyBytes)
    && typeof entry.target === "string"
    && typeof entry.bodyHash === "string" && SHA256_HEX.test(entry.bodyHash)
    && (entry.decision === null || entry.decision === "accepted" || entry.decision === "deferred")
    && (entry.decisionSeq === null || counted(entry.decisionSeq))
    && applyStateValid(entry.apply);
}

function rejectedValid(entry: unknown): entry is RejectedPointer {
  return isRecord(entry)
    && typeof entry.target === "string"
    && typeof entry.proposal === "string" && PROPOSAL_ID.test(entry.proposal)
    && counted(entry.revision) && counted(entry.seq)
    && typeof entry.bodyHash === "string" && SHA256_HEX.test(entry.bodyHash);
}

type Derived =
  | { readonly kind: "missing" }
  | { readonly kind: "malformed" }
  | { readonly kind: "ok"; readonly checkpoint: Checkpoint };

function checkpointValid(value: unknown): value is Checkpoint {
  const processed = isRecord(value) ? value.processed : undefined;
  return isRecord(value)
    && typeof value.runbook === "string"
    && isRecord(processed)
    && counted(processed.seq)
    && reviewValid(value.lastReview)
    && attemptValid(value.activeAttempt)
    && Array.isArray(value.pending) && value.pending.every(pointerValid)
    && Array.isArray(value.rejected) && value.rejected.every(rejectedValid)
    && Array.isArray(value.attempts) && value.attempts.every((item) => typeof item === "string");
}

function readDerived(store: Store, path: string): Derived {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if (missing(err)) return { kind: "missing" };
    fail(`cannot read ${path}: ${describe(err)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "malformed" };
  }
  if (!checkpointValid(parsed)) return { kind: "malformed" };
  if (parsed.runbook !== store.runbook) fail(`${path} belongs to runbook ${parsed.runbook}, not ${store.runbook}.`);
  return { kind: "ok", checkpoint: parsed };
}

function writeDerived(store: Store, path: string, checkpoint: Checkpoint): void {
  const temp = join(store.dir, `.state-${process.pid}-${randomUUID()}.tmp`);
  writeFileSync(temp, `${JSON.stringify(checkpoint)}\n`, { flag: "wx", mode: RECORD_FILE_MODE });
  try {
    renameSync(temp, path);
  } catch (err) {
    removeQuietly(temp);
    throw err;
  }
}

function writeCheckpoint(store: Store, checkpoint: Checkpoint): void {
  writeDerived(store, checkpointPath(store), checkpoint);
}

type NotReady = "missing-checkpoint" | "checkpoint-behind" | "checkpoint-ahead" | "checkpoint-malformed";

interface Readiness {
  readonly reason: NotReady | null;
  readonly checkpoint: Checkpoint | null;
  readonly tail: Tail;
}

function readiness(store: Store): Readiness {
  const tail = historyTail(store);
  const loaded = readDerived(store, checkpointPath(store));
  if (loaded.kind === "malformed") return { reason: "checkpoint-malformed", checkpoint: null, tail };
  if (loaded.kind === "missing") return { reason: tail.seq === 0 ? null : "missing-checkpoint", checkpoint: null, tail };
  const { checkpoint } = loaded;
  if (checkpoint.processed.seq < tail.seq) return { reason: "checkpoint-behind", checkpoint, tail };
  if (checkpoint.processed.seq > tail.seq) return { reason: "checkpoint-ahead", checkpoint, tail };
  return { reason: null, checkpoint, tail };
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
    if (isRecord(parsed) && typeof parsed.pid === "number" && typeof parsed.at === "string" && typeof parsed.token === "string") {
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
    return errorCode(err) !== "ESRCH";
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
    if (missing(err)) return false;
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

function withLock<T>(store: Store, work: () => T): T {
  const dir = lockPath(store);
  const owner: LockOwner = { pid: process.pid, at: new Date().toISOString(), token: randomUUID() };
  const staged = `${dir}.new-${process.pid}-${owner.token}`;
  try {
    mkdirSync(staged, { mode: RECORD_DIR_MODE });
    writeFileSync(join(staged, "owner.json"), JSON.stringify(owner), { flag: "wx", mode: RECORD_FILE_MODE });
  } catch (err) {
    rmSync(staged, { recursive: true, force: true });
    fail(`cannot prepare lock ${staged}: ${describe(err)}`);
  }
  let held = false;
  try {
    for (let attempt = 0; attempt < LOCK_ATTEMPTS && !held; attempt++) {
      try {
        renameSync(staged, dir);
        held = true;
      } catch (err) {
        const code = errorCode(err);
        if (code !== "EEXIST" && code !== "ENOTEMPTY") fail(`cannot create lock ${dir}: ${describe(err)}`);
        if (!breakStaleLock(dir)) sleep(LOCK_RETRY_MS);
      }
    }
  } finally {
    if (!held) rmSync(staged, { recursive: true, force: true });
  }
  if (!held) {
    const holder = readOwner(dir);
    const detail = holder === null ? "no readable owner record, which another process may be reclaiming" : `pid ${holder.pid} since ${holder.at}`;
    fail(`secretary records are busy: ${dir} is held by ${detail}. Retry shortly; remove the lock only if that process is gone.`);
  }
  try {
    return work();
  } finally {
    if (readOwner(dir)?.token === owner.token) removeLock(dir);
  }
}

function protectStore(store: Store): boolean {
  try {
    if (!statSync(store.dir).isDirectory()) fail(`${store.dir} is not a directory; the secretary records need a directory there.`);
    chmodSync(store.dir, RECORD_DIR_MODE);
    return true;
  } catch (err) {
    if (err instanceof Exit) throw err;
    if (errorCode(err) === "ENOENT") return false;
    fail(`cannot protect ${store.dir}: ${describe(err)}`);
  }
}

interface Ledger {
  readonly checkpoint: Checkpoint;
  readonly tail: Tail;
}

function openLedger(store: Store): Ledger {
  const state = readiness(store);
  if (state.reason !== null) refuse(`secretary records are not ready (${state.reason}); run recover before any change.`);
  return { checkpoint: state.checkpoint ?? freshCheckpoint(store), tail: state.tail };
}

function commit(store: Store, ledger: Ledger, event: SecretaryEvent, body: string | null): Ledger {
  const bytes = `${JSON.stringify(event)}\n`;
  if (Buffer.byteLength(bytes) > EVENT_MAX_BYTES) {
    refuse(`refusing ${event.type}: the event would exceed ${EVENT_MAX_BYTES} bytes. Shorten its text; proposal bodies are stored separately.`);
  }
  if (body !== null && event.type === "proposal") storeBody(store, event.payload.bodyHash, body);
  const today = event.at.slice(0, 10);
  const day = ledger.tail.newestDay !== null && ledger.tail.newestDay > today ? ledger.tail.newestDay : today;
  const dir = join(historyDir(store), day);
  mkdirSync(dir, { recursive: true, mode: RECORD_DIR_MODE });
  const name = `${padSeq(event.seq)}.json`;
  if (publishFile(dir, name, bytes) === "exists") fail(`${join(dir, name)} already exists; refusing to overwrite history.`);
  const checkpoint = reduce(ledger.checkpoint, event);
  writeCheckpoint(store, checkpoint);
  return { checkpoint, tail: { seq: event.seq, newestDay: day } };
}

export function append(store: Store, type: AppendType, value: unknown, now: Date): SecretaryEvent {
  guardCredentials(`record ${type}`, value);
  const input = parseInput(type, value);
  mkdirSync(store.dir, { recursive: true, mode: RECORD_DIR_MODE });
  protectStore(store);
  return withLock(store, () => {
    const ledger = openLedger(store);
    const refusal = admissionRefusal(ledger.checkpoint, ledger.tail.seq, input, now);
    if (refusal !== null) refuse(`refusing ${type}: ${refusal}.`);
    const { event, body } = committedEvent(ledger.checkpoint, input, ledger.tail.seq + 1, now.toISOString());
    commit(store, ledger, event, body);
    return event;
  });
}

export interface ApplyRequest {
  readonly attempt: string;
  readonly proposal: string;
  readonly revision: number;
}

export interface ApplyHooks {
  readonly beforeReplace?: () => void;
  readonly afterReplace?: () => void;
}

interface DirIdentity {
  readonly path: string;
  readonly dev: number;
  readonly ino: number;
}

interface TargetState {
  readonly label: string;
  readonly path: string;
  readonly dir: string;
  readonly chain: readonly DirIdentity[];
  readonly absentDirs: readonly string[];
  readonly hash: string | null;
  readonly mode: number | null;
}

interface ReplacementContext {
  readonly hooks: ApplyHooks;
  readonly chain: DirIdentity[];
  readonly createdDirs: DirIdentity[];
}

function lstatOrNull(path: string): Stats | null {
  try {
    return lstatSync(path);
  } catch (err) {
    if (missing(err)) return null;
    fail(`cannot read ${path}: ${describe(err)}`);
  }
}

function statOrNull(path: string): Stats | null {
  try {
    return statSync(path);
  } catch (err) {
    if (missing(err)) return null;
    fail(`cannot read ${path}: ${describe(err)}`);
  }
}

function observeTarget(path: string, label: string): { readonly hash: string | null; readonly mode: number | null } {
  const stats = lstatOrNull(path);
  if (stats === null) return { hash: null, mode: null };
  if (stats.isSymbolicLink()) refuse(`refusing apply: target ${label} is a symlink; apply replaces only a regular file inside the physical runbook.`);
  if (!stats.isFile()) refuse(`refusing apply: target ${label} is not a regular file.`);
  let fd: number;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (err) {
    if (errorCode(err) === "ELOOP") refuse(`refusing apply: target ${label} is a symlink; apply replaces only a regular file inside the physical runbook.`);
    if (missing(err)) return { hash: null, mode: null };
    fail(`cannot read target ${path}: ${describe(err)}`);
  }
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile()) refuse(`refusing apply: target ${label} is not a regular file.`);
    return { hash: sha256(readFileSync(fd)), mode: opened.mode & 0o7777 };
  } finally {
    closeSync(fd);
  }
}

function resolveTarget(store: Store, label: string): TargetState {
  const segments = label.split("/");
  const name = segments.pop() ?? "";
  const root = lstatOrNull(store.runbook);
  if (root === null || !root.isDirectory()) fail(`configured runbook ${store.runbook} is no longer a directory.`);
  const chain: DirIdentity[] = [{ path: store.runbook, dev: root.dev, ino: root.ino }];
  const absentDirs: string[] = [];
  let dir = store.runbook;
  for (const segment of segments) {
    dir = join(dir, segment);
    if (absentDirs.length > 0) {
      absentDirs.push(dir);
      continue;
    }
    const stats = lstatOrNull(dir);
    if (stats === null) {
      absentDirs.push(dir);
      continue;
    }
    if (stats.isSymbolicLink()) refuse(`refusing apply: target ${label} passes through the symlink ${dir}; apply follows no link out of the physical runbook.`);
    if (!stats.isDirectory()) refuse(`refusing apply: target ${label} needs ${dir} to be a directory.`);
    chain.push({ path: dir, dev: stats.dev, ino: stats.ino });
  }
  const enclosing = [...chain];
  for (let ancestor = store.runbook; dirname(ancestor) !== ancestor;) {
    ancestor = dirname(ancestor);
    const stats = statOrNull(ancestor);
    if (stats !== null) enclosing.push({ path: ancestor, dev: stats.dev, ino: stats.ino });
  }
  for (const root of store.guarded) {
    const stats = statOrNull(root);
    if (stats !== null && enclosing.some((link) => link.dev === stats.dev && link.ino === stats.ino)) {
      refuse(`refusing apply: target ${label} lies inside ${root}, which holds agents-kit records or configuration; apply never writes there.`);
    }
  }
  const path = join(dir, name);
  const observed = absentDirs.length > 0 ? { hash: null, mode: null } : observeTarget(path, label);
  return { label, path, dir, chain, absentDirs, ...observed };
}

function assertChain(chain: readonly DirIdentity[]): void {
  for (const link of chain) {
    const stats = lstatOrNull(link.path);
    if (stats === null || stats.isSymbolicLink() || !stats.isDirectory() || stats.dev !== link.dev || stats.ino !== link.ino) {
      fail(`runbook directory ${link.path} changed during apply.`);
    }
  }
}

function createDirs(target: TargetState, created: DirIdentity[], chain: DirIdentity[]): void {
  assertChain(chain);
  for (const dir of target.absentDirs) {
    let made = true;
    try {
      mkdirSync(dir);
    } catch (err) {
      if (errorCode(err) !== "EEXIST") fail(`cannot create runbook directory ${dir}: ${describe(err)}`);
      made = false;
    }
    const stats = lstatOrNull(dir);
    if (stats === null || stats.isSymbolicLink() || !stats.isDirectory()) fail(`runbook directory ${dir} changed during apply; the target was not replaced.`);
    const link = { path: dir, dev: stats.dev, ino: stats.ino };
    chain.push(link);
    if (made) created.push(link);
  }
}

function removeCreatedDirs(created: readonly DirIdentity[], chain: readonly DirIdentity[]): void {
  for (const link of [...created].reverse()) {
    try {
      const index = chain.findIndex((entry) => entry.path === link.path);
      if (index < 0) return;
      assertChain(chain.slice(0, index + 1));
      rmdirSync(link.path);
    } catch {
      return;
    }
  }
}

function removeApplyTemp(path: string, chain: readonly DirIdentity[], expected: Stats): void {
  try {
    assertChain(chain);
    const current = lstatSync(path);
    if (!current.isFile() || current.dev !== expected.dev || current.ino !== expected.ino) return;
    assertChain(chain);
    unlinkSync(path);
  } catch {
    return;
  }
}

function assertApplyTemp(path: string, expected: Stats, body: Buffer): void {
  const matches = (stats: Stats | null) => stats !== null && stats.isFile() && stats.dev === expected.dev && stats.ino === expected.ino;
  if (!matches(lstatOrNull(path))) fail(`staged file ${path} changed during apply; the target was not replaced.`);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!matches(fstatSync(fd)) || !readFileSync(fd).equals(body) || !matches(lstatOrNull(path))) {
      fail(`staged file ${path} changed during apply; the target was not replaced.`);
    }
  } finally {
    closeSync(fd);
  }
}

function replaceTarget(target: TargetState, body: Buffer, context: ReplacementContext): boolean {
  const { hooks, chain, createdDirs } = context;
  createDirs(target, createdDirs, chain);
  const temp = join(target.dir, `.secretary-apply-${process.pid}-${randomUUID()}.tmp`);
  const mode = target.mode ?? (NEW_TARGET_BASE_MODE & ~process.umask());
  let created: Stats | null = null;
  try {
    const fd = openSync(temp, "wx", APPLY_TEMP_MODE);
    try {
      created = fstatSync(fd);
      writeFileSync(fd, body);
      fchmodSync(fd, mode);
    } finally {
      closeSync(fd);
    }
    hooks.beforeReplace?.();
    assertChain(chain);
    if (target.hash === null) {
      assertApplyTemp(temp, created, body);
      try {
        linkSync(temp, target.path);
      } catch (err) {
        if (errorCode(err) === "EEXIST") return false;
        throw err;
      }
      return true;
    }
    if (observeTarget(target.path, target.label).hash !== target.hash) return false;
    assertApplyTemp(temp, created, body);
    renameSync(temp, target.path);
    return true;
  } finally {
    if (created !== null) removeApplyTemp(temp, chain, created);
  }
}

function describeHash(hash: string | null): string {
  return hash === null ? "absent" : `sha256 ${hash}`;
}

function applyAuthority(checkpoint: Checkpoint, request: ApplyRequest, verb: "apply" | "hold"): PendingPointer {
  const refusal = attemptRefusal(checkpoint, request.attempt, "apply");
  if (refusal !== null) refuse(`refusing ${verb}: ${refusal}.`);
  const entry = checkpoint.pending.find((candidate) => candidate.proposal === request.proposal);
  if (entry === undefined) refuse(`refusing ${verb}: ${request.proposal} is not pending.`);
  if (request.revision > entry.revision || (verb === "apply" && request.revision !== entry.revision)) {
    refuse(`refusing ${verb}: ${request.proposal} is at revision ${entry.revision}, not ${request.revision}.`);
  }
  return entry;
}

function proposalOf(store: Store, entry: PendingPointer): ProposalRecord {
  const event = readEvent(store, entry.seq);
  const matches = event.type === "proposal"
    && event.payload.proposal === entry.proposal
    && event.payload.revision === entry.revision
    && event.payload.target === entry.target
    && event.payload.bodyHash === entry.bodyHash;
  if (!matches) fail(`event ${entry.seq} does not hold ${entry.proposal}@${entry.revision}; the checkpoint disagrees with history.`);
  return event.payload;
}

function storedBody(store: Store, hash: string): Buffer {
  const path = join(bodiesDir(store), hash);
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch (err) {
    fail(`cannot read stored body ${path}: ${describe(err)}`);
  }
  if (sha256(bytes) !== hash) fail(`stored body ${path} does not match its hash; the target was not replaced.`);
  return bytes;
}

function envelope<T extends EventType, P>(ledger: Ledger, type: T, payload: P, now: Date): Envelope<T, P> {
  return { seq: ledger.tail.seq + 1, id: randomUUID(), at: now.toISOString(), type, payload };
}

function classifyFailedWrite(store: Store, proposal: ProposalRecord, chain: readonly DirIdentity[]): { outcome: ApplyOutcome; found: string | null } {
  let found: string | null | undefined;
  try {
    assertChain(chain);
    const target = resolveTarget(store, proposal.target);
    assertChain(chain);
    assertChain(target.chain);
    found = target.hash;
  } catch {
    found = undefined;
  }
  if (found === proposal.bodyHash) return { outcome: "applied", found };
  return { outcome: found === proposal.before ? "held" : "conflict", found: found ?? null };
}

interface ApplyScope {
  readonly store: Store;
  readonly request: ApplyRequest;
  readonly entry: PendingPointer;
  readonly proposal: ProposalRecord;
  readonly now: Date;
}

function recordApplyResult(scope: ApplyScope, ledger: Ledger, outcome: ApplyOutcome, observed: string | null, recovered: boolean): SecretaryEvent {
  const { store, request, entry, proposal, now } = scope;
  const payload: ApplyResult = { attempt: request.attempt, proposal: entry.proposal, revision: entry.revision, target: proposal.target, outcome, observed, recovered };
  guardCredentials("record apply-result", payload);
  const event = envelope(ledger, "apply-result", payload, now);
  commit(store, ledger, event, null);
  return event;
}

function refuseConflict(scope: ApplyScope, ledger: Ledger, observed: string | null, replaced: boolean): never {
  const { proposal } = scope;
  const event = recordApplyResult(scope, ledger, "conflict", observed, false);
  const recorded = `apply conflict recorded at seq ${event.seq}: ${proposal.target}`;
  refuse(replaced
    ? `${recorded} was replaced with the accepted body (${describeHash(proposal.bodyHash)}) and then read as ${describeHash(observed)}; only a new revision can proceed.`
    : `${recorded} is ${describeHash(observed)}, not the accepted revision's before (${describeHash(proposal.before)}); nothing was written, and only a new revision can proceed.`);
}

function settleIntent(scope: ApplyScope, ledger: Ledger): SecretaryEvent {
  const { store, entry, proposal } = scope;
  const id = `${entry.proposal}@${entry.revision}`;
  let target: TargetState;
  try {
    target = resolveTarget(store, proposal.target);
  } catch (err) {
    if (!(err instanceof Exit) || err.code !== 1) throw err;
    const event = recordApplyResult(scope, ledger, "conflict", null, false);
    refuse(`apply conflict recorded at seq ${event.seq} while settling the interrupted write: ${err.message.replace(/^refusing apply: /, "")} Only a new revision can proceed.`);
  }
  const settled = classifyFailedWrite(store, proposal, target.chain);
  if (settled.outcome === "applied") return recordApplyResult(scope, ledger, "applied", settled.found, true);
  if (settled.outcome === "held") {
    const event = recordApplyResult(scope, ledger, "held", settled.found, true);
    refuse(`interrupted apply of ${id} recorded held at seq ${event.seq}; nothing was written, and ${id} stays accepted for a fresh apply after rechecking its target and evidence.`);
  }
  refuseConflict(scope, ledger, settled.found, false);
}

export function applyProposal(store: Store, request: ApplyRequest, now: Date, hooks: ApplyHooks = {}): SecretaryEvent {
  if (!protectStore(store)) refuse(`refusing apply: no attempt is active, so attempt ${request.attempt} records nothing.`);
  return withLock(store, () => {
    const ledger = openLedger(store);
    const entry = applyAuthority(ledger.checkpoint, request, "apply");
    const id = `${entry.proposal}@${entry.revision}`;
    if (entry.decision !== "accepted") refuse(`refusing apply: ${id} is not accepted; only a recorded acceptance of that revision authorizes a write.`);
    if (entry.apply?.state === "conflict") refuse(`refusing apply: ${id} conflicted when applied at seq ${entry.apply.seq}; only a new revision can proceed.`);
    const proposal = proposalOf(store, entry);
    const body = storedBody(store, proposal.bodyHash);
    guardCredentials(`apply ${id}`, { body: body.toString("utf8") });
    const scope: ApplyScope = { store, request, entry, proposal, now };
    if (entry.apply?.state === "intent") return settleIntent(scope, ledger);
    const target = resolveTarget(store, proposal.target);
    if (target.hash !== proposal.before) refuseConflict(scope, ledger, target.hash, false);
    const intent: ApplyIntent = { attempt: request.attempt, proposal: entry.proposal, revision: entry.revision, target: proposal.target, before: proposal.before, after: proposal.bodyHash };
    guardCredentials("record apply-intent", intent);
    const intentEvent = envelope(ledger, "apply-intent", intent, now);
    const afterIntent = commit(store, ledger, intentEvent, null);
    const replacement: ReplacementContext = { hooks, chain: [...target.chain], createdDirs: [] };
    let replaced: boolean;
    let observed: string | null;
    try {
      replaced = replaceTarget(target, body, replacement);
      if (replaced) hooks.afterReplace?.();
      assertChain(replacement.chain);
      observed = observeTarget(target.path, proposal.target).hash;
      assertChain(replacement.chain);
    } catch (err) {
      if (!(err instanceof Exit) && errorCode(err) === undefined) throw err;
      const { outcome, found } = classifyFailedWrite(store, proposal, replacement.chain);
      if (outcome === "applied") return recordApplyResult(scope, afterIntent, "applied", found, false);
      removeCreatedDirs(replacement.createdDirs, replacement.chain);
      const event = recordApplyResult(scope, afterIntent, outcome, found, false);
      const next = outcome === "held" ? `${id} stays accepted for a later apply` : "only a new revision can proceed";
      refuse(`apply of ${id} failed after its intent at seq ${intentEvent.seq}: ${(err as Error).message}; recorded ${outcome} at seq ${event.seq}, and ${next}.`);
    }
    if (!replaced || observed !== proposal.bodyHash) {
      removeCreatedDirs(replacement.createdDirs, replacement.chain);
      refuseConflict(scope, afterIntent, observed, replaced);
    }
    return recordApplyResult(scope, afterIntent, "applied", observed, false);
  });
}

export function holdProposal(store: Store, request: ApplyRequest, now: Date): SecretaryEvent {
  if (!protectStore(store)) refuse(`refusing hold: no attempt is active, so attempt ${request.attempt} records nothing.`);
  return withLock(store, () => {
    const ledger = openLedger(store);
    const entry = applyAuthority(ledger.checkpoint, request, "hold");
    const unsettled = intentRefusal(entry);
    if (unsettled !== null) refuse(`refusing hold: ${unsettled}.`);
    if (request.revision === entry.revision && entry.decision !== "accepted") {
      refuse(`refusing hold: ${entry.proposal}@${entry.revision} is not accepted, so no write is held.`);
    }
    if (request.revision === entry.revision && entry.apply?.state === "conflict") {
      refuse(`refusing hold: ${entry.proposal}@${entry.revision} already conflicted at seq ${entry.apply.seq}, so no write is held.`);
    }
    const payload: ApplyResult = { attempt: request.attempt, proposal: entry.proposal, revision: request.revision, target: entry.target, outcome: "held", observed: null, recovered: false };
    guardCredentials("record apply-result", payload);
    const event = envelope(ledger, "apply-result", payload, now);
    commit(store, ledger, event, null);
    return event;
  });
}

function storeBody(store: Store, hash: string, body: string): void {
  const dir = bodiesDir(store);
  mkdirSync(dir, { recursive: true, mode: RECORD_DIR_MODE });
  const bytes = Buffer.from(body);
  if (publishFile(dir, hash, bytes) === "created") return;
  let existing: Buffer;
  try {
    existing = readFileSync(join(dir, hash));
  } catch (err) {
    fail(`cannot read stored body ${join(dir, hash)}: ${describe(err)}`);
  }
  if (!existing.equals(bytes)) fail(`stored body ${join(dir, hash)} does not match its hash; refusing to replace it.`);
}

export interface Blocker extends AttemptPointer {
  readonly leaseUntil: string;
}

export interface Wake {
  readonly at: string;
  readonly cron: string;
}

export interface ReviewState {
  readonly due: boolean;
  readonly dueAt: string | null;
  readonly blockedBy: Blocker | null;
  readonly wake: Wake | null;
}

export function wakeCron(at: Date, now: Date): string {
  const earliest = Math.max(at.getTime(), now.getTime() + WAKE_LEAD_MS);
  let slot = new Date(Math.ceil(earliest / MINUTE_MS) * MINUTE_MS);
  if (slot.getMinutes() % EARLY_FIRE_MINUTES === 0) slot = new Date(slot.getTime() + EARLY_FIRE_SHIFT_MINUTES * MINUTE_MS);
  return `${slot.getMinutes()} ${slot.getHours()} ${slot.getDate()} ${slot.getMonth() + 1} *`;
}

function reviewState(checkpoint: Checkpoint, now: Date): ReviewState {
  const dueMs = checkpoint.lastReview === null ? null : Date.parse(checkpoint.lastReview.at) + REVIEW_INTERVAL_MS;
  const due = dueMs === null || now.getTime() >= dueMs;
  const active = checkpoint.activeAttempt;
  const blockedBy = active !== null && now.getTime() < leaseEnd(active) ? { ...active, leaseUntil: new Date(leaseEnd(active)).toISOString() } : null;
  const wakeCandidates: number[] = [];
  if (blockedBy !== null) wakeCandidates.push(Date.parse(blockedBy.leaseUntil));
  if (!due && dueMs !== null) wakeCandidates.push(dueMs);
  const wakeAt = wakeCandidates.length === 0 ? null : new Date(Math.max(...wakeCandidates));
  return {
    due,
    dueAt: dueMs === null ? null : new Date(dueMs).toISOString(),
    blockedBy,
    wake: wakeAt === null ? null : { at: wakeAt.toISOString(), cron: wakeCron(wakeAt, now) },
  };
}

export interface StatusReport {
  readonly id: string;
  readonly runbook: string;
  readonly ready: boolean;
  readonly reason: NotReady | null;
  readonly lastSeq: number;
  readonly processedSeq: number | null;
  readonly lastReview: ReviewPointer | null;
  readonly activeAttempt: AttemptPointer | null;
  readonly review: ReviewState | null;
  readonly pendingTotal: number | null;
  readonly pending: readonly PendingPointer[];
  readonly next: string | null;
}

export function status(store: Store, cursor: string | null, now: Date): StatusReport {
  const after = cursor === null ? 0 : proposalNumber(cursor);
  const state = protectStore(store) ? withLock(store, () => readiness(store)) : null;
  const tail = state?.tail.seq ?? 0;
  if (state !== null && state.reason !== null) {
    return {
      id: store.id,
      runbook: store.runbook,
      ready: false,
      reason: state.reason,
      lastSeq: tail,
      processedSeq: state.checkpoint?.processed.seq ?? null,
      lastReview: null,
      activeAttempt: null,
      review: null,
      pendingTotal: null,
      pending: [],
      next: null,
    };
  }
  const checkpoint = state?.checkpoint ?? freshCheckpoint(store);
  const header = {
    id: store.id,
    runbook: store.runbook,
    ready: true,
    reason: null,
    lastSeq: tail,
    processedSeq: checkpoint.processed.seq,
    lastReview: checkpoint.lastReview,
    activeAttempt: checkpoint.activeAttempt,
    review: reviewState(checkpoint, now),
    pendingTotal: checkpoint.pending.length,
  };
  const remaining = checkpoint.pending.filter((entry) => proposalNumber(entry.proposal) > after);
  let used = byteSize({ ...header, pending: [], next: `p${"9".repeat(SEQ_DIGITS)}` });
  const page: PendingPointer[] = [];
  for (const entry of remaining) {
    const cost = byteSize(entry) + 1;
    if (used + cost > JSON_BUDGET) break;
    used += cost;
    page.push(entry);
  }
  if (page.length === 0 && remaining.length > 0) fail("a pending pointer exceeds the status page ceiling.");
  const next = page.length < remaining.length ? page[page.length - 1].proposal : null;
  return { ...header, pending: page, next };
}

export interface RejectedPage {
  readonly rejected: readonly RejectedPointer[];
  readonly next: string | null;
}

export function rejections(store: Store, cursor: string | null): RejectedPage {
  const state = protectStore(store) ? withLock(store, () => readiness(store)) : null;
  if (state !== null && state.reason !== null) refuse(`records are not ready (${state.reason}); run recover first.`);
  const remaining = (state?.checkpoint ?? freshCheckpoint(store)).rejected.filter((entry) => cursor === null || entry.target > cursor);
  let used = byteSize({ rejected: [], next: null });
  const page: RejectedPointer[] = [];
  for (const entry of remaining) {
    const cost = byteSize(entry) + 1;
    if (used + cost + byteSize(entry.target) > JSON_BUDGET) break;
    used += cost;
    page.push(entry);
  }
  if (page.length === 0 && remaining.length > 0) fail("a rejected pointer exceeds the page ceiling.");
  return { rejected: page, next: page.length < remaining.length ? page[page.length - 1].target : null };
}

export interface RecoveryReport {
  readonly ready: boolean;
  readonly reason: NotReady | null;
  readonly processedSeq: number;
  readonly lastSeq: number;
  readonly complete: boolean;
}

function recoveryBase(store: Store, state: Readiness): Checkpoint {
  const candidates: Checkpoint[] = [];
  if (state.checkpoint !== null && state.checkpoint.processed.seq <= state.tail.seq) candidates.push(state.checkpoint);
  const progress = readDerived(store, progressPath(store));
  if (progress.kind === "ok" && progress.checkpoint.processed.seq <= state.tail.seq) candidates.push(progress.checkpoint);
  return candidates.reduce((best, candidate) => (candidate.processed.seq > best.processed.seq ? candidate : best), freshCheckpoint(store));
}

export function recover(store: Store, batch: number = RECOVER_BATCH): RecoveryReport {
  if (!protectStore(store)) return { ready: true, reason: null, processedSeq: 0, lastSeq: 0, complete: true };
  return withLock(store, () => {
    const state = readiness(store);
    if (state.reason === null) {
      removeQuietly(progressPath(store));
      return { ready: true, reason: null, processedSeq: state.tail.seq, lastSeq: state.tail.seq, complete: true };
    }
    let checkpoint = recoveryBase(store, state);
    const located = locatedAfter(store, checkpoint.processed.seq);
    for (let count = 0; count < batch; count++) {
      const step = located.next();
      if (step.done) break;
      checkpoint = reduce(checkpoint, readCommitted(store, step.value));
    }
    const complete = checkpoint.processed.seq === state.tail.seq;
    if (complete) {
      writeCheckpoint(store, checkpoint);
      removeQuietly(progressPath(store));
    } else {
      writeDerived(store, progressPath(store), checkpoint);
    }
    return { ready: complete, reason: complete ? null : state.reason, processedSeq: checkpoint.processed.seq, lastSeq: state.tail.seq, complete };
  });
}

export interface HistoryQuery {
  readonly after: number;
  readonly type: EventType | null;
  readonly proposal: string | null;
}

export interface HistoryPage {
  readonly events: readonly SecretaryEvent[];
  readonly next: number | null;
}

function matches(event: SecretaryEvent, query: HistoryQuery): boolean {
  if (query.type !== null && event.type !== query.type) return false;
  if (query.proposal === null) return true;
  switch (event.type) {
    case "proposal":
    case "decision":
    case "apply-intent":
    case "apply-result":
      return event.payload.proposal === query.proposal;
    default:
      return false;
  }
}

export function history(store: Store, query: HistoryQuery): HistoryPage {
  protectStore(store);
  const start = query.proposal === null ? query.after : Math.max(query.after, proposalNumber(query.proposal) - 1);
  const events: SecretaryEvent[] = [];
  let used = byteSize({ events: [], next: 10 ** SEQ_DIGITS - 1 });
  let scanned = 0;
  let last = start;
  const located = locatedAfter(store, start);
  for (let step = located.next(); !step.done; step = located.next()) {
    if (scanned === HISTORY_SCAN_MAX) return { events, next: last };
    const event = readCommitted(store, step.value);
    if (matches(event, query)) {
      const cost = byteSize(event) + 1;
      if (used + cost > JSON_BUDGET) return { events, next: last };
      used += cost;
      events.push(event);
    }
    scanned++;
    last = event.seq;
  }
  return { events, next: null };
}

export function readEvent(store: Store, seq: number): SecretaryEvent {
  protectStore(store);
  const step = locatedAfter(store, seq - 1).next();
  if (step.done || step.value.seq !== seq) refuse(`no event ${seq} is recorded.`);
  return readCommitted(store, step.value);
}

export interface BodyChunk {
  readonly hash: string;
  readonly bytes: number;
  readonly offset: number;
  readonly length: number;
  readonly text: string;
  readonly next: number | null;
}

export function readBody(store: Store, hash: string, offset: number, limit: number): BodyChunk {
  protectStore(store);
  const path = join(bodiesDir(store), hash);
  let fd: number;
  try {
    fd = openSync(path, "r");
  } catch (err) {
    if (missing(err)) refuse(`no body ${hash} is stored.`);
    fail(`cannot read ${path}: ${describe(err)}`);
  }
  try {
    const size = fstatSync(fd).size;
    if (offset > size) fail(`offset ${offset} is beyond the ${size}-byte body.`);
    const span = Math.min(limit + UTF8_CHAR_MAX_BYTES - 1, size - offset);
    const buffer = Buffer.alloc(span);
    let read = 0;
    while (read < span) {
      const got = readSync(fd, buffer, read, span - read, offset + read);
      if (got === 0) break;
      read += got;
    }
    if (read > 0 && (buffer[0] & 0xc0) === 0x80) fail(`offset ${offset} falls inside a UTF-8 character.`);
    let cut = Math.min(limit, read);
    for (;;) {
      while (cut > 0 && cut < read && (buffer[cut] & 0xc0) === 0x80) cut--;
      const chunk = {
        hash,
        bytes: size,
        offset,
        length: cut,
        text: buffer.subarray(0, cut).toString("utf8"),
        next: offset + cut < size ? offset + cut : null,
      };
      if (byteSize(chunk) <= JSON_BUDGET) return chunk;
      cut = Math.floor(cut / 2);
    }
  } finally {
    closeSync(fd);
  }
}

function parseOptions(args: readonly string[], allowed: readonly string[], required: readonly string[]): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const equals = arg.indexOf("=");
    const flag = arg.startsWith("--") && equals > 0 ? arg.slice(0, equals) : arg;
    if (flag !== "--expect-runbook" && !allowed.includes(flag)) fail(arg.startsWith("-") ? `unknown option ${arg}.\n${USAGE}` : `unexpected argument ${arg}.\n${USAGE}`);
    if (values.has(flag)) fail(`${flag} given twice.\n${USAGE}`);
    const value = flag === arg ? args[++index] : arg.slice(equals + 1);
    if (value === undefined) fail(`${flag} needs a value.\n${USAGE}`);
    values.set(flag, value);
  }
  for (const flag of required) if (!values.has(flag)) fail(`${flag} is required.\n${USAGE}`);
  return values;
}

function integerOption(value: string | undefined, flag: string, minimum: number, fallback: number): number {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!DIGITS.test(value) || !Number.isSafeInteger(number) || number < minimum) fail(`${flag} takes an integer of at least ${minimum}, not ${value}.`);
  return number;
}

function appendTypeOption(value: string | undefined): AppendType {
  if (APPLY_TYPES.some((candidate) => candidate === value)) fail(`${value} is written only by apply and hold; append takes ${APPEND_TYPES.join(", ")}.`);
  const type = APPEND_TYPES.find((candidate) => candidate === value);
  if (type === undefined) fail(`--type takes one of ${APPEND_TYPES.join(", ")}, not ${value}.`);
  return type;
}

function eventTypeOption(value: string | undefined): EventType | null {
  if (value === undefined) return null;
  const type = EVENT_TYPES.find((candidate) => candidate === value);
  if (type === undefined) fail(`--type takes one of ${EVENT_TYPES.join(", ")}, not ${value}.`);
  return type;
}

function applyRequest(options: ReadonlyMap<string, string>): ApplyRequest {
  const attempt = options.get("--attempt") ?? "";
  if (attempt.length > ID_MAX_CHARS || !TOKEN.test(attempt)) fail(`--attempt takes an attempt token of letters, digits, '.', '_', ':', or '-' that starts with a letter or digit, not ${attempt}.`);
  return {
    attempt,
    proposal: proposalOption(options.get("--proposal"), "--proposal") ?? "",
    revision: integerOption(options.get("--revision"), "--revision", 1, 1),
  };
}

function proposalOption(value: string | undefined, flag: string): string | null {
  if (value === undefined) return null;
  if (!PROPOSAL_ID.test(value)) fail(`${flag} takes a proposal id such as p12, not ${value}.`);
  return value;
}

function readPayload(source: string): unknown {
  let raw: string;
  try {
    raw = readFileSync(source === "-" ? 0 : source, "utf8");
  } catch (err) {
    fail(`cannot read payload ${source === "-" ? "from stdin" : source}: ${describe(err)}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    refuse("the payload is not valid JSON.");
  }
}

function report(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function main(argv: readonly string[]): void {
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EPIPE" && err.code !== "ENOTCONN") throw err;
  });
  const [command, ...rest] = argv;
  switch (command) {
    case "append": {
      const options = parseOptions(rest, ["--type", "--json"], ["--type", "--json"]);
      const type = appendTypeOption(options.get("--type"));
      const payload = readPayload(options.get("--json") ?? "-");
      report({ event: append(openStore(homedir(), options.get("--expect-runbook")), type, payload, new Date()) });
      return;
    }
    case "apply": {
      const options = parseOptions(rest, ["--attempt", "--proposal", "--revision"], ["--attempt", "--proposal", "--revision"]);
      const request = applyRequest(options);
      report({ event: applyProposal(openStore(homedir(), options.get("--expect-runbook")), request, new Date()) });
      return;
    }
    case "hold": {
      const options = parseOptions(rest, ["--attempt", "--proposal", "--revision"], ["--attempt", "--proposal", "--revision"]);
      const request = applyRequest(options);
      report({ event: holdProposal(openStore(homedir(), options.get("--expect-runbook")), request, new Date()) });
      return;
    }
    case "recover": {
      const options = parseOptions(rest, [], []);
      report(recover(openStore(homedir(), options.get("--expect-runbook"))));
      return;
    }
    case "status": {
      const options = parseOptions(rest, ["--cursor"], []);
      const cursor = proposalOption(options.get("--cursor"), "--cursor");
      report(status(openStore(homedir(), options.get("--expect-runbook")), cursor, new Date()));
      return;
    }
    case "rejected": {
      const options = parseOptions(rest, ["--cursor"], []);
      const cursor = options.get("--cursor") ?? null;
      if (cursor !== null && (cursor.length === 0 || cursor.length > TARGET_MAX_CHARS)) fail("--cursor takes a target from an earlier page.");
      report(rejections(openStore(homedir(), options.get("--expect-runbook")), cursor));
      return;
    }
    case "history": {
      const options = parseOptions(rest, ["--after", "--type", "--proposal"], []);
      const query: HistoryQuery = {
        after: integerOption(options.get("--after"), "--after", 0, 0),
        type: eventTypeOption(options.get("--type")),
        proposal: proposalOption(options.get("--proposal"), "--proposal"),
      };
      report(history(openStore(homedir(), options.get("--expect-runbook")), query));
      return;
    }
    case "event": {
      const options = parseOptions(rest, ["--seq"], ["--seq"]);
      report({ event: readEvent(openStore(homedir(), options.get("--expect-runbook")), integerOption(options.get("--seq"), "--seq", 1, 1)) });
      return;
    }
    case "body": {
      const options = parseOptions(rest, ["--hash", "--offset", "--limit"], ["--hash"]);
      const hash = options.get("--hash") ?? "";
      if (!SHA256_HEX.test(hash)) fail(`--hash takes a lowercase sha256 hex digest.`);
      const offset = integerOption(options.get("--offset"), "--offset", 0, 0);
      const limit = integerOption(options.get("--limit"), "--limit", UTF8_CHAR_MAX_BYTES, BODY_CHUNK_MAX_BYTES);
      if (limit > BODY_CHUNK_MAX_BYTES) fail(`--limit takes at most ${BODY_CHUNK_MAX_BYTES} bytes.`);
      report(readBody(openStore(homedir(), options.get("--expect-runbook")), hash, offset, limit));
      return;
    }
    default:
      fail(USAGE);
  }
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
    main(process.argv.slice(2));
  } catch (err) {
    const exit = err instanceof Exit ? err : new Exit(2, `secretary-state failed: ${(err as Error).message}`);
    console.error(`[secretary-state] ${exit.message}`);
    process.exitCode = exit.code;
  }
}
