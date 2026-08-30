import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SCRIPT = join(REPO_DIR, "scripts", "cross-capability.ts");
const TEST_ROOT = realpathSync(mkdtempSync(join(tmpdir(), "agents-kit-cross-capability-")));
const CACHE_NAME = "cross-capability.json";
const HEX16 = /^[0-9a-f]{16}$/;

interface Run {
  readonly stdout: string;
  readonly stderr: string;
}

interface Area {
  readonly state: string;
  readonly repo: string;
}

function run(expectedStatus: number, args: readonly string[], state: string): Run {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...process.env, AGENTS_KIT_STATE_DIR: state },
  });
  assert.strictEqual(
    result.status,
    expectedStatus,
    `expected exit ${expectedStatus}, got ${result.status} for: ${args.join(" ")}\n` +
      `${result.stdout ?? ""}${result.stderr ?? result.error?.message ?? ""}`,
  );
  return { stdout: result.stdout, stderr: result.stderr };
}

function area(name: string): Area {
  const dir = join(TEST_ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  const state = join(dir, "state");
  const repo = join(dir, "repo");
  mkdirSync(state, { recursive: true });
  mkdirSync(repo, { recursive: true });
  return { state, repo };
}

function write(dir: string, relative: string, body: string): string {
  const path = join(dir, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  return path;
}

function cachePath(state: string): string {
  return join(state, CACHE_NAME);
}

function cacheText(state: string): string {
  return readFileSync(cachePath(state), "utf8");
}

function assertNoCache(state: string): void {
  assert.strictEqual(existsSync(cachePath(state)), false, "a refused record writes nothing at all");
}

function cache(state: string): Record<string, any> {
  return JSON.parse(cacheText(state));
}

function entry(state: string, repo: string): any {
  const parsed = cache(state)[repo];
  assert.ok(parsed, `the cache holds an entry for ${repo}`);
  return parsed;
}

function gitInit(repo: string): void {
  const init = spawnSync("git", ["init", "-q", repo], { encoding: "utf8" });
  assert.strictEqual(init.status, 0, `git init failed: ${init.stderr ?? init.error?.message}`);
  const add = spawnSync("git", ["-C", repo, "add", "-A"], { encoding: "utf8" });
  assert.strictEqual(add.status, 0, `git add failed: ${add.stderr ?? add.error?.message}`);
}

function facts(overrides: Record<string, string> = {}): string[] {
  const base: Record<string, string> = {
    "--engine": "codex",
    "--cli-version": "codex-cli 0.149.1",
    "--model": "gpt-5.6-sol",
    "--effort": "xhigh",
    "--network-access": "true",
    "--network-proxy": "true",
  };
  return Object.entries({ ...base, ...overrides }).flat();
}

const ENGINE_FACTS = facts();

const STATE_CLASS = "tool state outside the invocation root";
const WRAPPER_CLASS = "package-manager wrapper egress";

function recordArgs(repo: string, key: string, extra: readonly string[] = [], answer = "allowed"): string[] {
  return ["record", repo, ...ENGINE_FACTS, "--command", key, "--answer", answer, "--classes", STATE_CLASS, ...extra];
}

function check(state: string, repo: string, extra: readonly string[] = [], given = ENGINE_FACTS): any {
  const { stdout } = run(0, ["check", repo, ...given, ...extra], state);
  return JSON.parse(stdout);
}

after(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

test("record writes a fresh entry carrying both recomputed fingerprints", () => {
  const { state, repo } = area("record-fresh");
  write(repo, "pnpm-lock.yaml", "lock one\n");
  write(repo, "tsconfig.json", "{}\n");
  const key = "apps/web: ./node_modules/.bin/vitest run";

  const { stdout } = run(0, recordArgs(repo, key, ["--config-files", "tsconfig.json"]), state);
  assert.strictEqual(stdout, `recorded ${key} (allowed) for ${repo}\n`);

  const written = entry(state, repo);
  assert.strictEqual(written.engine, "codex");
  assert.strictEqual(written.cliVersion, "codex-cli 0.149.1");
  assert.deepStrictEqual(written.pin, { model: "gpt-5.6-sol", effort: "xhigh" });
  assert.deepStrictEqual(written.sandbox, { mode: "workspace-write", networkAccess: true, networkProxy: true });
  assert.match(written.probed, /^\d{4}-\d{2}-\d{2}$/);
  assert.strictEqual(written.lockfileSha256Prefixes.length, 1);
  assert.match(written.lockfileSha256Prefixes[0], HEX16);
  assert.match(written.configSha256Prefix, HEX16);
  assert.deepStrictEqual(written.answers[key].classes, [STATE_CLASS]);
  assert.strictEqual(written.answers[key].answer, "allowed");
  assert.deepStrictEqual(written.answers[key].configFiles, ["tsconfig.json"]);
});

test("a second record merges beside its siblings", () => {
  const { state, repo } = area("record-merge");
  write(repo, "pnpm-lock.yaml", "lock one\n");
  const first = "apps/web: ./node_modules/.bin/tsc --noEmit";
  const second = "apps/api: ./node_modules/.bin/vitest run";

  run(0, recordArgs(repo, first, ["--binary", "apps/web/node_modules/.bin/tsc"]), state);
  const before = entry(state, repo).answers[first];

  run(0, recordArgs(repo, second, ["--note", "listen EPERM 127.0.0.1"], "denied"), state);
  const answers = entry(state, repo).answers;
  assert.deepStrictEqual(Object.keys(answers), [first, second], "the sibling keeps its place and the new key appends");
  assert.deepStrictEqual(answers[first], before, "the sibling answer is untouched");
  assert.strictEqual(answers[second].answer, "denied");
  assert.strictEqual(answers[second].note, "listen EPERM 127.0.0.1");
});

test("another repository's entry survives a record that replaces a malformed one", () => {
  const { state, repo } = area("record-malformed");
  const other = "/somewhere/else";
  const otherEntry = { engine: "claude", answers: "not an object" };
  writeFileSync(cachePath(state), JSON.stringify({ [repo]: { answers: 7 }, [other]: otherEntry }, null, 2));

  run(0, recordArgs(repo, ".: ./bin/tool --version"), state);
  const parsed = cache(state);
  assert.deepStrictEqual(parsed[other], otherEntry, "the other repository's entry is preserved as parsed");
  assert.strictEqual(parsed[repo].engine, "codex", "the malformed entry was replaced wholesale");
});

test("every write recomputes the lockfile and config fingerprints", () => {
  const { state, repo } = area("record-refingerprint");
  write(repo, "pnpm-lock.yaml", "lock one\n");
  write(repo, "vitest.config.ts", "export default {}\n");
  const first = "apps/web: ./node_modules/.bin/vitest run";
  const second = "apps/api: ./node_modules/.bin/tsc --noEmit";

  run(0, recordArgs(repo, first, ["--config-files", "vitest.config.ts"]), state);
  const before = entry(state, repo);

  write(repo, "pnpm-lock.yaml", "lock two\n");
  write(repo, "vitest.config.ts", "export default { cache: false }\n");
  run(0, recordArgs(repo, second), state);
  const after = entry(state, repo);

  assert.notDeepStrictEqual(after.lockfileSha256Prefixes, before.lockfileSha256Prefixes, "lockfiles re-hash");
  assert.notStrictEqual(after.configSha256Prefix, before.configSha256Prefix, "the config union re-hashes");
  assert.strictEqual(
    after.answers[first].configSha256Prefix,
    before.answers[first].configSha256Prefix,
    "a sibling answer keeps the fingerprint it was probed under",
  );
});

test("lockfiles are discovered across a git tree and only at the root without one", () => {
  const tracked = area("record-lockfiles-git");
  write(tracked.repo, "pnpm-lock.yaml", "root lock\n");
  write(tracked.repo, "apps/web/package-lock.json", "{}\n");
  gitInit(tracked.repo);
  run(0, recordArgs(tracked.repo, ".: node --version"), tracked.state);
  assert.strictEqual(
    entry(tracked.state, tracked.repo).lockfileSha256Prefixes.length,
    2,
    "a git checkout contributes one prefix per tracked lockfile at any depth",
  );

  const loose = area("record-lockfiles-loose");
  write(loose.repo, "pnpm-lock.yaml", "root lock\n");
  write(loose.repo, "apps/web/package-lock.json", "{}\n");
  run(0, recordArgs(loose.repo, ".: node --version"), loose.state);
  assert.strictEqual(
    entry(loose.state, loose.repo).lockfileSha256Prefixes.length,
    1,
    "outside a checkout only the repository root is scanned",
  );
});

test("record refuses a classless answer", () => {
  const { state, repo } = area("refuse-classless");
  const args = ["record", repo, ...ENGINE_FACTS, "--command", ".: pnpm --version", "--answer", "allowed"];
  const { stderr } = run(1, args, state);
  assert.match(stderr, /--classes/);
  assertNoCache(state);
});

test("record refuses an unknown answer value", () => {
  const { state, repo } = area("refuse-answer");
  const { stderr } = run(1, recordArgs(repo, ".: pnpm --version", [], "maybe"), state);
  assert.match(stderr, /allowed, denied or hung/);
  assertNoCache(state);
});

test("record refuses wrapper egress on a command recorded with a direct binary", () => {
  const { state, repo } = area("refuse-wrapper");
  const args = recordArgs(repo, "apps/web: ./node_modules/.bin/tsc --noEmit", [
    "--classes",
    WRAPPER_CLASS,
    "--binary",
    "apps/web/node_modules/.bin/tsc",
  ]);
  const { stderr } = run(1, args, state);
  assert.match(stderr, /package-manager wrapper egress/);
  assertNoCache(state);
});

test("record refuses a repository path that is not a directory", () => {
  const { state, repo } = area("refuse-repo");
  const missing = join(repo, "no-such-repo");
  const { stderr } = run(1, recordArgs(missing, ".: node --version"), state);
  assert.match(stderr, /no such directory/);
  assertNoCache(state);
});

test("record refuses a config file that is not on disk", () => {
  const { state, repo } = area("refuse-config");
  const { stderr } = run(1, recordArgs(repo, ".: node --version", ["--config-files", "vitest.config.ts"]), state);
  assert.match(stderr, /vitest\.config\.ts/);
  assertNoCache(state);
});

test("record refuses to merge into a cache that holds no JSON object", () => {
  const { state, repo } = area("refuse-unparseable");
  writeFileSync(cachePath(state), "half a file");
  const { stderr } = run(1, recordArgs(repo, ".: node --version"), state);
  assert.match(stderr, /no JSON object/);
  assert.strictEqual(cacheText(state), "half a file", "the unparseable cache is left exactly as it was");
});

test("a failed write leaves the cache whole and no partial file behind", () => {
  const { state, repo } = area("write-failure");
  run(0, recordArgs(repo, "first: node --version"), state);
  const before = cacheText(state);
  mkdirSync(`${cachePath(state)}.tmp`);

  const { stderr } = run(2, recordArgs(repo, "second: node --version"), state);
  assert.match(stderr, /could not write/);
  assert.strictEqual(cacheText(state), before, "the cache still holds the last write that landed");
});

const WEB_KEY = "apps/web: ./node_modules/.bin/vitest run";
const API_KEY = "apps/api: ./node_modules/.bin/tsc --noEmit";

function probed(name: string): Area {
  const spot = area(name);
  write(spot.repo, "pnpm-lock.yaml", "lock one\n");
  write(spot.repo, "apps/web/vitest.config.ts", "export default {}\n");
  write(spot.repo, "apps/api/tsconfig.json", "{}\n");
  run(
    0,
    recordArgs(spot.repo, WEB_KEY, [
      "--config-files",
      "apps/web/vitest.config.ts",
      "--binary",
      "apps/web/node_modules/.bin/vitest",
      "--state-pins",
      "node_modules cloned into the worktree",
    ]),
    spot.state,
  );
  run(0, recordArgs(spot.repo, API_KEY, ["--config-files", "apps/api/tsconfig.json"]), spot.state);
  return spot;
}

test("a fresh entry checks match, carrying each answer's own facts", () => {
  const { state, repo } = probed("check-fresh");
  const report = check(state, repo, ["--command", WEB_KEY, "--command", API_KEY]);

  assert.strictEqual(report.repo, repo);
  assert.strictEqual(report.entry, "match");
  assert.deepStrictEqual(report.reasons, []);
  assert.deepStrictEqual(report.legacy, []);
  assert.strictEqual(report.commands[WEB_KEY].verdict, "match");
  assert.strictEqual(report.commands[WEB_KEY].answer, "allowed");
  assert.strictEqual(report.commands[WEB_KEY].binary, "apps/web/node_modules/.bin/vitest");
  assert.deepStrictEqual(report.commands[WEB_KEY].statePins, ["node_modules cloned into the worktree"]);
  assert.strictEqual(report.commands[API_KEY].verdict, "match");
  assert.strictEqual(report.summary, "entry match; commands: 2 match, 0 stale, 0 absent");
});

test("an edited lockfile stales the entry and every command under it", () => {
  const { state, repo } = probed("check-lockfile");
  write(repo, "pnpm-lock.yaml", "lock two\n");
  const report = check(state, repo, ["--command", WEB_KEY, "--command", API_KEY]);

  assert.strictEqual(report.entry, "stale");
  assert.deepStrictEqual(report.reasons, ["lockfiles"]);
  assert.deepStrictEqual(report.commands[WEB_KEY].reasons, ["lockfiles"]);
  assert.deepStrictEqual(report.commands[API_KEY].reasons, ["lockfiles"]);
  assert.strictEqual(report.summary, "entry stale (lockfiles); commands: 0 match, 2 stale, 0 absent");
});

test("editing one answer's config file leaves the sibling answer matching", () => {
  const { state, repo } = probed("check-config-one");
  write(repo, "apps/web/vitest.config.ts", "export default { cache: false }\n");
  const report = check(state, repo, ["--command", WEB_KEY, "--command", API_KEY]);

  assert.strictEqual(report.entry, "stale");
  assert.deepStrictEqual(report.reasons, ["config"]);
  assert.strictEqual(report.commands[WEB_KEY].verdict, "stale");
  assert.deepStrictEqual(report.commands[WEB_KEY].reasons, ["config"]);
  assert.strictEqual(report.commands[API_KEY].verdict, "match", "an answer whose own config has not moved stands");
});

test("a config file that is gone is named on the answer that read it", () => {
  const { state, repo } = probed("check-config-missing");
  rmSync(join(repo, "apps/api/tsconfig.json"));
  const report = check(state, repo, ["--command", WEB_KEY, "--command", API_KEY]);

  assert.strictEqual(report.entry, "stale");
  assert.deepStrictEqual(report.commands[API_KEY].reasons, ["config file missing: apps/api/tsconfig.json"]);
  assert.strictEqual(report.commands[WEB_KEY].verdict, "match");
});

test("a moved engine fact stales the entry on its own name", () => {
  const { state, repo } = probed("check-engine-facts");
  const key = ["--command", WEB_KEY];

  assert.deepStrictEqual(check(state, repo, key, facts({ "--engine": "claude" })).reasons, ["engine"]);
  assert.deepStrictEqual(check(state, repo, key, facts({ "--cli-version": "codex-cli 0.150.0" })).reasons, [
    "cliVersion",
  ]);
  assert.deepStrictEqual(check(state, repo, key, facts({ "--effort": "high" })).reasons, ["pin"]);
  assert.deepStrictEqual(check(state, repo, key, facts({ "--network-access": "false" })).reasons, ["sandbox"]);
  assert.deepStrictEqual(check(state, repo, key, facts({ "--network-proxy": "false" })).reasons, ["sandbox"]);
  const stale = check(state, repo, key, facts({ "--cli-version": "codex-cli 0.150.0" }));
  assert.deepStrictEqual(stale.commands[WEB_KEY].reasons, ["cliVersion"]);
});

test("only the facts a check passes are compared", () => {
  const { state, repo } = probed("check-partial-facts");
  const report = check(state, repo, ["--command", WEB_KEY], ["--cli-version", "codex-cli 0.149.1"]);
  assert.strictEqual(report.entry, "match", "an unpassed fact is not a fact this run knows");
});

test("a command the entry never answered is absent", () => {
  const { state, repo } = probed("check-absent-command");
  const unknown = "apps/rates: ./node_modules/.bin/vitest run";
  const report = check(state, repo, ["--command", WEB_KEY, "--command", unknown]);

  assert.strictEqual(report.commands[unknown].verdict, "absent");
  assert.strictEqual(report.commands[unknown].answer, undefined);
  assert.strictEqual(report.commands[WEB_KEY].verdict, "match");
  assert.strictEqual(report.summary, "entry match; commands: 1 match, 0 stale, 1 absent");
});

test("a wrong-shaped entry is absent, names the legacy files, and leaves the cache alone", () => {
  const { state, repo } = area("check-wrong-shape");
  const other = "/somewhere/else";
  const otherEntry = { engine: "claude", answers: {} };
  writeFileSync(cachePath(state), JSON.stringify({ [repo]: { engine: "codex" }, [other]: otherEntry }, null, 2));
  const legacy = write(state, join("capabilities", "cross-codex.json"), "{}\n");
  const before = cacheText(state);

  const report = check(state, repo, ["--command", WEB_KEY]);
  assert.strictEqual(report.entry, "absent");
  assert.deepStrictEqual(report.reasons, ["entry shape"]);
  assert.deepStrictEqual(report.legacy, [legacy]);
  assert.strictEqual(report.commands[WEB_KEY].verdict, "absent");
  assert.strictEqual(report.summary, "entry absent (entry shape); commands: 0 match, 0 stale, 1 absent; legacy: 1");
  assert.strictEqual(cacheText(state), before, "check reads and writes nothing, other repositories included");
});

test("an unrecorded repository and an unreadable cache both check absent", () => {
  const { state, repo } = area("check-absent-entry");
  const fresh = check(state, repo);
  assert.strictEqual(fresh.entry, "absent");
  assert.deepStrictEqual(fresh.reasons, ["no cache file"]);
  assert.strictEqual(fresh.summary, "entry absent (no cache file); commands: none");

  writeFileSync(cachePath(state), JSON.stringify({ "/somewhere/else": { engine: "codex" } }, null, 2));
  assert.deepStrictEqual(check(state, repo).reasons, ["no entry"]);

  writeFileSync(cachePath(state), "half a file");
  assert.deepStrictEqual(check(state, repo).reasons, ["unreadable cache"]);
});

test("sweep removes the legacy capability files and nothing else", () => {
  const { state, repo } = area("sweep-legacy");
  run(0, recordArgs(repo, WEB_KEY), state);
  const cacheBefore = cacheText(state);
  const codex = write(state, join("capabilities", "cross-codex.json"), "{}\n");
  const claude = write(state, join("capabilities", "cross-claude.json"), "{}\n");
  const kept = write(state, join("capabilities", "notes.txt"), "keep me\n");

  const { stdout } = run(0, ["sweep"], state);
  assert.strictEqual(stdout, `removed ${claude}\nremoved ${codex}\n`, "each removed file is named by absolute path");
  assert.strictEqual(existsSync(codex), false);
  assert.strictEqual(existsSync(claude), false);
  assert.strictEqual(existsSync(kept), true, "a file that is not a legacy answer stays");
  assert.strictEqual(cacheText(state), cacheBefore, "the cache itself is untouched");
});

test("sweep removes the legacy directory once it is empty", () => {
  const { state } = area("sweep-empties");
  write(state, join("capabilities", "cross-codex.json"), "{}\n");

  run(0, ["sweep"], state);
  assert.strictEqual(existsSync(join(state, "capabilities")), false);
});

test("sweep with nothing to remove prints nothing and exits 0", () => {
  const { state } = area("sweep-empty");
  const { stdout } = run(0, ["sweep"], state);
  assert.strictEqual(stdout, "");
  assert.strictEqual(existsSync(join(state, "capabilities")), false);
});

test("bad usage exits 2", () => {
  const { state, repo } = area("usage");
  run(2, [], state);
  run(2, ["probe", repo], state);
  run(2, ["record"], state);
  run(2, [...recordArgs(repo, ".: node --version"), "--sandbox-mode", "workspace-write"], state);
  run(2, ["record", repo, "--engine", "codex"], state);
  run(2, [...recordArgs(repo, ".: node --version"), "--command", "second: node --version"], state);
  const badFlag = [
    "record",
    repo,
    "--engine",
    "codex",
    "--cli-version",
    "codex-cli 0.149.1",
    "--model",
    "gpt-5.6-sol",
    "--effort",
    "xhigh",
    "--network-access",
    "yes",
    "--network-proxy",
    "true",
    "--command",
    ".: node --version",
    "--answer",
    "allowed",
    "--classes",
    STATE_CLASS,
  ];
  run(2, badFlag, state);
  run(2, ["check"], state);
  run(2, ["check", repo, "--answer", "allowed"], state);
  run(2, ["sweep", repo], state);
  run(2, ["sweep", "--command", WEB_KEY], state);
  assertNoCache(state);
});
