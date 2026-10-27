#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code !== "EPIPE" && err.code !== "ENOTCONN") throw err;
});

type SignalClass =
  | "api-error"
  | "permission-denial"
  | "policy-block"
  | "input-validation"
  | "retry-loop"
  | "user-abort";

const DEFAULT_TOP = 10;
const SAMPLE_LIMIT = 3;
const USER_PAIR_WINDOW_MS = 1000;
const MIN_EVENTS = {
  "api-error": 1,
  "permission-denial": 1,
  "policy-block": 1,
  "input-validation": 1,
  "retry-loop": 1,
  "user-abort": 2,
} satisfies Record<SignalClass, number>;

const CLAUDE_TYPES = new Set<string | undefined>([
  "assistant", "user", "system", "mode", "last-prompt", "attachment", "permission-mode",
  "file-history-snapshot", "file-history-delta", "ai-title", "queue-operation",
  "agent-name", "custom-title", "pr-link", "frame-link",
]);
const CODEX_TYPES = new Set<string | undefined>([
  "response_item", "event_msg", "turn_context", "session_meta", "world_state",
  "inter_agent_communication_metadata", "compacted",
]);
const TELEMETRY_TYPES = new Set([
  "token_usage_record", "cost-state", "atis-latch", "api-request-shape",
  "api-request-blob", "api-request", "progress",
]);

