import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  append,
  applyProposal,
  ATTEMPT_LEASE_MS,
  BODY_CHUNK_MAX_BYTES,
  BODY_MAX_BYTES,
  Exit,
  history,
  HISTORY_SCAN_MAX,
  holdProposal,
  openStore,
  OUTPUT_MAX_BYTES,
  publishFile,
  readBody,
  readEvent,
  RECOVER_BATCH,
  recover,
  rejections,
  REVIEW_INTERVAL_MS,
  status,
  wakeCron,
  type AppendType,
  type RecoveryReport,
  type SecretaryEvent,
  type Store,
} from "../scripts/secretary-state.ts";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(resolve(TESTS_DIR, ".."), "scripts", "secretary-state.ts");
const TEST_ROOT = realpathSync(mkdtempSync(join(tmpdir(), "agents-kit-secretary-state-")));
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const HALF_HOUR_MS = 30 * MINUTE_MS;
const START = Date.parse("2026-03-01T00:00:00.000Z");
const EVIDENCE = [{ source: "sources/access.md", published: "2026-01-10", observed: null }];
const OWNER = "session-test";

after(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

interface Fixture {
  readonly home: string;
  readonly runbook: string;
}

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function configure(home: string, contents: string): void {
  mkdirSync(join(home, ".config", "agents-kit"), { recursive: true });
  writeFileSync(join(home, ".config", "agents-kit", "config.json"), contents);
}

function fixture(name: string): Fixture {
  const home = join(TEST_ROOT, name);
  rmSync(home, { recursive: true, force: true });
  const runbook = join(home, "Notes", "runbook");
  mkdirSync(runbook, { recursive: true });
  configure(home, JSON.stringify({ runbookRoot: "~/Notes/runbook" }));
  return { home, runbook };
}

function run(home: string, args: readonly string[], input?: string): Run {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...process.env, HOME: home },
    input,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function runExpect(code: number, home: string, args: readonly string[], input?: string): Run {
  const result = run(home, args, input);
  assert.strictEqual(result.status, code, `expected exit ${code} for ${args.join(" ")}\n${result.stdout}${result.stderr}`);
  assert.ok(Buffer.byteLength(result.stdout) <= OUTPUT_MAX_BYTES, `stdout of ${args.join(" ")} exceeds ${OUTPUT_MAX_BYTES} bytes`);
  return result;
}

function report(home: string, args: readonly string[], input?: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(runExpect(0, home, args, input).stdout);
  assert.ok(typeof parsed === "object" && parsed !== null);
  return parsed as Record<string, unknown>;
}

function at(step: number): Date {
  return new Date(START + step * HALF_HOUR_MS);
}

function proposal(attempt: string, summary = "Staging context names conflict between the access and platform guides.", body = "# Staging\n\nUse context example-staging.\n"): Record<string, unknown> {
  return { attempt, target: "access/staging.md", summary, evidence: EVIDENCE, before: null, body };
}

function start(store: Store, attempt: string, now: Date, owner = OWNER, job: "review" | "apply" = "review"): SecretaryEvent {
  return append(store, "attempt-started", { attempt, owner, job }, now);
}

function complete(store: Store, attempt: string, now: Date): SecretaryEvent {
  return append(store, "review-completed", { attempt, outcome: "complete", summary: "No findings.", unavailable: [] }, now);
}

function cronSlot(cron: string, from: Date): Date {
  const fields = cron.split(" ");
  assert.strictEqual(fields.length, 5, `five cron fields in ${cron}`);
  assert.strictEqual(fields[4], "*", `${cron} leaves the weekday open`);
  const [minute, hour, day, month] = fields.slice(0, 4).map(Number);
  const slot = new Date(from.getFullYear(), month - 1, day, hour, minute);
  return slot.getTime() < from.getTime() - REVIEW_INTERVAL_MS ? new Date(from.getFullYear() + 1, month - 1, day, hour, minute) : slot;
}

function files(root: string): string[] {
  if (!existsSync(root)) return [];
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else found.push(relative(root, path));
    }
  };
  walk(root);
  return found.sort();
}

function digests(store: Store): Map<string, string> {
  const map = new Map<string, string>();
  for (const name of files(store.dir).filter((path) => path.startsWith("history/") || path.startsWith("bodies/"))) {
    map.set(name, createHash("sha256").update(readFileSync(join(store.dir, name))).digest("hex"));
  }
  return map;
}

function assertExit(code: number, work: () => unknown, pattern?: RegExp): void {
  assert.throws(work, (err: unknown) => {
    assert.ok(err instanceof Exit, `expected an Exit, got ${String(err)}`);
    assert.strictEqual(err.code, code, err.message);
    if (pattern !== undefined) assert.match(err.message, pattern);
    return true;
  });
}

function pageBytes(value: unknown): number {
  return Buffer.byteLength(`${JSON.stringify(value)}\n`);
}

for (const [field, reported] of [["published", "2026-99-99"], ["observed", "2026-02-30"]] as const) {
  test(`new proposal evidence dates reject impossible ${field} calendar and timestamp components`, () => {
    const store = openStore(fixture(`evidence-invalid-${field}`).home);
    start(store, "review", at(0));
    const recorded = digests(store);
    for (const value of [
      reported,
      "2026-99-99", "2026-02-30", "2026-00-01", "2026-13-01", "2026-01-00", "2026-01-32", "2026-04-31",
      "2025-02-29", "1900-02-29", "2100-02-29", "0001-02-29", "2026-02-30T12:30:00Z",
      "2026-03-01T24:01Z", "2026-03-01T24:00:01Z", `2026-03-01T24:00:00.${"0".repeat(400)}1Z`,
      "2026-03-01T25:00:00Z", "2026-03-01T00:60Z", "2026-03-01T00:00:60Z",
      "2026-03-01T00:00:60.1Z", "2026-03-01T00:00+24:00", "2026-03-01T00:00-24:00",
      "2026-03-01T00:00+00:60", "2026-03-01T00:00-00:60", "2026-03-01T00:00+99:99",
    ]) {
      const evidence = [{ source: "sources/access.md", published: null, observed: null, [field]: value }];
      assertExit(1, () => append(store, "proposal", { ...proposal("review"), evidence }, at(0)), new RegExp(`evidence\\[0\\]\\.${field} .*ISO date`));
    }
    assert.deepStrictEqual(digests(store), recorded, "invalid evidence publishes no history or body file");
    assert.strictEqual(status(store, null, at(0)).lastSeq, 1);
  });
}

test("new proposal evidence dates preserve null and supported valid date and timestamp formats", () => {
  const store = openStore(fixture("evidence-valid").home);
  start(store, "review", at(0));
  const evidence = [
    null, "2026-01-31", "2026-02-28", "2024-02-29", "2000-02-29", "0000-02-29", "0096-02-29", "2026-04-30",
    "2026-03-01T00:00Z", "2026-12-31T23:59Z", "2026-03-01T00:00:00Z", "2026-03-01T23:59:59.1Z",
    "2026-03-01T23:59:59.999999999999999999Z", "2026-03-01T00:00+04:00", "2026-03-01T00:00-05:30",
    "2026-03-01T23:59:59.123+23:59", "2026-03-01T00:00:00-23:59", "2026-03-01T00:00-00:00",
    "2026-03-01T24:00Z", "2026-03-01T24:00:00Z", "2026-03-01T24:00:00.000Z",
    `2026-03-01T24:00:00.${"0".repeat(400)}+04:00`, "2026-12-31T24:00-05:30",
  ].map((value) => ({ source: "sources/access.md", published: value, observed: value }));
  const event = append(store, "proposal", { ...proposal("review"), evidence }, at(0));
  assert.ok(event.type === "proposal");
  assert.deepStrictEqual(event.payload.evidence, evidence);
  assert.deepStrictEqual(readEvent(store, event.seq), event);
});

test("legacy proposal evidence dates remain readable and recoverable without changing history", () => {
  const store = openStore(fixture("evidence-legacy").home);
  start(store, "review", at(0));
  const event = append(store, "proposal", proposal("review"), at(0));
  assert.ok(event.type === "proposal");
  const legacy = { ...event, payload: { ...event.payload, evidence: [
    { source: "sources/access.md", published: "2026-99-99", observed: "2026-02-30" },
    { source: "sources/platform.md", published: "2026-03-01T99:99:99+99:99", observed: "2026-03-01T24:60-24:60" },
  ] } };
  const path = join(store.dir, "history", event.at.slice(0, 10), `${String(event.seq).padStart(12, "0")}.json`);
  writeFileSync(path, `${JSON.stringify(legacy)}\n`);
  const recorded = digests(store);
  assert.deepStrictEqual(readEvent(store, event.seq), legacy);
  assert.deepStrictEqual(history(store, { after: 0, type: "proposal", proposal: null }).events, [legacy]);
  unlinkSync(join(store.dir, "state.json"));
  assert.strictEqual(recover(store).complete, true);
  assert.deepStrictEqual(digests(store), recorded);
  const current = status(store, null, at(0));
  assert.strictEqual(current.ready, true);
  assert.strictEqual(current.pending[0].proposal, event.payload.proposal);
  assert.deepStrictEqual(readEvent(store, event.seq), legacy);
});

test("the CLI records review, proposal, and decision events and reports them through status", () => {
  const { home } = fixture("records");
  const started = join(home, "started.json");
  writeFileSync(started, JSON.stringify({ attempt: "a1", owner: OWNER, job: "review" }));
  const first = report(home, ["append", "--type", "attempt-started", "--json", started]);
  const body = "# Staging\n\nUse context example-staging é.\n";
  const proposed = report(home, ["append", "--type", "proposal", "--json", "-"], JSON.stringify(proposal("a1", undefined, body)));
  const decided = report(home, ["append", "--type=decision", "--json=-"], JSON.stringify({ proposal: "p2", revision: 1, decision: "accepted", source: "coordinator relayed the user's acceptance of p2 revision 1" }));
  report(home, ["append", "--type", "review-completed", "--json", "-"], JSON.stringify({ attempt: "a1", outcome: "partial", summary: "One conflict; one source unreachable.", unavailable: ["sources/platform.md"] }));

  const store = openStore(home);
  const day = (first.event as SecretaryEvent).at.slice(0, 10);
  assert.deepStrictEqual(
    files(join(store.dir, "history")),
    [1, 2, 3, 4].map((seq) => `${day}/${String(seq).padStart(12, "0")}.json`),
  );
  const onDisk: unknown = JSON.parse(readFileSync(join(store.dir, "history", day, "000000000002.json"), "utf8"));
  assert.deepStrictEqual(onDisk, proposed.event);
  const proposalEvent = proposed.event as SecretaryEvent;
  assert.strictEqual(proposalEvent.type, "proposal");
  if (proposalEvent.type !== "proposal") return;
  assert.strictEqual(proposalEvent.payload.proposal, "p2");
  assert.strictEqual(proposalEvent.payload.revision, 1);
  assert.strictEqual(proposalEvent.payload.attempt, "a1");
  assert.ok(!("body" in proposalEvent.payload), "the event holds the body's hash, not its text");
  assert.strictEqual((decided.event as SecretaryEvent).seq, 3);

  const current = report(home, ["status"]);
  assert.strictEqual(current.id, basename(store.dir));
  assert.strictEqual(current.ready, true);
  assert.strictEqual(current.lastSeq, 4);
  assert.deepStrictEqual(current.activeAttempt, null);
  assert.deepStrictEqual(current.lastReview, { attempt: "a1", outcome: "partial", at: (current.lastReview as { at: string }).at, seq: 4 });
  assert.deepStrictEqual(current.pending, [{
    proposal: "p2",
    revision: 1,
    target: "access/staging.md",
    seq: 2,
    bodyHash: proposalEvent.payload.bodyHash,
    bodyBytes: Buffer.byteLength(body),
    decision: "accepted",
    decisionSeq: 3,
    apply: null,
  }]);
  assert.strictEqual(current.next, null);

  assert.deepStrictEqual(report(home, ["event", "--seq", "2"]).event, proposalEvent);
  const chunk = report(home, ["body", "--hash", proposalEvent.payload.bodyHash]);
  assert.strictEqual(chunk.text, body);
  assert.strictEqual(chunk.next, null);
  const decisions = report(home, ["history", "--type", "decision"]);
  assert.deepStrictEqual((decisions.events as SecretaryEvent[]).map((event) => event.seq), [3]);
});

test("earlier history and body bytes stay unchanged after later appends and corrections", () => {
  const { home } = fixture("immutable");
  const store = openStore(home);
  let step = 0;
  for (let index = 0; index < 10; index++) {
    start(store, `r${index}`, at(step));
    append(store, "proposal", { ...proposal(`r${index}`, `claim ${index}`, `# Entry ${index}\n`), target: `entries/${index}.md` }, at(step + 1));
    step += 3;
  }
  const before = digests(store);
  assert.strictEqual([...before.keys()].filter((name) => name.startsWith("history/")).length, 20);

  const corrected = readEvent(store, 3);
  const correction = append(store, "correction", { attempt: "r9", corrects: 3, note: "The cited guide was the platform guide, not the access guide." }, at(step++));
  append(store, "proposal", { ...proposal("r9", "claim 1 revised", "# Entry 1, revised\n"), target: "entries/1.md", proposal: "p4" }, at(step++));
  append(store, "decision", { proposal: "p6", revision: 1, decision: "rejected", source: "user rejected p6 in conversation" }, at(step++));
  for (let index = 0; index < 30; index++) append(store, "correction", { attempt: "r9", corrects: index + 1, note: `note ${index}` }, at(step++));

  const later = digests(store);
  for (const [name, digest] of before) assert.strictEqual(later.get(name), digest, `${name} changed after later appends`);
  assert.strictEqual(later.size - before.size, 34);
  assert.deepStrictEqual(readEvent(store, 3), corrected, "a correction never rewrites the event it corrects");
  assert.strictEqual(correction.type, "correction");
  if (correction.type === "correction") assert.strictEqual(correction.payload.corrects, 3);
});

test("a pending proposal survives many unrelated events", () => {
  const { home } = fixture("survives");
  const store = openStore(home);
  start(store, "first", at(0));
  const kept = append(store, "proposal", proposal("first"), at(0));
  complete(store, "first", at(1));
  assert.strictEqual(kept.type, "proposal");
  if (kept.type !== "proposal") return;
  let step = 2;
  for (let index = 0; index < 150; index++) {
    start(store, `day-${index}`, at(step++));
    const other = append(store, "proposal", { ...proposal(`day-${index}`, `other ${index}`), target: `other/${index}.md` }, at(step++));
    complete(store, `day-${index}`, at(step++));
    append(store, "decision", { proposal: `p${other.seq}`, revision: 1, decision: "rejected", source: "user rejected it" }, at(step++));
  }
  const expected = {
    proposal: "p2",
    revision: 1,
    target: "access/staging.md",
    seq: 2,
    bodyHash: kept.payload.bodyHash,
    bodyBytes: kept.payload.bodyBytes,
    decision: null,
    decisionSeq: null,
    apply: null,
  };
  assert.deepStrictEqual(status(store, null, at(step)).pending, [expected]);
  const cli = report(home, ["status"]);
  assert.deepStrictEqual(cli.pending, [expected]);
  assert.strictEqual(cli.lastSeq, 603);
});

test("a newer revision supersedes the older one, and only rejection removes a proposal", () => {
  const { home } = fixture("revisions");
  const store = openStore(home);
  start(store, "a1", at(0));
  append(store, "proposal", proposal("a1", "first revision"), at(0));
  const revised = append(store, "proposal", { ...proposal("a1", "second revision", "# Staging v2\n"), proposal: "p2" }, at(1));
  assert.strictEqual(revised.type, "proposal");
  if (revised.type !== "proposal") return;
  assert.strictEqual(revised.payload.proposal, "p2");
  assert.strictEqual(revised.payload.revision, 2);
  assert.deepStrictEqual(
    status(store, null, at(1)).pending.map((entry) => [entry.proposal, entry.revision, entry.seq, entry.bodyHash, entry.decision]),
    [["p2", 2, 3, revised.payload.bodyHash, null]],
  );

  const stale = runExpect(1, home, ["append", "--type", "decision", "--json", "-"], JSON.stringify({ proposal: "p2", revision: 1, decision: "accepted", source: "user accepted revision 1" }));
  assert.match(stale.stderr, /revision 2/);
  append(store, "decision", { proposal: "p2", revision: 2, decision: "accepted", source: "user accepted p2 revision 2" }, at(2));
  assert.deepStrictEqual(status(store, null, at(2)).pending.map((entry) => [entry.decision, entry.decisionSeq]), [["accepted", 4]]);

  append(store, "proposal", { ...proposal("a1", "third revision"), proposal: "p2" }, at(3));
  assert.deepStrictEqual(
    status(store, null, at(3)).pending.map((entry) => [entry.revision, entry.decision]),
    [[3, null]],
    "acceptance of an older revision never carries to a newer one",
  );
  append(store, "decision", { proposal: "p2", revision: 3, decision: "deferred", source: "user deferred it" }, at(4));
  assert.deepStrictEqual(status(store, null, at(4)).pending.map((entry) => entry.decision), ["deferred"]);
  append(store, "decision", { proposal: "p2", revision: 3, decision: "rejected", source: "user rejected it" }, at(5));
  assert.deepStrictEqual(status(store, null, at(5)).pending, []);

  assertExit(1, () => append(store, "proposal", { ...proposal("a1"), proposal: "p2" }, at(6)), /not pending/);
  assertExit(1, () => append(store, "decision", { proposal: "p2", revision: 3, decision: "accepted", source: "late" }, at(6)), /not pending/);
  assert.deepStrictEqual(history(store, { after: 0, type: null, proposal: "p2" }).events.map((event) => event.seq), [2, 3, 4, 5, 6, 7]);
});

