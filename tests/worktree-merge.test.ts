// Covers scripts/worktree-merge.ts: the baseline manifest, the returned-worktree surface check, the
// verified incorporation and its verification, the receipt gate on removal, and the 0/1/2 exit contract.
// Zero dependencies; runs under Node type stripping — too old a Node fails as a parse error, not a
// version message. Floor in AGENTS.md § The `.ts` sources are unchecked by design.
// Run: node --test tests/<name>.test.ts   ·   every suite: node --test "tests/*.test.ts"

import assert from "node:assert";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SCRIPT = join(REPO_DIR, "scripts", "worktree-merge.ts");

// Realpath-normalized because the script resolves every path it is handed and echoes the resolved
// form; on macOS the tmpdir reaches it through /private, and the assertions have to name that tree.
const TEST_ROOT = realpathSync(mkdtempSync(join(tmpdir(), "agents-kit-worktree-merge-")));

after(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

interface Run {
  readonly stdout: string;
  readonly stderr: string;
}

// The exit status is the contract's outcome channel — 0 did the job, 1 an outcome the script
// decided, 2 a run that could not be carried out — so every run asserts it rather than trusting the
// message that came with it.
function run(expectedStatus: number, args: readonly string[], env?: NodeJS.ProcessEnv): Run {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", env: env ?? process.env });
  assert.strictEqual(
    result.status,
    expectedStatus,
    `expected exit ${expectedStatus}, got ${result.status} for: ${args.join(" ")}\n` +
      `${result.stdout ?? ""}${result.stderr ?? result.error?.message ?? ""}`,
  );
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

// The linked-worktree cases need a real repository: `.git` is a file there, and `remove` reaches
// `git worktree remove` only for a worktree Git registered.
function git(cwd: string, ...args: readonly string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.strictEqual(result.status, 0, `git ${args.join(" ")} failed:\n${result.stderr ?? ""}`);
  return result.stdout ?? "";
}

let caseCounter = 0;

// Each case gets its own tree so a failing assertion never leaves state for the next one to read.
function newCase(): { readonly dir: string; readonly path: (name: string) => string } {
  caseCounter += 1;
  const dir = join(TEST_ROOT, `case-${caseCounter}`);
  mkdirSync(dir, { recursive: true });
  return { dir, path: (name: string) => join(dir, name) };
}

function write(file: string, body: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}

// A shared tree and a worktree seeded from it — the shape every gate below operates on.
function seededPair(dir: string): { readonly shared: string; readonly worktree: string } {
  const shared = join(dir, "shared");
  const worktree = join(dir, "worktree");
  for (const root of [shared, worktree]) {
    write(join(root, "src", "app.ts"), "export const app = 1;\n");
    write(join(root, "src", "util.ts"), "export const util = 1;\n");
    write(join(root, "docs", "readme.md"), "# readme\n");
  }
  return { shared, worktree };
}

function baseline(dir: string, tree: string, extra: readonly string[] = []): string {
  const manifest = join(dir, "baseline.json");
  run(0, ["baseline", tree, "--out", manifest, ...extra]);
  return manifest;
}

test("baseline manifests every path and prunes the tool trees", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  write(join(tree, "src", "app.ts"), "a\n");
  write(join(tree, ".git", "HEAD"), "ref\n");
  write(join(tree, "node_modules", "dep", "index.js"), "x\n");
  write(join(tree, ".nx", "workspace-data", "cache"), "y\n");
  write(join(tree, "cache", "state"), "z\n");
  // A prune is a root-relative path: `cache` at the root, not every directory of that name.
  write(join(tree, "src", "cache", "x.ts"), "c\n");
  write(join(tree, "src", "node_modules", "nested", "index.js"), "n\n");

  const manifest = join(dir, "m.json");
  const result = run(0, ["baseline", tree, "--out", manifest, "--prune", ".nx", "--prune", "./cache/"]);
  assert.match(result.stdout, /paths 2$/m);

  const parsed = JSON.parse(readFileSync(manifest, "utf8"));
  assert.deepStrictEqual(Object.keys(parsed.entries), ["src/app.ts", "src/cache/x.ts"]);
  assert.strictEqual(parsed.root, realpathSync(tree));
  assert.strictEqual(parsed.gitignore, false, "a tree outside any checkout is measured unfiltered");
  assert.deepStrictEqual(parsed.prunes, [".nx", "cache"]);
});

test("prune takes an absolute path inside the root and refuses one outside it or covering it", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  write(join(tree, "src", "app.ts"), "a\n");
  write(join(tree, ".nx", "workspace-data", "cache"), "y\n");

  // A pinned tool-state directory reaches the coordinator as an absolute path, so an absolute prune
  // has to hide it rather than match nothing and leave it measured, escaping every unit's surface.
  const manifest = join(dir, "m.json");
  run(0, ["baseline", tree, "--out", manifest, "--prune", join(tree, ".nx")]);
  assert.deepStrictEqual(Object.keys(JSON.parse(readFileSync(manifest, "utf8")).entries), ["src/app.ts"]);

  assert.match(
    run(2, ["baseline", tree, "--out", manifest, "--prune", join(dir, "elsewhere")]).stderr,
    /prune outside the root/,
  );
  assert.match(run(2, ["baseline", tree, "--out", manifest, "--prune", "."]).stderr, /prune covers the whole tree/);
  assert.match(run(2, ["baseline", tree, "--out", manifest, "--prune", tree]).stderr, /prune covers the whole tree/);
});

