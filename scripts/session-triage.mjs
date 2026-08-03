#!/usr/bin/env node
// Triages Claude and Codex session transcripts for agent-misbehavior signals.
// Zero dependencies; Node >= 18.
// Usage: node scripts/session-triage.mjs --since YYYY-MM-DD [--top N] <dir> [<dir>...]
// Contract: stdout is one JSON object {flagged, remainder, remainderPaths, scanned,
// skippedUnknownRecords, skippedUnrecognized, skippedUnrecognizedPaths, unreadable, unreadableDirs,
// unreadablePaths} — flagged is the ranked top slice, remainderPaths names every flagged session
// beyond it, and `unreadable` counts every in-window transcript and directory this run could not read
// (unreadablePaths and unreadableDirs name them), so a caller advancing a since-marker can tell that
// work was missed rather than cleared. skippedUnrecognizedPaths names the files whose host could not
// be sniffed — reported, but outside that gate, since they would not sniff on a later run either.
// Warnings go to stderr; the exit code is always 0.
// Mere failure presence never flags a session — most `is_error` tool results are benign
// (file-not-found, no-match greps). Only the classified signals below count.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// stdout is asynchronous on a macOS pipe, so the report is written and the module then ends: calling
// process.exit after the write would discard whatever the pipe buffer could not take, truncating the
// JSON above 64 KB. A reader that closes early then raises EPIPE on a stream nothing awaits, and
// swallowing that is what keeps the always-zero exit status the contract above promises.
process.stdout.on("error", (err) => {
  if (err.code !== "EPIPE") throw err;
});

// Signal classes. A session scores one point per distinct class that meets its threshold.
// api-error         Provider or stream failure surfaced into the transcript.
// permission-denial A tool call the operator or the permission layer refused outright.
//                   Detected on Claude transcripts only: no in-repo-verified Codex denial
//                   marker exists yet, so Codex coverage is five classes.
// policy-block      Sandbox, worktree-isolation, hook, or risk layer refused a call before it ran.
// input-validation  Tool input rejected by the schema layer (InputValidationError).
// retry-loop        Three or more consecutive identical failures of one tool — a stuck retry.
// user-abort        Two or more user interrupts in one session — suggests runaway behavior.
const MIN_EVENTS = {
  "api-error": 1,
  "permission-denial": 1,
  "policy-block": 1,
  "input-validation": 1,
  "retry-loop": 1,
  "user-abort": 2,
};

// Record types each host is known to emit; anything else is counted, never fatal.
const CLAUDE_TYPES = new Set([
  "assistant", "user", "system", "mode", "last-prompt", "attachment", "permission-mode",
  "file-history-snapshot", "file-history-delta", "ai-title", "queue-operation",
  "agent-name", "custom-title", "pr-link", "frame-link",
]);
const CODEX_TYPES = new Set([
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
const CODEX_FAILURE = /(?:^|\n)(?:Process exited with code [1-9]|Exit code: [1-9]|Script failed)|exec_command failed for/;
// Per-call noise Codex prepends to every tool output; stripped so identical failures compare equal.
const CODEX_VOLATILE = /^(?:Chunk ID|Wall time|Original token count|Total token count):/;

const warnings = [];
// Reported separately from `warnings`: a caller that advances a since-marker past this run needs to
// know a file went unread, and a stderr line is not something the JSON contract lets it see.
const unreadablePaths = [];
// A failed directory listing hides a whole subtree, so it belongs in the same gate — kept in its own
// list because these are directories, not transcripts. ENOENT stays out: a corpus that isn't there is
// an uninstalled host, and counting it would pin the caller's marker forever on a single-agent machine.
const unreadableDirs = [];
// A transcript whose host can't be sniffed is as unread as one that wouldn't open. Reported, but
// deliberately outside the `unreadable` gate: it would never sniff on a later run either, so gating
// on it would freeze the window permanently on one stray non-session file.
const skippedUnrecognizedPaths = [];

function textOf(value) {
  return typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
}

// Collapses a failure message to a comparable signature: drop volatile headers, digits, spacing.
function signature(text) {
  const body = text.split("\n").filter((line) => !CODEX_VOLATILE.test(line)).join("\n");
  return body.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, 160);
}

function isoDate(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseSince(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // `new Date(y, m, d)` normalizes an out-of-range component instead of failing, so a well-shaped
  // but nonexistent date (2026-02-30 → March 2) would silently shift the window; the round-trip
  // rejects it, and rejects a NaN date with it.
  return isoDate(d.getTime()) === value ? d.getTime() : null;
}

function parseArgs(argv) {
  const dirs = [];
  let since = null;
  let top = "10";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--since") since = argv[++i] ?? "";
    else if (arg.startsWith("--since=")) since = arg.slice("--since=".length);
    else if (arg === "--top") top = argv[++i] ?? "";
    else if (arg.startsWith("--top=")) top = arg.slice("--top=".length);
    else if (arg.startsWith("-")) warnings.push(`ignoring unknown option: ${arg}`);
    else dirs.push(arg);
  }
  const sinceMs = parseSince(since);
  if (sinceMs == null) warnings.push(`--since must be YYYY-MM-DD (got ${JSON.stringify(since)})`);
  // `parseInt` takes the leading digit run and drops the rest, so `2junk` and `1.5` would pass as 2
  // and 1 with nothing said; the whole value has to be an integer, as health-check.mjs also requires.
  const topRaw = String(top).trim();
  const topN = /^\d+$/.test(topRaw) ? Number(topRaw) : NaN;
  if (!Number.isInteger(topN) || topN < 1) warnings.push(`--top must be a positive integer (got ${JSON.stringify(top)})`);
  if (dirs.length === 0) warnings.push("no session directory given");
  return { dirs, sinceMs, topN: Number.isInteger(topN) && topN >= 1 ? topN : 10 };
}

function collectFiles(dir, sinceMs, out) {
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
      // Its mtime is exactly what could not be read, so it counts as in-window rather than assumed out.
      warnings.push(`unreadable file ${child}: ${err.code ?? err.message}`);
      unreadablePaths.push(child);
    }
  }
}