test("the checkpoint retains only each target's latest rejected revision", () => {
  const { home } = fixture("latest-rejections");
  const store = openStore(home);
  start(store, "a1", at(0));
  const expected = new Map<string, Record<string, unknown>>();
  for (const [target, body] of [["z.md", "# First\n"], ["a.md", "# Other\n"], ["z.md", "# Later\n"]]) {
    const created = append(store, "proposal", { ...proposal("a1", "review", body), target }, at(0));
    const id = `p${created.seq}`;
    const revised = append(store, "proposal", { ...proposal("a1", "revised", body), target, proposal: id }, at(0));
    assert.ok(revised.type === "proposal");
    const decision = append(store, "decision", { proposal: id, revision: 2, decision: "rejected", source: "user" }, at(0));
    expected.set(target, { target, proposal: id, revision: 2, bodyHash: revised.payload.bodyHash, seq: decision.seq });
  }
  const entries = [expected.get("a.md"), expected.get("z.md")];
  const checkpoint = JSON.parse(readFileSync(join(store.dir, "state.json"), "utf8"));
  assert.deepStrictEqual(checkpoint.rejected, entries);
  assert.deepStrictEqual(report(home, ["rejected"]), { rejected: entries, next: null });
  assert.deepStrictEqual(report(home, ["rejected", "--cursor", "a.md"]), { rejected: [entries[1]], next: null });
  assert.deepStrictEqual(status(store, null, at(0)).pending, []);
  const recorded = digests(store);
  delete checkpoint.rejected;
  writeFileSync(join(store.dir, "state.json"), JSON.stringify(checkpoint));
  assert.strictEqual(status(store, null, at(0)).reason, "checkpoint-malformed");
  assert.match(runExpect(1, home, ["rejected"]).stderr, /not ready.*recover/);
  assert.strictEqual(recover(store).complete, true);
  assert.deepStrictEqual(report(home, ["rejected"]), { rejected: entries, next: null });
  assert.deepStrictEqual(digests(store), recorded);
});

test("rejected pages stay bounded and recover every target without reading lifetime decisions", () => {
  const { home } = fixture("rejected-pages");
  const store = openStore(home);
  assert.deepStrictEqual(report(home, ["rejected"]), { rejected: [], next: null });
  assert.ok(!existsSync(store.dir), "an empty rejection read creates no store");
  start(store, "a1", at(0));
  const expected: string[] = [];
  for (let index = 239; index >= 0; index--) {
    const target = `entries/${String(index).padStart(3, "0")}-${"é".repeat(180)}.md`;
    expected.unshift(target);
    const created = append(store, "proposal", { ...proposal("a1"), target }, at(0));
    append(store, "decision", { proposal: `p${created.seq}`, revision: 1, decision: "rejected", source: "user" }, at(0));
  }
  const readPages = (): string[] => {
    const found: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = report(home, cursor === null ? ["rejected"] : ["rejected", "--cursor", cursor]);
      const entries = page.rejected as { target: string }[];
      assert.ok(entries.length > 0);
      found.push(...entries.map((entry) => entry.target));
      cursor = page.next as string | null;
      pages++;
    } while (cursor !== null);
    assert.ok(pages > 1);
    return found;
  };
  assert.deepStrictEqual(readPages(), expected);
  const recorded = digests(store);
  unlinkSync(join(store.dir, "state.json"));
  assert.match(runExpect(1, home, ["rejected"]).stderr, /missing-checkpoint/);
  assert.strictEqual(recover(store).complete, true);
  assert.deepStrictEqual(readPages(), expected);
  assert.deepStrictEqual(digests(store), recorded);
  runExpect(2, home, ["rejected", "--cursor", ""]);
});

test("a new proposal for a target that already has a pending one is refused", () => {
  const { home } = fixture("one-pending-per-target");
  const store = openStore(home);
  start(store, "a1", at(0));
  append(store, "proposal", proposal("a1", "first finding"), at(0));
  assertExit(1, () => append(store, "proposal", proposal("a1", "same target again"), at(1)), /p2@1 already proposes access\/staging\.md; record its next revision instead/);
  append(store, "proposal", { ...proposal("a1", "other target"), target: "access/prod.md" }, at(1));
  append(store, "decision", { proposal: "p2", revision: 1, decision: "rejected", source: "user rejected it" }, at(2));
  append(store, "proposal", proposal("a1", "proposed again after rejection"), at(3));
  assert.deepStrictEqual(status(store, null, at(3)).pending.map((entry) => entry.target), ["access/prod.md", "access/staging.md"]);
});

test("status and history pages stay under the ceiling and continue through a large history", () => {
  const { home } = fixture("large");
  const store = openStore(home);
  const pending = new Set<string>();
  const decisions: number[] = [];
  const filler = "Evidence from the platform guide names a different context; ".repeat(10);
  let step = 0;
  for (let cycle = 0; cycle < 800; cycle++) {
    start(store, `review-${cycle}`, at(step++));
    const summary = cycle % 200 === 7 ? "x".repeat(15000) : `${filler}${cycle}`;
    const created = append(store, "proposal", { ...proposal(`review-${cycle}`, summary, `# Entry ${cycle}\n`), target: `entries/${cycle}.md` }, at(step++));
    pending.add(`p${created.seq}`);
    if (cycle % 2 === 1) {
      const victim = [...pending].find((id) => id !== "p2");
      assert.ok(victim !== undefined);
      const decided = append(store, "decision", { proposal: victim, revision: 1, decision: "rejected", source: "user rejected it" }, at(step++));
      decisions.push(decided.seq);
      pending.delete(victim);
    } else {
      append(store, "correction", { attempt: `review-${cycle}`, corrects: step - 1, note: "Clarifies the cited publication date." }, at(step++));
    }
    append(store, "review-completed", { attempt: `review-${cycle}`, outcome: "complete", summary: `cycle ${cycle}: ${filler}`, unavailable: [] }, at(step++));
  }
  const total = step;
  assert.ok(total >= 3000 && pending.size >= 300, `history ${total}, pending ${pending.size}`);

  const listed: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page = status(store, cursor, at(step));
    assert.ok(pageBytes(page) <= OUTPUT_MAX_BYTES, `status page ${pages} is ${pageBytes(page)} bytes`);
    assert.strictEqual(page.pendingTotal, pending.size);
    assert.ok(page.pending.length > 0);
    listed.push(...page.pending.map((entry) => entry.proposal));
    cursor = page.next;
    pages++;
  } while (cursor !== null);
  assert.ok(pages > 1, "hundreds of pending pointers need more than one page");
  assert.deepStrictEqual(listed, [...pending].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))));
  assert.ok(listed.includes("p2"), "the oldest proposal stays pending through thousands of events");

  const seen: number[] = [];
  let afterSeq: number | null = 0;
  while (afterSeq !== null) {
    const page = history(store, { after: afterSeq, type: null, proposal: null });
    assert.ok(pageBytes(page) <= OUTPUT_MAX_BYTES, `history page after ${afterSeq} is ${pageBytes(page)} bytes`);
    assert.ok(page.events.length > 0);
    seen.push(...page.events.map((event) => event.seq));
    afterSeq = page.next;
  }
  assert.deepStrictEqual(seen, Array.from({ length: total }, (_, index) => index + 1));

  const filtered: number[] = [];
  afterSeq = 0;
  while (afterSeq !== null) {
    const page = history(store, { after: afterSeq, type: "decision", proposal: null });
    assert.ok(pageBytes(page) <= OUTPUT_MAX_BYTES);
    if (page.next !== null) assert.ok(page.next - afterSeq <= HISTORY_SCAN_MAX, "one call reads a bounded span of history");
    filtered.push(...page.events.map((event) => event.seq));
    afterSeq = page.next;
  }
  assert.deepStrictEqual(filtered, decisions);

  const first = report(home, ["status"]);
  assert.deepStrictEqual(first, status(store, null, new Date()));
  const second = report(home, ["status", "--cursor", String(first.next)]);
  assert.deepStrictEqual(second, status(store, String(first.next), new Date()));
  const head = report(home, ["history"]);
  assert.ok(typeof head.next === "number");
  const continued = report(home, ["history", "--after", String(head.next)]);
  assert.strictEqual((continued.events as SecretaryEvent[])[0].seq, head.next + 1);
  const oldest = report(home, ["history", "--proposal", "p2"]);
  assert.strictEqual((oldest.events as SecretaryEvent[])[0].seq, 2);
});

test("a first run is due now and arms no wake", () => {
  const { home } = fixture("first-run");
  const store = openStore(home);
  assert.deepStrictEqual(status(store, null, at(0)).review, { due: true, dueAt: null, blockedBy: null, wake: null });
  start(store, "first", at(0));
  append(store, "proposal", proposal("first"), at(0));
  assert.strictEqual(status(store, null, at(0)).review?.due, true, "a review in flight completes nothing");
});

test("a restart before the interval ends is not due and wakes at the due instant", () => {
  const { home } = fixture("not-due");
  const store = openStore(home);
  const reviewed = new Date("2026-07-14T09:17:42.000Z");
  start(store, "r1", new Date(reviewed.getTime() - 5 * MINUTE_MS));
  complete(store, "r1", reviewed);
  const restart = new Date(reviewed.getTime() + 2 * HOUR_MS);
  const dueAt = new Date(reviewed.getTime() + REVIEW_INTERVAL_MS);
  assert.strictEqual(dueAt.getTime() - restart.getTime(), 22 * HOUR_MS);
  const slot = new Date(Math.ceil(dueAt.getTime() / MINUTE_MS) * MINUTE_MS);
  const fired = slot.getMinutes() % 30 === 0 ? new Date(slot.getTime() + 2 * MINUTE_MS) : slot;
  const review = status(store, null, restart).review;
  assert.deepStrictEqual(review, {
    due: false,
    dueAt: dueAt.toISOString(),
    blockedBy: null,
    wake: { at: dueAt.toISOString(), cron: `${fired.getMinutes()} ${fired.getHours()} ${fired.getDate()} ${fired.getMonth() + 1} *` },
  });
  assert.strictEqual(status(store, null, new Date(dueAt.getTime() - 1)).review?.due, false);
});

test("a review falls due 24 hours after the last completed or partial review", () => {
  const { home } = fixture("due");
  const store = openStore(home);
  const reviewed = new Date("2026-07-14T09:00:00.000Z");
  start(store, "r1", reviewed);
  append(store, "review-completed", { attempt: "r1", outcome: "partial", summary: "One source unreadable.", unavailable: ["sources/locked.md"] }, reviewed);
  const dueAt = new Date(reviewed.getTime() + REVIEW_INTERVAL_MS);
  assert.deepStrictEqual(status(store, null, dueAt).review, { due: true, dueAt: dueAt.toISOString(), blockedBy: null, wake: null });
  start(store, "r2", dueAt);
  complete(store, "r2", new Date(dueAt.getTime() + 10 * MINUTE_MS));
  assert.strictEqual(status(store, null, new Date(dueAt.getTime() + HOUR_MS)).review?.due, false);
});

test("after missed days exactly one review is due, and completing it moves the next one 24 hours on", () => {
  const { home } = fixture("missed-days");
  const store = openStore(home);
  const reviewed = new Date("2026-07-01T08:00:00.000Z");
  start(store, "old", reviewed);
  complete(store, "old", reviewed);
  const back = new Date(reviewed.getTime() + 5 * REVIEW_INTERVAL_MS + 3 * HOUR_MS);
  const missed = status(store, null, back).review;
  assert.deepStrictEqual(missed, {
    due: true,
    dueAt: new Date(reviewed.getTime() + REVIEW_INTERVAL_MS).toISOString(),
    blockedBy: null,
    wake: null,
  });
  start(store, "catch-up", back);
  const done = new Date(back.getTime() + 20 * MINUTE_MS);
  complete(store, "catch-up", done);
  const after = status(store, null, new Date(done.getTime() + MINUTE_MS)).review;
  assert.strictEqual(after?.due, false, "one review clears every missed day");
  assert.strictEqual(after?.dueAt, new Date(done.getTime() + REVIEW_INTERVAL_MS).toISOString());
  assert.strictEqual(after?.wake?.at, after?.dueAt);
  assert.strictEqual(history(store, { after: 0, type: "attempt-started", proposal: null }).events.length, 2, "no missed day is replayed");
});

test("a live lease refuses a competing start and expires into supersession", () => {
  const { home } = fixture("lease");
  const store = openStore(home);
  const begun = new Date("2026-07-14T10:00:00.000Z");
  start(store, "elsewhere", begun, "session-other");
  const leaseUntil = new Date(begun.getTime() + ATTEMPT_LEASE_MS);
  const during = new Date(begun.getTime() + 20 * MINUTE_MS);
  const review = status(store, null, during).review;
  assert.deepStrictEqual(review?.blockedBy, { attempt: "elsewhere", owner: "session-other", job: "review", at: begun.toISOString(), seq: 1, leaseUntil: leaseUntil.toISOString() });
  assert.deepStrictEqual([review?.due, review?.wake?.at], [true, leaseUntil.toISOString()]);
  assertExit(1, () => start(store, "here", during), /elsewhere by session-other.*holds its lease until 2026-07-14T11:00:00\.000Z and may still be live elsewhere/);

  assert.strictEqual(status(store, null, leaseUntil).review?.blockedBy, null, "the lease ends at leaseUntil");
  const superseding = start(store, "here", leaseUntil);
  assert.strictEqual(superseding.seq, 2);
  assert.deepStrictEqual(status(store, null, leaseUntil).activeAttempt, { attempt: "here", owner: OWNER, job: "review", at: leaseUntil.toISOString(), seq: 2 });

  const live = fixture("lease-cli");
  start(openStore(live.home), "elsewhere", new Date(Date.now() - 10 * MINUTE_MS), "session-other");
  const refused = runExpect(1, live.home, ["append", "--type", "attempt-started", "--json", "-"], JSON.stringify({ attempt: "here", owner: OWNER, job: "review" }));
  assert.match(refused.stderr, /elsewhere by session-other.*may still be live elsewhere/);
  const blocked = report(live.home, ["status"]).review as { readonly blockedBy: { readonly owner: string } | null };
  assert.strictEqual(blocked.blockedBy?.owner, "session-other");
});

test("a blocked review that is not yet due wakes at the later of its lease and due instant", () => {
  const { home } = fixture("blocked-not-due");
  const store = openStore(home);
  const reviewed = new Date("2026-07-14T10:00:00.000Z");
  start(store, "r1", reviewed);
  complete(store, "r1", reviewed);
  const early = new Date(reviewed.getTime() + REVIEW_INTERVAL_MS - 30 * MINUTE_MS);
  start(store, "early", early, "session-other");
  const now = new Date(early.getTime() + 5 * MINUTE_MS);
  const review = status(store, null, now).review;
  assert.strictEqual(review?.due, false);
  assert.strictEqual(review?.blockedBy?.attempt, "early");
  assert.strictEqual(review?.wake?.at, new Date(early.getTime() + ATTEMPT_LEASE_MS).toISOString());
  const leaseless = status(store, null, new Date(early.getTime() + 2 * ATTEMPT_LEASE_MS)).review;
  assert.deepStrictEqual([leaseless?.due, leaseless?.blockedBy, leaseless?.wake], [true, null, null]);
});

test("a stopped or superseded attempt's late results never land", () => {
  const { home } = fixture("late");
  const store = openStore(home);
  const begun = new Date("2026-07-14T10:00:00.000Z");
  start(store, "stopped", begun);
  append(store, "proposal", proposal("stopped", "before stop"), begun);
  const stoppedAt = new Date(begun.getTime() + 5 * MINUTE_MS);
  const stop = append(store, "attempt-stopped", { attempt: "stopped", reason: "stopped" }, stoppedAt);
  assert.strictEqual(stop.type, "attempt-stopped");
  assert.deepStrictEqual(status(store, null, stoppedAt).activeAttempt, null);
  assert.strictEqual(status(store, null, stoppedAt).review?.blockedBy, null, "a stopped attempt holds no lease");
  const recorded = digests(store);
  const late = new Date(stoppedAt.getTime() + MINUTE_MS);
  assertExit(1, () => complete(store, "stopped", late), /no attempt is active, so attempt stopped records nothing/);
  assertExit(1, () => append(store, "proposal", proposal("stopped", "after stop"), late), /no attempt is active/);
  assertExit(1, () => append(store, "attempt-stopped", { attempt: "stopped", reason: "interrupted" }, late), /no attempt is active/);
  assert.deepStrictEqual(digests(store), recorded, "a refused late result writes no event or body");
  assert.strictEqual(status(store, null, late).review?.due, true, "a stopped review completes nothing");

  start(store, "interrupted", late);
  append(store, "attempt-stopped", { attempt: "interrupted", reason: "interrupted" }, late);
  const old = new Date(late.getTime() + MINUTE_MS);
  start(store, "abandoned", old, "session-other");
  const newer = new Date(old.getTime() + ATTEMPT_LEASE_MS + MINUTE_MS);
  start(store, "current", newer);
  for (const [type, payload] of [
    ["review-completed", { attempt: "abandoned", outcome: "complete", summary: "late", unavailable: [] }],
    ["proposal", proposal("abandoned", "superseded")],
    ["attempt-stopped", { attempt: "abandoned", reason: "stopped" }],
  ] as const) {
    assertExit(1, () => append(store, type, payload, newer), /attempt abandoned is not the active attempt current; a stopped, superseded, or unknown attempt records nothing/);
  }
  const cli = runExpect(1, home, ["append", "--type", "proposal", "--json", "-"], JSON.stringify(proposal("abandoned", "superseded via CLI")));
  assert.match(cli.stderr, /not the active attempt current/);
  complete(store, "current", newer);
  assert.deepStrictEqual(
    history(store, { after: 0, type: null, proposal: null }).events.map((event) => [event.type, "attempt" in event.payload ? event.payload.attempt : null]),
    [
      ["attempt-started", "stopped"],
      ["proposal", "stopped"],
      ["attempt-stopped", "stopped"],
      ["attempt-started", "interrupted"],
      ["attempt-stopped", "interrupted"],
      ["attempt-started", "abandoned"],
      ["attempt-started", "current"],
      ["review-completed", "current"],
    ],
  );
});

test("a wake slot is a local minute off :00 and :30, never before its instant", () => {
  const from = Date.parse("2026-07-15T00:00:00.000Z");
  for (let offset = 0; offset < REVIEW_INTERVAL_MS; offset += 7 * MINUTE_MS + 13 * 1000) {
    const instant = new Date(from + offset);
    const cron = wakeCron(instant, new Date(from - HOUR_MS));
    const slot = cronSlot(cron, instant);
    assert.notStrictEqual(slot.getMinutes() % 30, 0, `${instant.toISOString()} -> ${cron}`);
    assert.ok(slot.getTime() >= instant.getTime(), `${cron} fires before ${instant.toISOString()}`);
    assert.ok(slot.getTime() - instant.getTime() < 3 * MINUTE_MS, `${cron} fires too long after ${instant.toISOString()}`);
  }
  const now = new Date("2026-07-15T08:10:40.000Z");
  for (const instant of [new Date(now.getTime() - 5 * MINUTE_MS), new Date(now.getTime() + 10 * 1000)]) {
    const slot = cronSlot(wakeCron(instant, now), now);
    assert.ok(slot.getTime() >= now.getTime() + MINUTE_MS, "a wake is armed at least a minute ahead of the status call");
  }
  const yearEnd = new Date(2026, 11, 31, 23, 59, 30);
  assert.strictEqual(wakeCron(yearEnd, new Date(yearEnd.getTime() - HOUR_MS)), "2 0 1 1 *");
});