test("baseline records a symlink by its target and never walks through it", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  const outside = path("outside");
  write(join(outside, "secret.ts"), "should not be walked\n");
  write(join(tree, "src", "app.ts"), "a\n");
  symlinkSync(outside, join(tree, "linked"));

  const manifest = join(dir, "m.json");
  run(0, ["baseline", tree, "--out", manifest]);
  const parsed = JSON.parse(readFileSync(manifest, "utf8"));
  assert.deepStrictEqual(Object.keys(parsed.entries).sort(), ["linked", "src/app.ts"]);
  assert.strictEqual(parsed.entries["linked"].t, "l");
  assert.strictEqual(parsed.entries["linked"].d, outside);
});

test("check reports an empty delta for an untouched worktree", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);

  const result = run(0, ["check", worktree, "--baseline", manifest, "--surface", "src"]);
  assert.match(result.stdout, /^delta 0 · escapes 0$/m);
});

test("check classifies additions, modifications, deletions, and the executable bit", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);

  write(join(worktree, "src", "app.ts"), "export const app = 2;\n");
  write(join(worktree, "src", "added.ts"), "export const added = 1;\n");
  rmSync(join(worktree, "src", "util.ts"));
  chmodSync(join(worktree, "docs", "readme.md"), 0o755);

  const result = run(0, [
    "check",
    worktree,
    "--baseline",
    manifest,
    "--surface",
    "src",
    "--surface",
    "docs/readme.md",
  ]);
  assert.match(result.stdout, /^modified\s+docs\/readme\.md$/m);
  assert.match(result.stdout, /^added\s+src\/added\.ts$/m);
  assert.match(result.stdout, /^modified\s+src\/app\.ts$/m);
  assert.match(result.stdout, /^deleted\s+src\/util\.ts$/m);
  assert.match(result.stdout, /^delta 4 · escapes 0$/m);
});

test("check refuses a change outside the declared surface", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  write(join(worktree, "src", "app.ts"), "changed\n");
  write(join(worktree, "docs", "readme.md"), "also changed\n");

  const result = run(1, ["check", worktree, "--baseline", manifest, "--surface", "src"]);
  assert.match(result.stdout, /^modified\s+docs\/readme\.md\s+ESCAPE$/m);
  assert.match(result.stdout, /^delta 2 · escapes 1$/m);
  assert.match(result.stderr, /surface escape: docs\/readme\.md/);
});

test("check takes an absolute surface inside the baseline root and refuses one outside it", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  write(join(worktree, "src", "app.ts"), "changed\n");

  run(0, ["check", worktree, "--baseline", manifest, "--surface", join(shared, "src")]);
  const outside = run(2, ["check", worktree, "--baseline", manifest, "--surface", join(dir, "elsewhere")]);
  assert.match(outside.stderr, /surface outside the baseline root/);
});

test("apply incorporates the change set and writes a verified receipt", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");

  write(join(worktree, "src", "app.ts"), "export const app = 2;\n");
  write(join(worktree, "src", "added.ts"), "export const added = 1;\n");
  rmSync(join(worktree, "src", "util.ts"));

  const result = run(0, [
    "apply",
    worktree,
    "--baseline",
    manifest,
    "--into",
    shared,
    "--surface",
    "src",
    "--receipt",
    receipt,
  ]);
  assert.match(result.stdout, /^applied 3 · verified$/m);

  assert.strictEqual(readFileSync(join(shared, "src", "app.ts"), "utf8"), "export const app = 2;\n");
  assert.strictEqual(readFileSync(join(shared, "src", "added.ts"), "utf8"), "export const added = 1;\n");
  assert.ok(!existsSync(join(shared, "src", "util.ts")), "the deletion is mirrored");
  assert.strictEqual(readFileSync(join(shared, "docs", "readme.md"), "utf8"), "# readme\n");

  const parsed = JSON.parse(readFileSync(receipt, "utf8"));
  assert.strictEqual(parsed.verified, true);
  assert.deepStrictEqual(
    parsed.applied.map((change: { path: string; op: string }) => `${change.op} ${change.path}`),
    ["added src/added.ts", "modified src/app.ts", "deleted src/util.ts"],
  );
});

test("apply changes nothing and writes no receipt on a surface escape", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  write(join(worktree, "src", "app.ts"), "changed\n");
  write(join(worktree, "docs", "readme.md"), "escaped\n");

  const result = run(1, [
    "apply",
    worktree,
    "--baseline",
    manifest,
    "--into",
    shared,
    "--surface",
    "src",
    "--receipt",
    receipt,
  ]);
  assert.match(result.stderr, /surface escape, nothing applied/);
  assert.strictEqual(readFileSync(join(shared, "src", "app.ts"), "utf8"), "export const app = 1;\n");
  assert.ok(!existsSync(receipt), "no receipt is written for work that never landed");
});