// Decides the host from record shape rather than path, so fixtures and real corpora agree.
function sniffHost(records) {
  for (const r of records) {
    if (r && typeof r === "object") {
      if (r.payload && typeof r.payload === "object" && CODEX_TYPES.has(r.type)) return "codex";
      if (CLAUDE_TYPES.has(r.type) && r.payload === undefined) return "claude";
    }
  }
  return null;
}

function classifyClaude(records, bump, countUnknown) {
  const toolNames = new Map();
  let runKey = null;
  let runLength = 0;
  for (const r of records) {
    // A line parsing to a bare `null` is valid JSON, so it survives the parse and would throw on the
    // dereference below; every non-object goes to the unknown tally instead, never fatal.
    if (!r || typeof r !== "object") {
      countUnknown();
      continue;
    }
    if (!CLAUDE_TYPES.has(r.type)) countUnknown();
    if (r.isApiErrorMessage === true) bump("api-error");
    if (r.type === "system" && (r.preventedContinuation === true || (Array.isArray(r.hookErrors) && r.hookErrors.length > 0))) {
      bump("policy-block");
    }
    const content = r.message?.content;
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

function classifyCodex(records, bump, countUnknown) {
  const callNames = new Map();
  let runKey = null;
  let runLength = 0;
  for (const r of records) {
    // Same guard as classifyClaude: a bare `null` record must be counted, not dereferenced.
    if (!r || typeof r !== "object") {
      countUnknown();
      continue;
    }
    if (!CODEX_TYPES.has(r.type)) countUnknown();
    const payload = r.payload;
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

function triage(file) {
  let text;
  try {
    text = readFileSync(file.path, "utf8");
  } catch (err) {
    warnings.push(`unreadable file ${file.path}: ${err.code ?? err.message}`);
    unreadablePaths.push(file.path);
    return null;
  }
  const records = [];
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
    return null;
  }
  const counts = new Map();
  const bump = (cls) => counts.set(cls, (counts.get(cls) ?? 0) + 1);
  const countUnknown = () => { unknown++; };
  if (host === "claude") classifyClaude(records, bump, countUnknown);
  else classifyCodex(records, bump, countUnknown);

  const classes = {};
  for (const [cls, n] of [...counts].sort((a, b) => a[0].localeCompare(b[0], "en"))) {
    if (n >= (MIN_EVENTS[cls] ?? 1)) classes[cls] = n;
  }
  const score = Object.keys(classes).length;
  return { path: file.path, host, mtime: isoDate(file.mtimeMs), mtimeMs: file.mtimeMs, classes, score, unknown };
}

const { dirs, sinceMs, topN } = parseArgs(process.argv.slice(2));
const files = [];
if (sinceMs != null) for (const dir of dirs) collectFiles(dir, sinceMs, files);

const results = [];
let skippedUnknownRecords = 0;
for (const file of files) {
  const result = triage(file);
  if (!result) continue;
  skippedUnknownRecords += result.unknown;
  if (result.score > 0) results.push(result);
}

results.sort((a, b) => b.score - a.score || b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path, "en"));
const flagged = results.slice(0, topN).map(({ path, host, mtime, classes, score }) => ({ path, host, mtime, classes, score }));

process.stdout.write(JSON.stringify({
  flagged,
  remainder: Math.max(0, results.length - flagged.length),
  remainderPaths: results.slice(flagged.length).map((r) => r.path),
  scanned: files.length,
  skippedUnknownRecords,
  skippedUnrecognized: skippedUnrecognizedPaths.length,
  skippedUnrecognizedPaths,
  unreadable: unreadablePaths.length + unreadableDirs.length,
  unreadableDirs,
  unreadablePaths,
}) + "\n");
for (const w of warnings) console.error(`[session-triage] ${w}`);
