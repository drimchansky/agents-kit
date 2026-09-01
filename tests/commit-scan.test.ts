import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  classifySteps,
  parseCommitLog,
  parsePlanSteps,
  parsePointers,
  type CommitScan,
} from "../scripts/commit-scan.ts";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SCRIPT = join(REPO_DIR, "scripts", "commit-scan.ts");
const TEST_ROOT = realpathSync(mkdtempSync(join(tmpdir(), "agents-kit-commit-scan-")));
const FENCE = "```";

after(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

const PLAN = `# Plan: fixture

**Status:** executing

## Steps

### Step 1 — the shipped one

- [x] **What:** wrote the note
- **Touches:** \`docs/c.md\`

### Step 2 — the first pending one

- [ ] **What:** rework \`src/a.ts\` against \`HEAD\`
- **Goal:** G1

### Step 3 — the second pending one

- [ ] **What:** the second module
- **Touches:** \`src/b.ts\`
`;

function pointers(entry: string): string {
  return `# Result: fixture

## Current state

_Updated: 2026-09-01_

- **Pointers:** ${entry}
- **Next:** keep going

---
`;
}

function git(cwd: string, args: readonly string[]): string {
  const child = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  assert.strictEqual(child.status, 0, `git ${args.join(" ")} failed: ${child.stderr}`);
  return child.stdout;
}

function checkout(name: string): string {
  const dir = join(TEST_ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const init = spawnSync("git", ["init", "-q", dir], { encoding: "utf8" });
  assert.strictEqual(init.status, 0, `git init failed: ${init.stderr}`);
  git(dir, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  git(dir, ["config", "user.email", "test@example.invalid"]);
  git(dir, ["config", "user.name", "agents-kit test"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  git(dir, ["config", "tag.gpgsign", "false"]);
  return dir;
}

function commit(dir: string, files: Readonly<Record<string, string>>, message: string): string {
  const paths = Object.keys(files);
  for (const path of paths) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), files[path]);
  }
  git(dir, ["add", "-f", "--", ...paths]);
  git(dir, ["commit", "-q", "-m", message]);
  return git(dir, ["rev-parse", "--short", "HEAD"]).trim();
}

interface Folder {
  readonly plan?: string;
  readonly result?: string;
}

function folder(root: string, files: Folder): string {
  const dir = join(root, ".agents", "tasks", "fixture");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  if (files.plan !== undefined) writeFileSync(join(dir, "plan.md"), files.plan);
  if (files.result !== undefined) writeFileSync(join(dir, "result.md"), files.result);
  return dir;
}

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function run(args: readonly string[]): Run {
  const child = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  return { status: child.status, stdout: child.stdout, stderr: child.stderr };
}

function report(dir: string): CommitScan {
  const child = run([dir]);
  assert.strictEqual(child.status, 0, `expected exit 0, got ${child.status}: ${child.stderr}`);
  return JSON.parse(child.stdout) as CommitScan;
}

function classifications(scan: CommitScan): readonly (string | null)[] {
  return scan.steps.map((step) => step.classification);
}

test("ok state nominates the pending steps a commit touched and reports the checked one as info", () => {
  const dir = checkout("ok");
  const baseline = commit(dir, { "docs/c.md": "c\n", "src/a.ts": "a\n", "src/b.ts": "b\n" }, "baseline");
  commit(dir, { "docs/c.md": "c revised\n" }, "revise the note");
  commit(dir, { "src/a.ts": "a revised\n" }, "rework a");
  commit(dir, { "src/b.ts": "b revised\n" }, "rework b");
  const task = folder(dir, { plan: PLAN, result: pointers(`SHA ${baseline} (recorded 2026-09-01)`) });

  const scan = report(task);

  assert.strictEqual(scan.state, "ok");
  assert.strictEqual(scan.repo, dir);
  assert.strictEqual(scan.pathsInRepo, true);
  assert.strictEqual(scan.watermark, baseline);
  assert.strictEqual(scan.ref, "HEAD");
  assert.strictEqual(scan.refFallback, null);
  assert.strictEqual(scan.total, 3);
  assert.deepStrictEqual(classifications(scan), ["info", "candidate", "candidate"]);
  assert.deepStrictEqual(scan.commits[0].paths, ["src/b.ts"]);
  assert.strictEqual(scan.commits[0].subject, "rework b");
  assert.strictEqual(scan.commits[0].date.length, 10);
});

test("a recorded task branch is scanned while the checkout's HEAD sits on the default branch", () => {
  const dir = checkout("task-branch");
  const baseline = commit(dir, { "docs/c.md": "c\n", "src/a.ts": "a\n", "src/b.ts": "b\n" }, "baseline");
  git(dir, ["checkout", "-q", "-b", "task/fixture"]);
  commit(dir, { "src/a.ts": "a on the task branch\n" }, "rework a on the branch");
  git(dir, ["checkout", "-q", "main"]);
  const task = folder(dir, {
    plan: PLAN,
    result: pointers(`branch \`task/fixture\`, SHA ${baseline} (recorded 2026-09-01)`),
  });

  const scan = report(task);

  assert.strictEqual(scan.state, "ok");
  assert.strictEqual(scan.branch, "task/fixture");
  assert.strictEqual(scan.ref, "task/fixture");
  assert.strictEqual(scan.refFallback, null);
  assert.strictEqual(scan.total, 1);
  assert.strictEqual(scan.commits[0].subject, "rework a on the branch");
  assert.deepStrictEqual(classifications(scan), [null, "candidate", null]);
});

test("a recorded branch that no longer resolves falls back to HEAD and says so", () => {
  const dir = checkout("dead-branch");
  const baseline = commit(dir, { "docs/c.md": "c\n", "src/a.ts": "a\n", "src/b.ts": "b\n" }, "baseline");
  commit(dir, { "src/a.ts": "a revised\n" }, "rework a on the default branch");
  const task = folder(dir, {
    plan: PLAN,
    result: pointers(`branch \`gone/fixture\`, SHA ${baseline} (recorded 2026-09-01)`),
  });

  const scan = report(task);

  assert.strictEqual(scan.state, "ok");
  assert.strictEqual(scan.branch, "gone/fixture");
  assert.strictEqual(scan.ref, "HEAD");
  assert.match(scan.refFallback ?? "", /gone\/fixture/);
  assert.strictEqual(scan.total, 1);
});

test("a branch entry marked removed takes the same HEAD fallback", () => {
  const dir = checkout("removed-branch");
  const baseline = commit(dir, { "docs/c.md": "c\n", "src/a.ts": "a\n", "src/b.ts": "b\n" }, "baseline");
  git(dir, ["branch", "task/fixture"]);
  commit(dir, { "src/a.ts": "a revised\n" }, "rework a after the merge");
  const task = folder(dir, {
    plan: PLAN,
    result: pointers(`branch \`task/fixture\` (removed 2026-08-30), SHA ${baseline} (recorded 2026-09-01)`),
  });

  const scan = report(task);

  assert.strictEqual(scan.ref, "HEAD");
  assert.match(scan.refFallback ?? "", /removed/);
  assert.strictEqual(scan.total, 1);
});

test("no watermark reports the missing baseline and scans nothing", () => {
  const dir = checkout("no-watermark");
  commit(dir, { "docs/c.md": "c\n", "src/a.ts": "a\n", "src/b.ts": "b\n" }, "baseline");
  commit(dir, { "src/a.ts": "a revised\n" }, "rework a");
  const task = folder(dir, { plan: PLAN, result: pointers("none yet") });

  const scan = report(task);

  assert.strictEqual(scan.state, "no-watermark");
  assert.strictEqual(scan.watermark, null);
  assert.deepStrictEqual(scan.commits, []);
  assert.strictEqual(scan.total, 0);
  assert.deepStrictEqual(classifications(scan), [null, null, null]);
});

test("a watermark outside the resolved ref's history reports orphaned and scans nothing", () => {
  const dir = checkout("orphaned");
  commit(dir, { "docs/c.md": "c\n", "src/a.ts": "a\n", "src/b.ts": "b\n" }, "baseline");
  git(dir, ["checkout", "-q", "-b", "side"]);
  const side = commit(dir, { "src/a.ts": "a on the side branch\n" }, "side work");
  git(dir, ["checkout", "-q", "main"]);
  commit(dir, { "src/b.ts": "b revised\n" }, "rework b on the default branch");
  const task = folder(dir, { plan: PLAN, result: pointers(`SHA ${side} (recorded 2026-09-01)`) });

  const scan = report(task);

  assert.strictEqual(scan.state, "orphaned");
  assert.strictEqual(scan.watermark, side);
  assert.deepStrictEqual(scan.commits, []);
  assert.strictEqual(scan.total, 0);
});

test("a task folder outside any checkout reports no-checkout and no commits", () => {
  const root = join(TEST_ROOT, "loose");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const task = folder(root, { plan: PLAN, result: pointers("SHA 1234abc (recorded 2026-09-01)") });

  const scan = report(task);

  assert.strictEqual(scan.state, "no-checkout");
  assert.strictEqual(scan.repo, null);
  assert.strictEqual(scan.pathsInRepo, false);
  assert.strictEqual(scan.ref, null);
  assert.deepStrictEqual(scan.commits, []);
  assert.strictEqual(scan.total, 0);
});

test("a checkout holding none of the plan's paths omits the scan rather than reporting an empty range", () => {
  const dir = checkout("wrong-root");
  const baseline = commit(dir, { "README.md": "r\n" }, "baseline");
  commit(dir, { "README.md": "r revised\n" }, "unrelated work");
  const task = folder(dir, { plan: PLAN, result: pointers(`SHA ${baseline} (recorded 2026-09-01)`) });

  const scan = report(task);

  assert.strictEqual(scan.state, "no-checkout");
  assert.strictEqual(scan.repo, dir);
  assert.strictEqual(scan.pathsInRepo, false);
  assert.strictEqual(scan.ref, null);
  assert.deepStrictEqual(scan.commits, []);
  assert.strictEqual(scan.total, 0);
});

test("over the cap the 20 most recent commits are returned with the full total", () => {
  const dir = checkout("capped");
  const baseline = commit(dir, { "docs/c.md": "c\n", "src/a.ts": "a\n", "src/b.ts": "b\n" }, "baseline");
  for (let round = 1; round <= 25; round++) commit(dir, { "src/a.ts": `a ${round}\n` }, `change ${round}`);
  const task = folder(dir, { plan: PLAN, result: pointers(`SHA ${baseline} (recorded 2026-09-01)`) });

  const scan = report(task);

  assert.strictEqual(scan.state, "ok");
  assert.strictEqual(scan.total, 25);
  assert.strictEqual(scan.commits.length, 20);
  assert.strictEqual(scan.commits[0].subject, "change 25");
  assert.strictEqual(scan.commits[19].subject, "change 6");
  assert.strictEqual(scan.steps[1].commits.length, 25);
});

test("a folder holding no task role file exits 2, as does a bad argument count", () => {
  const dir = join(TEST_ROOT, "not-a-task");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "README.md"), "not a task\n");

  const rejected = run([dir]);
  assert.strictEqual(rejected.status, 2);
  assert.match(rejected.stderr, /not a task folder/);

  assert.strictEqual(run([]).status, 2);
  assert.strictEqual(run([dir, dir]).status, 2);
});

