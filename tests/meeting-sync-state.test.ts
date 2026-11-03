import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync, renameSync, symlinkSync, linkSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { configure, status, start, finish, create, observe, archive, reconcile, remove, Exit, LEASE_MS } from "../scripts/meeting-sync-state.ts";
const ROOT = realpathSync(mkdtempSync(join(tmpdir(), "meeting-sync-")));
const NOW = Date.parse("2026-11-02T10:00:00Z");
after(() => rmSync(ROOT, { recursive: true, force: true }));
function fixture(settings: unknown = {}) {
  const home = mkdtempSync(join(ROOT, "home-"));
  const folder = join(home, "meetings");
  mkdirSync(folder);
  mkdirSync(join(home, ".config/agents-kit"), { recursive: true });
  const config = join(home, ".config/agents-kit/config.json");
  writeFileSync(config, JSON.stringify({ secretary: { duties: { "meeting-sync": { folder, ...settings } } }, unknown: true }));
  const retained = configure(home, "owner", NOW);
  assert.ok(retained);
  return { home, folder, retained, config };
}
test("configuration is disabled without folder, defaults to 60 and retains custom intervals", () => {
  const f = fixture();
  assert.equal(f.retained.intervalMinutes, 60);
  assert.equal(fixture({ intervalMinutes: 17 }).retained.intervalMinutes, 17);
  writeFileSync(f.config, JSON.stringify({ secretary: { duties: { "meeting-sync": { intervalMinutes: "ignored" } } } }));
  assert.equal(configure(f.home, "owner", NOW), null);
  rmSync(f.config);
  assert.equal(configure(f.home, "owner", NOW), null);
  assert.equal(status(f.home, f.retained, NOW).due, true);
  assert.equal(status(f.home, f.retained, NOW).eligibleAt, "2026-11-02T10:00:00.000Z");
});
test("configuration rejects malformed enabled values and containers", () => {
  const f = fixture();
  for (const value of [null, [], 3, { secretary: [] }, { secretary: { duties: { "meeting-sync": null } } }]) {
    writeFileSync(f.config, JSON.stringify(value));
    assert.throws(() => configure(f.home, "owner", NOW));
  }
  for (const value of [0, -1, 0.5, "60", null, Number.MAX_SAFE_INTEGER]) {
    writeFileSync(f.config, JSON.stringify({ secretary: { duties: { "meeting-sync": { folder: f.folder, intervalMinutes: value } } } }));
    assert.throws(() => configure(f.home, "owner", NOW));
  }
  for (const folder of ["relative", "", 3]) {
    writeFileSync(f.config, JSON.stringify({ secretary: { duties: { "meeting-sync": { folder } } } }));
    assert.throws(() => configure(f.home, "owner", NOW));
  }
});
test("retained settings bypass deleted and retargeted configuration; meetings-only uses no runbook", () => {
  const f = fixture();
  const other = fixture({ intervalMinutes: 5 });
  writeFileSync(f.config, readFileSync(other.config));
  const token = start(f.home, f.retained, { now: NOW });
  rmSync(f.config);
  create(f.home, f.retained, { token, path: "prep.md", body: "original target", now: NOW });
  assert.equal(readFileSync(join(f.folder, "prep.md"), "utf8"), "original target");
  assert.equal(existsSync(join(other.folder, "prep.md")), false);
  assert.equal(existsSync(join(f.home, ".local/state/agents-kit/secretary/runbook")), false);
});
test("a symlinked home component still opens the meeting store", () => {
  const f = fixture();
  const real = mkdtempSync(join(ROOT, "local-"));
  symlinkSync(real, join(f.home, ".local"));
  assert.equal(status(f.home, f.retained, NOW).enabled, true);
  assert.ok(existsSync(join(real, "state/agents-kit/secretary/meeting-sync", f.retained.store)));
});
test("leases, owner validation, stop and supersession reject late writes and completion", () => {
  const f = fixture();
  const first = start(f.home, f.retained, { now: NOW });
  assert.throws(() => start(f.home, f.retained, { now: NOW + 1, explicit: true }), /leased/);
  assert.throws(() => create(f.home, { ...f.retained, owner: "other" }, { token: first, path: "bad.md", body: "bad", now: NOW }), /superseded/);
  const second = start(f.home, f.retained, { now: NOW + LEASE_MS });
  const before = status(f.home, f.retained, NOW + LEASE_MS);
  assert.throws(() => finish(f.home, f.retained, { token: first, outcome: "complete", now: NOW + LEASE_MS }), /superseded/);
  assert.deepEqual(status(f.home, f.retained, NOW + LEASE_MS), before);
  finish(f.home, f.retained, { token: second, outcome: "stopped", now: NOW + LEASE_MS });
  assert.throws(() => create(f.home, f.retained, { token: second, path: "bad.md", body: "bad", now: NOW + LEASE_MS }), /stopped/);
  assert.deepEqual(readdirSync(f.folder), []);
});
test("stop revokes an attempt after its meeting folder moves", () => {
  const f = fixture();
  const token = start(f.home, f.retained, { now: NOW });
  renameSync(f.folder, f.folder + "-moved");
  finish(f.home, f.retained, { token, outcome: "stopped", now: NOW + 1 });
  assert.throws(() => finish(f.home, f.retained, { token, outcome: "stopped", now: NOW + 2 }), /stopped or superseded/);
  renameSync(f.folder + "-moved", f.folder);
  assert.equal(status(f.home, f.retained, NOW + 2).active, null);
  assert.ok(start(f.home, f.retained, { now: NOW + 2 }));
});
test("stop permits a fresh start after folder replacement while other outcomes refuse", () => {
  const f = fixture();
  const token = start(f.home, f.retained, { now: NOW });
  const replacement = join(f.home, "replacement");
  mkdirSync(replacement);
  rmSync(f.folder, { recursive: true });
  renameSync(replacement, f.folder);
  for (const outcome of ["complete", "partial", "failed"] as const) {
    assert.throws(() => finish(f.home, f.retained, { token, outcome, now: NOW + 1 }), /meeting root identity changed/);
  }
  assert.throws(() => finish(f.home, { ...f.retained, owner: "other" }, { token, outcome: "stopped", now: NOW + 1 }), /stopped or superseded/);
  finish(f.home, f.retained, { token, outcome: "stopped", now: NOW + 1 });
  const retained = configure(f.home, "next-owner", NOW + 2);
  assert.ok(retained);
  assert.equal(retained.store, f.retained.store);
  assert.notEqual(retained.identity, f.retained.identity);
  assert.equal(status(f.home, retained, NOW + 2).active, null);
  assert.ok(start(f.home, retained, { now: NOW + 2 }));
});
test("successful cadence, failed retry and explicit early retry remain distinct", () => {
  const f = fixture({ intervalMinutes: 10 });
  const first = start(f.home, f.retained, { now: NOW });
  finish(f.home, f.retained, { token: first, outcome: "partial", now: NOW });
  assert.equal(status(f.home, f.retained, NOW + 1).due, false);
  assert.equal(status(f.home, f.retained, NOW + 600000).due, true);
  const second = start(f.home, f.retained, { now: NOW + 1, explicit: true });
  finish(f.home, f.retained, { token: second, outcome: "failed", now: NOW + 2 });
  assert.equal(status(f.home, f.retained, NOW + 3).completed, NOW);
  assert.throws(() => start(f.home, f.retained, { now: NOW + 3 }), /not due/);
  assert.ok(start(f.home, f.retained, { now: NOW + 3, explicit: true }));
});
test("create refuses existing or racing destinations and preserves their bytes", () => {
  const f = fixture();
  const token = start(f.home, f.retained, { now: NOW });
  create(f.home, f.retained, { token, path: "prep.md", body: "first", now: NOW });
  assert.throws(() => create(f.home, f.retained, { token, path: "prep.md", body: "second", now: NOW }), /exists/);
  assert.throws(() => create(f.home, f.retained, { token, path: "raced.md", body: "candidate", now: NOW, beforePublish: () => writeFileSync(join(f.folder, "raced.md"), "user") }), /raced/);
  assert.equal(readFileSync(join(f.folder, "prep.md"), "utf8"), "first");
  assert.equal(readFileSync(join(f.folder, "raced.md"), "utf8"), "user");
});
test("the create CLI reports unavailable filenames and removes its private stage", () => {
  const f = fixture();
  const token = start(f.home, f.retained);
  const result = meetingCli(f.home, "create", { retained: f.retained, token, path: `${"a".repeat(300)}.md`, body: "prep" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /ENAMETOOLONG/);
  assert.deepEqual(readdirSync(f.folder).filter(name => name.startsWith(".meeting-sync-")), []);
});
test("root replacement, symlink parents and traversal refuse publication", () => {
  const f = fixture();
  const token = start(f.home, f.retained, { now: NOW });
  const outside = join(f.home, "outside"); mkdirSync(outside);
  symlinkSync(outside, join(f.folder, "alias"));
  for (const path of ["../bad.md", "/bad.md", "alias/bad.md"]) assert.throws(() => create(f.home, f.retained, { token, path, body: "bad", now: NOW }));
  renameSync(f.folder, f.folder + "-old"); mkdirSync(f.folder);
  assert.throws(() => create(f.home, f.retained, { token, path: "bad.md", body: "bad", now: NOW }), /identity/);
  assert.deepEqual(readdirSync(outside), []);
});
test("missing parents and notes are refusals naming the relative path", () => {
  const f = fixture();
  const token = start(f.home, f.retained, { now: NOW });
  const refusal = (path: string) => (error: unknown) => error instanceof Exit && error.code === 1 && error.message.includes(path);
  assert.throws(() => create(f.home, f.retained, { token, path: "absent/prep.md", body: "bad", now: NOW }), refusal("absent"));
  assert.throws(() => observe(f.home, f.retained, { token, path: "gone.md", now: NOW }), refusal("gone.md"));
  assert.equal(existsSync(join(f.folder, "absent")), false);
});
test("parent substitution during staging refuses publication", () => {
  const f = fixture(); mkdirSync(join(f.folder, "sub"));
  const token = start(f.home, f.retained, { now: NOW });
  assert.throws(() => create(f.home, f.retained, { token, path: "sub/prep.md", body: "bad", now: NOW, beforePublish: () => {
    renameSync(join(f.folder, "sub"), join(f.folder, "old")); mkdirSync(join(f.folder, "sub"));
  } }), /parent changed/);
  assert.equal(existsSync(join(f.folder, "sub/prep.md")), false);
});

function archiveFixture() {
  const f = fixture();
  mkdirSync(join(f.folder, "Archive"));
  writeFileSync(join(f.folder, "incoming.md"), "user prep");
  writeFileSync(join(f.folder, "template.md"), "template");
  const token = start(f.home, f.retained, { now: NOW });
  const incoming = observe(f.home, f.retained, { token, path: "incoming.md", now: NOW });
  const template = observe(f.home, f.retained, { token, path: "template.md", now: NOW });
  const request = { token, operation: { provider: "granola", id: "stable-provider-id" }, path: "Archive/meeting.md", body: "user prep\nsummary", incoming, template, now: NOW };
  return { ...f, request };
}
for (const interruption of ["beforePublish", "afterPublish", "beforeDelete"] as const) {
  test(`archive retry after interruption at ${interruption} leaves one archive`, () => {
    const f = archiveFixture();
    const crash = () => { throw new Error("interrupted"); };
    if (interruption === "beforeDelete") {
      archive(f.home, f.retained, f.request);
      assert.throws(() => remove(f.home, f.retained, { ...f.request, covered: true, beforeDelete: crash }), /interrupted/);
    } else assert.throws(() => archive(f.home, f.retained, { ...f.request, [interruption]: crash }), /interrupted/);
    finish(f.home, f.retained, { token: f.request.token, outcome: "stopped", now: NOW });
    const token = start(f.home, f.retained, { now: NOW + 1 });
    const receipt = reconcile(f.home, f.retained, { ...f.request, token });
    assert.equal(receipt?.path, "Archive/meeting.md");
    archive(f.home, f.retained, { ...f.request, token, path: "Archive/duplicate.md" });
    remove(f.home, f.retained, { ...f.request, token, covered: true });
    remove(f.home, f.retained, { ...f.request, token, covered: true });
    assert.deepEqual(readdirSync(join(f.folder, "Archive")), ["meeting.md"]);
    assert.equal(readFileSync(join(f.folder, "Archive/meeting.md"), "utf8"), f.request.body);
    assert.equal(existsSync(join(f.folder, "incoming.md")), false);
  });
}
test("receipt recovery retains newer prep and stopped attempts cannot publish or delete", () => {
  const f = archiveFixture();
  assert.throws(() => archive(f.home, f.retained, { ...f.request, afterPublish: () => { throw new Error("interrupted"); } }), /interrupted/);
  writeFileSync(join(f.folder, "incoming.md"), "user prep\nnewer text");
  const receipt = reconcile(f.home, f.retained, f.request);
  assert.ok(receipt?.archive);
  archive(f.home, f.retained, { ...f.request, path: "Archive/duplicate.md" });
  assert.throws(() => remove(f.home, f.retained, { ...f.request, covered: true }), /changed/);
  finish(f.home, f.retained, { token: f.request.token, outcome: "stopped", now: NOW });
  assert.throws(() => archive(f.home, f.retained, { ...f.request, operation: { provider: "granola", id: "another" }, path: "Archive/another.md" }), /stopped/);
  assert.throws(() => remove(f.home, f.retained, { ...f.request, covered: true }), /stopped/);
  assert.throws(() => reconcile(f.home, f.retained, f.request), /stopped/);
  assert.deepEqual(readdirSync(join(f.folder, "Archive")), ["meeting.md"]);
  assert.equal(readFileSync(join(f.folder, "incoming.md"), "utf8"), "user prep\nnewer text");
});
test("unrelated collisions preserve bytes and allow the existing filename policy", () => {
  const f = archiveFixture();
  writeFileSync(join(f.folder, f.request.path), f.request.body);
  assert.throws(() => archive(f.home, f.retained, f.request), /collision/);
  assert.equal(reconcile(f.home, f.retained, f.request), null);
  archive(f.home, f.retained, { ...f.request, path: "Archive/meeting 1000.md" });
  assert.equal(readFileSync(join(f.folder, f.request.path), "utf8"), f.request.body);
  assert.deepEqual(readdirSync(join(f.folder, "Archive")), ["meeting 1000.md", "meeting.md"]);
});
for (const changed of ["incoming.md", "template.md", "Archive/meeting.md"]) {
  test(`changed ${changed} observations prevent deletion`, () => {
    const f = archiveFixture();
    archive(f.home, f.retained, f.request);
    writeFileSync(join(f.folder, changed), "changed bytes");
    assert.throws(() => remove(f.home, f.retained, { ...f.request, covered: true }), /changed/);
    assert.equal(existsSync(join(f.folder, "incoming.md")), true);
    assert.equal(readFileSync(join(f.folder, changed), "utf8"), "changed bytes");
  });
}
test("replaced archive with matching bytes and substituted stages are not recovered", () => {
  const f = archiveFixture();
  archive(f.home, f.retained, f.request);
  renameSync(join(f.folder, f.request.path), join(f.folder, "saved.md"));
  writeFileSync(join(f.folder, f.request.path), f.request.body);
  assert.ok(reconcile(f.home, f.retained, f.request)?.archive);
  assert.throws(() => remove(f.home, f.retained, { ...f.request, covered: true }), /changed/);
  assert.equal(existsSync(join(f.folder, "incoming.md")), true);
  const g = archiveFixture();
  assert.throws(() => archive(g.home, g.retained, { ...g.request, beforePublish: () => { throw new Error("interrupted"); } }), /interrupted/);
  const receipt = reconcile(g.home, g.retained, g.request);
  assert.ok(receipt);
  renameSync(join(g.folder, receipt.stage.path), join(g.folder, "saved.md"));
  writeFileSync(join(g.folder, receipt.stage.path), g.request.body);
  assert.throws(() => archive(g.home, g.retained, g.request), /changed/);
  assert.equal(readFileSync(join(g.folder, receipt.stage.path), "utf8"), g.request.body);
  assert.equal(existsSync(join(g.folder, g.request.path)), false);
});
test("settled receipts survive later edits, moves, and deletion of the archive", () => {
  const f = archiveFixture();
  archive(f.home, f.retained, f.request);
  remove(f.home, f.retained, { ...f.request, covered: true });
  appendFileSync(join(f.folder, f.request.path), "\n- [x] follow-up");
  assert.equal(reconcile(f.home, f.retained, f.request)?.removed, true);
  renameSync(join(f.folder, f.request.path), join(f.folder, "Archive/renamed.md"));
  assert.equal(reconcile(f.home, f.retained, f.request)?.removed, true);
  rmSync(join(f.folder, "Archive"), { recursive: true });
  assert.equal(reconcile(f.home, f.retained, f.request)?.removed, true);
  const g = archiveFixture();
  archive(g.home, g.retained, g.request);
  appendFileSync(join(g.folder, g.request.path), "\nuser note");
  assert.ok(reconcile(g.home, g.retained, g.request)?.archive);
  assert.throws(() => remove(g.home, g.retained, { ...g.request, covered: true }), /changed/);
  assert.equal(existsSync(join(g.folder, "incoming.md")), true);
});
test("published unremoved receipts survive a replaced or deleted archive folder", () => {
  const f = archiveFixture();
  archive(f.home, f.retained, { ...f.request, incoming: null });
  renameSync(join(f.folder, "Archive"), join(f.folder, "Old archive"));
  mkdirSync(join(f.folder, "Archive"));
  const replaced = reconcile(f.home, f.retained, f.request);
  assert.ok(replaced?.archive);
  assert.equal(replaced.removed, false);
  rmSync(join(f.folder, "Archive"), { recursive: true });
  const deleted = reconcile(f.home, f.retained, f.request);
  assert.ok(deleted?.archive);
  assert.equal(deleted.removed, false);
  assert.equal(existsSync(join(f.folder, "incoming.md")), true);
});
for (const replacement of ["renamed", "deleted"] as const) {
  test(`an unpublished receipt refuses after its archive folder is ${replacement} and recreated`, () => {
    const f = archiveFixture();
    assert.throws(() => archive(f.home, f.retained, { ...f.request, beforePublish: () => { throw new Error("interrupted"); } }), /interrupted/);
    const receipt = reconcile(f.home, f.retained, f.request);
    assert.ok(receipt);
    if (replacement === "renamed") renameSync(join(f.folder, "Archive"), join(f.folder, "Old archive"));
    else rmSync(join(f.folder, "Archive"), { recursive: true });
    mkdirSync(join(f.folder, "Archive"));
    assert.throws(() => reconcile(f.home, f.retained, f.request), /archive parent changed/);
    assert.throws(() => archive(f.home, f.retained, f.request), /archive parent changed/);
    const refusal = (error: unknown) => error instanceof Exit && error.code === 1 && error.message.startsWith("archive parent changed") && error.message.includes(receipt.stage.path);
    assert.throws(() => reconcile(f.home, f.retained, f.request), refusal);
    assert.throws(() => archive(f.home, f.retained, f.request), refusal);
    assert.throws(() => remove(f.home, f.retained, { ...f.request, covered: true }), refusal);
    assert.deepEqual(readdirSync(join(f.folder, "Archive")), []);
    if (replacement === "renamed") assert.equal(readFileSync(join(f.folder, "Old archive", receipt.stage.path.slice("Archive/".length)), "utf8"), f.request.body);
  });
}
test("an interrupted publication refuses a renamed archive folder without publishing twice", () => {
  const f = archiveFixture();
  assert.throws(() => archive(f.home, f.retained, { ...f.request, afterPublish: () => { throw new Error("interrupted"); } }), /interrupted/);
  renameSync(join(f.folder, "Archive"), join(f.folder, "Old archive"));
  mkdirSync(join(f.folder, "Archive"));
  assert.throws(() => reconcile(f.home, f.retained, f.request), /archive parent changed/);
  assert.throws(() => archive(f.home, f.retained, f.request), /archive parent changed/);
  assert.deepEqual(readdirSync(join(f.folder, "Archive")), []);
  assert.equal(readFileSync(join(f.folder, "Old archive/meeting.md"), "utf8"), f.request.body);
});
test("an unpublished receipt restarts when its body or sources changed", () => {
  const f = archiveFixture();
  assert.throws(() => archive(f.home, f.retained, { ...f.request, beforePublish: () => { throw new Error("interrupted"); } }), /interrupted/);
  writeFileSync(join(f.folder, "incoming.md"), "user prep\nnewer text");
  const incoming = observe(f.home, f.retained, { token: f.request.token, path: "incoming.md", now: NOW });
  const body = "user prep\nnewer text\nsummary";
  assert.ok(archive(f.home, f.retained, { ...f.request, body, incoming }).archive);
  assert.equal(readFileSync(join(f.folder, f.request.path), "utf8"), body);
  assert.deepEqual(readdirSync(join(f.folder, "Archive")), ["meeting.md"]);
});
test("an unpublished receipt with an updated body restarts at the requested path without a collision", () => {
  const f = archiveFixture();
  assert.throws(() => archive(f.home, f.retained, { ...f.request, beforePublish: () => { throw new Error("interrupted"); } }), /interrupted/);
  const path = "Archive/renamed title.md";
  const body = "user prep\nupdated summary";
  assert.equal(existsSync(join(f.folder, f.request.path)), false);
  assert.equal(existsSync(join(f.folder, path)), false);
  const receipt = archive(f.home, f.retained, { ...f.request, path, body });
  assert.equal(receipt.path, path);
  assert.ok(receipt.archive);
  assert.equal(readFileSync(join(f.folder, path), "utf8"), body);
  assert.equal(existsSync(join(f.folder, f.request.path)), false);
});
test("an unpublished receipt restarts after its staging folder was deleted", () => {
  const f = archiveFixture();
  assert.throws(() => archive(f.home, f.retained, { ...f.request, beforePublish: () => { throw new Error("interrupted"); } }), /interrupted/);
  const receipt = reconcile(f.home, f.retained, f.request);
  assert.ok(receipt);
  rmSync(join(f.folder, receipt.stage.path, ".."), { recursive: true });
  assert.ok(archive(f.home, f.retained, f.request).archive);
  assert.equal(readFileSync(join(f.folder, f.request.path), "utf8"), f.request.body);
  assert.deepEqual(readdirSync(join(f.folder, "Archive")), ["meeting.md"]);
});
test("incomplete coverage and source authorization preserve incoming and template", () => {
  const f = archiveFixture();
  archive(f.home, f.retained, f.request);
  for (const covered of [undefined, false]) assert.throws(() => remove(f.home, f.retained, { ...f.request, covered }), /proof/);
  writeFileSync(join(f.folder, "copy.md"), "template");
  const incoming = observe(f.home, f.retained, { token: f.request.token, path: "copy.md", now: NOW });
  const options = { token: f.request.token, incoming, template: f.request.template, now: NOW };
  assert.throws(() => remove(f.home, f.retained, options), /complete source/);
  assert.throws(() => remove(f.home, f.retained, { ...options, incoming: f.request.incoming, completeSource: true }), /template-copy/);
  remove(f.home, f.retained, { ...options, completeSource: true });
  assert.equal(existsSync(join(f.folder, "copy.md")), false);
  assert.equal(readFileSync(join(f.folder, "template.md"), "utf8"), "template");
  assert.equal(readFileSync(join(f.folder, "incoming.md"), "utf8"), "user prep");
});
test("a hard link to the template is not a distinct incoming note", () => {
  const f = archiveFixture();
  linkSync(join(f.folder, "template.md"), join(f.folder, "alias.md"));
  const incoming = observe(f.home, f.retained, { token: f.request.token, path: "alias.md", now: NOW });
  assert.throws(() => remove(f.home, f.retained, { token: f.request.token, incoming, template: f.request.template, completeSource: true, now: NOW }), /distinct/);
  assert.equal(readFileSync(join(f.folder, "alias.md"), "utf8"), "template");
  assert.equal(readFileSync(join(f.folder, "template.md"), "utf8"), "template");
});
const caseInsensitive = (() => {
  writeFileSync(join(ROOT, "case-probe"), "");
  return existsSync(join(ROOT, "CASE-PROBE"));
})();
test("folder case aliases share a store and a live attempt lease", { skip: !caseInsensitive }, () => {
  const f = fixture();
  writeFileSync(f.config, JSON.stringify({ secretary: { duties: { "meeting-sync": { folder: join(f.home, "Meetings") } } } }));
  const alias = configure(f.home, "other-owner", NOW);
  assert.ok(alias);
  assert.equal(alias.store, f.retained.store);
  assert.equal(alias.folder, f.retained.folder);
  start(f.home, f.retained, { now: NOW });
  assert.throws(() => start(f.home, alias, { now: NOW + 1, explicit: true }), /attempt leased/);
});
test("a case alias of the template is not a distinct incoming note", { skip: !caseInsensitive }, () => {
  const f = fixture();
  writeFileSync(join(f.folder, "Meeting – Template.md"), "template");
  const token = start(f.home, f.retained, { now: NOW });
  const incoming = observe(f.home, f.retained, { token, path: "meeting – template.md", now: NOW });
  const template = observe(f.home, f.retained, { token, path: "Meeting – Template.md", now: NOW });
  assert.throws(() => remove(f.home, f.retained, { token, incoming, template, completeSource: true, now: NOW }), /distinct/);
  assert.deepEqual(readdirSync(f.folder), ["Meeting – Template.md"]);
  assert.equal(readFileSync(join(f.folder, "Meeting – Template.md"), "utf8"), "template");
});
test("last-moment incoming and template changes refuse publication and deletion", () => {
  const f = archiveFixture();
  assert.throws(() => archive(f.home, f.retained, { ...f.request, beforePublish: () => writeFileSync(join(f.folder, "incoming.md"), "new") }), /changed/);
  assert.equal(existsSync(join(f.folder, f.request.path)), false);
  const g = archiveFixture();
  archive(g.home, g.retained, g.request);
  assert.throws(() => remove(g.home, g.retained, { ...g.request, covered: true, beforeDelete: () => writeFileSync(join(g.folder, "template.md"), "new") }), /changed/);
  assert.equal(existsSync(join(g.folder, "incoming.md")), true);
});
test("racing unrelated destination can use a new filename without adopting its bytes", () => {
  const f = archiveFixture();
  assert.throws(() => archive(f.home, f.retained, { ...f.request, beforePublish: () => writeFileSync(join(f.folder, f.request.path), f.request.body) }), /collision/);
  assert.throws(() => reconcile(f.home, f.retained, f.request), /collision/);
  archive(f.home, f.retained, { ...f.request, path: "Archive/meeting 1000.md" });
  assert.equal(reconcile(f.home, f.retained, f.request)?.path, "Archive/meeting 1000.md");
  assert.equal(readFileSync(join(f.folder, f.request.path), "utf8"), f.request.body);
});
test("an archive edited in place after an interrupted publication is adopted by stage identity", () => {
  const f = archiveFixture();
  assert.throws(() => archive(f.home, f.retained, { ...f.request, afterPublish: () => { throw new Error("interrupted"); } }), /interrupted/);
  appendFileSync(join(f.folder, f.request.path), "\nuser edit");
  const receipt = reconcile(f.home, f.retained, f.request);
  assert.ok(receipt?.archive);
  assert.deepEqual(readdirSync(join(f.folder, "Archive")).filter(name => name.startsWith(".meeting-sync-")), []);
  assert.match(readFileSync(join(f.folder, f.request.path), "utf8"), /user edit$/);
});

test("recorded archive receipts clean edited stages by identity through every recovery entry", () => {
  for (const entry of ["reconcile", "archive", "remove"] as const) {
    const f = archiveFixture();
    assert.throws(() => archive(f.home, f.retained, { ...f.request, afterPublish: () => { throw new Error("interrupted"); } }), /interrupted/);
    const store = join(f.home, ".local/state/agents-kit/secretary/meeting-sync", f.retained.store);
    const receiptName = readdirSync(store).find(name => name.startsWith("archive-") && name.endsWith(".json"));
    assert.ok(receiptName);
    const file = join(store, receiptName);
    const receipt = JSON.parse(readFileSync(file, "utf8"));
    receipt.archive = observe(f.home, f.retained, f.request);
    writeFileSync(file, JSON.stringify(receipt));
    appendFileSync(join(f.folder, f.request.path), "\nuser edit");
    if (entry === "reconcile") assert.deepEqual(reconcile(f.home, f.retained, f.request)?.archive, receipt.archive);
    else if (entry === "archive") assert.deepEqual(archive(f.home, f.retained, f.request).archive, receipt.archive);
    else {
      let reachedDeletionChecks = false;
      assert.throws(() => remove(f.home, f.retained, { ...f.request, covered: true, beforeDelete: () => { reachedDeletionChecks = true; } }), /observed note changed/);
      assert.equal(reachedDeletionChecks, true);
    }
    assert.deepEqual(readdirSync(join(f.folder, "Archive")), ["meeting.md"]);
    assert.equal(readFileSync(join(f.folder, f.request.path), "utf8"), `${f.request.body}\nuser edit`);
    assert.equal(readFileSync(join(f.folder, "incoming.md"), "utf8"), "user prep");
  }
});

test("a publication renamed before its receipt recorded it settles without a second archive", () => {
  const f = archiveFixture();
  assert.throws(() => archive(f.home, f.retained, { ...f.request, afterPublish: () => { throw new Error("interrupted"); } }), /interrupted/);
  renameSync(join(f.folder, f.request.path), join(f.folder, "Archive/renamed.md"));
  assert.ok(reconcile(f.home, f.retained, f.request)?.archive);
  assert.ok(archive(f.home, f.retained, f.request).archive);
  assert.deepEqual(readdirSync(join(f.folder, "Archive")), ["renamed.md"]);
  assert.throws(() => remove(f.home, f.retained, { ...f.request, covered: true }), /missing note/);
  assert.equal(readFileSync(join(f.folder, "incoming.md"), "utf8"), "user prep");
});

test("a collided receipt restarts at a new filename after its source changes", () => {
  const f = archiveFixture();
  assert.throws(() => archive(f.home, f.retained, { ...f.request, beforePublish: () => { throw new Error("interrupted"); } }), /interrupted/);
  writeFileSync(join(f.folder, f.request.path), "foreign");
  appendFileSync(join(f.folder, "incoming.md"), "\nnewer text");
  const incoming = observe(f.home, f.retained, { token: f.request.token, path: "incoming.md", now: NOW });
  const receipt = archive(f.home, f.retained, { ...f.request, path: "Archive/meeting 1000.md", body: `${f.request.body}\nnewer text`, incoming });
  assert.ok(receipt.archive);
  assert.equal(readFileSync(join(f.folder, f.request.path), "utf8"), "foreign");
  assert.deepEqual(readdirSync(join(f.folder, "Archive")).filter(name => name.startsWith(".meeting-sync-")), []);
});

test("the CLI treats only boolean true as an explicit start", () => {
  const f = fixture();
  finish(f.home, f.retained, { token: start(f.home, f.retained), outcome: "complete" });
  const result = spawnSync(process.execPath, [join(import.meta.dirname, "../scripts/meeting-sync-state.ts"), "start", "-"], { encoding: "utf8", env: { ...process.env, HOME: f.home }, input: JSON.stringify({ retained: f.retained, explicit: "false" }) });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not due/);
});