test("apply mirrors a symlink rather than the tree behind it", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  symlinkSync(join(worktree, "src", "app.ts"), join(worktree, "src", "alias.ts"));

  run(0, [
    "apply",
    worktree,
    "--baseline",
    manifest,
    "--into",
    shared,
    "--surface",
    "src",
    "--receipt",
    receipt,
  ]);
  assert.ok(lstatSync(join(shared, "src", "alias.ts")).isSymbolicLink(), "the link is a link, not a copy");
  assert.strictEqual(readFileSync(join(shared, "src", "alias.ts"), "utf8"), "export const app = 1;\n");

  // An absolute target inside the worktree is re-pointed at the shared tree, so the link outlives it.
  run(0, ["remove", worktree, "--receipt", receipt]);
  assert.ok(!existsSync(worktree));
  assert.strictEqual(readlinkSync(join(shared, "src", "alias.ts")), join(realpathSync(shared), "src", "app.ts"));
  assert.strictEqual(readFileSync(join(shared, "src", "alias.ts"), "utf8"), "export const app = 1;\n");
});

test("remove takes a worktree carrying a verified receipt", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  write(join(worktree, "src", "app.ts"), "changed\n");

  run(0, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]);
  const result = run(0, ["remove", worktree, "--receipt", receipt]);
  assert.match(result.stdout, /^removed /m);
  assert.ok(!existsSync(worktree), "the worktree is gone");
  assert.strictEqual(readFileSync(join(shared, "src", "app.ts"), "utf8"), "changed\n");
});

test("remove refuses a worktree with no receipt — the ordering gate", () => {
  const { dir } = newCase();
  const { worktree } = seededPair(dir);

  const result = run(1, ["remove", worktree, "--receipt", join(dir, "absent.json")]);
  assert.match(result.stderr, /no readable receipt/);
  assert.ok(existsSync(worktree), "a worktree whose work is unproved stays on disk");
});

test("remove refuses an unverified receipt and one naming another worktree", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);

  const unverified = join(dir, "unverified.json");
  writeFileSync(
    unverified,
    JSON.stringify({ version: 2, worktree: realpathSync(worktree), into: shared, verified: false, applied: [] }),
  );
  assert.match(run(1, ["remove", worktree, "--receipt", unverified]).stderr, /unverified incorporation/);

  const otherWorktree = join(dir, "other-worktree");
  const mismatched = join(dir, "mismatched.json");
  writeFileSync(
    mismatched,
    JSON.stringify({ version: 2, worktree: otherWorktree, into: shared, verified: true, applied: [] }),
  );
  assert.match(run(1, ["remove", worktree, "--receipt", mismatched]).stderr, /receipt is for /);
  assert.ok(existsSync(worktree), "neither refusal removes anything");
});

test("remove refuses when an applied path is no longer as the receipt recorded it", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  write(join(worktree, "src", "added.ts"), "export const added = 1;\n");

  run(0, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]);
  rmSync(join(shared, "src", "added.ts"));

  const result = run(1, ["remove", worktree, "--receipt", receipt]);
  assert.match(result.stderr, /applied paths are no longer as recorded: src\/added\.ts/);
  assert.ok(existsSync(worktree), "the worktree survives to be re-applied from");
});

test("usage errors exit 2", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);

  assert.match(run(2, []).stderr, /usage: node scripts\/worktree-merge\.ts/);
  assert.match(run(2, ["frobnicate", worktree]).stderr, /unknown command frobnicate/);
  assert.match(run(2, ["check", worktree, "--baseline", manifest]).stderr, /requires at least one --surface/);
  assert.match(run(2, ["check", worktree, "--surface", "src"]).stderr, /requires --baseline/);
  assert.match(run(2, ["check", worktree, worktree, "--baseline", manifest]).stderr, /exactly one path argument/);
  assert.match(run(2, ["check", worktree, "--baseline", manifest, "--jazz", "x"]).stderr, /unknown option --jazz/);
  assert.match(run(2, ["discard", worktree, "--receipt", manifest]).stderr, /discard does not take --receipt/);
  assert.match(run(2, ["baseline", worktree, "--out"]).stderr, /--out takes a value/);
  assert.match(
    run(2, ["check", worktree, "--baseline", manifest, "--surface", ""]).stderr,
    /--surface takes a value/,
  );
  assert.match(run(2, ["baseline", join(dir, "absent"), "--out", join(dir, "o.json")]).stderr, /not a directory/);
  assert.match(
    run(2, ["check", worktree, "--baseline", join(dir, "absent.json"), "--surface", "src"]).stderr,
    /cannot read manifest/,
  );

  // Every shape clause readManifest checks, one at a time. A dropped clause reads a missing field as
  // an empty one — an absent `prunes` measures the tool trees a run pinned, an absent `gitignore`
  // walks a checkout unfiltered against a baseline that was filtered, an absent `entries` calls every
  // path an addition — so each is asserted rather than left to the parse that already passed.
  for (const [field, value] of [
    ["version", 1],
    ["root", 42],
    ["gitignore", undefined],
    ["prunes", undefined],
    ["entries", undefined],
  ] as const) {
    const parsed = JSON.parse(readFileSync(manifest, "utf8"));
    if (value === undefined) delete parsed[field];
    else parsed[field] = value;
    const broken = join(dir, `broken-${field}.json`);
    writeFileSync(broken, JSON.stringify(parsed));
    assert.match(
      run(2, ["check", worktree, "--baseline", broken, "--surface", "src"]).stderr,
      /not a worktree-merge manifest/,
      `a manifest whose ${field} is wrong must be refused`,
    );
  }
});

