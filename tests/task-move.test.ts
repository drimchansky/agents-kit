import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SCRIPT = join(REPO_DIR, "scripts", "task-move.ts");
const TEST_ROOT = realpathSync(mkdtempSync(join(tmpdir(), "agents-kit-task-move-")));
const NO_REGISTRY_HOME = join(TEST_ROOT, "no-registry-home");
mkdirSync(NO_REGISTRY_HOME, { recursive: true });
const PLAN = "plan.md";
const GROUP_FILE = "GROUP_CONTEXT.md";
const NOTE = "notes.md";
const NOTE_BODY = "# note\n\nA file whose survival proves the whole folder moved.\n";

interface Run {
  readonly stdout: string;
  readonly stderr: string;
}

function runMove(expectedStatus: number, args: readonly string[], options: object = {}): Run {
  const run = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...process.env, HOME: NO_REGISTRY_HOME },
    ...options,
  });
  assert.strictEqual(
    run.status,
    expectedStatus,
    `expected exit ${expectedStatus}, got ${run.status} for: ${args.join(" ")}\n` +
      `${run.stdout ?? ""}${run.stderr ?? run.error?.message ?? ""}`,
  );
  return { stdout: run.stdout, stderr: run.stderr };
}

function assertIncludes(haystack: string, needle: string, message: string): void {
  assert.ok(haystack.includes(needle), `${message} (expected to contain "${needle}", got "${haystack}")`);
}

function plan(status: string): string {
  return `# a task\n\n**Status:** ${status}\n`;
}

const RESULT = "# a result\n\n## Current state\n\n_Updated:_ 2026-01-01\n";
const LEGACY_RESULT = "# a result\n\n**Status:** done\n\n## Current state\n\n_Updated:_ 2026-01-01\n";

function area(name: string): string {
  const dir = join(TEST_ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeTask(dir: string, files: Record<string, string> = { [PLAN]: plan("done") }): string {
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  writeFileSync(join(dir, NOTE), NOTE_BODY);
  return dir;
}

function exists(path: string): boolean {
  try {
    readdirSync(path);
    return true;
  } catch {
    return false;
  }
}

function assertMoved(stdout: string, src: string, dest: string): void {
  assert.strictEqual(stdout, `moved ${src} -> ${dest}\n`, "the success line names both absolute paths");
  assert.strictEqual(exists(src), false, `${src} is gone from its old place`);
  assert.strictEqual(
    readFileSync(join(dest, NOTE), "utf8"),
    NOTE_BODY,
    "the whole folder moved, not just its status-bearing file",
  );
}

function assertUnmoved(src: string): void {
  assert.strictEqual(
    readFileSync(join(src, NOTE), "utf8"),
    NOTE_BODY,
    `${src} stayed where it was, contents untouched`,
  );
}

function containers(dir: string): string[] {
  return readdirSync(dir).filter((name) => /^(archive|backlog)$/i.test(name));
}

function writeGroups(root: string, dirs: readonly string[]): void {
  for (const dir of dirs) {
    const group = join(root, dir);
    mkdirSync(group, { recursive: true });
    writeFileSync(join(group, GROUP_FILE), `# ${basename(group)}\n\nShared grounding for everything below.\n`);
  }
}

function groupFileHashes(root: string): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const entry of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    if (basename(entry) !== GROUP_FILE) continue;
    hashes[entry] = createHash("sha256").update(readFileSync(join(root, entry))).digest("hex");
  }
  return hashes;
}

function registryEnv(home: string, roots: readonly string[]): NodeJS.ProcessEnv {
  mkdirSync(join(home, ".config", "agents-kit"), { recursive: true });
  writeFileSync(
    join(home, ".config", "agents-kit", "config.json"),
    JSON.stringify({ taskRoots: roots.map((path, index) => ({ path, label: `store-${index}` })) }),
  );
  return { ...process.env, HOME: home };
}