test("superseded attempt cannot recover a stage or remove an incoming note", () => {
  const f = archiveFixture();
  assert.throws(() => archive(f.home, f.retained, { ...f.request, beforePublish: () => { throw new Error("interrupted"); } }), /interrupted/);
  const token = start(f.home, f.retained, { now: NOW + LEASE_MS });
  assert.throws(() => archive(f.home, f.retained, f.request), /superseded/);
  archive(f.home, f.retained, { ...f.request, token });
  assert.throws(() => remove(f.home, f.retained, { ...f.request, covered: true }), /superseded/);
  assert.equal(readFileSync(join(f.folder, "incoming.md"), "utf8"), "user prep");
});
test("a removal interrupted after deletion settles on the next reconcile", () => {
  const f = archiveFixture();
  archive(f.home, f.retained, f.request);
  assert.throws(() => remove(f.home, f.retained, { ...f.request, covered: true, afterDelete: () => { throw new Error("interrupted"); } }), /interrupted/);
  assert.equal(existsSync(join(f.folder, "incoming.md")), false);
  assert.equal(reconcile(f.home, f.retained, f.request)?.removed, true);
  remove(f.home, f.retained, { ...f.request, covered: true });
  const g = archiveFixture();
  archive(g.home, g.retained, g.request);
  assert.throws(() => remove(g.home, g.retained, { ...g.request, covered: true, afterDelete: () => { throw new Error("interrupted"); } }), /interrupted/);
  writeFileSync(join(g.folder, "incoming.md"), "new prep");
  assert.equal(reconcile(g.home, g.retained, g.request)?.removed, false);
  assert.equal(readFileSync(join(g.folder, "incoming.md"), "utf8"), "new prep");
});