test("check prunes .git and node_modules whatever their type, and remove takes a linked worktree", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), "node_modules\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  write(join(shared, "node_modules", "dep", "index.js"), "x\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  git(shared, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");
  const worktree = path("worktree");
  git(shared, "worktree", "add", "-q", worktree, "HEAD");
  // A linked worktree's `.git` is a file; seeding links `node_modules` rather than copying it.
  assert.ok(lstatSync(join(worktree, ".git")).isFile());
  symlinkSync(join(shared, "node_modules"), join(worktree, "node_modules"));
  write(join(worktree, "src", "app.ts"), "export const app = 2;\n");

  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  const checked = run(0, ["check", worktree, "--baseline", manifest, "--surface", "src"]);
  assert.match(checked.stdout, /^delta 1 · escapes 0$/m);
  run(0, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]);
  assert.strictEqual(readFileSync(join(shared, "src", "app.ts"), "utf8"), "export const app = 2;\n");
  run(0, ["remove", worktree, "--receipt", receipt]);
  assert.ok(!existsSync(worktree), "the worktree is gone");
  assert.strictEqual(git(shared, "worktree", "list").trim().split("\n").length, 1, "Git no longer lists it");
});

// `git worktree add` carries no git-ignored file into the worktree it creates, and a build makes its
// own there, so a walk measuring them reads each of the shared tree's as a deletion and each of the
// worktree's as an addition — every one of them an escape from the unit's declared surface.
test("check measures no git-ignored file on either side, and still measures a force-tracked one", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), ".DS_Store\ndist\nlocal.json\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  write(join(shared, "local.json"), "{}\n");
  write(join(shared, ".DS_Store"), "finder\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  git(shared, "add", "-f", "local.json");
  git(shared, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");
  // The case turns on local.json being a path Git ignores by pattern and tracks anyway; were the
  // pattern not matching it, the assertions below would pass on an ordinary tracked file.
  assert.strictEqual(git(shared, "check-ignore", "--no-index", "local.json").trim(), "local.json");

  const worktree = path("worktree");
  git(shared, "worktree", "add", "-q", worktree, "HEAD");
  write(join(worktree, "dist", "out.js"), "built\n");
  write(join(worktree, "local.json"), '{ "edited": true }\n');

  const manifest = baseline(dir, shared);
  const parsed = JSON.parse(readFileSync(manifest, "utf8"));
  assert.strictEqual(parsed.gitignore, true);
  assert.deepStrictEqual(Object.keys(parsed.entries), [".gitignore", "local.json", "src/app.ts"]);

  const checked = run(0, ["check", worktree, "--baseline", manifest, "--surface", "local.json"]);
  assert.match(checked.stdout, /^modified\s+local\.json$/m);
  assert.match(checked.stdout, /^delta 1 · escapes 0$/m);
});

// Measuring the two sides under different rules is the failure being prevented: a tree that cannot
// reproduce the baseline's git-ignore filter reads every ignored path the baseline excluded as an
// addition the unit never made, so both walk-consuming subcommands refuse rather than compare.
test("check and apply refuse a tree that cannot reproduce the baseline's git-ignore filter", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), "dist\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  write(join(shared, "dist", "out.js"), "built\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  git(shared, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");

  const manifest = baseline(dir, shared);
  const parsed = JSON.parse(readFileSync(manifest, "utf8"));
  assert.strictEqual(parsed.gitignore, true);
  assert.deepStrictEqual(Object.keys(parsed.entries), [".gitignore", "src/app.ts"]);

  const copy = path("copy");
  cpSync(shared, copy, { recursive: true });
  rmSync(join(copy, ".git"), { recursive: true, force: true });
  assert.ok(existsSync(join(copy, "dist", "out.js")), "the copy carries the ignored path the baseline omitted");

  const refusal = /is not a Git checkout, and the baseline it is measured against excluded git-ignored paths/;
  assert.match(run(2, ["check", copy, "--baseline", manifest, "--surface", "src"]).stderr, refusal);

  const receipt = join(dir, "receipt.json");
  assert.match(
    run(2, ["apply", copy, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]).stderr,
    refusal,
  );
  assert.ok(!existsSync(receipt), "no receipt for a run that was never carried out");
});

// check-ignore answers one line per ignored path, and a pnpm store or a framework cache alone runs
// past Node's default 1 MiB reply buffer — the walk reads the whole answer or fails on exactly the
// trees the filter exists to drop.
test("baseline reads a git-ignore answer longer than the default reply buffer", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), "cache\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  git(shared, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");
  const deep = join(shared, "cache", "a".repeat(100));
  mkdirSync(deep, { recursive: true });
  for (let i = 0; i < 12000; i++) writeFileSync(join(deep, `f${i}`), "");

  const parsed = JSON.parse(readFileSync(baseline(dir, shared), "utf8"));
  assert.deepStrictEqual(Object.keys(parsed.entries), [".gitignore", "src/app.ts"]);
});

