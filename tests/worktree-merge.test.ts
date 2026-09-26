import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
const TEST_ROOT = realpathSync(mkdtempSync(join(tmpdir(), "agents-kit-worktree-merge-")));

after(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

interface Run {
  readonly stdout: string;
  readonly stderr: string;
}

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

function git(cwd: string, ...args: readonly string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.strictEqual(result.status, 0, `git ${args.join(" ")} failed:\n${result.stderr ?? ""}`);
  return result.stdout ?? "";
}

function commit(cwd: string, ...args: readonly string[]): void {
  git(cwd, "-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false", "commit", ...args);
}

let caseCounter = 0;

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

function checkedManifest(dir: string, tree: string): string {
  const reference = baseline(dir, tree);
  const manifest = join(dir, "checked.json");
  run(0, ["check", tree, "--baseline", reference, "--surface", ".", "--out", manifest]);
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
  commit(shared, "-qm", "seed");
  const worktree = path("worktree");
  git(shared, "worktree", "add", "-q", worktree, "HEAD");

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
  commit(shared, "-qm", "seed");

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

test("check and apply refuse a tree that cannot reproduce the baseline's git-ignore filter", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), "dist\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  write(join(shared, "dist", "out.js"), "built\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  commit(shared, "-qm", "seed");

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

test("baseline reads a git-ignore answer longer than the default reply buffer", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), "cache\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  commit(shared, "-qm", "seed");
  const deep = join(shared, "cache", "a".repeat(100));
  mkdirSync(deep, { recursive: true });
  for (let i = 0; i < 12000; i++) writeFileSync(join(deep, `f${i}`), "");

  const parsed = JSON.parse(readFileSync(baseline(dir, shared), "utf8"));
  assert.deepStrictEqual(Object.keys(parsed.entries), [".gitignore", "src/app.ts"]);
});

test("check keeps measuring a staged force-added ignored path the worktree holds untracked", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), "local.json\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  commit(shared, "-qm", "seed");
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

test("check reports and apply refuses a git-ignored path that differs inside the declared surface", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), ".claude/settings.local.json\ndist\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  write(join(shared, ".claude", "settings.local.json"), '{ "allow": [] }\n');
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  commit(shared, "-qm", "seed");

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

test("baseline tolerates an unreadable directory the repository ignores, and refuses one it does not", { skip: process.getuid?.() === 0 && "root ignores directory modes" }, () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), "cache\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  write(join(shared, "cache", "blocked", "x"), "junk\n");
  write(join(shared, "vendor", "blocked", "y"), "kept\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  commit(shared, "-qm", "seed");

  chmodSync(join(shared, "cache", "blocked"), 0o000);
  try {
    const parsed = JSON.parse(readFileSync(baseline(dir, shared), "utf8"));
    assert.deepStrictEqual(Object.keys(parsed.entries), [".gitignore", "src/app.ts", "vendor/blocked/y"]);

    chmodSync(join(shared, "vendor", "blocked"), 0o000);
    assert.match(run(2, ["baseline", shared, "--out", join(dir, "m2.json")]).stderr, /cannot read .*vendor\/blocked/);
  } finally {
    chmodSync(join(shared, "cache", "blocked"), 0o755);
    chmodSync(join(shared, "vendor", "blocked"), 0o755);
  }
});

test("check on the baseline's own tree never reports a divergent ignored path", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), "dist\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  write(join(shared, "dist", "out.js"), "built\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  commit(shared, "-qm", "seed");

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

test("apply names the split uncomputable when the post-copy verification cannot walk", () => {
  const { dir, path } = newCase();
  const shared = path("shared");
  write(join(shared, ".gitignore"), "dist\n");
  write(join(shared, "src", "app.ts"), "export const app = 1;\n");
  git(shared, "init", "-q");
  git(shared, "add", "-A");
  commit(shared, "-qm", "seed");

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
  commit(shared, "-qm", "seed");
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

  write(join(shared, "src", "gen", "keep.txt"), "unrelated\n");

  const refused = run(1, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]);
  assert.match(refused.stderr, /conflict, nothing applied/);
  assert.match(refused.stderr, /src\/gen/);
  assert.strictEqual(readFileSync(join(shared, "src", "gen", "keep.txt"), "utf8"), "unrelated\n");
  assert.ok(!existsSync(receipt), "no receipt for a refused apply");

  rmSync(join(shared, "src", "gen"), { recursive: true });
  mkdirSync(join(shared, "src", "gen"));
  run(0, ["apply", worktree, "--baseline", manifest, "--into", shared, "--surface", "src", "--receipt", receipt]);
  assert.strictEqual(readFileSync(join(shared, "src", "gen"), "utf8"), "generated\n");
});