test("a completed removal preserves a new incoming file and missing observations refuse deletion", () => {
  const f = archiveFixture();
  archive(f.home, f.retained, f.request);
  remove(f.home, f.retained, { ...f.request, covered: true });
  writeFileSync(join(f.folder, "incoming.md"), "new user note");
  remove(f.home, f.retained, { ...f.request, covered: true });
  assert.equal(readFileSync(join(f.folder, "incoming.md"), "utf8"), "new user note");
  const g = archiveFixture();
  archive(g.home, g.retained, { ...g.request, template: null });
  assert.throws(() => remove(g.home, g.retained, { ...g.request, covered: true }), /incomplete/);
  assert.equal(readFileSync(join(g.folder, "incoming.md"), "utf8"), "user prep");
});

for (const revocation of ["stopped", "superseded"] as const) {
  for (const mutation of ["create", "archive", "remove"] as const) {
    test(`${revocation} wins the lock before ${mutation} and rejects all later mutations`, () => {
      const f = archiveFixture();
      if (mutation === "remove") archive(f.home, f.retained, f.request);
      const beforeLock = () => {
        if (revocation === "stopped") finish(f.home, f.retained, { token: f.request.token, outcome: "stopped", now: NOW });
        else start(f.home, f.retained, { now: NOW + LEASE_MS });
      };
      const options = { ...f.request, beforeLock };
      const act = () => mutation === "create" ? create(f.home, f.retained, { ...options, path: "prep.md" }) : mutation === "archive" ? archive(f.home, f.retained, options) : remove(f.home, f.retained, { ...options, covered: true });
      assert.throws(act, /stopped or superseded/);
      assert.equal(existsSync(join(f.folder, "prep.md")), false);
      assert.equal(existsSync(join(f.folder, f.request.path)), mutation === "remove");
      assert.equal(readFileSync(join(f.folder, "incoming.md"), "utf8"), "user prep");
      const before = status(f.home, f.retained, NOW + LEASE_MS);
      assert.throws(() => finish(f.home, f.retained, { token: f.request.token, outcome: "complete", now: NOW + LEASE_MS }), /stopped or superseded/);
      assert.deepEqual(status(f.home, f.retained, NOW + LEASE_MS), before);
      assert.throws(() => reconcile(f.home, f.retained, f.request), /stopped or superseded/);
    });
  }
}