test("the CLI status reports the store id and a wake cron in the host's local time", () => {
  const { home } = fixture("cli-wake");
  const store = openStore(home);
  const minimum = Date.now() + 3 * HOUR_MS;
  const dueAt = new Date(Math.ceil(minimum / HOUR_MS) * HOUR_MS - 30 * 1000);
  const reviewed = new Date(dueAt.getTime() - REVIEW_INTERVAL_MS);
  start(store, "r1", reviewed);
  complete(store, "r1", reviewed);
  const slotUtc = new Date(dueAt.getTime() + 30 * 1000 + 2 * MINUTE_MS);
  const expectations: readonly (readonly [string, number])[] = [["UTC", 0], ["Asia/Kolkata", 330]];
  for (const [zone, offsetMinutes] of expectations) {
    const local = new Date(slotUtc.getTime() + offsetMinutes * MINUTE_MS);
    const cron = `${local.getUTCMinutes()} ${local.getUTCHours()} ${local.getUTCDate()} ${local.getUTCMonth() + 1} *`;
    const result = spawnSync(process.execPath, [SCRIPT, "status"], { encoding: "utf8", env: { ...process.env, HOME: home, TZ: zone } });
    assert.strictEqual(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.id, store.id);
    assert.deepStrictEqual(parsed.review, { due: false, dueAt: dueAt.toISOString(), blockedBy: null, wake: { at: dueAt.toISOString(), cron } }, zone);
  }
});

test("secretary records keep private creation modes under umask 022", (t) => {
  const previousUmask = process.umask(0o022);
  const created: { path: string; mode: number; directory: boolean }[] = [];
  try {
    const { home, runbook } = fixture("private-record-modes");
    chmodSync(runbook, 0o700);
    const source = join(runbook, "entry.md");
    writeFileSync(source, "# Private entry\n", { mode: 0o600 });
    const store = openStore(home);
    const observe = (path: unknown): void => {
      if (typeof path !== "string" || !path.startsWith(`${store.dir}/`)) return;
      const stat = statSync(path);
      created.push({ path, mode: stat.mode & 0o777, directory: stat.isDirectory() });
    };
    const mkdir = fs.mkdirSync;
    const write = fs.writeFileSync;
    t.mock.method(fs, "mkdirSync", (...args: Parameters<typeof mkdirSync>) => {
      const result = mkdir(...args);
      observe(args[0]);
      return result;
    });
    t.mock.method(fs, "writeFileSync", (...args: Parameters<typeof writeFileSync>) => {
      write(...args);
      observe(args[0]);
    });
    syncBuiltinESMExports();

    start(store, "private", at(0));
    append(store, "proposal", { ...proposal("private", "Private entry update", readFileSync(source, "utf8")), target: "entry.md" }, at(1));
    assert.strictEqual(statSync(store.dir).mode & 0o777, 0o700, "a copied private entry stays behind a private store root");
    unlinkSync(join(store.dir, "state.json"));
    assert.strictEqual(recover(store, 1).complete, false);
    assert.strictEqual(statSync(join(store.dir, "recovery.json")).mode & 0o777, 0o600);
    assert.strictEqual(recover(store, 1).complete, true);

    for (const entry of created) assert.strictEqual(entry.mode, entry.directory ? 0o700 : 0o600, entry.path);
    for (const name of files(store.dir)) assert.strictEqual(statSync(join(store.dir, name)).mode & 0o777, 0o600, name);
    for (const dir of ["history", "history/2026-03-01", "bodies"]) assert.strictEqual(statSync(join(store.dir, dir)).mode & 0o777, 0o700, dir);
    assert.ok(created.some((entry) => entry.directory && basename(entry.path).startsWith("lock.new-")));
    assert.ok(created.some((entry) => basename(entry.path) === "owner.json"));
    assert.ok(created.some((entry) => basename(entry.path).startsWith(".tmp-")));
    assert.ok(created.some((entry) => basename(entry.path).startsWith(".state-")));
    assert.strictEqual(statSync(runbook).mode & 0o777, 0o700);
    assert.strictEqual(statSync(source).mode & 0o777, 0o600);
    assert.strictEqual(readFileSync(source, "utf8"), "# Private entry\n");
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
    process.umask(previousUmask);
  }
});

test("secretary record access protects existing permissive stores without creating absent ones", () => {
  const previousUmask = process.umask(0o022);
  try {
    const { home } = fixture("private-existing-records");
    const store = openStore(home);
    start(store, "private", at(0));
    const event = append(store, "proposal", proposal("private"), at(1));
    assert.ok(event.type === "proposal");
    if (event.type !== "proposal") return;
    const body = join(store.dir, "bodies", event.payload.bodyHash);
    chmodSync(body, 0o644);
    const read = [
      () => status(store, null, at(1)),
      () => rejections(store, null),
      () => history(store, { after: 0, type: null, proposal: null }),
      () => readEvent(store, 2),
      () => readBody(store, event.payload.bodyHash, 0, BODY_CHUNK_MAX_BYTES),
      () => recover(store, 1),
      () => append(store, "correction", { attempt: "private", corrects: 2, note: "Private annotation" }, at(1)),
      () => assertExit(1, () => applyProposal(store, { attempt: "unknown", proposal: "p2", revision: 1 }, at(1))),
      () => assertExit(1, () => holdProposal(store, { attempt: "unknown", proposal: "p2", revision: 1 }, at(1))),
    ];
    for (const access of read) {
      chmodSync(store.dir, 0o755);
      access();
      assert.strictEqual(statSync(store.dir).mode & 0o777, 0o700, "access repairs a permissive root before using private records");
    }
    const absent = openStore(fixture("private-absent-records").home);
    status(absent, null, at(0));
    rejections(absent, null);
    history(absent, { after: 0, type: null, proposal: null });
    assertExit(1, () => readEvent(absent, 1));
    assertExit(1, () => readBody(absent, event.payload.bodyHash, 0, BODY_CHUNK_MAX_BYTES));
    recover(absent, 1);
    assert.ok(!existsSync(absent.dir), "record reads keep an absent store absent");
  } finally {
    process.umask(previousUmask);
  }
});

test("publication never overwrites an existing file", () => {
  const dir = join(TEST_ROOT, "publish");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "000000000001.json"), "original\n");
  assert.strictEqual(publishFile(dir, "000000000001.json", "replacement\n"), "exists");
  assert.strictEqual(readFileSync(join(dir, "000000000001.json"), "utf8"), "original\n");
  assert.strictEqual(publishFile(dir, "000000000002.json", "second\n"), "created");
  assert.deepStrictEqual(readdirSync(dir).sort(), ["000000000001.json", "000000000002.json"], "no temporary file survives publication");
  assert.strictEqual(readFileSync(join(dir, "000000000002.json"), "utf8"), "second\n");

  const { home } = fixture("bodies");
  const store = openStore(home);
  start(store, "a1", at(0));
  const first = append(store, "proposal", proposal("a1", "one", "# Shared body\n"), at(0));
  const second = append(store, "proposal", { ...proposal("a1", "two", "# Shared body\n"), target: "other.md" }, at(1));
  assert.ok(first.type === "proposal" && second.type === "proposal");
  if (first.type !== "proposal" || second.type !== "proposal") return;
  assert.strictEqual(first.payload.bodyHash, second.payload.bodyHash);
  assert.deepStrictEqual(readdirSync(join(store.dir, "bodies")), [first.payload.bodyHash]);

  const tampered = "# Tampered\n";
  const victimBody = "# Victim\n";
  const victimHash = createHash("sha256").update(victimBody).digest("hex");
  writeFileSync(join(store.dir, "bodies", victimHash), tampered);
  const refused = runExpect(2, home, ["append", "--type", "proposal", "--json", "-"], JSON.stringify({ ...proposal("a1", "three", victimBody), target: "victim.md" }));
  assert.match(refused.stderr, /does not match its hash/);
  assert.strictEqual(readFileSync(join(store.dir, "bodies", victimHash), "utf8"), tampered);
  assert.strictEqual(status(store, null, at(2)).lastSeq, 3, "a refused body publishes no event");
});

test("credential scanning appends and applies long noncredential tokens within a bounded time", () => {
  for (const [index, token] of ["sk-", "sk-_", "sk-_1"].entries()) {
    const { home, runbook } = fixture(`credential-scan-${index}`);
    const store = openStore(home);
    const body = `# Namespaces\n\n${token.repeat(40000)}\n`;
    assert.ok(Buffer.byteLength(body) < BODY_MAX_BYTES);
    const now = new Date();
    start(store, "review", now);
    const bounded = (args: readonly string[], input?: string): Record<string, unknown> => {
      const result = spawnSync(process.execPath, [SCRIPT, ...args], {
        encoding: "utf8",
        env: { ...process.env, HOME: home },
        input,
        timeout: 5000,
      });
      assert.ifError(result.error);
      assert.strictEqual(result.status, 0, result.stderr);
      return JSON.parse(result.stdout) as Record<string, unknown>;
    };
    const recorded = bounded(["append", "--type", "proposal", "--json", "-"], JSON.stringify(proposal("review", undefined, body))).event as SecretaryEvent;
    assert.ok(recorded.type === "proposal");
    if (recorded.type !== "proposal") return;
    assert.strictEqual(readFileSync(join(store.dir, "bodies", recorded.payload.bodyHash), "utf8"), body);
    complete(store, "review", now);
    accept(store, recorded.payload.proposal, 1, now);
    start(store, "apply", now, OWNER, "apply");
    const applied = bounded(["apply", "--attempt", "apply", "--proposal", recorded.payload.proposal, "--revision", "1"]).event as SecretaryEvent;
    assert.ok(applied.type === "apply-result" && applied.payload.outcome === "applied");
    assert.strictEqual(readFileSync(join(runbook, "access", "staging.md"), "utf8"), body);
  }
});