function seededRepo(root: string, ...init: readonly string[]): void {
  write(join(root, ".gitignore"), "local.env\n");
  write(join(root, "src", "app.ts"), "export const app = 1;\n");
  write(join(root, "local.env"), "SECRET=1\n");
  git(root, "init", "-q", ...init);
  git(root, "add", "-A");
  git(root, "add", "-f", "local.env");
  commit(root, "-qm", "seed");
}

test("index accepts an index holding exactly the measured bytes", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  seededRepo(tree);
  write(join(tree, "src", "app.ts"), "export const app = 2;\n");
  write(join(tree, "src", "new.ts"), "export const fresh = 1;\n");
  symlinkSync("app.ts", join(tree, "src", "link.ts"));
  git(tree, "add", "-A");
  const manifest = baseline(dir, tree);

  const result = run(0, ["index", tree, "--baseline", manifest, "--base", "HEAD"]);
  assert.match(result.stdout, /^paths 5 · matches /m);
});

test("index accepts a SHA-256 repository's index holding exactly the measured bytes", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  seededRepo(tree, "--object-format=sha256");
  assert.strictEqual(git(tree, "rev-parse", "--show-object-format").trim(), "sha256");
  write(join(tree, "src", "app.ts"), "export const app = 2;\n");
  symlinkSync("app.ts", join(tree, "src", "link.ts"));
  git(tree, "add", "-A");
  const manifest = baseline(dir, tree);

  const result = run(0, ["index", tree, "--baseline", manifest, "--base", "HEAD"]);
  assert.match(result.stdout, /^paths 4 · matches /m);
});

test("index refuses an index that differs from the tree the manifest measured", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  seededRepo(tree);
  write(join(tree, "src", "app.ts"), "export const app = 2;\n");
  write(join(tree, "src", "untracked.ts"), "u\n");
  write(join(tree, "tool.sh"), "#!/bin/sh\n");
  chmodSync(join(tree, "tool.sh"), 0o755);
  git(tree, "-c", "core.fileMode=false", "add", "tool.sh");
  git(tree, "update-index", "--skip-worktree", "src/app.ts");
  const manifest = baseline(dir, tree);

  const { stderr } = run(1, ["index", tree, "--baseline", manifest]);
  assert.match(stderr, /^index differs from the measured bytes: src\/app\.ts$/m, "skip-worktree hides the edit from status");
  assert.match(stderr, /^index differs from the measured bytes: tool\.sh$/m, "the executable bit was staged off");
  assert.match(stderr, /^measured path absent from the index: src\/untracked\.ts$/m);

  git(tree, "update-index", "--no-skip-worktree", "src/app.ts");
  git(tree, "add", "-A");
  write(join(tree, "src", "app.ts"), "export const app = 3;\n");
  assert.match(run(1, ["index", tree, "--baseline", manifest]).stderr, /^tree changed since the manifest: src\/app\.ts$/m);
});

test("index refuses an index path the tree no longer holds", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  seededRepo(tree);
  const manifest = baseline(dir, tree);
  rmSync(join(tree, "src", "app.ts"));

  assert.strictEqual(run(1, ["index", tree, "--baseline", manifest]).stderr, "index path missing from the tree: src/app.ts\n");
});

test("index refuses a deletion the tree still holds, against every base it is given", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  seededRepo(tree);
  git(tree, "rm", "-q", "--cached", "local.env");
  commit(tree, "-qm", "untrack local.env");
  write(join(tree, "src", "app.ts"), "export const app = 2;\n");
  git(tree, "add", "src/app.ts");
  const manifest = baseline(dir, tree);

  run(0, ["index", tree, "--baseline", manifest, "--base", "HEAD"]);
  assert.match(
    run(1, ["index", tree, "--baseline", manifest, "--base", "HEAD", "--base", "HEAD^1"]).stderr,
    /^deleted from the index but present in the tree: local\.env$/m,
    "an amendment replaces HEAD, so its original parent is a base too",
  );
});