test("a step's path set unions its Touches paths with the paths its What names", () => {
  const steps = parsePlanSteps(PLAN);

  assert.deepStrictEqual(
    steps.map((step) => [step.number, step.checked, step.paths]),
    [
      ["1", true, ["docs/c.md"]],
      ["2", false, ["src/a.ts"]],
      ["3", false, ["src/b.ts"]],
    ],
  );
});

test("plan parsing skips fenced content and reads both path fields of one step", () => {
  const steps = parsePlanSteps(`## Steps

${FENCE}
### Step 9 — illustrative only

- [ ] **What:** touch \`src/illustration.ts\`
${FENCE}

### Step 1 — the real one

- [ ] **What:** rework \`src/a.ts\` and the \`docs/\` tree
- **Touches:** \`src/b.ts\`, \`SCRIPTS.md\`
`);

  assert.deepStrictEqual(
    steps.map((step) => step.number),
    ["1"],
  );
  assert.deepStrictEqual(steps[0].paths, ["src/a.ts", "docs", "src/b.ts", "SCRIPTS.md"]);
});

test("the Pointers line yields the watermark, the branch, and whether the branch is recorded removed", () => {
  assert.deepStrictEqual(parsePointers(pointers("SHA A1B2C3D (recorded 2026-09-01)")), {
    watermark: "a1b2c3d",
    branch: null,
    branchRemoved: false,
  });
  assert.deepStrictEqual(parsePointers(pointers("branch `feat/x`, PR #12, SHA abc1234 (recorded 2026-09-01)")), {
    watermark: "abc1234",
    branch: "feat/x",
    branchRemoved: false,
  });
  assert.deepStrictEqual(parsePointers(pointers("branch `feat/x` (removed 2026-08-30)")), {
    watermark: null,
    branch: "feat/x",
    branchRemoved: true,
  });
  assert.deepStrictEqual(parsePointers("# Result: fixture\n"), {
    watermark: null,
    branch: null,
    branchRemoved: false,
  });
});