test("credential shapes are refused by class without echoing the value", () => {
  const { home } = fixture("credentials");
  const store = openStore(home);
  start(store, "a1", at(0));
  append(store, "proposal", proposal("a1"), at(0));
  const shapes: readonly (readonly [string, string])[] = [
    ["private-key", `-----BEGIN ${"OPENSSH PRIVATE"} KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n-----END OPENSSH PRIVATE KEY-----`],
    ["aws-access-key-id", `AK${"IA"}ABCDEFGHIJKLMNOP`],
    ["github-token", `gh${"p_"}${"a1B2".repeat(9)}`],
    ["github-token", `github${"_pat_"}${"x".repeat(30)}`],
    ["slack-token", `xo${"xb-"}1234567890-abcdefghij`],
    ["jwt", `ey${"JhbGciOiJIUzI1NiJ9"}.ey${"JzdWIiOiIxMjM0NTY3ODkwIn0"}.${"abcdefghijklmnop"}`],
    ["url-password", `postgres://app_user:${"hunter"}2pass@db.internal:5432/app`],
    ["url-password", `postgres://reader:Pa${"$$"}word123@db.example/app`],
    ["url-password", `postgres://re${"$"}der:${"hunter"}2pass@db/app`],
    ["url-password", `postgres://reader:${"$"}ecret123@db.internal/app`],
    ["api-key", `sk-${"proj-"}${"A1b2".repeat(6)}`],
    ["api-key", `AI${"za"}${"B".repeat(35)}`],
  ];
  const placements = [
    (value: string) => proposal("a1", undefined, `# Staging\n\n${value}\n`),
    (value: string) => proposal("a1", `The guide pastes ${value} inline.`),
    (value: string) => ({ ...proposal("a1"), evidence: [{ ...EVIDENCE[0], detail: value }] }),
    (value: string) => ({ ...proposal("a1"), [value]: "field name" }),
  ];
  const baseline = files(store.dir);
  for (const [shape, value] of shapes) {
    for (const place of placements) {
      const refused = runExpect(1, home, ["append", "--type", "proposal", "--json", "-"], JSON.stringify(place(value)));
      assert.match(refused.stderr, new RegExp(`${shape} credential shape`));
      assert.ok(!refused.stderr.includes(value) && !refused.stdout.includes(value), `the ${shape} value was echoed`);
    }
    const plain = JSON.stringify(proposal("a1", undefined, value));
    const encoded = JSON.stringify(value).slice(1, -1);
    const hidden = `${[...encoded.slice(0, 2)].map((char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`).join("")}${encoded.slice(2)}`;
    const escaped = plain.replace(encoded, hidden);
    assert.notStrictEqual(escaped, plain);
    const unescaped = runExpect(1, home, ["append", "--type", "proposal", "--json", "-"], escaped);
    assert.match(unescaped.stderr, new RegExp(`${shape} credential shape`), "JSON escapes cannot hide a credential shape");
  }
  assertExit(1, () => append(store, "correction", { attempt: "a1", corrects: 1, note: shapes[1][1] }, at(1)), /aws-access-key-id/);
  assert.deepStrictEqual(files(store.dir), baseline, "a refused payload leaves no event, body, or checkpoint change");

  const reference = { ...proposal("a1", "Read access uses Vault key ACCOUNTING_DB_READONLY_PASSWORD under secret/accounting; password=see credential manager."), target: "reference.md" };
  report(home, ["append", "--type", "proposal", "--json", "-"], JSON.stringify(reference));
  const placeholders = "Connect as postgres://app_user:<from-vault>@db.internal/app, https://ro:${DB_PASSWORD}@reports.internal/, mysql://ro:{vault:db/ro}@db.internal/, postgres://reader:$PGPASSWORD@db.internal/app, postgres://reader:${PGPASSWORD:-postgres}@db.internal/app, postgres://reader:${{secrets.DB_PASSWORD}}@db.internal/app, or postgres://reader:{{db_password}}@db.internal/app.";
  report(home, ["append", "--type", "proposal", "--json", "-"], JSON.stringify({ ...proposal("a1", placeholders), target: "placeholders.md" }));
  const namespaces = "Deploys use namespaces sk-payments-service-staging-eu and sk-payments-v2-staging-eu-west.";
  report(home, ["append", "--type", "proposal", "--json", "-"], JSON.stringify({ ...proposal("a1", namespaces), target: "namespaces.md" }));
});

test("a missing, behind, or ahead checkpoint reports not ready and blocks appends", () => {
  const fresh = fixture("fresh");
  const empty = report(fresh.home, ["status"]);
  assert.strictEqual(empty.ready, true);
  assert.strictEqual(empty.lastSeq, 0);
  assert.deepStrictEqual(empty.pending, []);
  assert.ok(!existsSync(openStore(fresh.home).dir), "reading status creates no store");

  const { home } = fixture("readiness");
  const store = openStore(home);
  start(store, "a0", at(0));
  for (let index = 0; index < 3; index++) append(store, "proposal", { ...proposal("a0", `claim ${index}`), target: `entries/${index}.md` }, at(index));
  const checkpoint = join(store.dir, "state.json");
  const saved = join(TEST_ROOT, "readiness-state.json");
  copyFileSync(checkpoint, saved);
  complete(store, "a0", at(3));
  const recorded = digests(store);

  unlinkSync(checkpoint);
  const missingReport = report(home, ["status"]);
  assert.deepStrictEqual(
    [missingReport.id, missingReport.ready, missingReport.reason, missingReport.lastSeq, missingReport.review, missingReport.pendingTotal, missingReport.pending],
    [basename(store.dir), false, "missing-checkpoint", 5, null, null, []],
  );
  assert.match(runExpect(1, home, ["append", "--type", "attempt-started", "--json", "-"], JSON.stringify({ attempt: "a2", owner: OWNER, job: "review" })).stderr, /not ready \(missing-checkpoint\)/);
  assert.ok(!existsSync(checkpoint), "a refused append writes no checkpoint");
  assert.strictEqual((report(home, ["history"]).events as SecretaryEvent[]).length, 5, "history stays readable while not ready");

  copyFileSync(saved, checkpoint);
  const behind = report(home, ["status"]);
  assert.deepStrictEqual([behind.ready, behind.reason, behind.processedSeq], [false, "checkpoint-behind", 4]);
  assertExit(1, () => start(store, "a2", at(4)), /checkpoint-behind/);

  const ahead = JSON.parse(readFileSync(saved, "utf8"));
  writeFileSync(checkpoint, JSON.stringify({ ...ahead, processed: { seq: 99 } }));
  assert.strictEqual(status(store, null, at(4)).reason, "checkpoint-ahead");
  assertExit(1, () => start(store, "a2", at(4)), /checkpoint-ahead/);
  assert.deepStrictEqual(digests(store), recorded, "no readiness state rewrites history");

  writeFileSync(checkpoint, "{");
  const malformed = report(home, ["status"]);
  assert.deepStrictEqual([malformed.ready, malformed.reason, malformed.processedSeq, malformed.pending], [false, "checkpoint-malformed", null, []]);
  assertExit(1, () => start(store, "a2", at(4)), /checkpoint-malformed/);
  assert.deepStrictEqual(digests(store), recorded, "a malformed checkpoint rewrites no history");
});

test("runbookRoot configuration selects one store per physical runbook", () => {
  const home = join(TEST_ROOT, "config");
  rmSync(home, { recursive: true, force: true });
  mkdirSync(join(home, "Notes", "runbook"), { recursive: true });
  mkdirSync(join(home, "Notes", "other"), { recursive: true });
  writeFileSync(join(home, "Notes", "file.md"), "not a directory\n");

  assert.match(runExpect(1, home, ["status"]).stderr, /no runbookRoot is configured/);
  configure(home, JSON.stringify({ taskRoots: [] }));
  assert.match(runExpect(1, home, ["status"]).stderr, /no runbookRoot is configured/);
  for (const value of [5, "", "   ", "Notes/runbook", "~Notes/runbook", null]) {
    configure(home, JSON.stringify({ runbookRoot: value }));
    runExpect(2, home, ["status"]);
  }
  configure(home, "{");
  assert.match(runExpect(2, home, ["status"]).stderr, /not valid JSON/);
  configure(home, "[]");
  runExpect(2, home, ["status"]);
  configure(home, JSON.stringify({ runbookRoot: "~/Notes/absent" }));
  assert.match(runExpect(2, home, ["status"]).stderr, /unavailable/);
  configure(home, JSON.stringify({ runbookRoot: "~/Notes/file.md" }));
  assert.match(runExpect(2, home, ["status"]).stderr, /not a directory/);

  configure(home, JSON.stringify({ runbookRoot: "~/Notes/runbook" }));
  const tilde = openStore(home);
  assert.strictEqual(tilde.runbook, realpathSync(join(home, "Notes", "runbook")));
  assert.ok(tilde.dir.startsWith(join(home, ".local", "state", "agents-kit", "secretary", "runbook", "runbook-")));
  configure(home, JSON.stringify({ runbookRoot: join(home, "Notes", "runbook") }));
  assert.strictEqual(openStore(home).dir, tilde.dir);
  symlinkSync(join(home, "Notes", "runbook"), join(home, "alias"));
  configure(home, JSON.stringify({ runbookRoot: "~/alias" }));
  assert.strictEqual(openStore(home).dir, tilde.dir, "an alias of the same directory shares its history");

  start(tilde, "a1", at(0));
  configure(home, JSON.stringify({ runbookRoot: "~/Notes/other" }));
  const other = openStore(home);
  assert.notStrictEqual(other.dir, tilde.dir);
  assert.strictEqual(report(home, ["status"]).lastSeq, 0, "a different runbook path never sees another runbook's history");
  configure(home, JSON.stringify({ runbookRoot: "~/Notes/runbook" }));
  assert.strictEqual(report(home, ["status"]).lastSeq, 1);
});

test("runbookRoot is used exactly as written, so surrounding whitespace is never trimmed", () => {
  const home = join(TEST_ROOT, "config-whitespace");
  rmSync(home, { recursive: true, force: true });
  mkdirSync(join(home, "Notes", "runbook"), { recursive: true });

  for (const value of ["   ", " ~/Notes/runbook", ` ${join(home, "Notes", "runbook")}`]) {
    configure(home, JSON.stringify({ runbookRoot: value }));
    assert.match(runExpect(2, home, ["status"]).stderr, /must be an absolute or ~\/ path/, `${JSON.stringify(value)} is a relative path`);
  }

  configure(home, JSON.stringify({ runbookRoot: "~/Notes/runbook " }));
  const absent = runExpect(2, home, ["status"]).stderr;
  assert.ok(absent.includes(`configured runbook ${join(home, "Notes", "runbook ")} is unavailable`), absent);

  mkdirSync(join(home, "Notes", "runbook "));
  assert.strictEqual(openStore(home).runbook, realpathSync(join(home, "Notes", "runbook ")));
  assert.notStrictEqual(openStore(home).runbook, realpathSync(join(home, "Notes", "runbook")));
});

test("long runbook names append and reopen distinct stores within the component limit", () => {
  const { home } = fixture("long-runbook-names");
  const prefix = "r".repeat(238);
  const names = [`${prefix}aa`, `${prefix}ab`, prefix, "runbook"];
  const ids = new Set<string>();

  for (const name of names) {
    const runbook = join(home, "Notes", name);
    mkdirSync(runbook, { recursive: true });
    configure(home, JSON.stringify({ runbookRoot: runbook }));
    const store = openStore(home);
    const event = start(store, "a1", at(0));
    assert.strictEqual(event.seq, 1);
    assert.ok(Buffer.byteLength(basename(store.dir)) <= 255);
    const hash = createHash("sha256").update(realpathSync(runbook)).digest("hex").slice(0, 16);
    assert.strictEqual(store.id, `${name.slice(0, 238)}-${hash}`);
    ids.add(store.id);

    const reopened = openStore(home);
    assert.strictEqual(reopened.dir, store.dir);
    assert.deepStrictEqual(readEvent(reopened, 1), event);
    assert.strictEqual(status(reopened, null, at(1)).lastSeq, 1);
  }

  assert.strictEqual(ids.size, names.length);
});

test("an earlier clock never writes into an older day directory", () => {
  const { home } = fixture("clock");
  const store = openStore(home);
  start(store, "a1", new Date("2026-05-10T12:00:00.000Z"));
  const late = complete(store, "a1", new Date("2026-05-09T12:00:00.000Z"));
  start(store, "a2", new Date("2026-05-11T00:00:00.000Z"));
  assert.strictEqual(late.at, "2026-05-09T12:00:00.000Z");
  assert.deepStrictEqual(files(join(store.dir, "history")), [
    "2026-05-10/000000000001.json",
    "2026-05-10/000000000002.json",
    "2026-05-11/000000000003.json",
  ]);
  assert.deepStrictEqual(history(store, { after: 0, type: null, proposal: null }).events.map((event) => event.seq), [1, 2, 3]);
  assert.strictEqual(readEvent(store, 2).seq, 2);
});

test("the mutation lock reclaims a dead owner's lock and reports a live owner busy", () => {
  const { home } = fixture("lock");
  const store = openStore(home);
  start(store, "a1", at(0));
  const lock = join(store.dir, "lock");

  const dead = spawnSync(process.execPath, ["-e", ""]).pid;
  mkdirSync(lock);
  writeFileSync(join(lock, "owner.json"), JSON.stringify({ pid: dead, at: "2026-03-01T00:00:00.000Z", token: "dead" }));
  complete(store, "a1", at(1));
  assert.ok(!existsSync(lock), "the reclaimed lock is released after the append");
  assert.ok(readdirSync(store.dir).every((name) => !name.startsWith("lock.")), "no set-aside lock survives");

  mkdirSync(lock);
  const owner = JSON.stringify({ pid: process.pid, at: "2026-03-01T00:00:00.000Z", token: "live" });
  writeFileSync(join(lock, "owner.json"), owner);
  const busy = runExpect(2, home, ["append", "--type", "attempt-started", "--json", "-"], JSON.stringify({ attempt: "a2", owner: OWNER, job: "review" }));
  assert.match(busy.stderr, new RegExp(`busy: .* held by pid ${process.pid}`));
  assert.strictEqual(readFileSync(join(lock, "owner.json"), "utf8"), owner, "a live owner's lock is left in place");
  assert.strictEqual((report(home, ["history"]).events as SecretaryEvent[]).length, 2, "history reads take no lock");
  rmSync(lock, { recursive: true });
  assert.strictEqual(report(home, ["status"]).lastSeq, 2);

  mkdirSync(lock);
  const claim = join(lock, `claim-${dead}-reclaiming.json`);
  writeFileSync(claim, JSON.stringify({ pid: dead, at: "2026-03-01T00:00:00.000Z", token: "dead" }));
  assert.match(runExpect(2, home, ["status"]).stderr, /busy: .* no readable owner record/);
  assert.ok(existsSync(claim), "a lock another process is reclaiming is never taken over");
  rmSync(lock, { recursive: true });
  mkdirSync(lock);
  assert.strictEqual(report(home, ["status"]).lastSeq, 2, "an empty leftover lock is replaced at once");
  assert.ok(!existsSync(lock));
  assert.ok(readdirSync(store.dir).every((name) => !name.startsWith("lock.")), "no prepared or set-aside lock survives");
});

test("usage errors exit 2 and invalid payloads exit 1", () => {
  const { home } = fixture("usage");
  const hash = "0".repeat(64);
  for (const args of [
    [],
    ["bogus"],
    ["status", "--bogus"],
    ["status", "extra"],
    ["status", "--cursor", "12"],
    ["append", "--type", "apply-intent", "--json", "-"],
    ["append", "--type", "apply-result", "--json", "-"],
    ["append", "--type", "nope", "--json", "-"],
    ["append", "--json", "-"],
    ["append", "--type", "correction", "--type", "correction", "--json", "-"],
    ["append", "--type", "correction", "--json", join(home, "absent.json")],
    ["history", "--after", "-1"],
    ["history", "--proposal", "12"],
    ["event"],
    ["event", "--seq", "0"],
    ["event", "--seq", "x"],
    ["body", "--hash", "xyz"],
    ["body", "--hash", hash, "--limit", String(BODY_CHUNK_MAX_BYTES + 1)],
    ["body", "--hash", hash, "--limit", "3"],
    ["apply"],
    ["apply", "--attempt", "a1", "--proposal", "p2"],
    ["apply", "--attempt", "has space", "--proposal", "p2", "--revision", "1"],
    ["apply", "--attempt", "a1", "--proposal", "2", "--revision", "1"],
    ["hold", "--attempt", "a1", "--proposal", "p2", "--revision", "0"],
    ["hold", "--attempt", "a1", "--proposal", "p2", "--revision", "1", "--json", "-"],
    ["history", "--type", "review-started"],
  ]) {
    runExpect(2, home, args, "{}");
  }

  runExpect(1, home, ["append", "--type", "proposal", "--json", "-"], "{not json");
  runExpect(1, home, ["event", "--seq", "1"]);
  runExpect(1, home, ["body", "--hash", hash]);
  runExpect(1, home, ["apply", "--attempt", "a1", "--proposal", "p2", "--revision", "1"]);
  runExpect(1, home, ["hold", "--attempt", "a1", "--proposal", "p2", "--revision", "1"]);
  assert.deepStrictEqual(report(home, ["history", "--type", "apply-result"]).events, []);

  const store = openStore(home);
  const invalid: readonly (readonly [AppendType, unknown, RegExp])[] = [
    ["attempt-started", { attempt: "a1", owner: OWNER, job: "review", extra: true }, /unexpected field/],
    ["attempt-started", {}, /missing attempt/],
    ["attempt-started", { attempt: "a1", job: "review" }, /missing owner/],
    ["attempt-started", { attempt: "a1", owner: OWNER }, /missing job/],
    ["attempt-started", { attempt: "a1", owner: OWNER, job: "recover" }, /job must be one of review, apply/],
    ["attempt-started", { attempt: "has space", owner: OWNER, job: "review" }, /token/],
    ["attempt-started", { attempt: "a1", owner: " ", job: "review" }, /owner must be a nonempty string/],
    ["attempt-started", { attempt: "a1", owner: "o".repeat(129), job: "review" }, /owner must be a nonempty string of at most 128 characters/],
    ["attempt-started", [], /JSON object/],
    ["attempt-stopped", { attempt: "a1" }, /missing reason/],
    ["attempt-stopped", { attempt: "a1", reason: "paused" }, /reason must be one of stopped, interrupted/],
    ["attempt-stopped", { attempt: "a1", reason: "stopped" }, /no attempt is active/],
    ["review-completed", { attempt: "a1", outcome: "complete", summary: "s", unavailable: [] }, /no attempt is active/],
    ["review-completed", { attempt: "a1", outcome: "partial", summary: "s", unavailable: [] }, /partial review must list/],
    ["review-completed", { attempt: "a1", outcome: "complete", summary: "s", unavailable: ["x"] }, /is partial, not complete/],
    ["review-completed", { attempt: "a1", outcome: "done", summary: "s", unavailable: [] }, /outcome must be one of/],
    ["proposal", { ...proposal("a1"), target: "../escape.md" }, /runbook-relative/],
    ["proposal", { ...proposal("a1"), target: "/abs.md" }, /runbook-relative/],
    ["proposal", { ...proposal("a1"), target: "a/./b.md" }, /runbook-relative/],
    ["proposal", { ...proposal("a1"), target: "a/" }, /runbook-relative/],
    ["proposal", { ...proposal("a1"), target: "a//b.md" }, /runbook-relative/],
    ["proposal", { ...proposal("a1"), evidence: [] }, /nonempty array/],
    ["proposal", { ...proposal("a1"), evidence: [{ source: "s" }] }, /missing published/],
    ["proposal", { ...proposal("a1"), evidence: [{ source: "s", published: "yesterday", observed: null }] }, /ISO date/],
    ["proposal", { ...proposal("a1"), before: "abc" }, /sha256/],
    ["proposal", { ...proposal("a1"), revision: 2 }, /unexpected field/],
    ["proposal", Object.fromEntries(Object.entries(proposal("a1")).filter(([key]) => key !== "attempt")), /missing attempt/],
    ["proposal", { ...proposal("a1"), body: "x".repeat(BODY_MAX_BYTES + 1) }, /body exceeds/],
    ["proposal", proposal("a1"), /no attempt is active/],
    ["decision", { proposal: "p1", revision: 1, decision: "accepted", source: "s" }, /not pending/],
    ["decision", { proposal: "p1", revision: 0, decision: "accepted", source: "s" }, /positive integer/],
    ["decision", { proposal: "p1", revision: 1, decision: "maybe", source: "s" }, /decision must be one of/],
    ["correction", { corrects: 1, note: "n" }, /missing attempt/],
    ["correction", { attempt: "a1", corrects: 1, note: "n" }, /no attempt is active/],
    ["correction", { corrects: 1, note: " " }, /nonempty string/],
  ];
  for (const [type, payload, pattern] of invalid) assertExit(1, () => append(store, type, payload, at(0)), pattern);
  assert.ok(!existsSync(join(store.dir, "history")), "no refused payload publishes an event");
  const longestOwner = "o".repeat(128);
  assert.deepStrictEqual(start(store, "a1", at(0), longestOwner).payload, { attempt: "a1", owner: longestOwner, job: "review" }, "an owner of 128 characters is accepted");
  const admission: readonly (readonly [AppendType, unknown, RegExp])[] = [
    ["attempt-started", { attempt: "a1", owner: OWNER, job: "apply" }, /already recorded/],
    ["review-completed", { attempt: "a0", outcome: "complete", summary: "s", unavailable: [] }, /not the active attempt a1/],
    ["attempt-stopped", { attempt: "a0", reason: "stopped" }, /not the active attempt a1/],
    ["proposal", proposal("a0"), /not the active attempt a1/],
    ["proposal", { ...proposal("a1"), proposal: "p9" }, /not pending/],
    ["proposal", proposal("a1", "x".repeat(17000)), /exceed 16384 bytes/],
  ];
  for (const [type, payload, pattern] of admission) assertExit(1, () => append(store, type, payload, at(1)), pattern);
  assert.strictEqual(status(store, null, at(1)).lastSeq, 1, "no refused admission publishes an event");
});

test("a malformed or missing committed event stops reads with its location", () => {
  const { home } = fixture("malformed");
  const store = openStore(home);
  for (let index = 0; index < 3; index++) start(store, `a${index}`, at(index * 3));
  const day = at(0).toISOString().slice(0, 10);
  const second = join(store.dir, "history", day, "000000000002.json");
  writeFileSync(second, "{not json");

  assert.ok(runExpect(2, home, ["history"]).stderr.includes(second));
  assert.ok(runExpect(2, home, ["event", "--seq", "2"]).stderr.includes(second));
  assert.strictEqual((report(home, ["event", "--seq", "1"]).event as SecretaryEvent).seq, 1);
  assert.deepStrictEqual((report(home, ["history", "--after", "2"]).events as SecretaryEvent[]).map((event) => event.seq), [3]);

  writeFileSync(second, JSON.stringify({ ...readEvent(store, 1), seq: 2 }).replace(/"seq":2/, "\"seq\":5"));
  assert.match(runExpect(2, home, ["history"]).stderr, /seq does not match/);
  unlinkSync(second);
  assert.match(runExpect(2, home, ["history"]).stderr, /missing or misorders seq 2/);
  assert.match(runExpect(2, home, ["event", "--seq", "2"]).stderr, /missing or misorders seq 2/);
});

test("body reads stay bounded and reassemble the stored bytes", () => {
  const { home } = fixture("body-reads");
  const store = openStore(home);
  start(store, "a1", at(0));
  const mixed = Array.from({ length: 2500 }, (_, index) => `line ${index}: é 日本 🙂\n`).join("");
  const controls = "\u0001".repeat(20000);
  for (const [index, body] of [mixed, controls].entries()) {
    const event = append(store, "proposal", { ...proposal("a1", `body ${index}`, body), target: `body-${index}.md` }, at(index));
    assert.ok(event.type === "proposal");
    if (event.type !== "proposal") return;
    let offset: number | null = 0;
    const pieces: string[] = [];
    let calls = 0;
    while (offset !== null) {
      const chunk = report(home, ["body", "--hash", event.payload.bodyHash, "--offset", String(offset)]);
      assert.ok((chunk.length as number) <= BODY_CHUNK_MAX_BYTES);
      assert.strictEqual(chunk.bytes, Buffer.byteLength(body));
      pieces.push(chunk.text as string);
      offset = chunk.next as number | null;
      calls++;
    }
    assert.ok(calls > 1);
    assert.strictEqual(pieces.join(""), body);
  }
  const mixedHash = createHash("sha256").update(mixed).digest("hex");
  const inside = Buffer.from(mixed).indexOf(Buffer.from("é")) + 1;
  assert.match(runExpect(2, home, ["body", "--hash", mixedHash, "--offset", String(inside)]).stderr, /inside a UTF-8 character/);
  runExpect(2, home, ["body", "--hash", mixedHash, "--offset", String(Buffer.byteLength(mixed) + 1)]);
  const end = readBody(store, mixedHash, Buffer.byteLength(mixed), 16);
  assert.deepStrictEqual([end.text, end.length, end.next], ["", 0, null]);
  const small = readBody(store, mixedHash, 0, 8);
  assert.ok(small.length <= 8 && small.next === small.length);
});

const STAGING_V1 = "# Staging\n\nUse context example-stage.\n";
const STAGING_V2 = "# Staging\n\nUse context example-staging.\nSource: platform guide, published 2026-09-01.\n";

function sha(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function manifest(root: string): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const name = relative(root, path);
      if (entry.isSymbolicLink()) map.set(name, `link:${readlinkSync(path)}`);
      else if (entry.isDirectory()) {
        map.set(name, "dir");
        walk(path);
      } else map.set(name, sha(readFileSync(path)));
    }
  };
  walk(root);
  return map;
}

function changedPaths(before: Map<string, string>, after: Map<string, string>): string[] {
  const names = new Set([...before.keys(), ...after.keys()]);
  return [...names].filter((name) => before.get(name) !== after.get(name)).sort();
}

function assertKept(before: Map<string, string>, store: Store): void {
  const later = digests(store);
  for (const [name, digest] of before) assert.strictEqual(later.get(name), digest, `${name} changed`);
}

interface Seeded extends Fixture {
  readonly store: Store;
  readonly sibling: string;
}

function seeded(name: string, entries: Readonly<Record<string, string>>): Seeded {
  const base = fixture(name);
  for (const [path, contents] of Object.entries(entries)) {
    mkdirSync(dirname(join(base.runbook, path)), { recursive: true });
    writeFileSync(join(base.runbook, path), contents);
  }
  const sibling = join(base.home, "Notes", "sibling.md");
  writeFileSync(sibling, "# Outside the runbook\n");
  return { ...base, store: openStore(base.home), sibling };
}

function propose(fx: Seeded, attempt: string, path: string, body: string, now: Date, revise?: string): string {
  const file = join(fx.runbook, path);
  const before = existsSync(file) ? sha(readFileSync(file)) : null;
  const payload = { ...proposal(attempt, `Update ${path}`, body), target: path, before, ...(revise === undefined ? {} : { proposal: revise }) };
  const event = append(fx.store, "proposal", payload, now);
  assert.ok(event.type === "proposal");
  return event.type === "proposal" ? event.payload.proposal : "";
}

function accept(store: Store, id: string, revision: number, now: Date): SecretaryEvent {
  return append(store, "decision", { proposal: id, revision, decision: "accepted", source: `user message ${now.toISOString()}: "accept ${id}@${revision}"` }, now);
}

function reviewed(fx: Seeded, path: string, body: string, step: number): string {
  start(fx.store, `review-${step}`, at(step));
  const id = propose(fx, `review-${step}`, path, body, at(step));
  complete(fx.store, `review-${step}`, at(step));
  return id;
}

function pointer(store: Store, id: string, now: Date) {
  return status(store, null, now).pending.find((entry) => entry.proposal === id);
}

test("an apply writes nothing before acceptance and then exactly the accepted body", () => {
  const fx = seeded("apply-once", { "README.md": "# Runbook\n", "access/staging.md": STAGING_V1, "personal/library.md": "# Library\n" });
  const { home, runbook, store, sibling } = fx;
  const target = join(runbook, "access", "staging.md");
  chmodSync(target, 0o640);
  const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
  const untouched = manifest(runbook);
  const siblingBytes = readFileSync(sibling);
  const recorded = digests(store);

  start(store, "apply-early", at(1), OWNER, "apply");
  const early = { attempt: "apply-early", proposal: id, revision: 1 };
  assertExit(1, () => applyProposal(store, early, at(1)), /not accepted; only a recorded acceptance of that revision authorizes a write/);
  append(store, "decision", { proposal: id, revision: 1, decision: "deferred", source: "user message: \"later\"" }, at(1));
  assertExit(1, () => applyProposal(store, early, at(1)), /not accepted/);
  append(store, "attempt-stopped", { attempt: "apply-early", reason: "stopped" }, at(2));
  start(store, "review-job", at(2));
  assertExit(1, () => applyProposal(store, { ...early, attempt: "review-job" }, at(2)), /attempt review-job runs the review job, not apply/);
  append(store, "attempt-stopped", { attempt: "review-job", reason: "stopped" }, at(2));
  assert.deepStrictEqual(manifest(runbook), untouched, "no runbook byte changes before acceptance");
  assertKept(recorded, store);

  accept(store, id, 1, at(3));
  start(store, "apply-1", at(4), OWNER, "apply");
  const lastSeq = status(store, null, at(4)).lastSeq;
  const prior = digests(store);
  const applied = report(home, ["apply", "--attempt", "apply-1", "--proposal", id, "--revision", "1"]).event as SecretaryEvent;
  assert.strictEqual(applied.type, "apply-result");
  if (applied.type !== "apply-result") return;
  assert.deepStrictEqual(applied.payload, { attempt: "apply-1", proposal: id, revision: 1, target: "access/staging.md", outcome: "applied", observed: sha(STAGING_V2), recovered: false });

  const stored = pointerBody(store, sha(STAGING_V2));
  assert.ok(readFileSync(target).equals(Buffer.from(stored)), "the target holds the stored body's bytes");
  assert.strictEqual(statSync(target).mode & 0o777, 0o640, "the replacement keeps the target's mode");
  assert.deepStrictEqual(changedPaths(untouched, manifest(runbook)), ["access/staging.md"], "only the target changed");
  assert.ok(readFileSync(sibling).equals(siblingBytes), "a file beside the runbook is untouched");
  assertKept(prior, store);
  assert.deepStrictEqual(
    history(store, { after: lastSeq, type: null, proposal: null }).events.map((event) => event.type),
    ["apply-intent", "apply-result"],
  );
  const after = status(store, null, at(5));
  assert.deepStrictEqual([after.pending.some((entry) => entry.proposal === id), after.activeAttempt], [false, null]);

  const written = manifest(runbook);
  assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(5)), /no attempt is active/);
  start(store, "apply-2", at(5), OWNER, "apply");
  assertExit(1, () => applyProposal(store, { attempt: "apply-2", proposal: id, revision: 1 }, at(5)), /not pending/);
  assert.deepStrictEqual(manifest(runbook), written, "a repeated apply writes nothing");
  assert.deepStrictEqual(history(store, { after: 0, type: null, proposal: id }).events.map((event) => event.type), ["proposal", "decision", "decision", "apply-intent", "apply-result"]);
});

for (const { name, mode, umask, writeUmask, finalMode } of [
  { name: "keep private targets private during writing", mode: 0o600, umask: 0o022, writeUmask: 0o022, finalMode: 0o600 },
  { name: "preserve existing modes under a restrictive umask", mode: 0o640, umask: 0o077, writeUmask: 0o022, finalMode: 0o640 },
  { name: "stage new targets privately under umask 022", mode: null, umask: 0o022, writeUmask: 0o077, finalMode: 0o644 },
  { name: "retain a new target's restrictive creation umask", mode: null, umask: 0o077, writeUmask: 0o022, finalMode: 0o600 },
]) {
  test(`apply temporary files ${name}`, (t) => {
    const previousUmask = process.umask(umask);
    try {
      const fx = seeded(`apply-temp-${mode ?? "new"}-${umask}`, mode === null ? {} : { "entry.md": STAGING_V1 });
      const target = join(fx.runbook, "entry.md");
      if (mode !== null) chmodSync(target, mode);
      const id = reviewed(fx, "entry.md", STAGING_V2, 0);
      accept(fx.store, id, 1, at(1));
      start(fx.store, "apply-1", at(2), OWNER, "apply");
      const observe = () => readdirSync(fx.runbook)
        .filter((name) => name.startsWith(".secretary-apply-") && name.endsWith(".tmp"))
        .map((name) => {
          const path = join(fx.runbook, name);
          return { mode: statSync(path).mode & 0o7777, body: readFileSync(path, "utf8") };
        });
      const writes: { before: ReturnType<typeof observe>; after: ReturnType<typeof observe> }[] = [];
      const write = fs.writeFileSync;
      t.mock.method(fs, "writeFileSync", (...args: Parameters<typeof writeFileSync>) => {
        const before = observe();
        write(...args);
        const after = observe();
        if (before.length > 0 || after.length > 0) {
          writes.push({ before, after });
          process.umask(writeUmask);
        }
      });
      syncBuiltinESMExports();

      const result = applyProposal(fx.store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2));
      assert.ok(result.type === "apply-result" && result.payload.outcome === "applied");
      assert.deepStrictEqual(writes, [{ before: [{ mode: 0o600, body: "" }], after: [{ mode: 0o600, body: STAGING_V2 }] }]);
      assert.strictEqual(statSync(target).mode & 0o7777, finalMode);
      assert.strictEqual(readFileSync(target, "utf8"), STAGING_V2);
      assert.deepStrictEqual(readdirSync(fx.runbook), ["entry.md"]);
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
      process.umask(previousUmask);
    }
  });
}

function pointerBody(store: Store, hash: string): string {
  let text = "";
  for (let offset: number | null = 0; offset !== null;) {
    const chunk = readBody(store, hash, offset, BODY_CHUNK_MAX_BYTES);
    text += chunk.text;
    offset = chunk.next;
  }
  return text;
}

test("a changed target or an older revision's decision holds the write until a new revision is accepted", () => {
  const fx = seeded("apply-conflict", { "access/staging.md": STAGING_V1 });
  const { runbook, store } = fx;
  const target = join(runbook, "access", "staging.md");
  start(store, "r1", at(0));
  const id = propose(fx, "r1", "access/staging.md", "# Staging v1 proposal\n", at(0));
  propose(fx, "r1", "access/staging.md", STAGING_V2, at(0), id);
  complete(store, "r1", at(0));
  assertExit(1, () => accept(store, id, 1, at(1)), /at revision 2; a decision for revision 1 does not apply/);
  start(store, "stale", at(1), OWNER, "apply");
  assertExit(1, () => applyProposal(store, { attempt: "stale", proposal: id, revision: 1 }, at(1)), /at revision 2, not 1/);
  append(store, "attempt-stopped", { attempt: "stale", reason: "stopped" }, at(1));

  accept(store, id, 2, at(2));
  const edited = "# Staging\n\nThe user edited this after the proposal.\n";
  writeFileSync(target, edited);
  const untouched = manifest(runbook);
  start(store, "apply-1", at(3), OWNER, "apply");
  const prior = digests(store);
  assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 2 }, at(3)), new RegExp(`conflict recorded at seq \\d+: access/staging\\.md is sha256 ${sha(edited)}, not the accepted revision's before \\(sha256 ${sha(STAGING_V1)}\\); nothing was written`));
  assert.deepStrictEqual(manifest(runbook), untouched, "a conflict writes nothing");
  assertKept(prior, store);
  const conflicted = status(store, null, at(3));
  assert.strictEqual(conflicted.activeAttempt, null, "a conflict ends the apply job");
  const entry = conflicted.pending.find((candidate) => candidate.proposal === id);
  assert.deepStrictEqual([entry?.revision, entry?.decision, entry?.apply?.state, entry?.apply?.attempt], [2, "accepted", "conflict", "apply-1"]);
  const result = readEvent(store, conflicted.lastSeq);
  assert.ok(result.type === "apply-result" && result.payload.outcome === "conflict" && result.payload.observed === sha(edited));

  assertExit(1, () => accept(store, id, 2, at(4)), /conflicted when applied at seq \d+; only a new revision can be accepted/);
  start(store, "apply-2", at(4), OWNER, "apply");
  assertExit(1, () => applyProposal(store, { attempt: "apply-2", proposal: id, revision: 2 }, at(4)), /conflicted when applied/);
  assertExit(1, () => holdProposal(store, { attempt: "apply-2", proposal: id, revision: 2 }, at(4)), /already conflicted/);
  assertExit(1, () => append(store, "proposal", { ...proposal("apply-2"), target: "access/staging.md" }, at(4)), /an apply attempt records only a new revision of a pending proposal/);
  assertExit(1, () => append(store, "proposal", { ...proposal("apply-2"), target: "access/other.md", proposal: id }, at(4)), /a revision keeps its target/);
  const merged = "# Staging\n\nThe user edited this after the proposal.\nUse context example-staging.\n";
  propose(fx, "apply-2", "access/staging.md", merged, at(4), id);
  const held = holdProposal(store, { attempt: "apply-2", proposal: id, revision: 2 }, at(4));
  assert.ok(held.type === "apply-result" && held.payload.outcome === "held" && held.payload.observed === null);
  assert.strictEqual(status(store, null, at(4)).activeAttempt, null, "a hold ends the apply job");
  const revised = pointer(store, id, at(4));
  assert.deepStrictEqual([revised?.revision, revised?.decision, revised?.apply], [3, null, null], "a new revision clears the old acceptance");
  assert.deepStrictEqual(manifest(runbook), untouched, "reassessment writes nothing");

  accept(store, id, 3, at(5));
  start(store, "apply-3", at(5), OWNER, "apply");
  applyProposal(store, { attempt: "apply-3", proposal: id, revision: 3 }, at(5));
  assert.strictEqual(readFileSync(target, "utf8"), merged);

  const created = reviewed(fx, "fresh/new-entry.md", "# New entry\n", 6);
  mkdirSync(join(runbook, "fresh"));
  writeFileSync(join(runbook, "fresh", "new-entry.md"), "# Written by the user first\n");
  accept(store, created, 1, at(7));
  start(store, "apply-4", at(7), OWNER, "apply");
  assertExit(1, () => applyProposal(store, { attempt: "apply-4", proposal: created, revision: 1 }, at(7)), /is sha256 [0-9a-f]{64}, not the accepted revision's before \(absent\)/);
  assert.strictEqual(readFileSync(join(runbook, "fresh", "new-entry.md"), "utf8"), "# Written by the user first\n");
});