test("index accepts a base-tracked file the index replaced with a directory", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  seededRepo(tree);
  write(join(tree, "cfg"), "flat\n");
  git(tree, "add", "cfg");
  commit(tree, "-qm", "track cfg");
  unlinkSync(join(tree, "cfg"));
  write(join(tree, "cfg", "x"), "nested\n");
  git(tree, "add", "-A");
  const manifest = baseline(dir, tree);

  const result = run(0, ["index", tree, "--baseline", manifest, "--base", "HEAD"]);
  assert.match(result.stdout, /^paths 4 · matches /m);
});

test("index refuses a pruned or unmeasured path and a manifest of another tree", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  seededRepo(tree);
  write(join(tree, "dist", "out.js"), "built\n");
  git(tree, "add", "-f", "dist/out.js");
  const pruned = join(dir, "pruned.json");
  run(0, ["baseline", tree, "--out", pruned, "--prune", "dist"]);
  assert.match(run(1, ["index", tree, "--baseline", pruned]).stderr, /^pruned path in the index: dist\/out\.js$/m);

  commit(tree, "-qm", "track dist");
  git(tree, "rm", "-q", "dist/out.js");
  run(0, ["baseline", tree, "--out", pruned, "--prune", "dist"]);
  assert.strictEqual(
    run(1, ["index", tree, "--baseline", pruned, "--base", "HEAD"]).stderr,
    "pruned path tracked in HEAD: dist/out.js\n",
  );

  write(join(tree, "src", "late.ts"), "export const late = 1;\n");
  git(tree, "add", "src/late.ts");
  assert.strictEqual(
    run(1, ["index", tree, "--baseline", pruned]).stderr,
    "index path the manifest never measured: src/late.ts\n",
  );

  const other = path("other");
  seededRepo(other);
  const foreign = baseline(dir, other);
  assert.match(run(2, ["index", tree, "--baseline", foreign]).stderr, /^the manifest measured .*other, not .*tree$/m);

  const loose = path("loose");
  write(join(loose, "a.txt"), "a\n");
  assert.match(run(2, ["index", loose, "--baseline", pruned]).stderr, /is not the top level of a Git checkout/);
  assert.match(run(2, ["index", join(tree, "src"), "--baseline", pruned]).stderr, /is not the top level of a Git checkout/);
  assert.match(run(2, ["index", tree, "--baseline", pruned, "--base", "nope"]).stderr, /git ls-tree .* failed/);
  assert.match(run(2, ["index", tree, "--baseline", pruned, "--surface", "src"]).stderr, /index does not take --surface/);
});

test("index refuses a manifest of its tree measured without the git-ignore filter", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  write(join(tree, "src", "app.ts"), "export const app = 1;\n");
  const manifest = baseline(dir, tree);
  git(tree, "init", "-q");
  git(tree, "add", "-A");

  assert.strictEqual(
    run(2, ["index", tree, "--baseline", manifest]).stderr,
    `the manifest measured ${tree} without its git-ignore filter\n`,
  );
});

test("index refuses an index holding an unmerged path", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  seededRepo(tree);
  write(join(tree, "src", "app.ts"), "export const app = 2;\n");
  commit(tree, "-qam", "theirs");
  write(join(tree, "src", "app.ts"), "export const app = 3;\n");
  commit(tree, "-qam", "ours");
  git(tree, "read-tree", "-m", "HEAD~2", "HEAD", "HEAD~1");
  const manifest = baseline(dir, tree);

  assert.strictEqual(run(1, ["index", tree, "--baseline", manifest]).stderr, "the index holds an unmerged path: src/app.ts\n");
});

test("index refuses an intent-to-add path the commit would omit", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  seededRepo(tree);
  write(join(tree, "src", "__init__.py"), "");
  git(tree, "add", "-N", "src/__init__.py");
  const manifest = baseline(dir, tree);

  assert.strictEqual(
    run(1, ["index", tree, "--baseline", manifest, "--base", "HEAD"]).stderr,
    "intent-to-add path the commit would omit: src/__init__.py\n",
  );
});

test("index accepts a case-only rename and a base path under a symlinked directory", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  seededRepo(tree);
  write(join(tree, "lib", "a.txt"), "a\n");
  git(tree, "add", "lib/a.txt");
  commit(tree, "-qm", "track lib");
  git(tree, "mv", "src/app.ts", "src/App.ts");
  rmSync(join(tree, "lib"), { recursive: true });
  write(join(tree, "vendor", "a.txt"), "a\n");
  symlinkSync("vendor", join(tree, "lib"));
  git(tree, "add", "-A");
  const manifest = baseline(dir, tree);

  const result = run(0, ["index", tree, "--baseline", manifest, "--base", "HEAD"]);
  assert.match(result.stdout, /^paths 5 · matches /m);
});