const CLAUDE_ABORT = /^\[Request interrupted by user/;
const CLAUDE_PERMISSION = /^Permission to use .+ has been denied\.?\s*$/s;
const CLAUDE_USER_REFUSAL = "The user doesn't want to";
const CLAUDE_SANDBOX_BLOCK = "<tool_use_error>Blocked:";
const CLAUDE_ISOLATION_BLOCK = "Refusing to run it";
const INPUT_VALIDATION = /^(?:<tool_use_error>)?InputValidationError\b/;
const CODEX_REJECTED = /^(?:This action was rejected due to unacceptable risk\.\s*\nReason: .+|exec_command failed: Rejected\(")/s;
const CODEX_FAILURE = /(?:^|\n)(?:Process exited with code [1-9]\d*\b|Exit code: [1-9]\d*\b|Script failed\b|exec_command failed for\b)/;
const CODEX_VOLATILE = /^(?:Chunk ID|Wall time|Original token count|Total token count):/;
const CODEX_OUTPUT_HEADER = /^(?:(?:(?:Chunk ID|Wall time|Original token count|Total token count):[^\n]*|(?:Process exited with code|Exit code:) -?\d+[ \t]*)(?:\n|$))+(?:Output:(?:\n|$))?/;
const CODEX_EXIT_CODE = /^(?:Process exited with code|Exit code:) (-?\d+)[ \t]*$/gm;
const USER_INTERVENTION = /^(?:any open questions\??|no ticket\b|(?:please\s+)?continue\b|(?:please\s+)?(?:try again|keep going)\b|no,\s|correction:\s|(?:i (?:already|said|asked)|you (?:already|didn't|did not)|that's not|that is not)\b)/i;
const INJECTED_USER = /^(?:# AGENTS\.md\b|<environment_context>|<INSTRUCTIONS>|<skills_instructions>|<system-reminder>|<local-command-(?:stdout|stderr)>|\[Request interrupted by user|You are (?:an? |Codex\b)|Base directory for this skill:)/i;
type Host = "claude" | "codex";
type SignalCounts = Partial<Record<SignalClass, number>>;
type CandidateClass = "user-intervention" | "repeated-request";
type JsonObject = Record<string, unknown>;

interface ParsedRecord {
  readonly record: JsonObject;
  readonly line: number;
  readonly timestamp: string | null;
  readonly timeMs: number | null;
}

interface UserSummary {
  readonly representation: string;
  readonly messageId: string;
  readonly turnId: string;
  readonly exact: string;
  readonly normalized: string;
  readonly repeatable: boolean;
  readonly eligible: boolean;
  readonly intervention: boolean;
}

type RecordAction =
  | { readonly kind: "tool"; readonly callId: string; readonly name: string }
  | { readonly kind: "signal"; readonly callId: string; readonly signal: SignalClass; readonly operation: string }
  | { readonly kind: "retry"; readonly callId: string; readonly signature: string; readonly failed: boolean };

interface RecordSummary {
  readonly line: number;
  readonly timestamp: string | null;
  readonly timeMs: number | null;
  readonly messageId: string;
  readonly callId: string;
  readonly user: UserSummary | null;
  readonly actions: readonly RecordAction[];
}

interface SessionFile {
  readonly path: string;
  readonly mtimeMs: number;
}

interface FlaggedSession {
  readonly path: string;
  readonly host: Host;
  readonly mtime: string;
  readonly classes: SignalCounts;
  readonly score: number;
  readonly paths: readonly string[];
  readonly candidates: Partial<Record<CandidateClass, number>>;
  readonly evidence: readonly Evidence[];
}

interface Evidence {
  readonly kind: SignalClass | CandidateClass;
  readonly path: string;
  readonly line: number;
  readonly timestamp: string | null;
  readonly timeBasis: "record" | "file-mtime";
  readonly callId?: string;
  readonly messageId?: string;
}

interface Transcript extends SessionFile {
  readonly host: Host;
  readonly project: string | null;
  readonly records: readonly RecordSummary[];
  readonly key: string;
  readonly parent: string | null;
  readonly isChild: boolean;
  readonly startedMs: number | null;
}

interface Diagnostic {
  readonly kind: "unknown" | "malformed" | "undated" | "invalid-timestamp" | "identity-uncertain";
  readonly path: string;
  readonly line: number;
}

interface Report {
  readonly flagged: readonly FlaggedSession[];
  readonly remainder: number;
  readonly remainderPaths: readonly string[];
  readonly scanned: number;
  readonly sessions: readonly { readonly project: string | null; readonly count: number }[];
  readonly conversations: number;
  readonly sampled: readonly FlaggedSession[];
  readonly sampleOmitted: number;
  readonly telemetryRecords: number;
  readonly diagnostics: readonly Diagnostic[];
  readonly skippedUnknownRecords: number;
  readonly skippedUnrecognized: number;
  readonly skippedUnrecognizedPaths: readonly string[];
  readonly unreadable: number;
  readonly unreadableDirs: readonly string[];
  readonly unreadablePaths: readonly string[];
}

const warnings: string[] = [];
const unreadablePaths: string[] = [];
const unreadableDirs: string[] = [];
const skippedUnrecognizedPaths: string[] = [];
const diagnostics: Diagnostic[] = [];
let telemetryRecords = 0;

function object(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function textBlocks(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.map((value) => object(value)).filter((block) => ["input_text", "output_text", "text"].includes(string(block.type)))
    .map((block) => string(block.text));
}

function textOf(value: unknown): string {
  return textBlocks(value).join("\n");
}

function outputOf(value: unknown): { text: string; succeeded: boolean; failed: boolean } {
  let envelope = object(value);
  let exitCode = envelope.exit_code ?? envelope.exitCode;
  let text: string;
  if (typeof exitCode === "number") text = textOf(envelope.output);
  else {
    const blocks = textBlocks(value).filter(Boolean);
    const header = CODEX_OUTPUT_HEADER.exec(blocks[0] ?? "")?.[0] ?? "";
    const codes = [...header.matchAll(CODEX_EXIT_CODE)].map((match) => Number(match[1]));
    exitCode = codes.find((code) => code !== 0) ?? codes[0];
    text = [blocks[0]?.slice(header.length), ...blocks.slice(1)].filter(Boolean).join("\n");
    if (exitCode === undefined) {
      try { envelope = object(JSON.parse(text)); } catch {}
      exitCode = envelope.exit_code ?? envelope.exitCode;
      if (typeof exitCode === "number") text = textOf(envelope.output);
    }
  }
  const succeeded = exitCode === 0;
  const failed = typeof exitCode === "number" ? exitCode !== 0 : CODEX_FAILURE.test(text);
  return { text, succeeded, failed };
}

function signature(text: string): string {
  const body = text.split("\n").filter((line) => !CODEX_VOLATILE.test(line)).join("\n");
  return body.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, 160);
}

function fingerprint(text: string): string {
  return createHash("sha256").update(text, "utf16le").digest("hex");
}

function summarizeRecord(parsed: ParsedRecord, host: Host): RecordSummary {
  const { record, line, timestamp, timeMs } = parsed;
  const payload = host === "codex" ? object(record.payload) : record;
  const kind = payload.type;
  const messageId = string(record.uuid) || string(payload.message_id) || string(payload.id) || string(record.id);
  const callId = string(payload.call_id);
  let userText = "";
  if (host === "codex") {
    if (record.type === "event_msg" && kind === "user_message") userText = string(payload.message);
    else if (record.type === "response_item" && kind === "message" && payload.role === "user") userText = textOf(payload.content);
  } else if (record.type === "user" && record.isMeta !== true) userText = textOf(object(record.message).content);
  let user: UserSummary | null = null;
  if (userText) {
    const exact = fingerprint(userText);
    userText = userText.trim();
    const command = /^<(?:command-name|command-message|local-command-caveat)>/.test(userText) ? /<command-name>([^<]+)<\/command-name>/.exec(userText)?.[1] ?? "" : userText;
    const housekeeping = /^\/(?:clear|model)(?:[;\s]|$)/i.test(command);
    const normalized = userText.replace(/\s+/g, " ").toLowerCase();
    user = {
      representation: string(record.type), messageId: string(payload.message_id) || string(payload.id) || string(record.id),
      turnId: string(payload.turn_id) || string(record.turn_id), exact, normalized: fingerprint(normalized),
      repeatable: normalized.length >= 12, eligible: !!userText && !housekeeping && !INJECTED_USER.test(userText),
      intervention: USER_INTERVENTION.test(userText),
    };
  }
  const actions: RecordAction[] = [];
  const signal = (signal: SignalClass, toolId = callId, operation = "") => actions.push({ kind: "signal", callId: toolId, signal, operation });
  if (host === "claude") {
    if (record.isApiErrorMessage === true) signal("api-error");
    if (record.type === "system" && (record.preventedContinuation === true || (Array.isArray(record.hookErrors) && record.hookErrors.length > 0))) signal("policy-block");
    const content = object(record.message).content;
    if (Array.isArray(content)) for (const value of content) {
      const block = object(value);
      const toolId = string(block.tool_use_id);
      if (block.type === "tool_use") actions.push({ kind: "tool", callId: string(block.id), name: string(block.name) });
      if (block.type === "text" && CLAUDE_ABORT.test(string(block.text))) signal("user-abort", toolId);
      if (block.type !== "tool_result") continue;
      const text = textOf(block.content);
      if (block.is_error === true) {
        if (CLAUDE_PERMISSION.test(text) || text.startsWith(CLAUDE_USER_REFUSAL)) signal("permission-denial", toolId);
        if (text.startsWith(CLAUDE_SANDBOX_BLOCK) || text.startsWith(CLAUDE_ISOLATION_BLOCK)) signal("policy-block", toolId);
        if (INPUT_VALIDATION.test(text)) signal("input-validation", toolId);
      }
      actions.push({ kind: "retry", callId: toolId, signature: fingerprint(signature(text)), failed: block.is_error === true });
    }
  } else if (record.type === "event_msg" || record.type === "response_item") {
    if (kind === "error" || kind === "stream_error") signal("api-error");
    if (kind === "turn_aborted" && payload.reason !== "replaced") signal("user-abort", callId, string(payload.turn_id) || messageId);
    if (kind === "patch_apply_end" && payload.success === false && CODEX_REJECTED.test(textOf(payload.stderr))) signal("policy-block");
    if (kind === "function_call" || kind === "custom_tool_call") actions.push({ kind: "tool", callId, name: string(payload.name) });
    if (kind === "function_call_output" || kind === "custom_tool_call_output") {
      const { text, succeeded, failed } = outputOf(payload.output);
      if (!succeeded) {
        if (CODEX_REJECTED.test(text)) signal("policy-block");
        if (INPUT_VALIDATION.test(text)) signal("input-validation");
      }
      actions.push({ kind: "retry", callId, signature: fingerprint(signature(text)), failed });
    }
  }
  return { line, timestamp, timeMs, messageId, callId, user, actions };
}

function isoDate(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const SINCE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseSince(value: string | null): number | null {
  const parts = SINCE_SHAPE.exec(value ?? "");
  if (!parts) return null;
  const midnightLocal = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return isoDate(midnightLocal.getTime()) === value ? midnightLocal.getTime() : null;
}

function parseArgs(argv: readonly string[]): { dirs: string[]; sinceMs: number | null; topN: number } {
  const dirs: string[] = [];
  let since: string | null = null;
  let top = String(DEFAULT_TOP);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--since") {
      since = argv[i + 1] ?? "";
      if (SINCE_SHAPE.test(since)) i++;
    } else if (arg.startsWith("--since=")) since = arg.slice("--since=".length);
    else if (arg === "--top") {
      top = argv[i + 1] ?? "";
      if (/^\d+$/.test(top)) i++;
    } else if (arg.startsWith("--top=")) top = arg.slice("--top=".length);
    else if (arg.startsWith("-")) warnings.push(`ignoring unknown option: ${arg}`);
    else dirs.push(arg);
  }
  const sinceMs = parseSince(since);
  if (sinceMs == null) warnings.push(`--since must be YYYY-MM-DD (got ${JSON.stringify(since)})`);

  const topRaw = String(top).trim();
  const topN = /^\d+$/.test(topRaw) ? Number(topRaw) : NaN;
  if (!Number.isInteger(topN) || topN < 1) warnings.push(`--top must be a positive integer (got ${JSON.stringify(top)})`);
  if (dirs.length === 0) warnings.push("no session directory given");
  return { dirs, sinceMs, topN: Number.isInteger(topN) && topN >= 1 ? topN : DEFAULT_TOP };
}

function noteUnwalked(dir: string): void {
  try {
    statSync(dir);
  } catch (err) {
    warnings.push(`unreadable dir ${dir}: ${err.code ?? err.message}`);
    if (err.code !== "ENOENT") unreadableDirs.push(dir);
    return;
  }
  unreadableDirs.push(dir);
}

function collectFiles(dir: string, sinceMs: number, out: SessionFile[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    warnings.push(`unreadable dir ${dir}: ${err.code ?? err.message}`);
    if (err.code !== "ENOENT") unreadableDirs.push(dir);
    return;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(child, sinceMs, out);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    try {
      const mtimeMs = statSync(child).mtimeMs;
      if (mtimeMs >= sinceMs) out.push({ path: child, mtimeMs });
    } catch (err) {
      warnings.push(`unreadable file ${child}: ${err.code ?? err.message}`);
      unreadablePaths.push(child);
    }
  }
}

function sniffHost(records: readonly ParsedRecord[]): Host | null {
  for (const { record } of records) {
    if (record.payload && CODEX_TYPES.has(string(record.type))) return "codex";
    if (CLAUDE_TYPES.has(string(record.type)) && record.payload === undefined) return "claude";
  }
  return null;
}

function firstProject(records: readonly ParsedRecord[], host: Host): string | null {
  for (const { record } of records) {
    if (host === "claude") {
      if (typeof record.cwd === "string") return record.cwd;
      continue;
    }
    if (record.type === "session_meta") return string(object(record.payload).cwd) || null;
  }
  return null;
}

function compareProjects(a: string | null, b: string | null): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return a.localeCompare(b, "en");
}

function readTranscript(file: SessionFile): Transcript | null {
  let text;
  try {
    text = readFileSync(file.path, "utf8");
  } catch (err) {
    warnings.push(`unreadable file ${file.path}: ${err.code ?? err.message}`);
    unreadablePaths.push(file.path);
    return null;
  }
  const records: ParsedRecord[] = [];
  for (const [index, line] of text.split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
      const timestamp = string(value.timestamp) || null;
      const parsedMs = timestamp === null ? NaN : Date.parse(timestamp);
      records.push({ record: value, line: index + 1, timestamp, timeMs: Number.isFinite(parsedMs) ? parsedMs : null });
    } catch {
      diagnostics.push({ kind: "malformed", path: file.path, line: index + 1 });
    }
  }
  const content = records.filter(({ record }) => {
    if (!TELEMETRY_TYPES.has(string(record.type)) && record.kind !== "telemetry") return true;
    telemetryRecords++;
    return false;
  });
  const host = sniffHost(content);
  for (const parsed of content) {
    const known = host === "codex" ? CODEX_TYPES : CLAUDE_TYPES;
    if (!known.has(string(parsed.record.type))) {
      diagnostics.push({ kind: "unknown", path: file.path, line: parsed.line });
      continue;
    }
    const { record } = parsed;
    const message = object(record.message);
    if ((["response_item", "event_msg"].includes(string(record.type)) && !string(object(record.payload).type)) ||
      (["user", "assistant"].includes(string(record.type)) && typeof message.content !== "string" && !Array.isArray(message.content))) {
      diagnostics.push({ kind: "malformed", path: file.path, line: parsed.line });
      continue;
    }
    if (["assistant", "user", "system", "response_item", "event_msg"].includes(string(parsed.record.type)) && parsed.timeMs === null) {
      diagnostics.push({ kind: record.timestamp == null ? "undated" : "invalid-timestamp", path: file.path, line: parsed.line });
    }
  }
  if (host == null) {
    warnings.push(`unrecognized session format, skipped: ${file.path}`);
    skippedUnrecognizedPaths.push(file.path);
    return null;
  }
  const meta = content.find(({ record }) => record.type === "session_meta");
  const payload = object(meta?.record.payload);
  const firstIdentity = content.find(({ record }) => typeof record.sessionId === "string" || record.isSidechain === true);
  const identity = firstIdentity?.record ?? {};
  const layout = /\/([^/]+)\/subagents\/(?:agent-)?([^/]+)\.jsonl$/.exec(file.path);
  const sessionId = string(identity.sessionId) || layout?.[1] || "";
  const agentId = string(identity.agentId) || layout?.[2] || "";
  const isChild = identity.isSidechain === true || layout !== null;
  const id = host === "codex" ? string(payload.id) : isChild ? (sessionId && agentId ? `${sessionId}/agent/${agentId}` : "") : sessionId;
  const spawn = object(object(object(payload.source).subagent).thread_spawn);
  const parentId = host === "codex" ? string(payload.parent_thread_id) || string(spawn.parent_thread_id) : isChild && id ? sessionId : "";
  if (!id) diagnostics.push({ kind: "identity-uncertain", path: file.path, line: meta?.line ?? firstIdentity?.line ?? 1 });
  return {
    ...file, records: content.map((record) => summarizeRecord(record, host)).filter(({ user, actions }) => user || actions.length),
    host, project: firstProject(content, host), key: id ? `${host}:${id}` : file.path,
    parent: id && parentId ? `${host}:${parentId}` : null,
    isChild: host === "claude" ? isChild : !!parentId || Object.hasOwn(object(payload.source), "subagent") || payload.source === "subagent",
    startedMs: meta?.timeMs ?? null,
  };
}

function conversationRoot(file: Transcript, identities: ReadonlyMap<string, Transcript>): string {
  const seen = new Set<string>();
  let key = file.key;
  while (identities.get(key)?.parent) {
    if (seen.has(key)) return file.key;
    seen.add(key);
    key = identities.get(key)?.parent ?? key;
  }
  return key;
}

function duplicateCodexUsers(records: readonly RecordSummary[]) {
  const messages = records.flatMap(({ user, line, timeMs }) => user ? [{ ...user, line, timeMs }] : []);
  const byLine = new Map(messages.map((message) => [message.line, message]));
  const eventIds = new Map<string, number[]>();
  for (const message of messages.filter(({ representation }) => representation === "event_msg")) {
    const ids = [message.messageId ? `message:${message.messageId}` : "", message.turnId ? `turn:${message.turnId}` : ""].filter(Boolean);
    for (const id of ids) eventIds.set(id, [...(eventIds.get(id) ?? []), message.line]);
  }
  const pairedEvents = new Set<number>();
  const duplicates = new Set<number>();
  const messageIds = new Map<number, string>();
  for (const message of messages.filter(({ representation }) => representation === "response_item")) {
    const candidates = [
      ...(eventIds.get(`message:${message.messageId}`) ?? []), ...(eventIds.get(`turn:${message.turnId}`) ?? []),
      message.line - 1, message.line + 1,
    ];
    const match = candidates.find((line) => {
      const event = byLine.get(line);
      if (!event || event.representation !== "event_msg" || pairedEvents.has(line) || event.exact !== message.exact) return false;
      if (message.messageId && event.messageId && message.messageId !== event.messageId) return false;
      if ((message.messageId && message.messageId === event.messageId) || (message.turnId && message.turnId === event.turnId)) return true;
      return Math.abs(line - message.line) === 1 && message.timeMs !== null && event.timeMs !== null &&
        Math.abs(message.timeMs - event.timeMs) <= USER_PAIR_WINDOW_MS &&
        (!message.turnId || !event.turnId || message.turnId === event.turnId);
    });
    if (match === undefined) continue;
    pairedEvents.add(match);
    duplicates.add(message.line);
    if (message.messageId) messageIds.set(match, message.messageId);
  }
  return { duplicates, messageIds };
}

function classifyConversation(members: readonly Transcript[], sinceMs: number) {
  const primary = members.find((file) => !file.isChild) ?? members[0];
  const evidence: Evidence[] = [];
  const counts = new Map<SignalClass | CandidateClass, Set<string>>();
  const latestByKind = new Map<SignalClass | CandidateClass, number>();
  const seenUsers = new Set<string>();
  const users: { readonly file: Transcript; readonly parsed: RecordSummary; readonly user: UserSummary }[] = [];
  let userActivity = false;
  const bump = (source: { file: Transcript; parsed: RecordSummary; callId?: string }, cls: SignalClass | CandidateClass, operation?: string) => {
    const { file, parsed } = source;
    const { line, timestamp, timeMs, messageId } = parsed;
    const callId = source.callId ?? parsed.callId;
    const inherited = file.isChild && timeMs !== null && file.startedMs !== null && timeMs < file.startedMs;
    if ((timeMs ?? file.mtimeMs) < sinceMs || inherited) return;
    const ids = counts.get(cls) ?? new Set<string>();
    ids.add(operation || callId || messageId || `${file.path}:${line}`);
    counts.set(cls, ids);
    evidence.push({ kind: cls, path: file.path, line, timestamp: timeMs === null ? null : timestamp, timeBasis: timeMs === null ? "file-mtime" : "record", ...(callId ? { callId } : {}), ...(messageId ? { messageId } : {}) });
    latestByKind.set(cls, Math.max(latestByKind.get(cls) ?? 0, timeMs ?? file.mtimeMs));
  };
  for (const file of members) {
    const toolNames = new Map<string, string>();
    const seenResults = new Set<string>();
    const pairedUsers = file.host === "codex" ? duplicateCodexUsers(file.records) : { duplicates: new Set<number>(), messageIds: new Map<number, string>() };
    let runKey = "";
    let runLength = 0;
    for (const parsed of file.records) {
      const { line, timeMs, messageId, user } = parsed;
      let callId = parsed.callId;
      const inherited = file.isChild && timeMs !== null && file.startedMs !== null && timeMs < file.startedMs;
      const inWindow = (timeMs ?? file.mtimeMs) >= sinceMs && !inherited;
      const retry = (signature: string, toolId: string, failed: boolean) => {
        if (!failed || !inWindow) { runKey = ""; runLength = 0; return; }
        if (toolId && seenResults.has(toolId)) return;
        if (toolId) seenResults.add(toolId);
        const key = `${toolNames.get(toolId) ?? "?"}::${signature}`;
        runLength = key === runKey ? runLength + 1 : 1;
        runKey = key;
        if (runLength === 3) bump({ file, parsed, callId }, "retry-loop", toolId || messageId || `${file.path}:${line}`);
      };
      if (!file.isChild && user?.eligible && !pairedUsers.duplicates.has(line)) {
        users.push({ file, parsed: { ...parsed, messageId: messageId || pairedUsers.messageIds.get(line) || "" }, user });
      }
      for (const action of parsed.actions) {
        callId = action.callId;
        if (action.kind === "tool") toolNames.set(callId, action.name);
        else if (action.kind === "signal") bump({ file, parsed, callId }, action.signal, action.operation || undefined);
        else retry(action.signature, callId, action.failed);
      }
    }
  }
  users.sort((a, b) => (a.parsed.timeMs ?? a.file.mtimeMs) - (b.parsed.timeMs ?? b.file.mtimeMs) ||
    a.file.path.localeCompare(b.file.path, "en") || a.parsed.line - b.parsed.line);
  let previousUser = "";
  for (const source of users) {
    const { file, parsed, user } = source;
    const { messageId, line } = parsed;
    if (messageId && seenUsers.has(messageId)) continue;
    if (messageId) seenUsers.add(messageId);
    if ((parsed.timeMs ?? file.mtimeMs) >= sinceMs) userActivity = true;
    const operation = messageId || `${file.path}:${line}`;
    if (user.intervention) bump(source, "user-intervention", operation);
    if (user.repeatable && user.normalized === previousUser) bump(source, "repeated-request", operation);
    previousUser = user.normalized;
  }
  const classes: SignalCounts = {};
  const candidates: Partial<Record<CandidateClass, number>> = {};
  let latestMs = 0;
  for (const [kind, ids] of [...counts].sort(([a], [b]) => a.localeCompare(b, "en"))) {
    if (kind === "user-intervention" || kind === "repeated-request") candidates[kind] = ids.size;
    else if (ids.size >= MIN_EVENTS[kind]) classes[kind] = ids.size;
    else continue;
    latestMs = Math.max(latestMs, latestByKind.get(kind) ?? 0);
  }
  const score = Object.keys(classes).length + Object.keys(candidates).length;
  const mtimeMs = Math.max(...members.map((file) => file.mtimeMs));
  const selection: FlaggedSession = {
    path: primary.path, host: primary.host, mtime: isoDate(mtimeMs), classes, score,
    paths: members.map((file) => file.path).sort(), candidates,
    evidence: evidence.filter(({ kind }) => Object.hasOwn(classes, kind) || Object.hasOwn(candidates, kind)),
  };
  return { selection, userActivity, latestMs: latestMs || mtimeMs };
}

const { dirs, sinceMs, topN } = parseArgs(process.argv.slice(2));
const files: SessionFile[] = [];

if (sinceMs == null) for (const dir of dirs) noteUnwalked(dir);
else for (const dir of dirs) collectFiles(dir, sinceMs, files);

const transcripts: Transcript[] = [];
const projectCounts = new Map<string | null, number>();
for (const file of files) {
  const transcript = readTranscript(file);
  const project = transcript?.project ?? null;
  projectCounts.set(project, (projectCounts.get(project) ?? 0) + 1);
  if (transcript) transcripts.push(transcript);
}

const sessions = [...projectCounts]
  .map(([project, count]) => ({ project, count }))
  .sort((a, b) => b.count - a.count || compareProjects(a.project, b.project));

const identities = new Map(transcripts.map((file) => [file.key, file]));
const groups = new Map<string, Transcript[]>();
for (const file of transcripts) {
  const key = conversationRoot(file, identities);
  const members = groups.get(key) ?? [];
  members.push(file);
  groups.set(key, members);
}
const results = [...groups.values()].map((members) => classifyConversation(members, sinceMs ?? Infinity));
const ranked = results.filter(({ selection }) => selection.score > 0)
  .sort((a, b) => b.selection.score - a.selection.score || b.latestMs - a.latestMs || a.selection.path.localeCompare(b.selection.path, "en"));
const flagged = ranked.slice(0, topN).map(({ selection }) => selection);
const samplePool = results.filter(({ selection, userActivity }) => selection.score === 0 && userActivity)
  .sort((a, b) => a.selection.path.localeCompare(b.selection.path, "en"));

process.stdout.write(JSON.stringify({
  flagged,
  remainder: Math.max(0, ranked.length - flagged.length),
  remainderPaths: ranked.slice(flagged.length).flatMap(({ selection }) => selection.paths),
  scanned: files.length,
  sessions,
  conversations: groups.size,
  sampled: samplePool.slice(0, SAMPLE_LIMIT).map(({ selection }) => selection),
  sampleOmitted: Math.max(0, samplePool.length - SAMPLE_LIMIT),
  telemetryRecords,
  diagnostics: diagnostics.sort((a, b) => a.path.localeCompare(b.path, "en") || a.line - b.line || a.kind.localeCompare(b.kind, "en")),
  skippedUnknownRecords: diagnostics.filter(({ kind }) => kind === "unknown" || kind === "malformed").length,
  skippedUnrecognized: skippedUnrecognizedPaths.length,
  skippedUnrecognizedPaths,
  unreadable: unreadablePaths.length + unreadableDirs.length,
  unreadableDirs,
  unreadablePaths,
} satisfies Report) + "\n");
for (const w of warnings) console.error(`[session-triage] ${w}`);