test("a held apply writes nothing and leaves the accepted revision for a later attempt", () => {
  const fx = seeded("apply-held", { "access/staging.md": STAGING_V1 });
  const { runbook, store } = fx;
  const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
  start(store, "apply-1", at(1), OWNER, "apply");
  assertExit(1, () => holdProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(1)), /is not accepted, so no write is held/);
  accept(store, id, 1, at(1));
  assertExit(1, () => holdProposal(store, { attempt: "apply-1", proposal: id, revision: 2 }, at(1)), /at revision 1, not 2/);
  const untouched = manifest(runbook);
  holdProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(1));
  const entry = pointer(store, id, at(1));
  assert.deepStrictEqual([entry?.decision, entry?.apply?.state, status(store, null, at(1)).activeAttempt], ["accepted", "held", null]);
  assert.deepStrictEqual(manifest(runbook), untouched);
  start(store, "apply-2", at(2), OWNER, "apply");
  applyProposal(store, { attempt: "apply-2", proposal: id, revision: 1 }, at(2));
  assert.strictEqual(readFileSync(join(runbook, "access", "staging.md"), "utf8"), STAGING_V2);
});

test("a stale apply holds its older revision and leaves the newer revision's pointer unchanged", () => {
  const fx = seeded("apply-stale-hold", { "access/staging.md": STAGING_V1 });
  const { runbook, store } = fx;
  const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
  accept(store, id, 1, at(1));
  start(store, "review-2", at(2));
  propose(fx, "review-2", "access/staging.md", "# Staging\n\nUse context example-staging-2.\n", at(2), id);
  complete(store, "review-2", at(2));
  const newer = pointer(store, id, at(3));
  assert.deepStrictEqual([newer?.revision, newer?.decision, newer?.apply], [2, null, null]);
  const untouched = manifest(runbook);

  start(store, "apply-1", at(3), OWNER, "apply");
  const request = { attempt: "apply-1", proposal: id, revision: 1 };
  const lastSeq = status(store, null, at(3)).lastSeq;
  assertExit(1, () => applyProposal(store, request, at(3)), /at revision 2, not 1/);
  const refused = status(store, null, at(3));
  assert.deepStrictEqual([refused.lastSeq, refused.activeAttempt?.attempt], [lastSeq, "apply-1"], "a stale apply records nothing and leaves the attempt active");

  const held = holdProposal(store, request, at(3));
  assert.strictEqual(held.type, "apply-result");
  assert.deepStrictEqual(held.payload, { attempt: "apply-1", proposal: id, revision: 1, target: "access/staging.md", outcome: "held", observed: null, recovered: false });
  const settled = status(store, null, at(3));
  assert.strictEqual(settled.activeAttempt, null, "the hold ends the apply job");
  assert.deepStrictEqual(settled.pending.find((entry) => entry.proposal === id), newer, "the newer revision keeps its pointer, decision, and apply state");
  assert.deepStrictEqual(history(store, { after: lastSeq, type: null, proposal: null }).events.map((event) => event.type), ["apply-result"]);
  assert.deepStrictEqual(manifest(runbook), untouched, "a hold writes nothing");
});

test("a stopped or superseded apply attempt cannot apply, and apply attempts share the review lease", () => {
  const fx = seeded("apply-authority", { "access/staging.md": STAGING_V1 });
  const { home, runbook, store } = fx;
  const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
  accept(store, id, 1, at(1));
  const untouched = manifest(runbook);
  const begun = at(2);
  start(store, "apply-a", begun, "session-other", "apply");
  assertExit(1, () => start(store, "review-b", new Date(begun.getTime() + 10 * MINUTE_MS)), /apply attempt apply-a by session-other, started .* holds its lease until .* and may still be live elsewhere/);
  assert.deepStrictEqual(status(store, null, begun).review?.blockedBy?.job, "apply");
  assertExit(1, () => complete(store, "apply-a", begun), /attempt apply-a runs the apply job, not review/);
  append(store, "attempt-stopped", { attempt: "apply-a", reason: "stopped" }, begun);
  assertExit(1, () => applyProposal(store, { attempt: "apply-a", proposal: id, revision: 1 }, begun), /no attempt is active, so attempt apply-a records nothing/);
  assert.strictEqual(runExpect(1, home, ["apply", "--attempt", "apply-a", "--proposal", id, "--revision", "1"]).stdout, "");

  const old = at(3);
  start(store, "apply-b", old, "session-other", "apply");
  const later = new Date(old.getTime() + ATTEMPT_LEASE_MS + MINUTE_MS);
  start(store, "apply-c", later, OWNER, "apply");
  assertExit(1, () => applyProposal(store, { attempt: "apply-b", proposal: id, revision: 1 }, later), /attempt apply-b is not the active attempt apply-c/);
  assertExit(1, () => holdProposal(store, { attempt: "apply-b", proposal: id, revision: 1 }, later), /not the active attempt apply-c/);
  assert.deepStrictEqual(manifest(runbook), untouched, "no stale authority reaches the runbook");
  const token = `gh${"p_"}${"a1B2".repeat(9)}`;
  assertExit(1, () => start(store, token, later, OWNER, "apply"), /github-token credential shape/);

  applyProposal(store, { attempt: "apply-c", proposal: id, revision: 1 }, later);
  assert.strictEqual(readFileSync(join(runbook, "access", "staging.md"), "utf8"), STAGING_V2);
  assert.strictEqual(status(store, null, later).lastReview?.attempt, "review-0", "an apply completes no review");
});