after(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

test("a done task archives into a fresh Archive/ beside it", () => {
  const parent = area("archive-done");
  const src = writeTask(join(parent, "finished"));
  const { stdout } = runMove(0, [src, "--to", "archive"]);
  assertMoved(stdout, src, join(parent, "Archive", "finished"));
  assert.deepStrictEqual(containers(parent), ["Archive"], "a created container is capitalized");
});

test("a skipped task archives on the same terminal set", () => {
  const parent = area("archive-skipped");
  const src = writeTask(join(parent, "abandoned"), { [PLAN]: plan("skipped") });
  const { stdout } = runMove(0, [src, "--to", "archive"]);
  assertMoved(stdout, src, join(parent, "Archive", "abandoned"));
});

test("a live plan is refused for archiving and nothing moves", () => {
  const parent = area("archive-live");
  const src = writeTask(join(parent, "in-flight"), { [PLAN]: plan("executing") });
  const { stderr } = runMove(1, [src, "--to", "archive"]);
  assertIncludes(stderr, "executing", "the refusal names the status that blocked it");
  assertIncludes(stderr, "done or skipped", "the refusal names the terminal set it read");
  assertUnmoved(src);
  assert.deepStrictEqual(containers(parent), [], "a refused move creates no container");
});

test("a folder with no plan.md is refused for archiving, legacy result status included", () => {
  for (const [name, files, reason] of [
    ["bare", {}, "holds no task file"],
    ["legacy-status", { "result.md": LEGACY_RESULT }, "no plan.md"],
  ] as const) {
    const parent = area(`archive-planless-${name}`);
    const src = writeTask(join(parent, "young"), files);
    const { stderr } = runMove(1, [src, "--to", "archive"]);
    assertIncludes(stderr, reason, "the refusal says why the task could not be confirmed finished");
    assertUnmoved(src);
  }
});

test("a directory holding no task file is refused rather than moved", () => {
  const project = area("not-a-task");
  const root = join(project, ".agents", "tasks");
  const projectArea = writeTask(join(root, "treasury"), {});
  writeTask(join(projectArea, "some-task"), { [PLAN]: plan("to-do") });

  const byPath = runMove(1, [projectArea, "--to", "backlog"]);
  assertIncludes(byPath.stderr, "holds no task file", "the refusal names what the directory is missing");
  assertUnmoved(projectArea);

  const bySlug = runMove(2, ["treasury", "--to", "backlog"], { cwd: project });
  assertIncludes(bySlug.stderr, "no task folder named treasury", "a bare slug finds no match rather than the area");
  assertUnmoved(projectArea);
});

test("the store directory itself is never reached by a relative slug", () => {
  const project = area("dotdot-slug");
  writeTask(join(project, ".agents", "tasks", "real"), { [PLAN]: plan("to-do") });
  const { stderr } = runMove(2, ["..", "--to", "backlog"], { cwd: project });
  assertIncludes(stderr, "no task folder named ..", "the store directory is not a slug match");
  assert.ok(exists(join(project, ".agents", "tasks")), "the task store stayed where it was");
});

test("a status outside the lifecycle vocabulary is refused for archiving", () => {
  const parent = area("archive-unknown");
  const src = writeTask(join(parent, "mystery"), { [PLAN]: plan("finished-ish") });
  const { stderr } = runMove(1, [src, "--to", "archive"]);
  assertIncludes(stderr, "finished-ish", "the refusal quotes the status it could not place");
  assertUnmoved(src);
});

test("a status inside a fenced block is not read as the plan's own", () => {
  const parent = area("archive-fenced");
  const body = "# a task\n\n```\n**Status:** done\n```\n\n**Status:** executing\n";
  const src = writeTask(join(parent, "fenced"), { [PLAN]: body });
  const { stderr } = runMove(1, [src, "--to", "archive"]);
  assertIncludes(stderr, "executing", "the illustrative status inside the fence is skipped");
  assertUnmoved(src);
});

test("an indented marker run inside a fence does not close it", () => {
  const parent = area("archive-fence-indent");
  const body = "# a task\n\nAn example:\n\n```markdown\n    ```\n**Status:** done\n```\n\n## Steps\n";
  const src = writeTask(join(parent, "indented"), { [PLAN]: body });
  const { stderr } = runMove(1, [src, "--to", "archive"]);
  assertIncludes(stderr, "absent", "the illustrative status stays inside the fence");
  assertUnmoved(src);
});

test("a symlinked source folder is refused rather than followed", () => {
  const parent = area("archive-symlink-src");
  const real = writeTask(join(parent, "real-task"));
  const link = join(parent, "linked-task");
  symlinkSync(real, link);
  const { stderr } = runMove(1, [link, "--to", "archive"]);
  assertIncludes(stderr, "is a symlink", "the refusal names the symlink");
  assertUnmoved(real);
  assert.deepStrictEqual(containers(parent), [], "a refused move creates no container");
});

test("a symlinked archive container is refused rather than moved through", () => {
  const parent = area("archive-symlink-container");
  const elsewhere = join(TEST_ROOT, "archive-symlink-container-elsewhere");
  mkdirSync(elsewhere, { recursive: true });
  symlinkSync(elsewhere, join(parent, "Archive"));
  const src = writeTask(join(parent, "finished"));
  const { stderr } = runMove(1, [src, "--to", "archive"]);
  assertIncludes(stderr, "is a symlink", "the refusal names the container");
  assertUnmoved(src);
  assert.deepStrictEqual(readdirSync(elsewhere), [], "nothing travelled through the link");
});

test("a file where the container belongs is refused", () => {
  const parent = area("archive-container-file");
  writeFileSync(join(parent, "Archive"), "not a directory\n");
  const src = writeTask(join(parent, "finished"));
  const { stderr } = runMove(1, [src, "--to", "archive"]);
  assertIncludes(stderr, "not a directory", "the refusal says the container cannot hold a task");
  assertUnmoved(src);
});

test("an occupied destination is refused rather than overwritten or merged into", () => {
  const parent = area("archive-occupied");
  const occupant = join(parent, "Archive", "finished");
  mkdirSync(occupant, { recursive: true });
  writeFileSync(join(occupant, PLAN), plan("done"));
  const src = writeTask(join(parent, "finished"));
  const { stderr } = runMove(1, [src, "--to", "archive"]);
  assertIncludes(stderr, "already exists", "the refusal names the collision");
  assertUnmoved(src);
  assert.deepStrictEqual(readdirSync(occupant), [PLAN], "the folder already in the archive is untouched");
});

test("a rename that fails takes the container this run created with it", { skip: process.getuid?.() === 0 && "root bypasses the permission bits this case turns on" }, () => {
  const parent = area("archive-rename-fails");
  const src = writeTask(join(parent, "finished"));
  chmodSync(src, 0o555);
  try {
    const { stderr } = runMove(1, [src, "--to", "archive"]);
    assertIncludes(stderr, "could not move", "the refusal carries the rename's own reason");
    assert.deepStrictEqual(containers(parent), [], "the container this run created was removed with it");
  } finally {
    chmodSync(src, 0o755);
  }
  assertUnmoved(src);
});

test("an existing lowercase archive/ is moved into rather than duplicated beside", () => {
  const parent = area("archive-lowercase");
  mkdirSync(join(parent, "archive"), { recursive: true });
  const src = writeTask(join(parent, "finished"));
  const { stdout } = runMove(0, [src, "--to", "archive"]);
  assertMoved(stdout, src, join(parent, "archive", "finished"));
  assert.deepStrictEqual(
    containers(parent),
    ["archive"],
    "the container keeps its own spelling — normalizing it belongs to maintain's format sweep",
  );
});

test("an occupied destination inside a differently-cased container is still refused", () => {
  const parent = area("archive-lowercase-occupied");
  const occupant = join(parent, "archive", "finished");
  mkdirSync(occupant, { recursive: true });
  const src = writeTask(join(parent, "finished"));
  const { stderr } = runMove(1, [src, "--to", "archive"]);
  assertIncludes(stderr, "already exists", "recognition finds the collision under either spelling");
  assertUnmoved(src);
  assert.deepStrictEqual(containers(parent), ["archive"], "no second container was created to collide with");
});

test("an already-archived folder is refused under either spelling of its container", () => {
  for (const [index, spelling] of ["Archive", "archive"].entries()) {
    const parent = area(`archive-already-${index}`);
    const src = writeTask(join(parent, spelling, "finished"));
    const { stderr } = runMove(1, [src, "--to", "archive"]);
    assertIncludes(stderr, "already archived", `a folder under ${spelling}/ is recognized as archived`);
    assertUnmoved(src);
  }
});

test("a finished task parked in a backlog archives out of the backlog, never into it", () => {
  const parent = area("archive-out-of-backlog");
  const src = writeTask(join(parent, "Backlog", "finished"));
  const { stdout } = runMove(0, [src, "--to", "archive"]);
  assertMoved(stdout, src, join(parent, "Archive", "finished"));
  assert.strictEqual(
    exists(join(parent, "Backlog", "Archive")),
    false,
    "frozen history never files inside the container that holds unstarted work",
  );
});

test("a folder with no plan.md parks — the entry gate archiving refuses", () => {
  const parent = area("backlog-planless");
  const src = writeTask(join(parent, "young"), { "ticket.md": "# ticket\n" });
  const { stdout } = runMove(0, [src, "--to", "backlog"]);
  assertMoved(stdout, src, join(parent, "Backlog", "young"));
  assert.deepStrictEqual(containers(parent), ["Backlog"], "a created container is capitalized");
});

test("a to-do plan parks", () => {
  const parent = area("backlog-todo");
  const src = writeTask(join(parent, "unstarted"), { [PLAN]: plan("to-do") });
  const { stdout } = runMove(0, [src, "--to", "backlog"]);
  assertMoved(stdout, src, join(parent, "Backlog", "unstarted"));
});

test("a live plan is refused for parking and pointed at the blocked status", () => {
  const parent = area("backlog-live");
  const src = writeTask(join(parent, "in-flight"), { [PLAN]: plan("blocked") });
  const { stderr } = runMove(1, [src, "--to", "backlog"]);
  assertIncludes(stderr, "blocked", "the refusal names the status that blocked it");
  assertUnmoved(src);
  assert.deepStrictEqual(containers(parent), [], "a refused move creates no container");
});

test("a finished plan is refused for parking and pointed at archiving", () => {
  const parent = area("backlog-terminal");
  const src = writeTask(join(parent, "finished"), { [PLAN]: plan("done") });
  const { stderr } = runMove(1, [src, "--to", "backlog"]);
  assertIncludes(stderr, "archives instead of parking", "the refusal points at the other container");
  assertUnmoved(src);
});

test("a plan-less folder holding a result.md at all is refused for parking", () => {
  for (const [name, body] of [["conformant", RESULT], ["legacy-status", LEGACY_RESULT]] as const) {
    const parent = area(`backlog-result-${name}`);
    const src = writeTask(join(parent, "started"), { "result.md": body });
    assertIncludes(
      runMove(1, [src, "--to", "backlog"]).stderr,
      "has a result.md, so work has already begun",
      "a result file exists only once execution starts",
    );
    assertUnmoved(src);
    assert.deepStrictEqual(containers(parent), [], "a refused move creates no container");
  }
});

test("the gates read a legacy-suffix plan and result, not just the exact names", () => {
  for (const [name, files, reason] of [
    ["live-plan", { "feature.plan.md": plan("executing") }, "Only an unstarted task parks"],
    ["result-only", { "feature.result.md": RESULT }, "work has already begun"],
  ] as const) {
    const parent = area(`backlog-legacy-${name}`);
    const src = writeTask(join(parent, "legacy"), files);
    const { stderr } = runMove(1, [src, "--to", "backlog"]);
    assertIncludes(stderr, reason, "the legacy-named file is read like its canonical counterpart");
    assertUnmoved(src);
    assert.deepStrictEqual(containers(parent), [], "a refused move creates no container");
  }
});

test("a legacy-suffix plan is read by the archive gate too", () => {
  const parent = area("archive-legacy-plan");
  const src = writeTask(join(parent, "legacy"), { "feature.plan.md": plan("done") });
  const { stdout } = runMove(0, [src, "--to", "archive"]);
  assertMoved(stdout, src, join(parent, "Archive", "legacy"));
});

test("an already-parked folder is refused under either spelling of its container", () => {
  for (const [index, spelling] of ["Backlog", "backlog"].entries()) {
    const parent = area(`backlog-already-${index}`);
    const src = writeTask(join(parent, spelling, "unstarted"), { [PLAN]: plan("to-do") });
    const { stderr } = runMove(1, [src, "--to", "backlog"]);
    assertIncludes(stderr, "already parked", `a folder under ${spelling}/ is recognized as parked`);
    assertUnmoved(src);
  }
});

test("an archived folder never moves straight into a backlog", () => {
  const parent = area("backlog-from-archive");
  const src = writeTask(join(parent, "Archive", "finished"), { [PLAN]: plan("to-do") });
  const { stderr } = runMove(1, [src, "--to", "backlog"]);
  assertIncludes(stderr, "Un-archive it first", "the refusal names the manual step that comes first");
  assertUnmoved(src);
});

test("the source, container, and destination guards hold for a backlog move too", () => {
  const parent = area("backlog-guards");

  const real = writeTask(join(parent, "unstarted"), { [PLAN]: plan("to-do") });
  const link = join(parent, "linked");
  symlinkSync(real, link);
  assertIncludes(runMove(1, [link, "--to", "backlog"]).stderr, "is a symlink", "a symlinked source is refused");

  const occupant = join(parent, "backlog", "unstarted");
  mkdirSync(occupant, { recursive: true });
  assertIncludes(
    runMove(1, [real, "--to", "backlog"]).stderr,
    "already exists",
    "an occupied destination is refused under either spelling",
  );
  assertUnmoved(real);

  const elsewhere = area("backlog-guards-elsewhere");
  const linked = area("backlog-guards-linked");
  const linkedSrc = writeTask(join(linked, "unstarted"), { [PLAN]: plan("to-do") });
  symlinkSync(elsewhere, join(linked, "Backlog"));
  assertIncludes(
    runMove(1, [linkedSrc, "--to", "backlog"]).stderr,
    "is a symlink",
    "a symlinked container is refused",
  );
  assert.deepStrictEqual(readdirSync(elsewhere), [], "nothing travelled through the link");
});

test("a task round-trips: parked, activated by hand, then archived", () => {
  const parent = area("round-trip");
  const src = writeTask(join(parent, "travels"), { [PLAN]: plan("to-do") });

  const parked = join(parent, "Backlog", "travels");
  assertMoved(runMove(0, [src, "--to", "backlog"]).stdout, src, parked);

  renameSync(parked, src);
  writeFileSync(join(src, PLAN), plan("done"));

  const archived = join(parent, "Archive", "travels");
  assertMoved(runMove(0, [src, "--to", "archive"]).stdout, src, archived);
  assert.deepStrictEqual(
    readdirSync(join(parent, "Backlog")),
    [],
    "the backlog it passed through is left empty rather than holding a copy",
  );
});

test("a bare slug resolves against the canonical root of the process directory", () => {
  const project = area("slug-canonical");
  const root = join(project, ".agents", "tasks");
  const src = writeTask(join(root, "by-slug"));
  const { stdout } = runMove(0, ["by-slug", "--to", "archive"], { cwd: project });
  assertMoved(stdout, src, join(root, "Archive", "by-slug"));
});

test("a bare slug resolves against a registered root, containers included", () => {
  const home = area("slug-registry-home");
  const store = area("slug-registry-store");
  const src = writeTask(join(store, "Backlog", "parked-and-finished"));
  const empty = area("slug-registry-cwd");
  const { stdout } = runMove(0, ["parked-and-finished", "--to", "archive"], {
    cwd: empty,
    env: registryEnv(home, [store]),
  });
  assertMoved(stdout, src, join(store, "Archive", "parked-and-finished"));
});

test("a bare slug resolves through nested grouping directories in a registered root", () => {
  const home = area("slug-deep-home");
  const store = area("slug-deep-store");
  const group = join(store, "product", "backend", "empty");
  const src = writeTask(join(group, "buried"));
  const { stdout } = runMove(0, ["buried", "--to", "archive"], {
    cwd: area("slug-deep-cwd"),
    env: registryEnv(home, [store]),
  });
  assertMoved(stdout, src, join(group, "Archive", "buried"));
});

test("a lifecycle container is searched at whatever group depth it sits", () => {
  const home = area("slug-deep-containers-home");
  const store = area("slug-deep-containers-store");
  const group = join(store, "product", "backend");
  const parked = writeTask(join(group, "Backlog", "parked-deep"));
  const archived = writeTask(join(group, "Archive", "archived-deep"));
  const env = registryEnv(home, [store]);
  const cwd = area("slug-deep-containers-cwd");

  const { stdout } = runMove(0, ["parked-deep", "--to", "archive"], { cwd, env });
  assertMoved(stdout, parked, join(group, "Archive", "parked-deep"));

  const { stderr } = runMove(1, ["archived-deep", "--to", "archive"], { cwd, env });
  assertIncludes(stderr, "already archived", "a slug inside a deep Archive/ resolves to it rather than being missed");
  assertUnmoved(archived);
});

test("duplicate slugs at different group depths ask for a path instead of picking one", () => {
  const home = area("slug-deep-twin-home");
  const store = area("slug-deep-twin-store");
  const near = writeTask(join(store, "product", "twin"));
  const far = writeTask(join(store, "platform", "backend", "twin"));
  const { stderr } = runMove(2, ["twin", "--to", "archive"], {
    cwd: area("slug-deep-twin-cwd"),
    env: registryEnv(home, [store]),
  });
  assertIncludes(stderr, "Pass the one you mean as a path", "a deep duplicate is handed back, never guessed");
  assertIncludes(stderr, near, "both candidates are named");
  assertIncludes(stderr, far, "both candidates are named");
  assertUnmoved(near);
  assertUnmoved(far);
});

test("one physical task reached through overlapping root registrations is a single match", () => {
  const home = area("slug-aliases-home");
  const store = join(home, "Tasks");
  const group = join(store, "product", "backend");
  const src = writeTask(join(group, "shared"));
  const { stdout } = runMove(0, ["shared", "--to", "archive"], {
    cwd: area("slug-aliases-cwd"),
    env: registryEnv(home, [store, `${store}/`, "~/Tasks", join(store, "product")]),
  });
  assertMoved(stdout, src, join(group, "Archive", "shared"));
});

test("a slug found through nested registrations bounds against the innermost root, as a path does", () => {
  const home = area("slug-nested-bound-home");
  const store = area("slug-nested-bound-store");
  const inner = join(store, "Archive", "product");
  const bySlug = writeTask(join(inner, "backend", "shared"));
  const byPath = writeTask(join(inner, "backend", "by-path"));
  const env = registryEnv(home, [store, inner]);
  const { stdout: slugRun } = runMove(0, ["shared", "--to", "archive"], { cwd: area("slug-nested-bound-cwd"), env });
  assertMoved(slugRun, bySlug, join(inner, "backend", "Archive", "shared"));
  const { stdout: pathRun } = runMove(0, [byPath, "--to", "archive"], { env });
  assertMoved(pathRun, byPath, join(inner, "backend", "Archive", "by-path"));
});

test("a registered root and a symlinked spelling of it are one root, so the task under them is one match", () => {
  const home = area("slug-link-alias-home");
  const store = area("slug-link-alias-store");
  const link = join(TEST_ROOT, "slug-link-alias-link");
  rmSync(link, { force: true });
  symlinkSync(store, link);
  const src = writeTask(join(store, "group", "reached-once"));
  const { stdout } = runMove(0, ["reached-once", "--to", "archive"], {
    cwd: area("slug-link-alias-cwd"),
    env: registryEnv(home, [link, store]),
  });
  assertMoved(stdout, src, join(store, "group", "Archive", "reached-once"));
});

test("a root that only shares a textual prefix with another is searched rather than collapsed into it", () => {
  const home = area("slug-prefix-home");
  const product = area("slug-prefix-product");
  writeTask(join(product, "kept"));
  const sibling = area("slug-prefix-product-archive");
  const src = writeTask(join(sibling, "group", "only-here"));
  const { stdout } = runMove(0, ["only-here", "--to", "archive"], {
    cwd: area("slug-prefix-cwd"),
    env: registryEnv(home, [product, sibling]),
  });
  assertMoved(stdout, src, join(sibling, "group", "Archive", "only-here"));
});

test("a root registered under a pruned ancestor is searched on its own account rather than folded into its container", () => {
  const home = area("slug-nested-root-home");
  const store = area("slug-nested-root-store");
  const inner = join(store, ".hidden", "inner");
  const src = writeTask(join(inner, "group", "beyond-the-prune"));
  const cwd = area("slug-nested-root-cwd");

  const { stderr } = runMove(2, ["beyond-the-prune", "--to", "archive"], {
    cwd,
    env: registryEnv(home, [store]),
  });
  assertIncludes(stderr, "no task folder named beyond-the-prune", "the outer root's walk prunes the dotted ancestor away");
  assertUnmoved(src);

  const { stdout } = runMove(0, ["beyond-the-prune", "--to", "archive"], {
    cwd,
    env: registryEnv(home, [store, inner]),
  });
  assertMoved(stdout, src, join(inner, "group", "Archive", "beyond-the-prune"));
});

test("the search stops at a task folder rather than descending into one", () => {
  const home = area("slug-leaf-home");
  const store = area("slug-leaf-store");
  const outer = writeTask(join(store, "group", "outer"));
  const inner = writeTask(join(outer, "inner"));
  const { stderr } = runMove(2, ["inner", "--to", "archive"], {
    cwd: area("slug-leaf-cwd"),
    env: registryEnv(home, [store]),
  });
  assertIncludes(stderr, "no task folder named inner", "a directory beneath a recognized task is never a match");
  assertUnmoved(inner);
});

test("a directory link is pruned, so neither a linked twin nor a loop is searched", () => {
  const home = area("slug-links-home");
  const store = area("slug-links-store");
  const outside = area("slug-links-outside");
  const twin = writeTask(join(outside, "linked-twin"));
  const src = writeTask(join(store, "group", "reachable"));
  symlinkSync(outside, join(store, "mirror"));
  symlinkSync(join(store, "group"), join(store, "group", "loop"));
  const env = registryEnv(home, [store]);
  const cwd = area("slug-links-cwd");

  const { stderr } = runMove(2, ["linked-twin", "--to", "archive"], { cwd, env });
  assertIncludes(stderr, "no task folder named linked-twin", "a task behind a directory link is not reached");
  assertUnmoved(twin);

  const { stdout } = runMove(0, ["reachable", "--to", "archive"], { cwd, env });
  assertMoved(stdout, src, join(store, "group", "Archive", "reachable"));
});

test("an unreadable group refuses the search rather than resolving from what stayed visible", {
  skip: process.getuid?.() === 0 && "root reads a directory whose bits deny it",
}, () => {
  const home = area("slug-locked-home");
  const store = area("slug-locked-store");
  const src = writeTask(join(store, "open", "visible"));
  const locked = join(store, "closed");
  mkdirSync(locked, { recursive: true });
  chmodSync(locked, 0o000);
  try {
    const { stderr } = runMove(2, ["visible", "--to", "archive"], {
      cwd: area("slug-locked-cwd"),
      env: registryEnv(home, [store]),
    });
    assertIncludes(stderr, locked, "the refusal names the subtree it could not read");
    assertIncludes(stderr, "EACCES", "the refusal carries the cause");
  } finally {
    chmodSync(locked, 0o755);
  }
  assertUnmoved(src);
});

test("an unreadable registered root refuses the run rather than resolving from the roots it could read", {
  skip: process.getuid?.() === 0 && "root reads a directory whose bits deny it",
}, () => {
  const home = area("root-locked-home");
  const readable = area("root-locked-readable");
  const src = writeTask(join(readable, "group", "visible"));
  const locked = area("root-locked-store");
  chmodSync(locked, 0o000);
  try {
    const { stderr } = runMove(2, ["visible", "--to", "archive"], {
      cwd: area("root-locked-cwd"),
      env: registryEnv(home, [locked, readable]),
    });
    assertIncludes(stderr, locked, "the refusal names the registered root it could not list");
    assertIncludes(stderr, "EACCES", "the refusal carries the cause");
    assertIncludes(stderr, "could not read in full", "an unreadable root is refused, not skipped like an absent one");
  } finally {
    chmodSync(locked, 0o755);
  }
  assertUnmoved(src);
  assert.strictEqual(exists(join(readable, "group", "Archive")), false, "the readable root resolved nothing on its own");
});

test("a registered root that is absent or not a directory is skipped with one warning line each", () => {
  const home = area("slug-missing-root-home");
  const store = area("slug-missing-root-store");
  const src = writeTask(join(store, "group", "still-found"));
  const absent = join(TEST_ROOT, "slug-missing-root-gone");
  const notADir = join(TEST_ROOT, "slug-missing-root-file.md");
  writeFileSync(notADir, "not a root\n");
  const { stdout, stderr } = runMove(0, ["still-found", "--to", "archive"], {
    cwd: area("slug-missing-root-cwd"),
    env: registryEnv(home, [absent, notADir, store]),
  });
  assertIncludes(stderr, `skipping registered root ${absent}`, "the missing root is named and skipped");
  assertIncludes(stderr, `skipping registered root ${notADir}`, "a root that is a regular file is skipped like an absent one");
  assertMoved(stdout, src, join(store, "group", "Archive", "still-found"));
});

test("a registered project root is entered through .agents while other dotted names and node_modules are pruned", () => {
  const home = area("slug-dotted-home");
  const project = area("slug-dotted-project");
  const src = writeTask(join(project, ".agents", "tasks", "group", "under-dot-agents"));
  const hidden = writeTask(join(project, ".hidden", "ignored-task"));
  const vendored = writeTask(join(project, "node_modules", "vendored-task"));
  const env = registryEnv(home, [project]);
  const cwd = area("slug-dotted-cwd");

  assertIncludes(
    runMove(2, ["ignored-task", "--to", "archive"], { cwd, env }).stderr,
    "no task folder named ignored-task",
    "a dotted directory other than .agents is pruned",
  );
  assertUnmoved(hidden);
  assertIncludes(
    runMove(2, ["vendored-task", "--to", "archive"], { cwd, env }).stderr,
    "no task folder named vendored-task",
    "node_modules is pruned",
  );
  assertUnmoved(vendored);

  const { stdout } = runMove(0, ["under-dot-agents", "--to", "archive"], { cwd, env });
  assertMoved(stdout, src, join(dirname(src), "Archive", "under-dot-agents"));
});

test("a canonical root that is also registered resolves once and reaches its nested groups", () => {
  const home = area("slug-registered-canonical-home");
  const project = area("slug-registered-canonical-project");
  const root = join(project, ".agents", "tasks");
  const flat = writeTask(join(root, "top"));
  const nested = writeTask(join(root, "group", "buried"));
  const env = registryEnv(home, [root]);

  const both = runMove(0, ["top", "--to", "archive"], { cwd: project, env });
  assertMoved(both.stdout, flat, join(root, "Archive", "top"));

  const deep = runMove(0, ["buried", "--to", "archive"], { cwd: project, env });
  assertMoved(deep.stdout, nested, join(root, "group", "Archive", "buried"));
});

test("the canonical root registered through a symlinked project spelling resolves once", () => {
  const home = area("slug-link-canonical-home");
  const project = area("slug-link-canonical-project");
  const alias = join(TEST_ROOT, "slug-link-canonical-alias");
  rmSync(alias, { force: true });
  symlinkSync(project, alias);
  const root = join(project, ".agents", "tasks");
  const src = writeTask(join(root, "once"));
  const { stdout } = runMove(0, ["once", "--to", "archive"], {
    cwd: project,
    env: registryEnv(home, [join(alias, ".agents", "tasks")]),
  });
  assertMoved(stdout, src, join(root, "Archive", "once"));
});

test("an unregistered canonical root keeps its flat slug lookup", () => {
  const project = area("slug-canonical-flat");
  const env = registryEnv(area("slug-canonical-flat-home"), []);
  const root = join(project, ".agents", "tasks");
  const flat = writeTask(join(root, "top"));
  const nested = writeTask(join(root, "group", "buried-canonical"));

  const { stderr } = runMove(2, ["buried-canonical", "--to", "archive"], { cwd: project, env });
  assertIncludes(stderr, "no task folder named buried-canonical", "an unregistered canonical root is not walked recursively");
  assertUnmoved(nested);

  const { stdout } = runMove(0, ["top", "--to", "archive"], { cwd: project, env });
  assertMoved(stdout, flat, join(root, "Archive", "top"));
});

test("an ambiguous bare slug asks for a path instead of picking one", () => {
  const home = area("slug-ambiguous-home");
  const project = area("slug-ambiguous-project");
  const canonical = writeTask(join(project, ".agents", "tasks", "twin"));
  const store = area("slug-ambiguous-store");
  const registered = writeTask(join(store, "twin"));
  const { stderr } = runMove(2, ["twin", "--to", "archive"], {
    cwd: project,
    env: registryEnv(home, [store]),
  });
  assertIncludes(stderr, "Pass the one you mean as a path", "an ambiguous slug is handed back, never guessed");
  assertIncludes(stderr, canonical, "both candidates are named");
  assertIncludes(stderr, registered, "both candidates are named");
  assertUnmoved(canonical);
  assertUnmoved(registered);
});

test("an ambiguity names its candidates in identity order, whatever order the registry listed them", () => {
  const home = area("slug-order-home");
  const first = area("slug-order-a-store");
  const second = area("slug-order-b-store");
  const early = writeTask(join(first, "listed-twice"));
  const late = writeTask(join(second, "listed-twice"));
  const cwd = area("slug-order-cwd");

  const { stderr } = runMove(2, ["listed-twice", "--to", "archive"], {
    cwd,
    env: registryEnv(home, [second, first]),
  });
  assertIncludes(stderr, `${early} and ${late}`, "the two candidates are named in identity order, not registry order");
  assertUnmoved(early);
  assertUnmoved(late);
});

test("a terminal task under an Archive/ higher up the path is already archived, group between or not", () => {
  const parent = area("archive-ancestor");
  const nested = writeTask(join(parent, "Archive", "team", "finished"));
  const { stderr } = runMove(1, [nested, "--to", "archive"]);
  assertIncludes(stderr, "already archived", "an Archive/ above the immediate parent still counts as archived");
  assertIncludes(stderr, join(parent, "Archive"), "the refusal names the container it found");
  assertUnmoved(nested);
  assert.deepStrictEqual(containers(dirname(nested)), [], "no second container is created beneath the first");

  const { stderr: parking } = runMove(1, [nested, "--to", "backlog"]);
  assertIncludes(parking, "Un-archive it first", "the same reading blocks parking it straight from the archive");
  assertUnmoved(nested);
});

test("an Archive above a registered root is the user's tree naming, so the path route archives beneath it", () => {
  const home = area("bound-registered-home");
  const store = join(area("bound-registered-tree"), "Archive", "Tasks");
  const src = writeTask(join(store, "group", "finished"));
  const { stdout } = runMove(0, [src, "--to", "archive"], { env: registryEnv(home, [store]) });
  assertMoved(stdout, src, join(store, "group", "Archive", "finished"));
});

test("an Archive above a project's .agents store is the user's tree naming, so the path route archives beneath it", () => {
  const store = join(area("bound-canonical-tree"), "Archive", "project", ".agents", "tasks");
  const src = writeTask(join(store, "finished"));
  const { stdout } = runMove(0, [src, "--to", "archive"]);
  assertMoved(stdout, src, join(store, "Archive", "finished"));
});

test("the archive bound holds when the path is given through a spelling other than the registered one", () => {
  const home = area("bound-alias-home");
  const store = area("bound-alias-store");
  const link = join(area("bound-alias-tree"), "Archive", "link");
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(store, link);
  const src = writeTask(join(store, "group", "finished"));
  const viaLink = join(link, "group", "finished");
  const { stdout } = runMove(0, [viaLink, "--to", "archive"], { env: registryEnv(home, [store]) });
  assertMoved(stdout, viaLink, join(link, "group", "Archive", "finished"));
  assert.strictEqual(
    readFileSync(join(store, "group", "Archive", "finished", NOTE), "utf8"),
    NOTE_BODY,
    "the move landed inside the registered store itself",
  );
});

test("an unmatched bare slug asks for a path", () => {
  const project = area("slug-missing");
  const { stderr } = runMove(2, ["nowhere-task", "--to", "archive"], { cwd: project });
  assertIncludes(stderr, "Pass its path instead", "a slug that resolved to nothing asks for a path");
});

test("a spawn that passes no env never reads the registry of the process's own home", () => {
  const decoyHome = area("decoy-home");
  const decoyStore = area("decoy-store");
  const decoy = writeTask(join(decoyStore, "nowhere-task"));
  registryEnv(decoyHome, [decoyStore]);

  const realHome = process.env.HOME;
  process.env.HOME = decoyHome;
  try {
    const { stderr } = runMove(2, ["nowhere-task", "--to", "archive"], { cwd: area("decoy-cwd") });
    assertIncludes(
      stderr,
      "Pass its path instead",
      "the slug resolves nothing: the child's HOME is the test's own, never the process's",
    );
  } finally {
    process.env.HOME = realHome;
  }
  assertUnmoved(decoy);
});

test("an unparseable registry is warned about rather than fatal", () => {
  const home = area("registry-broken-home");
  const project = area("registry-broken-project");
  const root = join(project, ".agents", "tasks");
  const src = writeTask(join(root, "still-archives"));
  mkdirSync(join(home, ".config", "agents-kit"), { recursive: true });
  writeFileSync(join(home, ".config", "agents-kit", "config.json"), "{ not json");
  const { stdout, stderr } = runMove(0, ["still-archives", "--to", "archive"], {
    cwd: project,
    env: { ...process.env, HOME: home },
  });
  assertIncludes(stderr, "unparseable", "the ignored registry is reported");
  assertMoved(stdout, src, join(root, "Archive", "still-archives"));
});

test("a malformed taskRoots key or entry is warned about rather than silently dropped", () => {
  for (const [name, registry, warning] of [
    ["not-an-array", { taskRoots: { path: "~/Tasks" } }, "ignoring taskRoots in"],
    ["entry-without-path", { taskRoots: [{ label: "nameless" }] }, "ignoring taskRoots[0] in"],
  ] as const) {
    const home = area(`registry-malformed-${name}-home`);
    const project = area(`registry-malformed-${name}-project`);
    const root = join(project, ".agents", "tasks");
    const src = writeTask(join(root, "still-archives"));
    mkdirSync(join(home, ".config", "agents-kit"), { recursive: true });
    writeFileSync(join(home, ".config", "agents-kit", "config.json"), JSON.stringify(registry));
    const { stdout, stderr } = runMove(0, ["still-archives", "--to", "archive"], {
      cwd: project,
      env: { ...process.env, HOME: home },
    });
    assertIncludes(stderr, warning, "the dropped registry content is named rather than silently skipped");
    assertMoved(stdout, src, join(root, "Archive", "still-archives"));
  }
});

test("usage failures exit 2 with the invocation form", () => {
  const parent = area("usage");
  const src = writeTask(join(parent, "finished"));
  for (const args of [[src], [src, "--to"], [src, "--to", "sideways"], ["--wat", src, "--to", "archive"], [src, "extra", "--to", "archive"]]) {
    const { stderr } = runMove(2, args);
    assertIncludes(stderr, "usage: node scripts/task-move.ts", `"${args.join(" ")}" reports the usage line`);
  }
  assertUnmoved(src);
});

test("a path argument is taken verbatim and never rebuilt from the slug and the process directory", () => {
  const decoy = area("verbatim-decoy");
  const decoySrc = writeTask(join(decoy, ".agents", "tasks", "same-slug"));
  const elsewhere = area("verbatim-elsewhere");
  const src = writeTask(join(elsewhere, "same-slug"));
  const { stdout } = runMove(0, [src, "--to", "archive"], { cwd: decoy });
  assertMoved(stdout, src, join(elsewhere, "Archive", "same-slug"));
  assertUnmoved(decoySrc);
  assert.strictEqual(
    exists(join(decoy, ".agents", "tasks", "Archive")),
    false,
    "the same-slug task under the process directory was never touched",
  );
});

test("the destination stays beside the source when the source sits deep in a store area", () => {
  const store = area("area-relative");
  const src = writeTask(join(store, "project-x", "finished"));
  const { stdout } = runMove(0, [src, "--to", "archive"]);
  assertMoved(stdout, src, join(store, "project-x", "Archive", "finished"));
  assert.strictEqual(exists(join(store, "Archive")), false, "archiving is location-relative, not store-relative");
});

test("a folder name carrying spaces and dots moves under its own name", () => {
  const parent = area("slug-is-folder-name");
  const src = writeTask(join(parent, "Oddly.Named Task"));
  const { stdout } = runMove(0, [src, "--to", "archive"]);
  assertMoved(stdout, src, join(parent, "Archive", basename(src)));
});

test("a done task three groups deep archives beside itself and rewrites no group file", () => {
  const home = area("groups-archive-home");
  const store = area("groups-archive-store");
  writeGroups(store, ["", "product", join("product", "backend")]);
  const group = join(store, "product", "backend", "empty");
  const src = writeTask(join(group, "deep-done"));
  const before = groupFileHashes(store);

  const { stdout } = runMove(0, [src, "--to", "archive"], {
    cwd: area("groups-archive-cwd"),
    env: registryEnv(home, [store]),
  });
  assertMoved(stdout, src, join(group, "Archive", "deep-done"));
  assert.deepStrictEqual(groupFileHashes(store), before, "no group file moved, and none changed a byte");
});

test("a to-do task three groups deep parks beside itself and rewrites no group file", () => {
  const home = area("groups-backlog-home");
  const store = area("groups-backlog-store");
  writeGroups(store, ["", "product", join("product", "backend")]);
  const group = join(store, "product", "backend", "empty");
  const src = writeTask(join(group, "deep-todo"), { [PLAN]: plan("to-do") });
  const before = groupFileHashes(store);

  const { stdout } = runMove(0, [src, "--to", "backlog"], {
    cwd: area("groups-backlog-cwd"),
    env: registryEnv(home, [store]),
  });
  assertMoved(stdout, src, join(group, "Backlog", "deep-todo"));
  assert.deepStrictEqual(groupFileHashes(store), before, "no group file moved, and none changed a byte");
});

test("a group file sitting directly in a lifecycle container neither blocks the move nor travels with it", () => {
  const home = area("groups-decoy-home");
  const store = area("groups-decoy-store");
  writeGroups(store, ["", "product", join("product", "backend")]);
  const group = join(store, "product", "backend", "empty");
  writeGroups(group, ["Archive", "Backlog"]);
  const finished = writeTask(join(group, "decoy-done"));
  const unstarted = writeTask(join(group, "decoy-todo"), { [PLAN]: plan("to-do") });
  const before = groupFileHashes(store);
  const env = registryEnv(home, [store]);
  const cwd = area("groups-decoy-cwd");

  const archived = runMove(0, [finished, "--to", "archive"], { cwd, env });
  assertMoved(archived.stdout, finished, join(group, "Archive", "decoy-done"));

  const parked = runMove(0, [unstarted, "--to", "backlog"], { cwd, env });
  assertMoved(parked.stdout, unstarted, join(group, "Backlog", "decoy-todo"));

  assert.deepStrictEqual(groupFileHashes(store), before, "the decoys stay in their containers, unchanged and unmoved");
});

test("a role file sitting directly in a lifecycle container neither hides the tasks below it nor makes it a match", () => {
  const home = area("container-role-file-home");
  const store = area("container-role-file-store");
  const group = join(store, "product", "backend");
  const container = join(group, "Archive");
  const src = writeTask(join(container, "archived-deep"));
  writeFileSync(join(container, "CONTEXT.md"), "# backend\n\nShared grounding misfiled into the container.\n");
  const env = registryEnv(home, [store]);
  const cwd = area("container-role-file-cwd");

  const { stderr } = runMove(1, ["archived-deep", "--to", "archive"], { cwd, env });
  assertIncludes(stderr, "already archived", "a task under a container holding a role file still resolves by slug");
  assertUnmoved(src);

  const claimed = runMove(2, ["Archive", "--to", "backlog"], { cwd, env });
  assertIncludes(claimed.stderr, "no task folder named Archive", "the container itself is never a slug match");
  assertUnmoved(src);
  assert.strictEqual(exists(join(group, "Backlog")), false, "the container was never relocated with its tasks inside it");
});

test("a role file misfiled into a canonical lifecycle container leaves the container unclaimed", () => {
  const project = area("canonical-container-role-file-project");
  const env = registryEnv(area("canonical-container-role-file-home"), []);
  const root = join(project, ".agents", "tasks");
  const container = join(root, "Archive");
  const src = writeTask(join(container, "archived-deep"));
  writeFileSync(join(container, "CONTEXT.md"), "# tasks\n\nShared grounding misfiled into the container.\n");

  const { stderr } = runMove(1, ["archived-deep", "--to", "archive"], { cwd: project, env });
  assertIncludes(stderr, "already archived", "a task under a container holding a role file still resolves by slug");
  assertUnmoved(src);

  const claimed = runMove(2, ["Archive", "--to", "backlog"], { cwd: project, env });
  assertIncludes(claimed.stderr, "no task folder named Archive", "the canonical root's own container is never a slug match");
  assertUnmoved(src);
  assert.strictEqual(exists(join(root, "Backlog")), false, "the container was never parked with its tasks inside it");
});

test("a lifecycle container nested inside a canonical one is stepped through rather than claimed", () => {
  const project = area("canonical-nested-container-project");
  const env = registryEnv(area("canonical-nested-container-home"), []);
  const root = join(project, ".agents", "tasks");
  const container = writeTask(join(root, "Backlog", "Archive"));

  const { stderr } = runMove(2, ["Archive", "--to", "archive"], { cwd: project, env });
  assertIncludes(stderr, "no task folder named Archive", "a container inside a container is no more a match than one at the root");
  assertUnmoved(container);
  assert.strictEqual(exists(join(root, "Archive", "Archive")), false, "the nested container never lands under an archive of its own");
});

test("a group holding only shared grounding is never a slug match, so its subtree never archives", () => {
  const home = area("groups-subject-slug-home");
  const store = area("groups-subject-slug-store");
  writeGroups(store, ["product", join("product", "backend")]);
  const group = join(store, "product", "backend");
  const leaf = writeTask(join(group, "under-group"));

  const { stderr } = runMove(2, ["backend", "--to", "archive"], {
    cwd: area("groups-subject-slug-cwd"),
    env: registryEnv(home, [store]),
  });
  assertIncludes(stderr, "no task folder named backend", "a group file never makes the group a folder the walk records");
  assert.strictEqual(exists(group), true, "the group stayed where it was");
  assertUnmoved(leaf);
  assert.deepStrictEqual(containers(join(store, "product")), [], "a refused move creates no container");
});

test("a group named by path is refused — its group file is not a task file", () => {
  const store = area("groups-subject-path-store");
  writeGroups(store, ["product"]);
  const group = join(store, "product");
  const leaf = writeTask(join(group, "unstarted"), { [PLAN]: plan("to-do") });

  const { stderr } = runMove(1, [group, "--to", "backlog"]);
  assertIncludes(stderr, "holds no task file", "a group file is none of the role files a task folder is recognized by");
  assert.strictEqual(exists(group), true, "the group stayed where it was");
  assertUnmoved(leaf);
  assert.deepStrictEqual(containers(store), [], "a refused move creates no container");
});

test("a parked task activated by hand resolves by slug at the group it returned to", () => {
  const home = area("groups-activate-home");
  const store = area("groups-activate-store");
  writeGroups(store, ["", "product", join("product", "backend")]);
  const group = join(store, "product", "backend", "empty");
  const src = writeTask(join(group, "activated"), { [PLAN]: plan("to-do") });
  const env = registryEnv(home, [store]);
  const cwd = area("groups-activate-cwd");

  const parked = join(group, "Backlog", "activated");
  assertMoved(runMove(0, [src, "--to", "backlog"], { cwd, env }).stdout, src, parked);

  renameSync(parked, src);
  writeFileSync(join(src, PLAN), plan("done"));

  const { stdout } = runMove(0, ["activated", "--to", "archive"], { cwd, env });
  assertMoved(stdout, src, join(group, "Archive", "activated"));
});

test("a task moved by hand into another group resolves by slug there and no longer where it sat", () => {
  const home = area("groups-relocate-home");
  const store = area("groups-relocate-store");
  writeGroups(store, ["", "product", join("product", "backend"), join("product", "frontend")]);
  const from = join(store, "product", "backend", "empty");
  const to = join(store, "product", "frontend");
  const src = writeTask(join(from, "travels-groups"));
  const before = groupFileHashes(store);

  const moved = join(to, "travels-groups");
  renameSync(src, moved);

  const { stdout } = runMove(0, ["travels-groups", "--to", "archive"], {
    cwd: area("groups-relocate-cwd"),
    env: registryEnv(home, [store]),
  });
  assertMoved(stdout, moved, join(to, "Archive", "travels-groups"));
  assert.strictEqual(exists(join(from, "Archive")), false, "the group it left gains no archive of its own");
  assert.deepStrictEqual(groupFileHashes(store), before, "crossing groups rewrites no group file either");
});

test("a finished task parked in a group's backlog archives into that group, not below the backlog", () => {
  const home = area("groups-backlog-exception-home");
  const store = area("groups-backlog-exception-store");
  writeGroups(store, ["", "product", join("product", "backend")]);
  const group = join(store, "product", "backend", "empty");
  const src = writeTask(join(group, "Backlog", "misfiled"));
  const before = groupFileHashes(store);

  const { stdout } = runMove(0, ["misfiled", "--to", "archive"], {
    cwd: area("groups-backlog-exception-cwd"),
    env: registryEnv(home, [store]),
  });
  assertMoved(stdout, src, join(group, "Archive", "misfiled"));
  assert.strictEqual(
    exists(join(group, "Backlog", "Archive")),
    false,
    "the backlog exception holds at group depth too",
  );
  assert.deepStrictEqual(groupFileHashes(store), before, "the exception rewrites no group file");
});

test("the same nested moves behave identically in a registered root carrying no group files", () => {
  const home = area("groups-absent-home");
  const store = area("groups-absent-store");
  const group = join(store, "product", "backend", "empty");
  const finished = writeTask(join(group, "plain-done"));
  const unstarted = writeTask(join(group, "plain-todo"), { [PLAN]: plan("to-do") });
  const env = registryEnv(home, [store]);
  const cwd = area("groups-absent-cwd");

  const archived = runMove(0, ["plain-done", "--to", "archive"], { cwd, env });
  assertMoved(archived.stdout, finished, join(group, "Archive", "plain-done"));

  const parked = runMove(0, ["plain-todo", "--to", "backlog"], { cwd, env });
  assertMoved(parked.stdout, unstarted, join(group, "Backlog", "plain-todo"));

  assert.deepStrictEqual(groupFileHashes(store), {}, "a store carrying no shared grounding gains none");
});

test("an unreadable registry refuses the run rather than resolving as if no root were registered", {
  skip: process.getuid?.() === 0 && "root reads a file whose bits deny it",
}, () => {
  const home = area("registry-locked-home");
  const store = area("registry-locked-store");
  const registered = writeTask(join(store, "twin"));
  const project = area("registry-locked-project");
  const canonical = writeTask(join(project, ".agents", "tasks", "twin"));
  const env = registryEnv(home, [store]);
  const registry = join(home, ".config", "agents-kit", "config.json");
  chmodSync(registry, 0o000);
  try {
    const { stderr } = runMove(2, ["twin", "--to", "archive"], { cwd: project, env });
    assertIncludes(stderr, registry, "the refusal names the registry it could not read");
    assertIncludes(stderr, "EACCES", "the refusal carries the cause");
  } finally {
    chmodSync(registry, 0o644);
  }
  assertUnmoved(canonical);
  assertUnmoved(registered);
});

test("a path-route move draws its bound from a registry it cannot read rather than refusing on it", {
  skip: process.getuid?.() === 0 && "root reads a file whose bits deny it",
}, () => {
  const home = area("path-locked-home");
  const store = area("path-locked-store");
  const src = writeTask(join(store, "group", "finished"));
  const env = registryEnv(home, [store]);
  const registry = join(home, ".config", "agents-kit", "config.json");
  chmodSync(registry, 0o000);
  try {
    const { stdout, stderr } = runMove(0, [src, "--to", "archive"], { env });
    assert.strictEqual(stderr, "", "the path route reads the registry silently");
    assertMoved(stdout, src, join(store, "group", "Archive", "finished"));
  } finally {
    chmodSync(registry, 0o644);
  }
});

test("a path-route refusal stays one stderr line under a malformed registry", () => {
  for (const [name, registry] of [
    ["unparseable", "{ not json"],
    ["not-an-array", JSON.stringify({ taskRoots: { path: "~/Tasks" } })],
    ["entry-without-path", JSON.stringify({ taskRoots: [{ label: "nameless" }] })],
  ] as const) {
    const home = area(`path-malformed-${name}-home`);
    const parent = area(`path-malformed-${name}-tree`);
    const src = writeTask(join(parent, "Archive", "finished"));
    mkdirSync(join(home, ".config", "agents-kit"), { recursive: true });
    writeFileSync(join(home, ".config", "agents-kit", "config.json"), registry);
    const { stderr } = runMove(1, [src, "--to", "archive"], { env: { ...process.env, HOME: home } });
    assert.strictEqual(
      stderr,
      `${src} is already archived under ${join(parent, "Archive")}.\n`,
      `the refusal is the only stderr line under a ${name} registry`,
    );
    assertUnmoved(src);
  }
});

test("an unreadable canonical container refuses the run rather than resolving from the registered roots alone", {
  skip: process.getuid?.() === 0 && "root reads a directory whose bits deny it",
}, () => {
  const home = area("canonical-locked-home");
  const store = area("canonical-locked-store");
  const registered = writeTask(join(store, "product", "backend", "twin"));
  const project = area("canonical-locked-project");
  const locked = join(project, ".agents", "tasks", "Archive");
  mkdirSync(locked, { recursive: true });
  chmodSync(locked, 0o000);
  try {
    const { stderr } = runMove(2, ["twin", "--to", "archive"], {
      cwd: project,
      env: registryEnv(home, [store]),
    });
    assertIncludes(stderr, locked, "the refusal names the canonical container it could not read");
    assertIncludes(stderr, "EACCES", "the refusal carries the cause");
  } finally {
    chmodSync(locked, 0o755);
  }
  assertUnmoved(registered);
});

test("a slug matches a folder name exactly, under the canonical root as under a registered one", () => {
  const project = area("slug-case-project");
  const canonical = writeTask(join(project, ".agents", "tasks", "MyTask"));
  const store = area("slug-case-store");
  const registered = writeTask(join(store, "group", "MyTask"));

  const viaCanonical = runMove(2, ["mytask", "--to", "archive"], {
    cwd: project,
    env: registryEnv(area("slug-case-canonical-home"), []),
  });
  assertIncludes(
    viaCanonical.stderr,
    "no task folder named mytask",
    "a case-differing slug resolves nothing under the canonical root",
  );
  assertUnmoved(canonical);

  const viaRegistry = runMove(2, ["mytask", "--to", "archive"], {
    cwd: area("slug-case-cwd"),
    env: registryEnv(area("slug-case-registered-home"), [store]),
  });
  assertIncludes(
    viaRegistry.stderr,
    "no task folder named mytask",
    "a case-differing slug resolves nothing under a registered root either",
  );
  assertUnmoved(registered);
});

test("a bare `.`, `..`, or empty subject names no task folder", () => {
  const project = area("slug-dot-project");
  const tasks = join(project, ".agents", "tasks");
  writeTask(tasks, { [PLAN]: plan("to-do") });

  for (const subject of [".", "..", ""]) {
    runMove(2, [subject, "--to", "backlog"], { cwd: project });
  }

  assertUnmoved(tasks);
  assert.strictEqual(exists(join(project, ".agents", "Backlog")), false, "the store itself never moved");
});