test("the Pointers line is read from the Current state block, not from the log below it", () => {
  const text = `# Result: fixture

## Current state

- **Pointers:** SHA aaaaaaa (recorded 2026-09-01)

---

## 2026-08-01 — an earlier entry

- **Pointers:** SHA bbbbbbb (recorded 2026-08-01)
`;

  assert.strictEqual(parsePointers(text).watermark, "aaaaaaa");
});

test("a subheading inside Current state does not end the block", () => {
  const text = `# Result: fixture

## Current state

### Delivery

- **Pointers:** branch \`feat/x\`, SHA abc1234 (recorded 2026-09-01)
`;

  assert.deepStrictEqual(parsePointers(text), {
    watermark: "abc1234",
    branch: "feat/x",
    branchRemoved: false,
  });
});

test("the commit log parses into per-commit path lists", () => {
  const commits = parseCommitLog("\0abc1234 2026-09-01 first\nsrc/a.ts\nsrc/b.ts\n\n\0def5678 2026-08-31 second\n");

  assert.deepStrictEqual(commits, [
    { sha: "abc1234", date: "2026-09-01", subject: "first", paths: ["src/a.ts", "src/b.ts"] },
    { sha: "def5678", date: "2026-08-31", subject: "second", paths: [] },
  ]);
});