// Each side asks its own index, and a worktree's index is HEAD: a path force-added to the shared
// index but not yet committed is tracked on one side and an ignored untracked file on the other, so
// a filter applied alike to both reads it as deleted — and apply would carry that deletion out.
test("check keeps measuring a staged force-added ignored path the worktree holds untracked", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), "local.json\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  git(shared, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");
  write(join(shared, "local.json"), "{}\n");
  git(shared, "add", "-f", "local.json");

  const worktree = path("worktree");
  git(shared, "worktree", "add", "-q", worktree, "HEAD");
  write(join(worktree, "local.json"), "{}\n");
  assert.strictEqual(git(worktree, "check-ignore", "local.json").trim(), "local.json", "untracked and ignored there");

  const manifest = baseline(dir, shared);
  assert.ok("local.json" in JSON.parse(readFileSync(manifest, "utf8")).entries, "tracked in the shared index");
  assert.match(
    run(0, ["check", worktree, "--baseline", manifest, "--surface", "local.json"]).stdout,
    /^delta 0 · escapes 0$/m,
  );

  write(join(worktree, "local.json"), '{ "edited": true }\n');
  const receipt = join(dir, "receipt.json");
  const applied = run(0, [
    "apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "local.json", "--receipt", receipt,
  ]);
  assert.match(applied.stdout, /^modified\s+local\.json$/m);
  assert.match(applied.stdout, /^applied 1 · verified$/m);
  assert.strictEqual(readFileSync(join(shared, "local.json"), "utf8"), '{ "edited": true }\n');
});

// The filter drops an ignored path on both sides, so a unit told to write one would have that work
// read as no change at all: `apply` would report `verified` over the loss and `remove` would then take
// the worktree holding the only copy. Inside the declared surface the difference is reported and
// refused instead; outside it a worktree's own build output stays unmeasured.
test("check reports and apply refuses a git-ignored path that differs inside the declared surface", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), ".claude/settings.local.json\ndist\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  write(join(shared, ".claude", "settings.local.json"), '{ "allow": [] }\n');
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  git(shared, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");

  const manifest = baseline(dir, shared);
  const parsed = JSON.parse(readFileSync(manifest, "utf8"));
  assert.ok(!(".claude/settings.local.json" in parsed.entries), "ignored, so the baseline never held it");

  const worktree = path("worktree");
  git(shared, "worktree", "add", "-q", worktree, "HEAD");
  write(join(worktree, ".claude", "settings.local.json"), '{ "allow": ["Bash"] }\n');
  write(join(worktree, "dist", "out.js"), "built\n");

  const checked = run(0, ["check", worktree, "--baseline", manifest, "--surface", ".claude"]);
  assert.match(checked.stdout, /^ignored {2}\.claude\/settings\.local\.json {2}NOT MEASURED$/m);
  assert.match(checked.stdout, /^delta 0 · escapes 0 · ignored-divergent 1$/m);
  assert.doesNotMatch(checked.stdout, /dist\/out\.js/, "build output sits outside the surface, unmeasured");

  const receipt = join(dir, "receipt.json");
  const refused = run(1, [
    "apply", worktree, "--baseline", manifest, "--into", shared, "--surface", ".claude", "--receipt", receipt,
  ]);
  assert.match(refused.stderr, /git-ignored paths inside the surface differ .* nothing applied/);
  assert.ok(!existsSync(receipt), "no receipt for work that was never carried");
  assert.strictEqual(
    readFileSync(join(shared, ".claude", "settings.local.json"), "utf8"),
    '{ "allow": [] }\n',
    "the shared tree is untouched by the refusal",
  );
});

// The walk descends before it filters, so an ignored directory it cannot read used to abort the whole
// run at exit 2 — on exactly the trees the filter exists to drop, and with no `--prune` left to reach
// for once callers are told an ignored path needs none. One the filter does not cover still refuses.
test("baseline tolerates an unreadable directory the repository ignores, and refuses one it does not", { skip: process.getuid?.() === 0 && "root ignores directory modes" }, () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), "cache\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  write(join(shared, "cache", "blocked", "x"), "junk\n");
  write(join(shared, "vendor", "blocked", "y"), "kept\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  git(shared, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");

  chmodSync(join(shared, "cache", "blocked"), 0o000);
  try {
    const parsed = JSON.parse(readFileSync(baseline(dir, shared), "utf8"));
    assert.deepStrictEqual(Object.keys(parsed.entries), [".gitignore", "src/app.ts", "vendor/blocked/y"]);

    // The same directory outside the ignore rules is still a run that could not be carried out.
    chmodSync(join(shared, "vendor", "blocked"), 0o000);
    assert.match(run(2, ["baseline", shared, "--out", join(dir, "m2.json")]).stderr, /cannot read .*vendor\/blocked/);
  } finally {
    chmodSync(join(shared, "cache", "blocked"), 0o755);
    chmodSync(join(shared, "vendor", "blocked"), 0o755);
  }
});

// A same-tree comparison — the boundary role — reads every ignored path against itself, so the
// divergence check can never fire there and the two-segment trailer stays exactly as it was.
test("check on the baseline's own tree never reports a divergent ignored path", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), "dist\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  write(join(shared, "dist", "out.js"), "built\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  git(shared, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");

  const manifest = baseline(dir, shared);
  write(join(shared, "dist", "out.js"), "rebuilt\n");
  assert.match(run(0, ["check", shared, "--baseline", manifest, "--surface", "."]).stdout, /^delta 0 · escapes 0$/m);
});

test("apply replaces a symlink with the worktree's regular file instead of writing through it", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  symlinkSync("app.ts", join(shared, "src", "alias.ts"));
  symlinkSync("app.ts", join(worktree, "src", "alias.ts"));
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  rmSync(join(worktree, "src", "alias.ts"));
  write(join(worktree, "src", "alias.ts"), "export const alias = 1;\n");

  run(0, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src/alias.ts", "--receipt", receipt]);
  assert.ok(!lstatSync(join(shared, "src", "alias.ts")).isSymbolicLink(), "the path is now a regular file");
  assert.strictEqual(readFileSync(join(shared, "src", "alias.ts"), "utf8"), "export const alias = 1;\n");
  assert.strictEqual(readFileSync(join(shared, "src", "app.ts"), "utf8"), "export const app = 1;\n", "the link's target is untouched");
});

