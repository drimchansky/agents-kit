import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { configure, start, finish, create, observe, archive, reconcile, remove } from "../scripts/meeting-sync-state.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = readFileSync(join(REPO, "skills/sync-meeting-notes/SKILL.md"), "utf8");
const DUTY = readFileSync(join(REPO, "references/secretary/meeting-sync.md"), "utf8");
const CONTRACT = readFileSync(join(REPO, "references/workflow/secretary-contract.md"), "utf8");
const ROOT = realpathSync(mkdtempSync(join(tmpdir(), "sync-procedure-")));
const NOW = Date.parse("2026-11-02T10:00:00Z");
after(() => rmSync(ROOT, { recursive: true, force: true }));

function fixture() {
  const home = mkdtempSync(join(ROOT, "home-"));
  const folder = join(home, "meetings");
  mkdirSync(join(folder, "Archive"), { recursive: true });
  mkdirSync(join(home, ".config/agents-kit"), { recursive: true });
  writeFileSync(join(home, ".config/agents-kit/config.json"), JSON.stringify({ secretary: { duties: { "meeting-sync": { folder } } } }));
  writeFileSync(join(folder, "Meeting – Template.md"), "## Prep / notes\n");
  const retained = configure(home, "session-fixture", NOW)!;
  const token = start(home, retained, { now: NOW });
  return { home, folder, retained, token };
}