test("a pending step none of whose paths exists on disk is never a candidate", () => {
  const steps = parsePlanSteps(PLAN);
  const commits = parseCommitLog("\0abc1234 2026-09-01 rework a\nsrc/a.ts\n");

  const withPath = classifySteps(steps, commits, new Set(["src/a.ts"]));
  const withoutPath = classifySteps(steps, commits, new Set(["docs/c.md"]));

  assert.strictEqual(withPath[1].classification, "candidate");
  assert.strictEqual(withoutPath[1].classification, null);
  assert.deepStrictEqual(withoutPath[1].commits, ["abc1234"]);
});

test("a commit under a directory a step names touches that step", () => {
  const steps = parsePlanSteps(`### Step 1 — the tree

- [ ] **What:** rework the \`src/models\` tree
`);
  const commits = parseCommitLog("\0abc1234 2026-09-01 rework\nsrc/models/user.ts\nsrc/modelsmith.ts\n");

  const classified = classifySteps(steps, commits, new Set(["src/models"]));

  assert.strictEqual(classified[0].classification, "candidate");
  assert.deepStrictEqual(classified[0].commits, ["abc1234"]);
  assert.deepStrictEqual(classifySteps(steps, parseCommitLog("\0abc1234 2026-09-01 near miss\nsrc/modelsmith.ts\n"), new Set(["src/models"]))[0].classification, null);
});