test("apply replaces a directory the worktree turned into a file", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  write(join(shared, "src", "zoo", "x.ts"), "x\n");
  write(join(worktree, "src", "zoo", "x.ts"), "x\n");
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  rmSync(join(worktree, "src", "zoo"), { recursive: true });
  write(join(worktree, "src", "zoo"), "now a file\n");

  const result = run(0, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]);
  assert.match(result.stdout, /^applied 2 · verified$/m);
  assert.strictEqual(readFileSync(join(shared, "src", "zoo"), "utf8"), "now a file\n");
});

// The failure is a directory mode the copy cannot write past; root ignores modes, so under a
// privileged runner the copy would succeed and the case would assert a failure that never came.
test("apply reports the landed/missed split and writes no receipt when a copy fails part-way", { skip: process.getuid?.() === 0 && "root ignores directory modes" }, () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  write(join(worktree, "src", "app.ts"), "landed\n");
  write(join(worktree, "src", "locked", "new.ts"), "never lands\n");
  mkdirSync(join(shared, "src", "locked"));
  chmodSync(join(shared, "src", "locked"), 0o555);
  try {
    const result = run(1, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]);
    assert.match(result.stdout, /^landed   src\/app\.ts$/m);
    assert.match(result.stderr, /incorporation did not verify \(.*EACCES.*\)/);
    assert.match(result.stderr, /did not land 1: src\/locked\/new\.ts/);
    assert.ok(!existsSync(receipt), "no receipt for work that only partly landed");
    assert.strictEqual(readFileSync(join(shared, "src", "app.ts"), "utf8"), "landed\n", "what landed stays reported as landed");
  } finally {
    chmodSync(join(shared, "src", "locked"), 0o755);
  }
});

// Same directory-mode trick as the split case above, and the same reason root has to sit it out.
test("apply writes no landed list when nothing landed at all", { skip: process.getuid?.() === 0 && "root ignores directory modes" }, () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  write(join(worktree, "src", "locked", "new.ts"), "never lands\n");
  mkdirSync(join(shared, "src", "locked"));
  chmodSync(join(shared, "src", "locked"), 0o555);
  try {
    const result = run(1, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]);
    assert.match(result.stdout, /^added\s+src\/locked\/new\.ts\ndelta 1 · escapes 0\n$/);
    assert.match(result.stderr, /landed 0, did not land 1/);
  } finally {
    chmodSync(join(shared, "src", "locked"), 0o755);
  }
});

// Past the copy the split is measured, never assumed: a verification walk that throws leaves `apply`
// unable to say what landed, so the refusal names the split uncomputable rather than reporting a zero
// it never measured, and the coordinator's restore is unconditional from there. `apply` asks git
// exactly twice on a checkout-backed pair, both `check-ignore` on the worktree: once for the surface
// check before the copy, once for this verification after it. The shim passes the first through and
// fails the second with an answer that is neither a listing nor "not a git repository" — dubious
// ownership, the shape a container gives — so the throw lands past the copy and nowhere else.
test("apply names the split uncomputable when the post-copy verification cannot walk", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), "dist\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  git(shared, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");

  const worktree = path("worktree");
  git(shared, "worktree", "add", "-q", worktree, "HEAD");
  write(join(worktree, "src", "app.ts"), "changed\n");

  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");

  const shim = join(dir, "bin");
  const spent = join(dir, "first-call-spent");
  write(
    join(shim, "git"),
    `#!/bin/sh\nif [ -e "${spent}" ]; then\n` +
      '  echo "fatal: detected dubious ownership in repository" >&2\n  exit 128\nfi\n' +
      `: > "${spent}"\nPATH="${process.env.PATH ?? ""}"\nexport PATH\nexec git "$@"\n`,
  );
  chmodSync(join(shim, "git"), 0o755);

  const result = run(
    1,
    ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt],
    { ...process.env, PATH: shim },
  );
  assert.match(result.stderr, /cannot verify the incorporation: .*dubious ownership/);
  assert.match(result.stderr, /which paths landed cannot be computed/);
  assert.doesNotMatch(result.stderr, /landed \d/, "a branch that cannot measure reports no count");
  assert.ok(!existsSync(receipt), "no receipt for an incorporation that could not be verified");
  assert.strictEqual(readFileSync(join(shared, "src", "app.ts"), "utf8"), "changed\n", "the copy did land");
});

test("a surface of the root itself covers every path", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  write(join(worktree, "src", "app.ts"), "changed\n");
  write(join(worktree, "docs", "readme.md"), "changed\n");

  assert.match(run(0, ["check", worktree, "--baseline", manifest, "--surface", "."]).stdout, /^delta 2 · escapes 0$/m);
  assert.match(run(0, ["check", worktree, "--baseline", manifest, "--surface", shared]).stdout, /^delta 2 · escapes 0$/m);
});

test("remove matches a receipt through a symlinked spelling of the worktree path", () => {
  const { dir, path } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  write(join(worktree, "src", "app.ts"), "changed\n");
  const alias = path("worktree-alias");
  symlinkSync(worktree, alias);

  run(0, ["apply", alias, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]);
  run(0, ["remove", worktree, "--receipt", receipt]);
  assert.ok(!existsSync(worktree), "the worktree is gone");
});