test("apply refuses symlinked targets and parents, non-regular targets, and escaping paths", () => {
  const fx = seeded("apply-escape", { "plain.md": "# Plain\n" });
  const { home, runbook, store } = fx;
  const outside = join(home, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "secret.md"), "# Outside\n");
  symlinkSync(join(outside, "secret.md"), join(runbook, "link.md"));
  symlinkSync(outside, join(runbook, "linked"));
  mkdirSync(join(runbook, "folder.md"));
  const outsideBefore = manifest(outside);

  start(store, "r1", at(0));
  const cases: readonly (readonly [string, string | null, RegExp])[] = [
    ["link.md", sha("# Outside\n"), /target link\.md is a symlink/],
    ["linked/entry.md", null, /passes through the symlink .*linked/],
    ["linked/secret.md", sha("# Outside\n"), /passes through the symlink .*linked/],
    ["folder.md", null, /target folder\.md is not a regular file/],
    ["plain.md/child.md", null, /needs .*plain\.md to be a directory/],
  ];
  const ids = cases.map(([path, before]) => {
    const event = append(store, "proposal", { ...proposal("r1", `Update ${path}`, "# Replacement\n"), target: path, before }, at(0));
    return event.type === "proposal" ? event.payload.proposal : "";
  });
  complete(store, "r1", at(0));
  for (const id of ids) accept(store, id, 1, at(1));
  const untouched = manifest(runbook);
  start(store, "apply-1", at(2), OWNER, "apply");
  const recorded = digests(store);
  for (const [index, [, , pattern]] of cases.entries()) {
    assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: ids[index], revision: 1 }, at(2)), pattern);
  }
  assertKept(recorded, store);
  assert.strictEqual(status(store, null, at(2)).lastSeq, Math.max(...[...recorded.keys()].filter((name) => name.startsWith("history/")).map((name) => Number(basename(name, ".json")))), "a refused target records no event");
  assert.strictEqual(status(store, null, at(2)).activeAttempt?.attempt, "apply-1", "a refusal leaves the attempt to be held or stopped");
  holdProposal(store, { attempt: "apply-1", proposal: ids[0], revision: 1 }, at(2));
  assert.deepStrictEqual(manifest(runbook), untouched);
  assert.deepStrictEqual(manifest(outside), outsideBefore, "nothing outside the runbook changed");

  const escape = reviewed(fx, "escape.md", "# Escaped\n", 3);
  accept(store, escape, 1, at(4));
  const proposalEvent = readEvent(store, Number(escape.slice(1)));
  const file = join(store.dir, "history", proposalEvent.at.slice(0, 10), `${String(proposalEvent.seq).padStart(12, "0")}.json`);
  writeFileSync(file, readFileSync(file, "utf8").replace("\"target\":\"escape.md\"", "\"target\":\"../escape.md\""));
  start(store, "apply-2", at(4), OWNER, "apply");
  assertExit(2, () => applyProposal(store, { attempt: "apply-2", proposal: escape, revision: 1 }, at(4)), /malformed committed event .*target must be a normalized runbook-relative path/);
  assert.ok(!existsSync(join(home, "Notes", "escape.md")) && !existsSync(join(runbook, "escape.md")), "an escaping target is never written");
});

test("an apply interrupted before replacement leaves its intent and re-applies once", () => {
  const fx = seeded("apply-before", { "access/staging.md": STAGING_V1, "other.md": "# Other\n" });
  const { runbook, store } = fx;
  const target = join(runbook, "access", "staging.md");
  const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
  accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  const untouched = manifest(runbook);
  const inode = statSync(target).ino;
  const prior = digests(store);
  assert.throws(() => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), { beforeReplace: () => { throw new Error("crash before replace"); } }), /crash before replace/);
  assert.deepStrictEqual(manifest(runbook), untouched, "the target and its directory are untouched, with no temporary file left");
  assert.strictEqual(statSync(target).ino, inode);
  assertKept(prior, store);
  const interrupted = status(store, null, at(2));
  const intent = readEvent(store, interrupted.lastSeq);
  assert.ok(intent.type === "apply-intent");
  if (intent.type !== "apply-intent") return;
  assert.deepStrictEqual(intent.payload, { attempt: "apply-1", proposal: id, revision: 1, target: "access/staging.md", before: sha(STAGING_V1), after: sha(STAGING_V2) });
  assert.deepStrictEqual(pointer(store, id, at(2))?.apply, { state: "intent", attempt: "apply-1", seq: intent.seq });
  assert.strictEqual(interrupted.activeAttempt?.attempt, "apply-1");

  assertExit(1, () => append(store, "proposal", { ...proposal("apply-1", "revise"), target: "access/staging.md", proposal: id }, at(2)), /unsettled apply intent at seq \d+; settle it with apply first/);
  assertExit(1, () => append(store, "decision", { proposal: id, revision: 1, decision: "rejected", source: "user" }, at(2)), /unsettled apply intent/);
  assertExit(1, () => holdProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2)), /unsettled apply intent/);

  const settled = applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(3));
  assert.ok(settled.type === "apply-result" && settled.payload.outcome === "applied" && !settled.payload.recovered);
  assert.strictEqual(readFileSync(target, "utf8"), STAGING_V2);
  assert.deepStrictEqual(changedPaths(untouched, manifest(runbook)), ["access/staging.md"]);
  const rewritten = statSync(target).ino;
  assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(3)), /no attempt is active/);
  assert.strictEqual(statSync(target).ino, rewritten, "the update was written once");
  assert.deepStrictEqual(history(store, { after: 0, type: null, proposal: id }).events.map((event) => event.type), ["proposal", "decision", "apply-intent", "apply-intent", "apply-result"]);
});

test("an apply interrupted after replacement settles as applied without rewriting", () => {
  const fx = seeded("apply-after", { "access/staging.md": STAGING_V1, "personal/library.md": "# Library\n" });
  const { runbook, store, sibling } = fx;
  const target = join(runbook, "access", "staging.md");
  const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
  accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  const untouched = manifest(runbook);
  assert.throws(() => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), { afterReplace: () => { throw new Error("crash after replace"); } }), /crash after replace/);
  assert.strictEqual(readFileSync(target, "utf8"), STAGING_V2);
  const replaced = lstatSync(target);
  const written = manifest(runbook);
  assert.deepStrictEqual(changedPaths(untouched, written), ["access/staging.md"]);
  assert.strictEqual(pointer(store, id, at(2))?.apply?.state, "intent");
  append(store, "attempt-stopped", { attempt: "apply-1", reason: "interrupted" }, at(3));
  assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(3)), /no attempt is active/);

  start(store, "apply-2", at(4), OWNER, "apply");
  const prior = digests(store);
  const settled = applyProposal(store, { attempt: "apply-2", proposal: id, revision: 1 }, at(4));
  assert.ok(settled.type === "apply-result");
  if (settled.type !== "apply-result") return;
  assert.deepStrictEqual(settled.payload, { attempt: "apply-2", proposal: id, revision: 1, target: "access/staging.md", outcome: "applied", observed: sha(STAGING_V2), recovered: true });
  const kept = lstatSync(target);
  assert.deepStrictEqual([kept.ino, kept.mtimeMs, kept.size], [replaced.ino, replaced.mtimeMs, replaced.size], "settlement rewrites nothing");
  assert.deepStrictEqual(manifest(runbook), written);
  assert.ok(readFileSync(sibling, "utf8").startsWith("# Outside"));
  assertKept(prior, store);
  assert.strictEqual(pointer(store, id, at(4)), undefined, "the settled proposal leaves the pending list");

  const second = reviewed(fx, "personal/library.md", "# Library\n\nRenew every 24 months.\n", 5);
  accept(store, second, 1, at(6));
  start(store, "apply-3", at(6), OWNER, "apply");
  assert.throws(() => applyProposal(store, { attempt: "apply-3", proposal: second, revision: 1 }, at(6), { afterReplace: () => { throw new Error("crash after replace"); } }));
  append(store, "attempt-stopped", { attempt: "apply-3", reason: "interrupted" }, at(7));
  writeFileSync(join(runbook, "personal", "library.md"), "# Library\n\nThe user edited it again.\n");
  start(store, "apply-4", at(7), OWNER, "apply");
  assertExit(1, () => applyProposal(store, { attempt: "apply-4", proposal: second, revision: 1 }, at(7)), /conflict recorded/);
  assert.strictEqual(readFileSync(join(runbook, "personal", "library.md"), "utf8"), "# Library\n\nThe user edited it again.\n", "a third state is a conflict, never rolled back or overwritten");
  assert.strictEqual(pointer(store, second, at(7))?.apply?.state, "conflict");
});

test("a target changed after its replacement records a conflict that says the accepted body was written", () => {
  const fx = seeded("apply-overwritten", { "access/staging.md": STAGING_V1 });
  const { runbook, store } = fx;
  const target = join(runbook, "access", "staging.md");
  const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
  accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  const other = "# Staging\n\nThe user saved over the replacement.\n";
  const overwrite = { afterReplace: () => writeFileSync(target, other) };
  assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), overwrite), new RegExp(`^(?!.*nothing was written)apply conflict recorded at seq \\d+: access/staging\\.md was replaced with the accepted body \\(sha256 ${sha(STAGING_V2)}\\) and then read as sha256 ${sha(other)}; only a new revision can proceed\\.$`));
  assert.strictEqual(pointer(store, id, at(2))?.apply?.state, "conflict");
  assert.strictEqual(readFileSync(target, "utf8"), other, "the other bytes stay in place");
});

test("an apply creates a new entry and its missing directories and leaves no temporary file", () => {
  const fx = seeded("apply-new-file", { "README.md": "# Runbook\n" });
  const { runbook, store } = fx;
  const body = "# Deep entry\n\nRenew the access token every 90 days.\n";
  const id = reviewed(fx, "new/deep/entry.md", body, 0);
  accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  const untouched = manifest(runbook);
  assert.ok(!untouched.has("new"), "the target's directories start absent");
  const applied = applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2));
  assert.ok(applied.type === "apply-result");
  if (applied.type !== "apply-result") return;
  assert.deepStrictEqual(applied.payload, { attempt: "apply-1", proposal: id, revision: 1, target: "new/deep/entry.md", outcome: "applied", observed: sha(body), recovered: false });
  const written = manifest(runbook);
  assert.deepStrictEqual(changedPaths(untouched, written), ["new", "new/deep", "new/deep/entry.md"]);
  assert.strictEqual(readFileSync(join(runbook, "new", "deep", "entry.md"), "utf8"), body);
  assert.ok([...written.keys()].every((name) => !basename(name).startsWith(".secretary-apply-")), "no temporary file remains");
  assert.strictEqual(pointer(store, id, at(3)), undefined, "the applied proposal leaves the pending list");
});

test("a new entry that appears just before the link records a conflict and keeps the other bytes", () => {
  const fx = seeded("apply-link-race", { "access/staging.md": STAGING_V1 });
  const { runbook, store } = fx;
  const target = join(runbook, "access", "new-entry.md");
  const id = reviewed(fx, "access/new-entry.md", "# New entry\n", 0);
  accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  const untouched = manifest(runbook);
  const lastSeq = status(store, null, at(2)).lastSeq;
  const racing = "# New entry\n\nThe user saved this first.\n";
  const race = { beforeReplace: () => writeFileSync(target, racing, { flag: "wx" }) };
  assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), race), /conflict recorded/);
  const recorded = history(store, { after: lastSeq, type: null, proposal: null }).events;
  assert.deepStrictEqual(recorded.map((event) => event.type), ["apply-intent", "apply-result"], "the conflict comes from the link, after the intent");
  const result = recorded[1];
  assert.ok(result.type === "apply-result");
  if (result.type !== "apply-result") return;
  assert.deepStrictEqual([result.payload.outcome, result.payload.observed], ["conflict", sha(racing)]);
  assert.strictEqual(pointer(store, id, at(2))?.apply?.state, "conflict");
  assert.strictEqual(readFileSync(target, "utf8"), racing, "the link never replaces the other bytes");
  assert.deepStrictEqual(changedPaths(untouched, manifest(runbook)), ["access/new-entry.md"], "only the racing file appears, with no temporary file left");
});

test("a write error after the accepted body landed records applied and returns that result", () => {
  const fx = seeded("apply-error-after", { "access/staging.md": STAGING_V1 });
  const { runbook, store } = fx;
  const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
  accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  const failing = { afterReplace: () => { throw Object.assign(new Error("EIO: i/o error, read"), { code: "EIO" }); } };
  const result = applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), failing);
  assert.ok(result.type === "apply-result");
  if (result.type !== "apply-result") return;
  assert.deepStrictEqual([result.payload.outcome, result.payload.observed, result.payload.recovered], ["applied", sha(STAGING_V2), false]);
  assert.strictEqual(readFileSync(join(runbook, "access", "staging.md"), "utf8"), STAGING_V2);
  assert.strictEqual(pointer(store, id, at(2)), undefined);
  const contract = readFileSync(join(resolve(TESTS_DIR, ".."), "references", "scripts", "secretary-state.md"), "utf8");
  assert.match(contract, /An `applied` result prints `\{event\}` and exits 0\. A `held` or `conflict` result exits 1 naming the failure and the recorded seq/);
});

test("an apply whose temporary write fails leaves no partial file in the runbook", () => {
  const fx = seeded("apply-partial", { "access/staging.md": STAGING_V1 });
  const { home, runbook, store } = fx;
  const id = reviewed(fx, "access/staging.md", `${STAGING_V2}${"x".repeat(4096)}\n`, 0);
  accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  const untouched = manifest(runbook);
  const limited = spawnSync("/bin/sh", ["-c", 'ulimit -f 2; exec "$0" "$@"', process.execPath, SCRIPT, "apply", "--attempt", "apply-1", "--proposal", id, "--revision", "1"], {
    encoding: "utf8",
    env: { ...process.env, HOME: home },
  });
  assert.strictEqual(limited.status, 1, limited.stderr);
  assert.match(limited.stderr, /EFBIG[^\n]*recorded held/);
  assert.deepStrictEqual(manifest(runbook), untouched, "the failed write leaves no temporary file");
  assert.strictEqual(pointer(store, id, at(2))?.apply?.state, "held");
});

test("an apply removes temporary files a crashed apply left beside its target", () => {
  const fx = seeded("apply-sweep", { "access/staging.md": STAGING_V1 });
  const { runbook, store } = fx;
  const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
  accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  const orphan = join(runbook, "access", ".secretary-apply-4242-0f8fad5b-d9cb-469f-a165-70867728950e.tmp");
  const unrelated = join(runbook, "access", ".secretary-apply-notes.tmp");
  writeFileSync(orphan, STAGING_V2);
  writeFileSync(unrelated, "# Kept\n");
  const before = manifest(runbook);
  const result = applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2));
  assert.ok(result.type === "apply-result" && result.payload.outcome === "applied");
  assert.strictEqual(readFileSync(join(runbook, "access", "staging.md"), "utf8"), STAGING_V2);
  assert.ok(!existsSync(orphan), "the orphaned temporary file is removed");
  assert.strictEqual(readFileSync(unrelated, "utf8"), "# Kept\n", "a name outside the helper's temporary pattern stays");
  assert.deepStrictEqual(changedPaths(before, manifest(runbook)), [relative(runbook, orphan), "access/staging.md"]);
});

for (const alias of [false, true]) {
  for (const held of [false, true]) {
    test(`temporary sweep preserves the selected target when apply is ${held ? "held" : "successful"}${alias ? " through a case alias" : ""}`, (t) => {
      const name = ".secretary-apply-4242-0f8fad5b-d9cb-469f-a165-70867728950e.tmp";
      const fx = seeded(`apply-sweep-target-${alias}-${held}`, { [`access/${name}`]: STAGING_V1 });
      const { home, runbook, store, sibling } = fx;
      const label = `access/${alias ? name.toUpperCase() : name}`;
      const target = join(runbook, label);
      if (alias && !existsSync(target)) {
        t.skip("the fixture filesystem distinguishes filename case");
        return;
      }
      const original = readFileSync(target);
      const siblingBytes = readFileSync(sibling);
      const id = reviewed(fx, label, STAGING_V2, 0);
      accept(store, id, 1, at(1));
      start(store, "apply-1", at(2), OWNER, "apply");
      if (held) {
        const untouched = manifest(runbook);
        const denied = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
        assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), {
          beforeReplace: () => { throw denied; },
        }), /EACCES: permission denied; recorded held/);
        assert.ok(readFileSync(target).equals(original), "the failed apply preserves the original target bytes");
        assert.deepStrictEqual(manifest(runbook), untouched, "no target or temporary file changes remain");
        assert.deepStrictEqual([pointer(store, id, at(2))?.decision, pointer(store, id, at(2))?.apply?.state], ["accepted", "held"]);
      } else {
        const result = report(home, ["apply", "--attempt", "apply-1", "--proposal", id, "--revision", "1"]).event as SecretaryEvent;
        assert.ok(result.type === "apply-result" && result.payload.outcome === "applied");
        assert.strictEqual(readFileSync(target, "utf8"), STAGING_V2);
        assert.strictEqual(pointer(store, id, at(2)), undefined);
      }
      assert.ok(readFileSync(sibling).equals(siblingBytes), "a file beside the runbook is untouched");
    });
  }
}

test("a held apply removes the directories it created for a new entry and keeps every other one", () => {
  const fx = seeded("apply-held-dirs", { "README.md": "# Runbook\n" });
  const { runbook, store } = fx;
  mkdirSync(join(runbook, "kept"));
  const noSpace = Object.assign(new Error("ENOSPC: no space left on device"), { code: "ENOSPC" });
  for (const [step, target] of [[0, "new/deep/entry.md"], [3, "kept/fresh/entry.md"]] as const) {
    const id = reviewed(fx, target, "# Entry\n\nRenew yearly.\n", step);
    accept(store, id, 1, at(step + 1));
    start(store, `apply-${step}`, at(step + 2), OWNER, "apply");
    const untouched = manifest(runbook);
    assertExit(1, () => applyProposal(store, { attempt: `apply-${step}`, proposal: id, revision: 1 }, at(step + 2), { beforeReplace: () => { throw noSpace; } }), /ENOSPC: no space left on device; recorded held/);
    assert.deepStrictEqual(manifest(runbook), untouched, `${target}: no created directory or temporary file remains, and the existing empty directory stays`);
    assert.strictEqual(pointer(store, id, at(step + 2))?.apply?.state, "held");
  }
});

test("a held or conflicting apply keeps a created directory that another writer filled or replaced", () => {
  const fx = seeded("apply-kept-dirs", { "README.md": "# Runbook\n" });
  const { home, runbook, store } = fx;
  const racing = "# Entry\n\nThe user saved this first.\n";
  const id = reviewed(fx, "new/deep/entry.md", "# Entry\n", 0);
  accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  const untouched = manifest(runbook);
  const race = { beforeReplace: () => writeFileSync(join(runbook, "new", "deep", "entry.md"), racing, { flag: "wx" }) };
  assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), race), /conflict recorded/);
  assert.deepStrictEqual(changedPaths(untouched, manifest(runbook)), ["new", "new/deep", "new/deep/entry.md"], "the directories holding the racing file stay");

  const second = reviewed(fx, "swapped/deep/entry.md", "# Entry\n", 3);
  accept(store, second, 1, at(4));
  start(store, "apply-2", at(5), OWNER, "apply");
  const outside = join(home, "outside");
  const swap = {
    beforeReplace: () => {
      renameSync(join(runbook, "swapped"), join(home, "moved"));
      mkdirSync(join(outside, "deep"), { recursive: true });
      symlinkSync(outside, join(runbook, "swapped"));
      throw Object.assign(new Error("ENOSPC: no space left on device"), { code: "ENOSPC" });
    },
  };
  assertExit(1, () => applyProposal(store, { attempt: "apply-2", proposal: second, revision: 1 }, at(5), swap), /recorded conflict/);
  assert.ok(statSync(join(outside, "deep")).isDirectory(), "an empty directory reached through a swapped link stays");
  assert.ok(lstatSync(join(runbook, "swapped")).isSymbolicLink(), "the link that replaced a created directory stays");
});

