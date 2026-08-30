import assert from "node:assert";
import { spawnSync } from "node:child_process";
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
const PLAN = "plan.md";
const NOTE = "notes.md";
const NOTE_BODY = "# note\n\nA file whose survival proves the whole folder moved.\n";

interface Run {
  readonly stdout: string;
  readonly stderr: string;
}

function runMove(expectedStatus: number, args: readonly string[], options: object = {}): Run {
  const run = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", ...options });
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
  mkdirSync(join(home, ".config", "agents-kit"), { recursive: true });
  writeFileSync(
    join(home, ".config", "agents-kit", "config.json"),
    JSON.stringify({ taskRoots: [{ path: store, label: "store" }] }),
  );
  const empty = area("slug-registry-cwd");
  const { stdout } = runMove(0, ["parked-and-finished", "--to", "archive"], {
    cwd: empty,
    env: { ...process.env, HOME: home },
  });
  assertMoved(stdout, src, join(store, "Archive", "parked-and-finished"));
});

test("an ambiguous bare slug asks for a path instead of picking one", () => {
  const home = area("slug-ambiguous-home");
  const project = area("slug-ambiguous-project");
  const canonical = writeTask(join(project, ".agents", "tasks", "twin"));
  const store = area("slug-ambiguous-store");
  const registered = writeTask(join(store, "twin"));
  mkdirSync(join(home, ".config", "agents-kit"), { recursive: true });
  writeFileSync(
    join(home, ".config", "agents-kit", "config.json"),
    JSON.stringify({ taskRoots: [{ path: store, label: "store" }] }),
  );
  const { stderr } = runMove(2, ["twin", "--to", "archive"], {
    cwd: project,
    env: { ...process.env, HOME: home },
  });
  assertIncludes(stderr, "Pass the one you mean as a path", "an ambiguous slug is handed back, never guessed");
  assertIncludes(stderr, canonical, "both candidates are named");
  assertIncludes(stderr, registered, "both candidates are named");
  assertUnmoved(canonical);
  assertUnmoved(registered);
});

test("an unmatched bare slug asks for a path", () => {
  const project = area("slug-missing");
  const { stderr } = runMove(2, ["nowhere-task", "--to", "archive"], { cwd: project });
  assertIncludes(stderr, "Pass its path instead", "a slug that resolved to nothing asks for a path");
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
