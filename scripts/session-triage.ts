#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code !== "EPIPE") throw err;
});

type SignalClass =
  | "api-error"
  | "permission-denial"
  | "policy-block"
  | "input-validation"
  | "retry-loop"
  | "user-abort";

const DEFAULT_TOP = 10;
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

const CLAUDE_ABORT = /^\[Request interrupted by user/;
const CLAUDE_PERMISSION = /^Permission to use .+ has been denied\.?\s*$/s;
const CLAUDE_USER_REFUSAL = "The user doesn't want to";
const CLAUDE_SANDBOX_BLOCK = "<tool_use_error>Blocked:";
const CLAUDE_ISOLATION_BLOCK = "Refusing to run it";
const INPUT_VALIDATION = "InputValidationError";
const CODEX_REJECTED = /rejected due to unacceptable risk|Rejected\("/;
const CODEX_FAILURE = /(?:^|\n|\\n)(?:Process exited with code [1-9]|Exit code: [1-9]|Script failed|exec_command failed for)/;
const CODEX_VOLATILE = /^(?:Chunk ID|Wall time|Original token count|Total token count):/;
type Host = "claude" | "codex";
type SignalCounts = Partial<Record<SignalClass, number>>;

interface TranscriptRecord {
  readonly type?: string;
  readonly cwd?: string;
  readonly payload?: CodexPayload;
  readonly isApiErrorMessage?: boolean;
  readonly preventedContinuation?: boolean;
  readonly hookErrors?: unknown;
  readonly message?: { readonly content?: ContentBlock[] };
}

interface CodexPayload {
  readonly type?: string;
  readonly cwd?: string;
  readonly reason?: string;
  readonly success?: boolean;
  readonly stderr?: unknown;
  readonly call_id?: string;
  readonly name?: string;
  readonly output?: unknown;
}

interface ContentBlock {
  readonly type?: string;
  readonly id?: string;
  readonly name?: string;
  readonly text?: string;
  readonly content?: unknown;
  readonly is_error?: boolean;
  readonly tool_use_id?: string;
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
}

interface SessionScore extends FlaggedSession {
  readonly mtimeMs: number;
  readonly unknown: number;
}

interface TriagedFile {
  readonly project: string | null;
  readonly session: SessionScore | null;
}

interface ProjectSessions {
  readonly project: string | null;
  readonly count: number;
}

interface Report {
  readonly flagged: readonly FlaggedSession[];
  readonly remainder: number;
  readonly remainderPaths: readonly string[];
  readonly scanned: number;
  readonly sessions: readonly ProjectSessions[];
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

function textOf(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
}

function signature(text: string): string {
  const body = text.split("\n").filter((line) => !CODEX_VOLATILE.test(line)).join("\n");
  return body.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, 160);
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

function sniffHost(records: readonly TranscriptRecord[]): Host | null {
  for (const record of records) {
    if (record && typeof record === "object") {
      if (record.payload && typeof record.payload === "object" && CODEX_TYPES.has(record.type)) return "codex";
      if (CLAUDE_TYPES.has(record.type) && record.payload === undefined) return "claude";
    }
  }
  return null;
}

function firstProject(records: readonly TranscriptRecord[], host: Host): string | null {
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    if (host === "claude") {
      if (typeof record.cwd === "string") return record.cwd;
      continue;
    }
    if (record.type === "session_meta" && typeof record.payload?.cwd === "string") return record.payload.cwd;
  }
  return null;
}

function compareProjects(a: string | null, b: string | null): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return a.localeCompare(b, "en");
}

function classifyClaude(
  records: readonly TranscriptRecord[],
  bump: (cls: SignalClass) => void,
  countUnknown: () => void,
): void {
  const toolNames = new Map<string | undefined, string>();
  let runKey = null;
  let runLength = 0;
  for (const record of records) {
    if (!record || typeof record !== "object") {
      countUnknown();
      continue;
    }
    if (!CLAUDE_TYPES.has(record.type)) countUnknown();
    if (record.isApiErrorMessage === true) bump("api-error");
    if (record.type === "system" && (record.preventedContinuation === true || (Array.isArray(record.hookErrors) && record.hookErrors.length > 0))) {
      bump("policy-block");
    }
    const content = record.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      if (block.type === "tool_use") {
        if (block.id) toolNames.set(block.id, block.name ?? "?");
        continue;
      }
      if (block.type === "text") {
        if (CLAUDE_ABORT.test(block.text ?? "")) bump("user-abort");
        continue;
      }
      if (block.type !== "tool_result") continue;
      const text = textOf(block.content);
      if (!block.is_error) {
        runKey = null;
        runLength = 0;
        continue;
      }
      if (CLAUDE_PERMISSION.test(text) || text.includes(CLAUDE_USER_REFUSAL)) bump("permission-denial");
      if (text.includes(CLAUDE_SANDBOX_BLOCK) || text.includes(CLAUDE_ISOLATION_BLOCK)) bump("policy-block");
      if (text.includes(INPUT_VALIDATION)) bump("input-validation");
      const key = `${toolNames.get(block.tool_use_id) ?? "?"}::${signature(text)}`;
      if (key === runKey) {
        runLength++;
        if (runLength === 3) bump("retry-loop");
      } else {
        runKey = key;
        runLength = 1;
      }
    }
  }
}