for (const existing of [true, false]) {
  for (const symlink of [true, false]) {
    test(`a successful write records conflict for a swapped ${existing ? "existing" : "newly created"} parent replaced by a ${symlink ? "symlink" : "directory"} holding the accepted body`, () => {
      const fx = seeded(`apply-after-swapped-${existing}-${symlink}`, existing ? { "access/staging.md": STAGING_V1 } : { "README.md": "# Runbook\n" });
      const { home, runbook, store } = fx;
      const parent = join(runbook, "access");
      const moved = join(home, "moved");
      const outside = join(home, "outside");
      mkdirSync(outside);
      writeFileSync(join(outside, "staging.md"), STAGING_V2);
      const outsideBefore = manifest(outside);
      const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
      accept(store, id, 1, at(1));
      start(store, "apply-1", at(2), OWNER, "apply");
      const lastSeq = status(store, null, at(2)).lastSeq;
      const swap = {
        afterReplace: () => {
          assert.strictEqual(readFileSync(join(parent, "staging.md"), "utf8"), STAGING_V2);
          renameSync(parent, moved);
          if (symlink) symlinkSync(outside, parent);
          else renameSync(outside, parent);
        },
      };
      assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), swap), /^(?!.*the target was not replaced).*directory .* changed during apply.*recorded conflict/);
      const events = history(store, { after: lastSeq, type: null, proposal: null }).events;
      assert.deepStrictEqual(events.map((event) => event.type), ["apply-intent", "apply-result"]);
      const result = events[1];
      assert.ok(result.type === "apply-result");
      if (result.type !== "apply-result") return;
      assert.deepStrictEqual([result.payload.outcome, result.payload.observed, result.payload.recovered], ["conflict", null, false]);
      const settled = status(store, null, at(2));
      const pending = settled.pending.find((entry) => entry.proposal === id);
      assert.deepStrictEqual([pending?.decision, pending?.apply?.state, settled.activeAttempt], ["accepted", "conflict", null]);
      assert.deepStrictEqual(manifest(symlink ? outside : parent), outsideBefore, "the replacement parent's accepted body is untouched");
      assert.strictEqual(readFileSync(join(moved, "staging.md"), "utf8"), STAGING_V2, "the completed replacement stays in its original directory");
    });

    test(`a failed apply records conflict for a swapped ${existing ? "existing" : "newly created"} parent replaced by a ${symlink ? "symlink" : "directory"} holding the accepted body`, () => {
      const fx = seeded(`apply-swapped-${existing}-${symlink}`, existing ? { "access/staging.md": STAGING_V1 } : { "README.md": "# Runbook\n" });
      const { home, runbook, store } = fx;
      const parent = join(runbook, "access");
      const moved = join(home, "moved");
      const outside = join(home, "outside");
      mkdirSync(outside);
      writeFileSync(join(outside, "staging.md"), STAGING_V2);
      const outsideBefore = manifest(outside);
      const original = existing ? statSync(join(parent, "staging.md")) : null;
      const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
      accept(store, id, 1, at(1));
      start(store, "apply-1", at(2), OWNER, "apply");
      const lastSeq = status(store, null, at(2)).lastSeq;
      const swap = {
        beforeReplace: () => {
          renameSync(parent, moved);
          if (symlink) symlinkSync(outside, parent);
          else renameSync(outside, parent);
        },
      };
      assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), swap), /directory .* changed during apply.*recorded conflict/);
      const events = history(store, { after: lastSeq, type: null, proposal: null }).events;
      assert.deepStrictEqual(events.map((event) => event.type), ["apply-intent", "apply-result"]);
      const result = events[1];
      assert.ok(result.type === "apply-result");
      if (result.type !== "apply-result") return;
      assert.deepStrictEqual([result.payload.outcome, result.payload.observed], ["conflict", null]);
      const settled = status(store, null, at(2));
      const pending = settled.pending.find((entry) => entry.proposal === id);
      assert.deepStrictEqual([pending?.decision, pending?.apply?.state, settled.activeAttempt], ["accepted", "conflict", null]);
      assert.deepStrictEqual(manifest(symlink ? outside : parent), outsideBefore, "the replacement parent's accepted body is untouched");
      if (original !== null) {
        const kept = statSync(join(moved, "staging.md"));
        assert.deepStrictEqual([kept.ino, kept.mtimeMs, kept.size], [original.ino, original.mtimeMs, original.size]);
        assert.strictEqual(readFileSync(join(moved, "staging.md"), "utf8"), STAGING_V1, "the original target is untouched");
      } else assert.ok(!existsSync(join(moved, "staging.md")), "the new target was never created");
    });
  }
}

test("apply never writes into the kit's records or configuration inside the runbook", () => {
  const home = join(TEST_ROOT, "apply-home");
  rmSync(home, { recursive: true, force: true });
  mkdirSync(home, { recursive: true });
  configure(home, JSON.stringify({ runbookRoot: "~/" }));
  const store = openStore(home);
  assert.strictEqual(store.runbook, realpathSync(home));
  start(store, "r1", at(0));
  const first = relative(home, join(store.dir, "history", at(0).toISOString().slice(0, 10), "000000000001.json"));
  const config = join(".config", "agents-kit", "config.json");
  const ids = [first, config].map((path) => {
    const event = append(store, "proposal", { ...proposal("r1", `Update ${path}`, "# Replaced\n"), target: path, before: sha(readFileSync(join(home, path))) }, at(0));
    return event.type === "proposal" ? event.payload.proposal : "";
  });
  complete(store, "r1", at(0));
  for (const id of ids) accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  const recorded = digests(store);
  const settings = readFileSync(join(home, config), "utf8");
  for (const id of ids) {
    assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2)), /lies inside .*agents-kit, which holds agents-kit records or configuration/);
  }
  assertKept(recorded, store);
  assert.strictEqual(readFileSync(join(home, config), "utf8"), settings);
});

test("apply never writes into a runbook that lies inside the kit's records or configuration", () => {
  const firstEvent = (store: Store): string => relative(store.runbook, join(store.dir, "history", at(0).toISOString().slice(0, 10), "000000000001.json"));
  const cases = [
    { name: "apply-in-state", runbookRoot: "~/.local/state/agents-kit/secretary", targets: (store: Store) => ["entry.md", firstEvent(store)], inside: /lies inside .*\/\.local\/state\/agents-kit, which holds agents-kit records or configuration; apply never writes there\./ },
    { name: "apply-in-config", runbookRoot: "~/.config/agents-kit/runbook", targets: () => ["entry.md"], inside: /lies inside .*\/\.config\/agents-kit, which holds agents-kit records or configuration; apply never writes there\./ },
  ];
  for (const { name, runbookRoot, targets, inside } of cases) {
    const home = join(TEST_ROOT, name);
    rmSync(home, { recursive: true, force: true });
    mkdirSync(join(home, runbookRoot.slice(2)), { recursive: true });
    writeFileSync(join(home, runbookRoot.slice(2), "entry.md"), "# Entry\n");
    configure(home, JSON.stringify({ runbookRoot }));
    const store = openStore(home);
    start(store, "r1", at(0));
    const ids = targets(store).map((path) => {
      const event = append(store, "proposal", { ...proposal("r1", `Update ${path}`, "# Replaced\n"), target: path, before: sha(readFileSync(join(store.runbook, path))) }, at(0));
      return event.type === "proposal" ? event.payload.proposal : "";
    });
    complete(store, "r1", at(0));
    for (const id of ids) accept(store, id, 1, at(1));
    start(store, "apply-1", at(2), OWNER, "apply");
    const recorded = digests(store);
    const untouched = manifest(store.runbook);
    for (const id of ids) {
      assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2)), inside);
    }
    assertKept(recorded, store);
    assert.deepStrictEqual(manifest(store.runbook), untouched, `${name}: a refused apply changes nothing inside the runbook`);
    const lastSeq = status(store, null, at(2)).lastSeq;
    assert.strictEqual(history(store, { after: 0, type: null, proposal: null }).events.length, lastSeq, `${name}: every committed event still reads`);
  }
});

test("a write that fails after its intent settles at once and leaves the proposal decidable", () => {
  const fx = seeded("apply-fails", { "access/staging.md": STAGING_V1, "locked/entry.md": "# Entry\n" });
  const { runbook, store } = fx;
  const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
  accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  const untouched = manifest(runbook);
  const denied = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
  assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), { beforeReplace: () => { throw denied; } }), /failed after its intent at seq \d+: EACCES: permission denied; recorded held at seq \d+, and p\d+@1 stays accepted/);
  assert.deepStrictEqual(manifest(runbook), untouched, "the failed write leaves the runbook and no temporary file");
  assert.deepStrictEqual([pointer(store, id, at(2))?.decision, pointer(store, id, at(2))?.apply?.state], ["accepted", "held"]);
  assert.strictEqual(status(store, null, at(2)).activeAttempt, null, "the recorded result ends the apply job");
  start(store, "apply-2", at(3), OWNER, "apply");
  const applied = applyProposal(store, { attempt: "apply-2", proposal: id, revision: 1 }, at(3));
  assert.ok(applied.type === "apply-result" && applied.payload.outcome === "applied" && !applied.payload.recovered);
  assert.strictEqual(readFileSync(join(runbook, "access", "staging.md"), "utf8"), STAGING_V2);

  if (process.getuid?.() === 0) return;
  const second = reviewed(fx, "locked/entry.md", "# Entry\n\nRenew yearly.\n", 4);
  accept(store, second, 1, at(5));
  start(store, "apply-3", at(5), OWNER, "apply");
  const locked = join(runbook, "locked");
  chmodSync(locked, 0o555);
  try {
    assertExit(1, () => applyProposal(store, { attempt: "apply-3", proposal: second, revision: 1 }, at(5)), /failed after its intent at seq \d+: EACCES.*; recorded held/);
  } finally {
    chmodSync(locked, 0o755);
  }
  assert.strictEqual(readFileSync(join(locked, "entry.md"), "utf8"), "# Entry\n");
  assert.ok(readdirSync(locked).every((name) => !name.startsWith(".secretary-apply-")));
  append(store, "decision", { proposal: second, revision: 1, decision: "rejected", source: "user" }, at(6));
  assert.strictEqual(pointer(store, second, at(6)), undefined, "a settled failure admits the user's next decision");
});

test("settling an interrupted write against a target that is no longer a regular file records a conflict", () => {
  const fx = seeded("apply-settle-unsafe", { "access/staging.md": STAGING_V1 });
  const { runbook, store } = fx;
  const target = join(runbook, "access", "staging.md");
  const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
  accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  assert.throws(() => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), { beforeReplace: () => { throw new Error("crash before replace"); } }), /crash before replace/);
  append(store, "attempt-stopped", { attempt: "apply-1", reason: "interrupted" }, at(3));
  rmSync(target);
  mkdirSync(target);
  start(store, "apply-2", at(4), OWNER, "apply");
  assertExit(1, () => applyProposal(store, { attempt: "apply-2", proposal: id, revision: 1 }, at(4)), /conflict recorded at seq \d+ while settling the interrupted write: target access\/staging\.md is not a regular file\. Only a new revision can proceed\./);
  assert.strictEqual(pointer(store, id, at(4))?.apply?.state, "conflict");
  assert.ok(statSync(target).isDirectory(), "settlement writes nothing");
  append(store, "decision", { proposal: id, revision: 1, decision: "rejected", source: "user" }, at(5));
  assert.strictEqual(pointer(store, id, at(5)), undefined);
});

interface Rich extends Seeded {
  readonly ids: Readonly<Record<string, string>>;
  readonly early: string;
}

function richHistory(name: string, fillers: number): Rich {
  const keys = ["a", "b", "c", "d", "e", "f", "g"];
  const fx = seeded(name, Object.fromEntries(keys.map((key) => [`${key}.md`, `# ${key.toUpperCase()}\n`])));
  const { runbook, store } = fx;
  start(store, "r1", at(0));
  const ids: Record<string, string> = {};
  for (const key of keys) ids[key] = propose(fx, "r1", `${key}.md`, `# ${key.toUpperCase()} revised\n`, at(0));
  complete(store, "r1", at(1));
  const early = join(TEST_ROOT, `${name}-early-state.json`);
  copyFileSync(join(store.dir, "state.json"), early);
  accept(store, ids.b, 1, at(2));
  append(store, "decision", { proposal: ids.c, revision: 1, decision: "deferred", source: "user message: \"later\"" }, at(2));
  accept(store, ids.d, 1, at(2));
  accept(store, ids.e, 1, at(2));
  append(store, "decision", { proposal: ids.f, revision: 1, decision: "rejected", source: "user message: \"no\"" }, at(2));
  accept(store, ids.g, 1, at(2));
  start(store, "x1", at(3), OWNER, "apply");
  applyProposal(store, { attempt: "x1", proposal: ids.g, revision: 1 }, at(3));
  start(store, "x2", at(4), OWNER, "apply");
  assert.throws(() => applyProposal(store, { attempt: "x2", proposal: ids.b, revision: 1 }, at(4), { afterReplace: () => { throw new Error("crash after replace"); } }));
  append(store, "attempt-stopped", { attempt: "x2", reason: "interrupted" }, at(5));
  writeFileSync(join(runbook, "d.md"), "# D edited by the user\n");
  start(store, "x3", at(5), OWNER, "apply");
  assertExit(1, () => applyProposal(store, { attempt: "x3", proposal: ids.d, revision: 1 }, at(5)), /conflict recorded/);
  start(store, "x4", at(6), OWNER, "apply");
  holdProposal(store, { attempt: "x4", proposal: ids.e, revision: 1 }, at(6));
  start(store, "r2", at(8));
  for (let index = 0; index < fillers; index++) append(store, "correction", { attempt: "r2", corrects: 1 + (index % 7), note: `filler ${index}` }, at(8));
  return { ...fx, ids, early };
}

function checkpointOf(store: Store): unknown {
  return JSON.parse(readFileSync(join(store.dir, "state.json"), "utf8"));
}

function recoverAll(store: Store, batch: number): RecoveryReport[] {
  const pages: RecoveryReport[] = [];
  for (;;) {
    const page = recover(store, batch);
    assert.ok(pageBytes(page) <= OUTPUT_MAX_BYTES);
    const previous = pages.at(-1)?.processedSeq ?? -1;
    assert.ok(page.processedSeq > previous || page.complete, "each recover call advances or completes");
    pages.push(page);
    if (page.complete) return pages;
    assert.strictEqual(page.ready, false, "an incomplete recovery is never ready");
  }
}

function assertBlocked(fx: Rich, reason: string): void {
  const { store, ids } = fx;
  const pattern = new RegExp(`not ready \\(${reason}\\)`);
  const current = status(store, null, at(9));
  assert.deepStrictEqual([current.ready, current.reason, current.review, current.pending], [false, reason, null, []]);
  assertExit(1, () => start(store, "r3", at(9)), pattern);
  assertExit(1, () => append(store, "attempt-stopped", { attempt: "r2", reason: "stopped" }, at(9)), pattern);
  assertExit(1, () => applyProposal(store, { attempt: "r2", proposal: ids.b, revision: 1 }, at(9)), pattern);
  assertExit(1, () => holdProposal(store, { attempt: "r2", proposal: ids.e, revision: 1 }, at(9)), pattern);
}

test("a deleted checkpoint recovers in bounded pages to the uninterrupted reduction", () => {
  const fx = richHistory("recover-missing", 230);
  const { runbook, store, ids } = fx;
  const expected = checkpointOf(store);
  const recorded = digests(store);
  const untouched = manifest(runbook);
  const lastSeq = status(store, null, at(9)).lastSeq;
  const progress = join(store.dir, "recovery.json");

  unlinkSync(join(store.dir, "state.json"));
  assertBlocked(fx, "missing-checkpoint");
  const first = recover(store, 100);
  assert.deepStrictEqual(first, { ready: false, reason: "missing-checkpoint", processedSeq: 100, lastSeq, complete: false });
  assert.ok(existsSync(progress) && !existsSync(join(store.dir, "state.json")), "progress is saved apart from the checkpoint");
  assertBlocked(fx, "missing-checkpoint");

  const reopened = openStore(fx.home);
  const rest = recoverAll(reopened, 100);
  assert.deepStrictEqual(rest.map((page) => page.processedSeq), [200, lastSeq]);
  assert.deepStrictEqual(rest.at(-1), { ready: true, reason: null, processedSeq: lastSeq, lastSeq, complete: true });
  assert.deepStrictEqual(checkpointOf(store), expected, "the resumed reduction equals the uninterrupted one");
  assert.ok(!existsSync(progress), "a completed recovery leaves no progress file");
  assert.deepStrictEqual(digests(store), recorded, "recovery modifies, adds, and deletes no history or body file");
  assert.deepStrictEqual(manifest(runbook), untouched, "recovery writes no runbook byte");

  const ready = status(store, null, at(9));
  assert.strictEqual(ready.ready, true);
  assert.deepStrictEqual(ready.activeAttempt?.attempt, "r2");
  assert.deepStrictEqual(ready.lastReview?.attempt, "r1");
  assert.deepStrictEqual(
    ready.pending.map((entry) => [entry.proposal, entry.decision, entry.apply?.state ?? null]),
    [[ids.a, null, null], [ids.b, "accepted", "intent"], [ids.c, "deferred", null], [ids.d, "accepted", "conflict"], [ids.e, "accepted", "held"]],
  );
  assert.deepStrictEqual(recover(store, 100), { ready: true, reason: null, processedSeq: lastSeq, lastSeq, complete: true }, "a ready store recovers nothing");
});