test("apply never deletes through a symlink the worktree put in a directory's place", () => {
  const { dir, path } = newCase();
  const { shared, worktree } = seededPair(dir);
  const outside = path("outside");
  write(join(outside, "child"), "victim\n");
  write(join(shared, "dir", "child"), "child\n");
  write(join(worktree, "dir", "child"), "child\n");
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  rmSync(join(worktree, "dir"), { recursive: true });
  symlinkSync(outside, join(worktree, "dir"));

  const result = run(0, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", ".", "--receipt", receipt]);
  assert.match(result.stdout, /^applied 2 · verified$/m);
  assert.strictEqual(readFileSync(join(outside, "child"), "utf8"), "victim\n", "nothing outside the tree is touched");
  assert.ok(lstatSync(join(shared, "dir")).isSymbolicLink());
});

test("apply refuses a shared tree that is not the baseline's root or overlaps the worktree", () => {
  const { dir, path } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  const other = path("other");
  write(join(other, "src", "app.ts"), "export const app = 1;\n");

  assert.match(
    run(2, ["apply", shared, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]).stderr,
    /must be disjoint trees/,
  );
  assert.match(
    run(2, ["apply", worktree, "--baseline", manifest, "--into", other, "--surface", "src", "--receipt", receipt]).stderr,
    /is not the baseline's root/,
  );
  // A misdirected run stays exit 2 even when the worktree also escapes its surface: exit 1 would
  // report an outcome for a run that was never carried out.
  write(join(worktree, "docs", "readme.md"), "escaped\n");
  assert.match(
    run(2, ["apply", worktree, "--baseline", manifest, "--into", other, "--surface", "src", "--receipt", receipt]).stderr,
    /is not the baseline's root/,
  );
  assert.ok(!existsSync(receipt));
});

test("remove and discard refuse a checkout and never fall back to deleting one", () => {
  const { dir, path } = newCase();
  const checkout = path("checkout");
  write(join(checkout, "src", "app.ts"), "a\n");
  git(checkout, "init", "-q");
  const receipt = join(dir, "receipt.json");
  writeFileSync(
    receipt,
    JSON.stringify({ version: 2, worktree: realpathSync(checkout), into: realpathSync(checkout), verified: true, applied: [] }),
  );

  assert.match(run(1, ["remove", checkout, "--receipt", receipt]).stderr, /refusing to remove .*: it holds a \.git directory/);
  assert.match(run(1, ["discard", checkout]).stderr, /refusing to remove .*: it holds a \.git directory/);
  assert.ok(existsSync(join(checkout, "src", "app.ts")), "the checkout is intact");
});

test("remove and discard refuse repository content that carries no worktree pointer", () => {
  const { dir, path } = newCase();
  const checkout = path("checkout");
  write(join(checkout, "src", "app.ts"), "a\n");
  git(checkout, "init", "-q");
  const inside = join(checkout, "src");

  assert.match(run(1, ["discard", inside]).stderr, /sits inside the .* checkout and carries no worktree pointer/);
  const receipt = join(dir, "receipt.json");
  writeFileSync(
    receipt,
    JSON.stringify({ version: 2, worktree: realpathSync(inside), into: realpathSync(checkout), verified: true, applied: [] }),
  );
  assert.match(run(1, ["remove", inside, "--receipt", receipt]).stderr, /sits inside the .* checkout/);
  assert.ok(existsSync(join(inside, "app.ts")), "repository content survives both");
});

// A git that answers neither a toplevel nor "not a git repository" leaves the guard unable to read the
// tree — the shape dubious ownership takes in a container, and an absent git too. The refusal above is
// what stands between a mistaken path and a recursive delete, so it must not fall through when the
// answer it depends on never arrives.
test("remove and discard refuse when git cannot say whether the path is repository content", () => {
  const { dir, path } = newCase();
  const checkout = path("checkout");
  write(join(checkout, "src", "app.ts"), "a\n");
  git(checkout, "init", "-q");
  const inside = join(checkout, "src");

  const shim = join(dir, "bin");
  write(join(shim, "git"), `#!/bin/sh\necho "fatal: detected dubious ownership in repository" >&2\nexit 128\n`);
  chmodSync(join(shim, "git"), 0o755);
  const blinded = { ...process.env, PATH: shim };

  assert.match(run(2, ["discard", inside], blinded).stderr, /cannot tell whether .* sits inside a checkout/);
  const receipt = join(dir, "receipt.json");
  writeFileSync(
    receipt,
    JSON.stringify({ version: 2, worktree: realpathSync(inside), into: realpathSync(checkout), verified: true, applied: [] }),
  );
  assert.match(run(2, ["remove", inside, "--receipt", receipt], blinded).stderr, /cannot tell whether .* sits inside a checkout/);
  assert.ok(existsSync(join(inside, "app.ts")), "repository content survives a guard that cannot read");
});

test("apply refuses a path the shared tree changed since the baseline, before writing anything", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  write(join(shared, "src", "app.ts"), "earlier unit\n");
  write(join(worktree, "src", "app.ts"), "this unit\n");
  write(join(worktree, "src", "added.ts"), "new\n");

  const result = run(1, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]);
  assert.match(result.stderr, /conflict, nothing applied .*: src\/app\.ts/);
  assert.strictEqual(readFileSync(join(shared, "src", "app.ts"), "utf8"), "earlier unit\n");
  assert.ok(!existsSync(join(shared, "src", "added.ts")), "no change lands beside a conflict");
  assert.ok(!existsSync(receipt));
});