test("manual resolution and invocation authorization coexist with the enclosing secretary authorization", () => {
  assert.match(SKILL, /\*\*Model invocation:\*\* requires a confirmed proposal/);
  assert.match(SKILL, /folder from the argument, the conversation, or the user's instructions/);
  assert.match(SKILL, /Ask when none supplies it/);
  assert.match(SKILL, /manual model-invoked run asks that as its proposal and writes nothing before the confirmation/);
  assert.match(SKILL, /user-invoked run announces it and proceeds/);
  assert.match(SKILL, /consumes the enclosing start authorization; ask no separate proposal/);
  assert.match(SKILL, /In manual entry, ask when more than one event fits/);
  assert.match(CONTRACT, /meeting job opens no runbook records/);
  assert.match(CONTRACT, /meeting launch grants no runbook decision or apply authority/);
  assert.match(DUTY, /Never write, move, replace, or delete notes directly/);
  assert.match(DUTY, /Never run `configure` inside a job/);
  for (const heading of ["Secretary", "Finish", "Changes", "Preserved", "Coverage", "Next steps", "Blockers"]) assert.ok(DUTY.includes(`\`${heading}\``));
});

test("source windows, connected ambiguity, coverage and guarded receipt ordering stay in the shared procedure", () => {
  for (const rule of [/last 30 days, reading every page/, /next seven days, reading every page/, /Skip the entire connected ambiguous group/, /including its events and incoming notes/, /continue independent meetings/, /Apply no archive, prep creation, or deletion to a skipped group/, /Granola returns its summary/, /complete Granola listing covers its date/, /complete Calendar listing covers its date/, /create or delete no notes from that data/, /every line that differs from the template appears there/]) assert.match(SKILL, rule);
  assert.ok(SKILL.indexOf("reconcile each unambiguous stable provider operation") < SKILL.indexOf("Without a receipt, call a meeting new"));
  assert.match(SKILL, /existing archive without a receipt stays untouched and grants no incoming deletion authority/);
});

test("archiving and removing an independent meeting leaves other notes, including an ambiguous group's notes, untouched", () => {
  const f = fixture();
  const ambiguous = ["2026-11-01 – Planning.md", "2026-11-01 – Planning 1100.md"];
  for (const path of ambiguous) writeFileSync(join(f.folder, path), "My unresolved prep\n");
  const incomingPath = "2026-11-01 – Independent.md";
  const body = "## Prep / notes\nMy action\n\n## Summary\nAgreed next action.\n";
  writeFileSync(join(f.folder, incomingPath), "## Prep / notes\nMy action\n");
  const operation = { provider: "granola", id: "independent" };
  assert.equal(reconcile(f.home, f.retained, { token: f.token, operation, now: NOW }), null);
  const incoming = observe(f.home, f.retained, { token: f.token, path: incomingPath, now: NOW });
  const template = observe(f.home, f.retained, { token: f.token, path: "Meeting – Template.md", now: NOW });
  archive(f.home, f.retained, { token: f.token, operation, path: `Archive/${incomingPath}`, body, incoming, template, now: NOW });
  assert.ok(readFileSync(join(f.folder, "Archive", incomingPath), "utf8").includes("My action\n"));
  remove(f.home, f.retained, { token: f.token, operation, covered: true, now: NOW });
  finish(f.home, f.retained, { token: f.token, outcome: "partial", now: NOW });
  for (const path of ambiguous) assert.equal(readFileSync(join(f.folder, path), "utf8"), "My unresolved prep\n");
  assert.equal(existsSync(join(f.folder, incomingPath)), false);
  assert.deepEqual(readdirSync(join(f.folder, "Archive")), [incomingPath]);
});

test("helper refuses removal without a receipt, completeSource attestation, or matching template hash and publication over an existing archive without a receipt", () => {
  const f = fixture();
  const preserved = new Map([
    ["2026-11-01 – Summary pending.md", "User prep"],
    ["2026-10-31 – Incomplete Granola.md", "## Prep / notes\n"],
    ["2026-11-03 – Incomplete Calendar.md", "## Prep / notes\n"],
    ["2026-11-02 – Free busy.md", "## Prep / notes\n"],
    ["2026-11-01 – Existing.md", "Newer prep"],
    ["Archive/2026-11-01 – Existing.md", "Previous archive"],
  ]);
  for (const [path, body] of preserved) writeFileSync(join(f.folder, path), body);
  assert.equal(reconcile(f.home, f.retained, { token: f.token, operation: { provider: "granola", id: "existing" }, now: NOW }), null);
  const existing = { provider: "granola", id: "existing" };
  const newer = observe(f.home, f.retained, { token: f.token, path: "2026-11-01 – Existing.md", now: NOW });
  assert.throws(() => archive(f.home, f.retained, { token: f.token, operation: existing, path: "Archive/2026-11-01 – Existing.md", body: "Newer prep\n## Summary\n", incoming: newer, template: null, now: NOW }), /collision/);
  assert.throws(() => remove(f.home, f.retained, { token: f.token, operation: existing, covered: true, now: NOW }), /proof/);
  const template = observe(f.home, f.retained, { token: f.token, path: "Meeting – Template.md", now: NOW });
  for (const path of ["2026-10-31 – Incomplete Granola.md", "2026-11-03 – Incomplete Calendar.md", "2026-11-02 – Free busy.md"]) {
    const incoming = observe(f.home, f.retained, { token: f.token, path, now: NOW });
    assert.throws(() => remove(f.home, f.retained, { token: f.token, incoming, template, now: NOW }), /complete source/);
  }
  const pending = observe(f.home, f.retained, { token: f.token, path: "2026-11-01 – Summary pending.md", now: NOW });
  assert.throws(() => remove(f.home, f.retained, { token: f.token, incoming: pending, template, completeSource: true, now: NOW }), /template-copy/);
  create(f.home, f.retained, { token: f.token, path: "2026-11-03 – Independent.md", body: "## Prep / notes\n", now: NOW });
  finish(f.home, f.retained, { token: f.token, outcome: "partial", now: NOW });
  for (const [path, body] of preserved) assert.equal(readFileSync(join(f.folder, path), "utf8"), body);
  assert.deepEqual(readdirSync(join(f.folder, "Archive")), ["2026-11-01 – Existing.md"]);
  assert.equal(readdirSync(f.folder).length, 8);
});

test("fixture trace reconciles publication before classification and preserves newer incoming text", () => {
  const f = fixture();
  const path = "2026-11-01 – Retried.md";
  writeFileSync(join(f.folder, path), "## Prep / notes\noriginal\n");
  const incoming = observe(f.home, f.retained, { token: f.token, path, now: NOW });
  const template = observe(f.home, f.retained, { token: f.token, path: "Meeting – Template.md", now: NOW });
  const operation = { provider: "granola", id: "stable-retry" };
  assert.throws(() => archive(f.home, f.retained, { token: f.token, operation, path: `Archive/${path}`, body: "## Prep / notes\noriginal\n## Summary\nSummary\n", incoming, template, now: NOW, afterPublish() { throw new Error("interrupted"); } }), /interrupted/);
  finish(f.home, f.retained, { token: f.token, outcome: "stopped", now: NOW });
  writeFileSync(join(f.folder, path), "## Prep / notes\noriginal\nnewer\n");
  const token = start(f.home, f.retained, { now: NOW, explicit: true });
  const receipt = reconcile(f.home, f.retained, { token, operation, now: NOW });
  assert.ok(receipt?.archive);
  assert.equal(receipt.path, `Archive/${path}`);
  assert.ok(!readFileSync(join(f.folder, receipt.path), "utf8").includes("newer"));
  finish(f.home, f.retained, { token, outcome: "partial", now: NOW });
  assert.deepEqual(readdirSync(join(f.folder, "Archive")), [path]);
  assert.equal(readFileSync(join(f.folder, path), "utf8"), "## Prep / notes\noriginal\nnewer\n");
});

test("fixture trace deletes a template copy only after complete source coverage", () => {
  const f = fixture();
  const path = "2026-10-31 – Cancelled.md";
  writeFileSync(join(f.folder, path), "## Prep / notes\n");
  const incoming = observe(f.home, f.retained, { token: f.token, path, now: NOW });
  const template = observe(f.home, f.retained, { token: f.token, path: "Meeting – Template.md", now: NOW });
  remove(f.home, f.retained, { token: f.token, incoming, template, completeSource: true, now: NOW });
  assert.equal(existsSync(join(f.folder, path)), false);
});

test("new duty and shared procedure references resolve beside their owners", () => {
  for (const [path, text] of [["references/secretary/meeting-sync.md", DUTY], ["skills/sync-meeting-notes/SKILL.md", SKILL]] as const) {
    for (const [, target] of text.matchAll(/`(\.\.?\/[^`]+\.md)`/g)) assert.ok(existsSync(resolve(REPO, dirname(path), target)), `${path}: ${target}`);
  }
});