function classifyCodex(
  records: readonly TranscriptRecord[],
  bump: (cls: SignalClass) => void,
  countUnknown: () => void,
): void {
  const callNames = new Map<string | undefined, string>();
  let runKey = null;
  let runLength = 0;
  for (const record of records) {
    if (!record || typeof record !== "object") {
      countUnknown();
      continue;
    }
    if (!CODEX_TYPES.has(record.type)) countUnknown();
    const payload = record.payload;
    if (!payload || typeof payload !== "object") continue;
    const kind = payload.type;
    if (kind === "error" || kind === "stream_error") bump("api-error");
    if (kind === "turn_aborted" && payload.reason !== "replaced") bump("user-abort");
    if (kind === "patch_apply_end" && payload.success === false && CODEX_REJECTED.test(textOf(payload.stderr))) {
      bump("policy-block");
    }
    if (kind === "function_call" || kind === "custom_tool_call") {
      if (payload.call_id) callNames.set(payload.call_id, payload.name ?? "?");
      continue;
    }
    if (kind !== "function_call_output" && kind !== "custom_tool_call_output") continue;
    const text = textOf(payload.output);
    if (CODEX_REJECTED.test(text)) bump("policy-block");
    if (text.includes(INPUT_VALIDATION)) bump("input-validation");
    if (!CODEX_FAILURE.test(text)) {
      runKey = null;
      runLength = 0;
      continue;
    }
    const key = `${callNames.get(payload.call_id) ?? "?"}::${signature(text)}`;
    if (key === runKey) {
      runLength++;
      if (runLength === 3) bump("retry-loop");
    } else {
      runKey = key;
      runLength = 1;
    }
  }
}

function triage(file: SessionFile): TriagedFile {
  let text;
  try {
    text = readFileSync(file.path, "utf8");
  } catch (err) {
    warnings.push(`unreadable file ${file.path}: ${err.code ?? err.message}`);
    unreadablePaths.push(file.path);
    return { project: null, session: null };
  }
  const records: TranscriptRecord[] = [];
  let unknown = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      unknown++;
    }
  }
  const host = sniffHost(records);
  if (host == null) {
    warnings.push(`unrecognized session format, skipped: ${file.path}`);
    skippedUnrecognizedPaths.push(file.path);
    return { project: null, session: null };
  }
  const counts = new Map<SignalClass, number>();
  const bump = (cls: SignalClass) => counts.set(cls, (counts.get(cls) ?? 0) + 1);
  const countUnknown = () => { unknown++; };
  if (host === "claude") classifyClaude(records, bump, countUnknown);
  else classifyCodex(records, bump, countUnknown);

  const classes: SignalCounts = {};
  for (const [cls, n] of [...counts].sort((a, b) => a[0].localeCompare(b[0], "en"))) {
    if (n >= (MIN_EVENTS[cls] ?? 1)) classes[cls] = n;
  }
  const score = Object.keys(classes).length;
  return {
    project: firstProject(records, host),
    session: { path: file.path, host, mtime: isoDate(file.mtimeMs), mtimeMs: file.mtimeMs, classes, score, unknown },
  };
}

const { dirs, sinceMs, topN } = parseArgs(process.argv.slice(2));
const files: SessionFile[] = [];

if (sinceMs == null) for (const dir of dirs) noteUnwalked(dir);
else for (const dir of dirs) collectFiles(dir, sinceMs, files);

const results: SessionScore[] = [];
const projectCounts = new Map<string | null, number>();
let skippedUnknownRecords = 0;
for (const file of files) {
  const { project, session } = triage(file);
  projectCounts.set(project, (projectCounts.get(project) ?? 0) + 1);
  if (!session) continue;
  skippedUnknownRecords += session.unknown;
  if (session.score > 0) results.push(session);
}

const sessions = [...projectCounts]
  .map(([project, count]) => ({ project, count }))
  .sort((a, b) => b.count - a.count || compareProjects(a.project, b.project));

results.sort((a, b) => b.score - a.score || b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path, "en"));
const flagged = results.slice(0, topN).map(({ path, host, mtime, classes, score }) => ({ path, host, mtime, classes, score }));

process.stdout.write(JSON.stringify({
  flagged,
  remainder: Math.max(0, results.length - flagged.length),
  remainderPaths: results.slice(flagged.length).map((result) => result.path),
  scanned: files.length,
  sessions,
  skippedUnknownRecords,
  skippedUnrecognized: skippedUnrecognizedPaths.length,
  skippedUnrecognizedPaths,
  unreadable: unreadablePaths.length + unreadableDirs.length,
  unreadableDirs,
  unreadablePaths,
} satisfies Report) + "\n");
for (const w of warnings) console.error(`[session-triage] ${w}`);