test("index takes the staged executable bit from the owner's permission, as Git does", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  seededRepo(tree);
  write(join(tree, "tool.sh"), "#!/bin/sh\n");
  chmodSync(join(tree, "tool.sh"), 0o654);
  git(tree, "add", "tool.sh");
  assert.match(git(tree, "ls-files", "-s", "tool.sh"), /^100644 /);
  const manifest = baseline(dir, tree);

  run(0, ["index", tree, "--baseline", manifest, "--base", "HEAD"]);
});

test("check --out writes the manifest baseline would write for the tree it measured", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  seededRepo(tree);
  const reference = baseline(dir, tree);
  write(join(tree, "src", "app.ts"), "export const app = 2;\n");
  git(tree, "rm", "-q", "--cached", "local.env");
  const next = join(dir, "next.json");

  const result = run(0, ["check", tree, "--baseline", reference, "--surface", ".", "--prune", "dist", "--out", next]);
  assert.match(result.stdout, /^modified src\/app\.ts$/m);
  assert.match(result.stdout, /^delta 1 · escapes 0$/m, "the kept measure of local.env reads no delta");
  assert.match(result.stdout, /^paths 2$/m, "the written manifest drops local.env, now ignored and untracked");
  const fresh = join(dir, "fresh.json");
  run(0, ["baseline", tree, "--out", fresh, "--prune", "dist"]);
  assert.deepStrictEqual(JSON.parse(readFileSync(next, "utf8")), JSON.parse(readFileSync(fresh, "utf8")));

  write(join(tree, "notes.md"), "outside the surface\n");
  const refused = join(dir, "refused.json");
  run(1, ["check", tree, "--baseline", next, "--surface", "src", "--out", refused]);
  assert.ok(!existsSync(refused), "a refused check writes no manifest");
  assert.match(run(2, ["baseline", tree, "--out", refused, "--surface", "src"]).stderr, /baseline does not take --surface/);
});

test("baseline saves a root __proto__ file as an own entry with its content hash", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  const bytes = Buffer.from([0, 255, 10, 128, 65]);
  mkdirSync(tree);
  writeFileSync(join(tree, "__proto__"), bytes);

  const manifest = JSON.parse(readFileSync(baseline(dir, tree), "utf8"));
  assert.strictEqual(manifest.version, 2);
  assert.ok(Object.hasOwn(manifest.entries, "__proto__"));
  assert.deepStrictEqual(manifest.entries["__proto__"], {
    t: "f",
    h: createHash("sha256").update(bytes).digest("hex"),
    x: false,
  });
});

for (const producer of ["baseline", "check --out"]) {
  for (const name of ["__proto__", "constructor"]) {
    for (const operation of ["added", "deleted"]) {
      test(`${producer} reload classifies a root ${name} file as ${operation}`, () => {
        const { dir } = newCase();
        const { shared, worktree } = seededPair(dir);
        if (operation === "deleted") write(join(shared, name), "baseline bytes\n");
        let manifest = baseline(dir, shared);
        if (producer === "check --out") {
          const next = join(dir, "next.json");
          run(0, ["check", shared, "--baseline", manifest, "--surface", ".", "--out", next]);
          manifest = next;
        }
        if (operation === "added") write(join(worktree, name), "worker bytes\n");

        const result = run(0, ["check", worktree, "--baseline", manifest, "--surface", "."]);
        assert.strictEqual(result.stdout, `${operation.padEnd(8)} ${name}\ndelta 1 · escapes 0\n`);
      });
    }
  }
}

test("check reports a worker-only root __proto__ file outside src as an escape", () => {
  const { dir } = newCase();
  const { shared, worktree } = seededPair(dir);
  const manifest = baseline(dir, shared);
  write(join(worktree, "__proto__"), "worker output\n");

  const result = run(1, ["check", worktree, "--baseline", manifest, "--surface", "src"]);
  assert.strictEqual(result.stdout, "added    __proto__  ESCAPE\ndelta 1 · escapes 1\n");
  assert.strictEqual(result.stderr, "surface escape: __proto__\n");
});