test("publication winning before stop survives while late deletion and completion refuse after config deletion", () => {
  const f = archiveFixture();
  assert.throws(() => archive(f.home, f.retained, { ...f.request, afterPublish: () => { throw new Error("pause after publication"); } }), /pause after publication/);
  rmSync(f.config);
  finish(f.home, f.retained, { token: f.request.token, outcome: "stopped", now: NOW });
  const before = readFileSync(join(f.folder, f.request.path));
  assert.throws(() => remove(f.home, f.retained, { ...f.request, covered: true }), /stopped/);
  assert.throws(() => archive(f.home, f.retained, f.request), /stopped/);
  assert.throws(() => finish(f.home, f.retained, { token: f.request.token, outcome: "partial", now: NOW }), /stopped/);
  assert.deepEqual(readFileSync(join(f.folder, f.request.path)), before);
  assert.equal(readFileSync(join(f.folder, "incoming.md"), "utf8"), "user prep");
  assert.equal(status(f.home, f.retained, NOW).active, null);
});

function meetingCli(home: string, command: string, request: unknown) {
  return spawnSync(process.execPath, [join(import.meta.dirname, "../scripts/meeting-sync-state.ts"), command, "-"], { encoding: "utf8", env: { ...process.env, HOME: home }, input: JSON.stringify(request) });
}
test("the meeting lock reclaims a dead owner's lock and reports a live owner busy", () => {
  const f = fixture();
  const store = join(f.home, ".local/state/agents-kit/secretary/meeting-sync", f.retained.store);
  const lock = join(store, "lock");
  const dead = spawnSync(process.execPath, ["-e", ""]).pid;
  mkdirSync(lock, { recursive: true });
  writeFileSync(join(lock, "owner.json"), JSON.stringify({ pid: dead, at: "2026-03-01T00:00:00.000Z", token: "dead" }));
  const token = start(f.home, f.retained, { now: NOW });
  assert.equal(existsSync(lock), false);
  assert.ok(readdirSync(store).every(name => !name.startsWith("lock.")));
  mkdirSync(lock);
  const owner = JSON.stringify({ pid: process.pid, at: "2026-03-01T00:00:00.000Z", token: "live" });
  writeFileSync(join(lock, "owner.json"), owner);
  const busy = meetingCli(f.home, "finish", { retained: f.retained, token, outcome: "stopped" });
  assert.equal(busy.status, 2);
  assert.match(busy.stderr, new RegExp(`busy: .* held by pid ${process.pid}`));
  assert.throws(() => create(f.home, f.retained, { token, path: "prep.md", body: "prep", now: NOW }), /busy/);
  assert.equal(existsSync(join(f.folder, "prep.md")), false);
  assert.equal(readFileSync(join(lock, "owner.json"), "utf8"), owner);
  rmSync(lock, { recursive: true });
  assert.equal(status(f.home, f.retained, NOW).active?.token, token);
});