test("a rewound checkpoint resumes from its position, and an ahead or malformed one rebuilds from the start", () => {
  const fx = richHistory("recover-stale", 150);
  const { store } = fx;
  const expected = checkpointOf(store);
  const recorded = digests(store);
  const lastSeq = status(store, null, at(9)).lastSeq;
  const checkpoint = join(store.dir, "state.json");
  const rewoundSeq = JSON.parse(readFileSync(fx.early, "utf8")).processed.seq;

  copyFileSync(fx.early, checkpoint);
  assertBlocked(fx, "checkpoint-behind");
  const resumed = recoverAll(store, 64);
  assert.strictEqual(resumed[0].processedSeq, rewoundSeq + 64, "a behind checkpoint resumes from its processed position");
  assert.deepStrictEqual(checkpointOf(store), expected);

  writeFileSync(checkpoint, JSON.stringify({ ...(expected as Record<string, unknown>), processed: { seq: lastSeq + 50 } }));
  writeFileSync(join(store.dir, "recovery.json"), JSON.stringify({ ...(expected as Record<string, unknown>), processed: { seq: lastSeq + 9 } }));
  assertBlocked(fx, "checkpoint-ahead");
  const rebuilt = recoverAll(store, 64);
  assert.strictEqual(rebuilt[0].processedSeq, 64, "an ahead checkpoint and an ahead progress file are untrusted; replay starts at seq 1");
  assert.deepStrictEqual(checkpointOf(store), expected);

  writeFileSync(checkpoint, "{\"runbook\":");
  assert.strictEqual(report(fx.home, ["status"]).reason, "checkpoint-malformed");
  assertBlocked(fx, "checkpoint-malformed");
  assert.strictEqual(recoverAll(store, 64)[0].processedSeq, 64);
  assert.deepStrictEqual(checkpointOf(store), expected);
  assert.deepStrictEqual(digests(store), recorded);
});

test("a checkpoint holding an impossible instant reads as malformed and rebuilds from history", () => {
  const fx = richHistory("recover-instant", 10);
  const { home, store } = fx;
  const expected = checkpointOf(store) as { lastReview: Record<string, unknown>; activeAttempt: Record<string, unknown> };
  const recorded = digests(store);
  const lastSeq = status(store, null, at(9)).lastSeq;
  const checkpoint = join(store.dir, "state.json");

  for (const corrupted of [
    { ...expected, lastReview: { ...expected.lastReview, at: "2026-99-99T00:00:00.000Z" } },
    { ...expected, activeAttempt: { ...expected.activeAttempt, at: "2026-02-30T00:00:00.000Z" } },
  ]) {
    writeFileSync(checkpoint, JSON.stringify(corrupted));
    const malformed = report(home, ["status"]);
    assert.deepStrictEqual([malformed.ready, malformed.reason, malformed.review], [false, "checkpoint-malformed", null]);
    assertBlocked(fx, "checkpoint-malformed");
    assert.deepStrictEqual(report(home, ["recover"]), { ready: true, reason: null, processedSeq: lastSeq, lastSeq, complete: true });
    assert.deepStrictEqual(checkpointOf(store), expected, "recovery replaces the impossible instant with the recorded one");
    const ready = report(home, ["status"]);
    assert.deepStrictEqual([ready.ready, ready.lastReview, ready.activeAttempt], [true, expected.lastReview, expected.activeAttempt]);
  }
  assert.deepStrictEqual(digests(store), recorded);
});

test("an impossible committed event timestamp stops recovery with its location", () => {
  const { home } = fixture("recover-event-timestamp");
  const store = openStore(home);
  start(store, "r1", at(0));
  const completed = complete(store, "r1", at(1));
  const located = files(store.dir).find((name) => name.endsWith(`/${String(completed.seq).padStart(12, "0")}.json`));
  assert.ok(located !== undefined);
  const file = join(store.dir, located);
  writeFileSync(file, JSON.stringify({ ...completed, at: "2026-99-99T12:00:00.000Z" }));
  const recorded = digests(store);
  const checkpoint = join(store.dir, "state.json");
  unlinkSync(checkpoint);

  const refused = runExpect(2, home, ["recover"]);
  assert.ok(refused.stderr.includes(file), refused.stderr);
  assert.match(refused.stderr, /malformed committed event .*at must be an ISO UTC instant/);
  assert.strictEqual(refused.stdout, "");
  assert.ok(!existsSync(checkpoint), "recovery publishes no checkpoint from an impossible event timestamp");
  assert.deepStrictEqual(digests(store), recorded);
});

test("a malformed or missing event stops recovery with its location and keeps its progress", () => {
  const fx = richHistory("recover-malformed", 120);
  const { home, store } = fx;
  const expected = checkpointOf(store);
  const recorded = digests(store);
  const progress = join(store.dir, "recovery.json");
  unlinkSync(join(store.dir, "state.json"));
  assert.strictEqual(recover(store, 50).processedSeq, 50);
  const saved = readFileSync(progress);

  const seq = 73;
  const located = [...recorded.keys()].find((name) => name.endsWith(`/${String(seq).padStart(12, "0")}.json`));
  assert.ok(located !== undefined);
  const file = join(store.dir, located);
  const original = readFileSync(file);
  writeFileSync(file, "{not json");
  const refused = runExpect(2, home, ["recover"]);
  assert.ok(refused.stderr.includes(file) && /malformed committed event/.test(refused.stderr), refused.stderr);
  assert.strictEqual(refused.stdout, "");
  assert.ok(readFileSync(progress).equals(saved), "a failed recover keeps the saved progress");
  assert.strictEqual(report(home, ["status"]).ready, false);
  runExpect(1, home, ["append", "--type", "attempt-started", "--json", "-"], JSON.stringify({ attempt: "r3", owner: OWNER, job: "review" }));

  unlinkSync(file);
  assert.match(runExpect(2, home, ["recover"]).stderr, new RegExp(`missing or misorders seq ${seq}`));
  assert.ok(readFileSync(progress).equals(saved));

  writeFileSync(file, original);
  const pages = recoverAll(store, 50);
  assert.strictEqual(pages[0].processedSeq, 100, "recovery resumes from the saved progress");
  assert.deepStrictEqual(checkpointOf(store), expected);
  assert.deepStrictEqual(digests(store), recorded);
});

test("the recover CLI pages a long history at the fixed batch across restarts and stays under the ceiling", () => {
  const fx = richHistory("recover-cli", 2050);
  const { home, store, ids } = fx;
  const expected = checkpointOf(store);
  const recorded = digests(store);
  const lastSeq = status(store, null, at(9)).lastSeq;
  assert.ok(lastSeq > 2 * RECOVER_BATCH);
  unlinkSync(join(store.dir, "state.json"));

  const seen: number[] = [];
  for (;;) {
    const page = report(home, ["recover"]);
    seen.push(page.processedSeq as number);
    if (page.complete === true) {
      assert.deepStrictEqual(page, { ready: true, reason: null, processedSeq: lastSeq, lastSeq, complete: true });
      break;
    }
    assert.deepStrictEqual([page.ready, page.reason, page.lastSeq], [false, "missing-checkpoint", lastSeq]);
    const waiting = report(home, ["status"]);
    assert.deepStrictEqual([waiting.ready, waiting.pending], [false, []]);
    runExpect(1, home, ["apply", "--attempt", "r2", "--proposal", ids.b, "--revision", "1"]);
    assert.ok(seen.length <= 3);
  }
  assert.deepStrictEqual(seen, [RECOVER_BATCH, 2 * RECOVER_BATCH, lastSeq]);
  assert.deepStrictEqual(checkpointOf(store), expected);
  assert.deepStrictEqual(digests(store), recorded);
  let cursor: string | null = null;
  do {
    const page = runExpect(0, home, cursor === null ? ["status"] : ["status", "--cursor", cursor]);
    cursor = (JSON.parse(page.stdout) as { next: string | null }).next;
  } while (cursor !== null);
});

test("expected runbook refuses configuration drift before decisions and every store command", () => {
  const { home, runbook } = fixture("expected-runbook-drift");
  const original = openStore(home);
  start(original, "review-original", at(0));
  append(original, "proposal", proposal("review-original", "Original proposal", "Original replacement\n"), at(0));
  complete(original, "review-original", at(0));
  const shown = report(home, ["status"]);
  const originalRecords = digests(original);

  const otherRoot = join(home, "other-runbook");
  mkdirSync(otherRoot);
  configure(home, JSON.stringify({ runbookRoot: otherRoot }));
  const other = openStore(home);
  start(other, "review-other", at(0));
  append(other, "proposal", proposal("review-other", "Other proposal", "Other replacement\n"), at(0));
  complete(other, "review-other", at(0));
  assert.strictEqual(status(other, null, at(1)).pending[0].proposal, "p2");
  assert.strictEqual((shown.pending as { proposal: string }[])[0].proposal, "p2");
  const otherRecords = digests(other);
  const decision = JSON.stringify({ proposal: "p2", revision: 1, decision: "accepted", source: "user message: accept p2@1" });
  const commands = [
    ["append", "--type", "decision", "--json", "-"],
    ["apply", "--attempt", "apply-test", "--proposal", "p2", "--revision", "1"],
    ["hold", "--attempt", "apply-test", "--proposal", "p2", "--revision", "1"],
    ["recover"], ["status"], ["rejected"], ["history"], ["event", "--seq", "2"],
    ["body", "--hash", status(other, null, at(1)).pending[0].bodyHash],
  ];
  for (const command of commands) {
    const refused = runExpect(1, home, [...command, "--expect-runbook", runbook], decision);
    assert.strictEqual(refused.stdout, "");
    assert.match(refused.stderr, /differs from expected runbook/);
  }
  assert.deepStrictEqual(digests(original), originalRecords);
  assert.deepStrictEqual(digests(other), otherRecords);
  assert.strictEqual(status(other, null, at(1)).pending[0].decision, null);
  assert.strictEqual(status(original, null, at(1)).pending[0].decision, null);
  assert.ok(!existsSync(join(otherRoot, "access", "staging.md")));

  accept(other, "p2", 1, at(1));
  start(other, "apply-test", at(2), OWNER, "apply");
  const acceptedRecords = digests(other);
  runExpect(1, home, ["apply", "--attempt", "apply-test", "--proposal", "p2", "--revision", "1", "--expect-runbook", runbook]);
  assert.deepStrictEqual(digests(other), acceptedRecords);
  assert.ok(!existsSync(join(otherRoot, "access", "staging.md")));
});

test("expected runbook accepts physical aliases and preserves unguarded standalone access", () => {
  const { home, runbook } = fixture("expected-runbook-alias");
  const original = openStore(home);
  const alias = join(home, "alias");
  symlinkSync(runbook, alias);
  configure(home, JSON.stringify({ runbookRoot: alias }));
  assert.strictEqual(report(home, ["status", "--expect-runbook", runbook]).id, original.id);
  const started = report(home, ["append", "--expect-runbook", runbook, "--type", "attempt-started", "--json", "-"], JSON.stringify({ attempt: "bound-review", owner: OWNER, job: "review" }));
  assert.strictEqual((started.event as SecretaryEvent).type, "attempt-started");
  assert.strictEqual(report(home, ["status"]).id, original.id);
  for (const value of ["", "relative", "~/runbook"]) {
    assert.match(runExpect(2, home, ["status", "--expect-runbook", value]).stderr, /absolute physical runbook path/);
  }
  runExpect(2, home, ["status", "--expect-runbook"]);
  runExpect(2, home, ["status", "--expect-runbook", runbook, "--expect-runbook", runbook]);
});


for (const symlink of [false, true]) {
  test(`recovery records conflict when its target parent becomes a ${symlink ? "symlink" : "different directory"} during the read`, (t) => {
    const fx = seeded(`recovery-parent-${symlink}`, { "access/staging.md": STAGING_V1 });
    const { home, runbook, store } = fx;
    const parent = join(runbook, "access");
    const target = join(parent, "staging.md");
    const moved = join(home, "moved");
    const outside = join(home, "outside");
    const other = "# Concurrent update\n";
    mkdirSync(outside);
    writeFileSync(join(outside, "staging.md"), other);
    const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
    accept(store, id, 1, at(1));
    start(store, "apply-1", at(2), OWNER, "apply");
    assert.throws(() => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), {
      afterReplace: () => { throw new Error("crash after replace"); },
    }), /crash after replace/);
    append(store, "attempt-stopped", { attempt: "apply-1", reason: "interrupted" }, at(3));
    start(store, "apply-2", at(4), OWNER, "apply");
    const expected = statSync(target);
    const read = fs.readFileSync;
    let swapped = false;
    try {
      t.mock.method(fs, "readFileSync", (...args: Parameters<typeof readFileSync>) => {
        const bytes = read(...args);
        if (typeof args[0] === "number" && !swapped) {
          const opened = fs.fstatSync(args[0]);
          if (opened.dev === expected.dev && opened.ino === expected.ino) {
            swapped = true;
            renameSync(parent, moved);
            if (symlink) symlinkSync(outside, parent);
            else renameSync(outside, parent);
          }
        }
        return bytes;
      });
      syncBuiltinESMExports();
      assertExit(1, () => applyProposal(store, { attempt: "apply-2", proposal: id, revision: 1 }, at(4)), /conflict recorded/);
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
    assert.ok(swapped);
    assert.strictEqual(readFileSync(target, "utf8"), other);
    assert.strictEqual(readFileSync(join(moved, "staging.md"), "utf8"), STAGING_V2);
    assert.strictEqual(pointer(store, id, at(4))?.apply?.state, "conflict");
    assert.strictEqual(status(store, null, at(4)).activeAttempt, null);
  });
}

test("failed apply cleanup keeps an outside file with the temporary basename after a parent swap", () => {
  const fx = seeded("cleanup-outside-temp", { "access/staging.md": STAGING_V1 });
  const { home, runbook, store } = fx;
  const parent = join(runbook, "access");
  const outside = join(home, "outside");
  const moved = join(home, "moved");
  mkdirSync(outside);
  const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
  accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  let name = "";
  assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), {
    beforeReplace: () => {
      name = readdirSync(parent).find((entry) => entry.startsWith(".secretary-apply-")) ?? "";
      assert.notStrictEqual(name, "");
      renameSync(parent, moved);
      writeFileSync(join(outside, name), "unrelated file\n");
      symlinkSync(outside, parent);
    },
  }), /recorded conflict/);
  assert.strictEqual(readFileSync(join(outside, name), "utf8"), "unrelated file\n");
  assert.strictEqual(readFileSync(join(moved, "staging.md"), "utf8"), STAGING_V1);
  assert.strictEqual(pointer(store, id, at(2))?.apply?.state, "conflict");
});

test("failed apply cleanup keeps a replacement temporary file in the original parent", () => {
  const fx = seeded("cleanup-replaced-temp", { "access/staging.md": STAGING_V1 });
  const { home, runbook, store } = fx;
  const parent = join(runbook, "access");
  const id = reviewed(fx, "access/staging.md", STAGING_V2, 0);
  accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  let name = "";
  assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), {
    beforeReplace: () => {
      name = readdirSync(parent).find((entry) => entry.startsWith(".secretary-apply-")) ?? "";
      assert.notStrictEqual(name, "");
      renameSync(join(parent, name), join(home, "original-temp"));
      writeFileSync(join(parent, name), "another writer\n");
      throw Object.assign(new Error("ENOSPC: no space left on device"), { code: "ENOSPC" });
    },
  }), /recorded held/);
  assert.strictEqual(readFileSync(join(parent, name), "utf8"), "another writer\n");
  assert.strictEqual(readFileSync(join(parent, "staging.md"), "utf8"), STAGING_V1);
});

test("failed apply cleanup keeps a created directory moved behind a symlinked ancestor", () => {
  const fx = seeded("cleanup-moved-created-dir", { "README.md": "# Runbook\n" });
  const { home, runbook, store } = fx;
  const parent = join(runbook, "new");
  const moved = join(home, "moved");
  const id = reviewed(fx, "new/deep/entry.md", "# Entry\n", 0);
  accept(store, id, 1, at(1));
  start(store, "apply-1", at(2), OWNER, "apply");
  assertExit(1, () => applyProposal(store, { attempt: "apply-1", proposal: id, revision: 1 }, at(2), {
    beforeReplace: () => {
      const name = readdirSync(join(parent, "deep")).find((entry) => entry.startsWith(".secretary-apply-"));
      assert.ok(name !== undefined);
      renameSync(parent, moved);
      unlinkSync(join(moved, "deep", name));
      symlinkSync(moved, parent);
    },
  }), /recorded conflict/);
  assert.ok(lstatSync(join(moved, "deep")).isDirectory());
  assert.deepStrictEqual(readdirSync(join(moved, "deep")), []);
  assert.ok(lstatSync(parent).isSymbolicLink());
  assert.strictEqual(pointer(store, id, at(2))?.apply?.state, "conflict");
});


test("corrections require the active review attempt and refuse late results", () => {
  const store = openStore(fixture("correction-attempts").home);
  const correct = (attempt: string, now: Date) => append(store, "correction", { attempt, corrects: 1, note: "Corrected source name." }, now);
  const refused = (attempt: string, now: Date, pattern: RegExp) => {
    const before = digests(store);
    const seq = status(store, null, now).lastSeq;
    assertExit(1, () => correct(attempt, now), pattern);
    assert.deepStrictEqual(digests(store), before);
    assert.strictEqual(status(store, null, now).lastSeq, seq);
  };
  start(store, "old", at(0));
  const first = correct("old", at(0));
  assert.ok(first.type === "correction" && first.payload.attempt === "old");
  refused("unknown", at(0), /not the active attempt old/);
  assertExit(1, () => append(store, "correction", { attempt: "old", corrects: 999, note: "Missing event." }, at(0)), /no event 999 exists/);
  append(store, "attempt-stopped", { attempt: "old", reason: "stopped" }, at(1));
  refused("old", at(1), /no attempt is active/);
  start(store, "next", at(1));
  start(store, "newest", at(3));
  refused("next", at(3), /not the active attempt newest/);
  correct("newest", at(3));
  complete(store, "newest", at(3));
  refused("newest", at(3), /no attempt is active/);
  start(store, "apply", at(4), OWNER, "apply");
  refused("apply", at(4), /runs the apply job, not review/);
});

test("legacy corrections without attempt tokens remain readable and recoverable", () => {
  const store = openStore(fixture("correction-legacy").home);
  start(store, "review", at(0));
  const event = append(store, "correction", { attempt: "review", corrects: 1, note: "Legacy annotation." }, at(1));
  const legacy = { ...event, payload: { corrects: 1, note: "Legacy annotation." } };
  const path = join(store.dir, "history", event.at.slice(0, 10), `${String(event.seq).padStart(12, "0")}.json`);
  writeFileSync(path, `${JSON.stringify(legacy)}\n`);
  const recorded = digests(store);
  assert.deepStrictEqual(readEvent(store, event.seq), legacy);
  assert.deepStrictEqual(history(store, { after: 0, type: "correction", proposal: null }).events, [legacy]);
  unlinkSync(join(store.dir, "state.json"));
  assert.strictEqual(recover(store).complete, true);
  assert.deepStrictEqual(digests(store), recorded);
  assert.strictEqual(status(store, null, at(1)).activeAttempt?.attempt, "review");
  assertExit(1, () => append(store, "correction", legacy.payload, at(1)), /missing attempt/);
});