test("check --out preserves collision filenames and matches a fresh baseline with identical prunes", () => {
  const { dir, path } = newCase();
  const tree = path("tree");
  write(join(tree, "__proto__"), "prototype bytes\n");
  write(join(tree, "constructor"), "constructor bytes\n");
  write(join(tree, "cache", "state"), "pruned\n");
  const reference = baseline(dir, tree, ["--prune", "cache"]);
  const next = path("next.json");
  run(0, ["check", tree, "--baseline", reference, "--surface", ".", "--out", next]);
  const fresh = path("fresh.json");
  run(0, ["baseline", tree, "--out", fresh, "--prune", "cache"]);
  const parsed = JSON.parse(readFileSync(next, "utf8"));
  assert.deepStrictEqual(parsed, JSON.parse(readFileSync(fresh, "utf8")));
  assert.deepStrictEqual(Object.keys(parsed.entries).sort(), ["__proto__", "constructor"]);
  assert.ok(Object.hasOwn(parsed.entries, "__proto__"));
  assert.ok(Object.hasOwn(parsed.entries, "constructor"));
  assert.strictEqual(
    run(0, ["check", tree, "--baseline", next, "--surface", "."]).stdout,
    "delta 0 · escapes 0\n",
  );
});

for (const producer of ["baseline", "check --out"]) {
  test(`apply from ${producer} incorporates collision additions before receipt-gated removal`, () => {
    const { dir } = newCase();
    const { shared, worktree } = seededPair(dir);
    const manifest = producer === "baseline" ? baseline(dir, shared) : checkedManifest(dir, shared);
    const receipt = join(dir, "receipt.json");
    const prototypeBytes = Buffer.from([0, 255, 10, 128, 65]);
    const constructorBytes = Buffer.from([255, 0, 66, 13, 10]);
    writeFileSync(join(worktree, "__proto__"), prototypeBytes);
    writeFileSync(join(worktree, "constructor"), constructorBytes);

    const result = run(0, [
      "apply", worktree, "--baseline", manifest, "--into", shared,
      "--surface", "__proto__", "--surface", "constructor", "--receipt", receipt,
    ]);
    assert.deepStrictEqual(result.stdout.split("\n").slice(0, 4), [
      "added    __proto__", "added    constructor", "delta 2 · escapes 0", "applied 2 · verified",
    ]);
    assert.deepStrictEqual(readFileSync(join(shared, "__proto__")), prototypeBytes);
    assert.deepStrictEqual(readFileSync(join(shared, "constructor")), constructorBytes);
    assert.deepStrictEqual(JSON.parse(readFileSync(receipt, "utf8")), {
      version: 2,
      worktree,
      into: shared,
      verified: true,
      applied: [{ path: "__proto__", op: "added" }, { path: "constructor", op: "added" }],
    });

    unlinkSync(join(shared, "__proto__"));
    assert.strictEqual(
      run(1, ["remove", worktree, "--receipt", receipt]).stderr,
      "applied paths are no longer as recorded: __proto__\n",
    );
    assert.ok(existsSync(worktree));
    assert.deepStrictEqual(readFileSync(join(worktree, "__proto__")), prototypeBytes);
    writeFileSync(join(shared, "__proto__"), prototypeBytes);
    run(0, ["remove", worktree, "--receipt", receipt]);
    assert.ok(!existsSync(worktree));
    assert.deepStrictEqual(readFileSync(join(shared, "__proto__")), prototypeBytes);
    assert.deepStrictEqual(readFileSync(join(shared, "constructor")), constructorBytes);
  });

  test(`apply from ${producer} records and incorporates a baseline constructor deletion`, () => {
    const { dir } = newCase();
    const { shared, worktree } = seededPair(dir);
    write(join(shared, "constructor"), "baseline bytes\n");
    const manifest = producer === "baseline" ? baseline(dir, shared) : checkedManifest(dir, shared);
    const receipt = join(dir, "receipt.json");

    const result = run(0, [
      "apply", worktree, "--baseline", manifest, "--into", shared,
      "--surface", "constructor", "--receipt", receipt,
    ]);
    assert.deepStrictEqual(result.stdout.split("\n").slice(0, 3), [
      "deleted  constructor", "delta 1 · escapes 0", "applied 1 · verified",
    ]);
    assert.ok(!existsSync(join(shared, "constructor")));
    const parsed = JSON.parse(readFileSync(receipt, "utf8"));
    assert.strictEqual(parsed.verified, true);
    assert.deepStrictEqual(parsed.applied, [{ path: "constructor", op: "deleted" }]);
    run(0, ["remove", worktree, "--receipt", receipt]);
    assert.ok(!existsSync(worktree));
  });

  for (const name of ["__proto__", "constructor"]) {
    for (const refusal of ["escape", "added conflict", "modified conflict"]) {
      test(`apply from ${producer} refuses a ${name} ${refusal} before writes or a receipt`, () => {
        const { dir } = newCase();
        const { shared, worktree } = seededPair(dir);
        if (refusal === "modified conflict") {
          for (const root of [shared, worktree]) write(join(root, name), "baseline bytes\n");
        }
        const manifest = producer === "baseline" ? baseline(dir, shared) : checkedManifest(dir, shared);
        const receipt = join(dir, "receipt.json");
        write(join(worktree, name), "worker bytes\n");
        write(join(worktree, "src", "app.ts"), "worker source\n");
        if (refusal !== "escape") write(join(shared, name), "concurrent bytes\n");

        const result = run(1, [
          "apply", worktree, "--baseline", manifest, "--into", shared,
          "--surface", refusal === "escape" ? "src" : ".", "--receipt", receipt,
        ]);
        const op = refusal === "modified conflict" ? "modified" : "added";
        assert.ok(result.stdout.split("\n").includes(
          `${op.padEnd(8)} ${name}${refusal === "escape" ? "  ESCAPE" : ""}`,
        ));
        assert.match(result.stderr, refusal === "escape" ? /surface escape, nothing applied/ : /conflict, nothing applied/);
        assert.ok(!existsSync(receipt));
        assert.strictEqual(readFileSync(join(shared, "src", "app.ts"), "utf8"), "export const app = 1;\n");
        if (refusal === "escape") assert.ok(!existsSync(join(shared, name)));
        else assert.strictEqual(readFileSync(join(shared, name), "utf8"), "concurrent bytes\n");
        assert.strictEqual(readFileSync(join(worktree, name), "utf8"), "worker bytes\n");
      });
    }
  }
}