test("apply incorporates a file the worktree turned into a directory, and remove takes it", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  write(join(shared, "src", "zoo"), "a file\n");
  write(join(worktree, "src", "zoo"), "a file\n");
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  rmSync(join(worktree, "src", "zoo"));
  write(join(worktree, "src", "zoo", "x.ts"), "x\n");

  const result = run(0, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]);
  assert.match(result.stdout, /^applied 2 · verified$/m);
  assert.strictEqual(readFileSync(join(shared, "src", "zoo", "x.ts"), "utf8"), "x\n");
  run(0, ["remove", worktree, "--receipt", receipt]);
  assert.ok(!existsSync(worktree));
});

test("apply removes the directories a deletion emptied, stopping at the declared surface", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  const worktree = path("worktree");
  for (const root of [shared, worktree]) write(join(root, "src", "zoo", "x.ts"), "x\n");
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  rmSync(join(worktree, "src", "zoo"), { recursive: true });

  run(0, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src/zoo", "--receipt", receipt]);
  assert.ok(!existsSync(join(shared, "src", "zoo")), "the emptied directory goes with its contents");
  assert.ok(existsSync(join(shared, "src")), "the walk stops at the surface, leaving src standing");
});

test("a prune given at check time filters the baseline too", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");

  assert.match(
    run(0, ["check", worktree, "--baseline", manifest, "--surface", ".", "--prune", "src"]).stdout,
    /^delta 0 · escapes 0$/m,
  );
  // An absolute prune resolves against the baseline's root, the same root a surface resolves against.
  assert.match(
    run(0, ["check", worktree, "--baseline", manifest, "--surface", ".", "--prune", join(shared, "src")]).stdout,
    /^delta 0 · escapes 0$/m,
  );
  run(0, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", ".", "--receipt", receipt, "--prune", "src/"]);
  assert.strictEqual(readFileSync(join(shared, "src", "app.ts"), "utf8"), "export const app = 1;\n", "the pruned seed files stay");
});

test("discard removes a linked worktree or a plain scratch directory that earned no receipt", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, "src", "app.ts"), "a\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  git(shared, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "seed");
  const worktree = path("worktree");
  git(shared, "worktree", "add", "-q", worktree, "HEAD");
  write(join(worktree, "src", "escaped.ts"), "never merged\n");
  const plain = path("plain");
  write(join(plain, "x"), "x\n");

  assert.match(run(0, ["discard", worktree]).stdout, /^discarded /m);
  assert.ok(!existsSync(worktree));
  assert.strictEqual(git(shared, "worktree", "list").trim().split("\n").length, 1, "Git no longer lists it");
  run(0, ["discard", plain]);
  assert.ok(!existsSync(plain));
  assert.match(run(2, ["discard", worktree]).stderr, /not a directory/);
  assert.match(run(2, ["discard", dir, dir]).stderr, /exactly one path argument/);
});

test("apply replaces a symlinked directory with the real one the worktree put there", () => {
  const { dir, path } = newCase();
  const { shared, worktree } = seededPair(dir);
  const elsewhere = path("elsewhere");
  write(join(elsewhere, "child"), "linked\n");
  symlinkSync(elsewhere, join(shared, "dir"));
  symlinkSync(elsewhere, join(worktree, "dir"));
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  unlinkSync(join(worktree, "dir"));
  write(join(worktree, "dir", "child"), "real\n");

  const result = run(0, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", ".", "--receipt", receipt]);
  assert.match(result.stdout, /^applied 2 · verified$/m);
  assert.ok(lstatSync(join(shared, "dir")).isDirectory(), "the link gave way to a directory");
  assert.strictEqual(readFileSync(join(shared, "dir", "child"), "utf8"), "real\n");
  assert.strictEqual(readFileSync(join(elsewhere, "child"), "utf8"), "linked\n", "the old target is untouched");
  run(0, ["remove", worktree, "--receipt", receipt]);
});

test("apply refuses an added path the shared tree now holds a directory at", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  const receipt = join(dir, "receipt.json");
  write(join(worktree, "src", "gen"), "generated\n");
  // A directory the baseline never recorded, sitting where the unit adds a file. leafAt does not see
  // one, so without the occupant check it reads as absent, the copy clears it recursively, and the
  // run still writes a verified receipt.
  write(join(shared, "src", "gen", "keep.txt"), "unrelated\n");

  const refused = run(1, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]);
  assert.match(refused.stderr, /conflict, nothing applied/);
  assert.match(refused.stderr, /src\/gen/);
  assert.strictEqual(readFileSync(join(shared, "src", "gen", "keep.txt"), "utf8"), "unrelated\n");
  assert.ok(!existsSync(receipt), "no receipt for a refused apply");

  // An empty directory holds nothing the change set has to account for, so it is not a conflict.
  rmSync(join(shared, "src", "gen"), { recursive: true });
  mkdirSync(join(shared, "src", "gen"));
  run(0, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]);
  assert.strictEqual(readFileSync(join(shared, "src", "gen"), "utf8"), "generated\n");
});