for (const mutation of ["create", "archive", "remove"] as const) {
  test(`a stop sent while ${mutation} holds the lock reports busy and the later stop rejects mutations`, () => {
    const f = archiveFixture();
    if (mutation === "remove") archive(f.home, f.retained, f.request);
    let competing: ReturnType<typeof meetingCli> | undefined;
    const contend = () => { competing = meetingCli(f.home, "finish", { retained: f.retained, token: f.request.token, outcome: "stopped" }); };
    if (mutation === "create") create(f.home, f.retained, { ...f.request, path: "prep.md", beforePublish: contend });
    else if (mutation === "archive") archive(f.home, f.retained, { ...f.request, beforePublish: contend });
    else remove(f.home, f.retained, { ...f.request, covered: true, beforeDelete: contend });
    assert.equal(competing?.status, 2);
    assert.match(competing?.stderr ?? "", /busy/);
    assert.equal(readFileSync(join(f.folder, mutation === "create" ? "prep.md" : f.request.path), "utf8"), f.request.body);
    assert.equal(existsSync(join(f.folder, "incoming.md")), mutation !== "remove");
    finish(f.home, f.retained, { token: f.request.token, outcome: "stopped", now: NOW });
    assert.throws(() => create(f.home, f.retained, { ...f.request, path: "late.md" }), /stopped or superseded/);
    assert.equal(existsSync(join(f.folder, "late.md")), false);
  });
}