for (const producer of ["baseline", "check --out"]) {
  test(`index from ${producer} accepts exact measured collision filenames`, () => {
    const { dir, path } = newCase();
    const tree = path("tree");
    seededRepo(tree);
    for (const name of ["__proto__", "constructor"]) {
      writeFileSync(join(tree, name), Buffer.from([0, 255, 10, 128, 65]));
    }
    git(tree, "add", "__proto__", "constructor");
    const manifest = producer === "baseline" ? baseline(dir, tree) : checkedManifest(dir, tree);

    const result = run(0, ["index", tree, "--baseline", manifest, "--base", "HEAD"]);
    assert.strictEqual(result.stdout, `index ${tree}\npaths 5 · matches ${manifest}\n`);
    assert.strictEqual(result.stderr, "");
  });

  for (const name of ["__proto__", "constructor"]) {
    test(`index from ${producer} refuses an unmeasured collision filename ${name}`, () => {
      const { dir, path } = newCase();
      const tree = path("tree");
      seededRepo(tree);
      const manifest = producer === "baseline" ? baseline(dir, tree) : checkedManifest(dir, tree);
      write(join(tree, name), "added after measurement\n");
      git(tree, "add", name);

      assert.strictEqual(
        run(1, ["index", tree, "--baseline", manifest]).stderr,
        `index path the manifest never measured: ${name}\n`,
      );
    });

    test(`index from ${producer} refuses changed bytes and a missing index entry for ${name}`, () => {
      const { dir, path } = newCase();
      const tree = path("tree");
      seededRepo(tree);
      write(join(tree, name), "measured bytes\n");
      git(tree, "add", name);
      const manifest = producer === "baseline" ? baseline(dir, tree) : checkedManifest(dir, tree);
      write(join(tree, name), "later bytes\n");
      assert.strictEqual(
        run(1, ["index", tree, "--baseline", manifest]).stderr,
        `tree changed since the manifest: ${name}\n`,
      );

      write(join(tree, name), "measured bytes\n");
      git(tree, "rm", "--cached", name);
      assert.strictEqual(
        run(1, ["index", tree, "--baseline", manifest]).stderr,
        `measured path absent from the index: ${name}\n`,
      );
    });
  }
}
