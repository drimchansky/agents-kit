import assert from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseArgs, watch, type Clock } from "../scripts/silence-watch.ts";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(resolve(TESTS_DIR, ".."), "scripts", "silence-watch.ts");
const TEST_ROOT = mkdtempSync(join(tmpdir(), "agents-kit-silence-watch-"));
const USAGE = /^usage: node scripts\/silence-watch\.ts --interval <seconds> <file>\.\.\.$/;
const INTERVAL_MS = 300_000;
const START = Date.UTC(2026, 0, 1, 12, 0, 0);
const CLI_DEADLINE_MS = 10_000;

after(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

class Stop extends Error {}

function fixture(name: string): string {
  return join(TEST_ROOT, name);
}

function touch(file: string, at: number): void {
  writeFileSync(file, "");
  utimesSync(file, at / 1000, at / 1000);
}

interface Run {
  readonly lines: readonly string[];
  readonly sleeps: readonly number[];
  readonly linesBeforeSleep: readonly number[];
}

async function runWatch(
  files: readonly string[],
  sleepCount: number,
  during: (sleep: number, now: number) => void = () => {},
  intervalMs = INTERVAL_MS,
): Promise<Run> {
  const lines: string[] = [];
  const sleeps: number[] = [];
  const linesBeforeSleep: number[] = [];
  let now = START;
  const clock: Clock = {
    now: () => now,
    sleep: async (ms) => {
      linesBeforeSleep.push(lines.length);
      if (sleeps.length === sleepCount) throw new Stop();
      sleeps.push(ms);
      during(sleeps.length, now);
      now += ms;
    },
  };
  await assert.rejects(watch({ intervalMs, files }, clock, (line) => lines.push(line)), Stop);
  return { lines, sleeps, linesBeforeSleep };
}

test("the first check prints nothing, and each later check that reaches a new multiple prints one line", async () => {
  const output = fixture("old-output");
  touch(output, START - 3.5 * INTERVAL_MS);

  const run = await runWatch([output], 3);

  assert.strictEqual(run.linesBeforeSleep[0], 0, "the first check printed a line");
  assert.deepStrictEqual(run.sleeps, [150_000, 300_000, 300_000], "each sleep wakes at the next multiple since the last change");
  assert.deepStrictEqual(run.lines, [
    "silent 1200s since 2026-01-01T11:42:30.000Z",
    "silent 1500s since 2026-01-01T11:42:30.000Z",
    "silent 1800s since 2026-01-01T11:42:30.000Z",
  ]);
});

test("a watched log that keeps changing prints nothing, even while another watched file stays unchanged", async () => {
  const output = fixture("quiet-output");
  const log = fixture("busy-log");
  touch(output, START);
  touch(log, START);

  const run = await runWatch([output, log], 6, (_sleep, now) => touch(log, now + 1000));

  assert.ok(run.sleeps.reduce((total, ms) => total + ms, 0) > 2 * INTERVAL_MS, "the run spans more than two intervals");
  assert.deepStrictEqual(run.lines, []);
});

test("a listed file that does not exist yet counts as unchanged, and its later creation counts as a change", async () => {
  const log = fixture("late-log");
  const output = fixture("present-output");
  rmSync(log, { force: true });
  touch(output, START);

  const run = await runWatch([log, output], 3, (sleep, now) => {
    if (sleep === 2) touch(log, now + 60_000);
  });

  assert.deepStrictEqual(run.lines, [
    "silent 300s since 2026-01-01T12:00:00.000Z",
    "silent 300s since 2026-01-01T12:06:00.000Z",
  ]);
});

test("a listed file that becomes unreadable after the watch read it keeps its last read modification time", async () => {
  const output = fixture("older-output");
  const log = fixture("vanishing-log");
  touch(output, START - INTERVAL_MS);
  touch(log, START - 60_000);

  const run = await runWatch([output, log], 2, (sleep) => {
    if (sleep === 1) rmSync(log);
  });

  assert.deepStrictEqual(run.lines, [
    "silent 300s since 2026-01-01T11:59:00.000Z",
    "silent 600s since 2026-01-01T11:59:00.000Z",
  ]);
});

test("with no listed file present, silence runs from the watch's start", async () => {
  const missing = fixture("never-created");
  rmSync(missing, { force: true });

  const run = await runWatch([missing], 1);

  assert.deepStrictEqual(run.lines, ["silent 300s since 2026-01-01T12:00:00.000Z"]);
});

test("an interval longer than the longest timer sleeps in capped steps and prints only once the whole interval has passed", async () => {
  const output = fixture("long-interval-output");
  touch(output, START);

  const run = await runWatch([output], 2, () => {}, 3_000_000_000);

  assert.deepStrictEqual(run.sleeps, [2_147_483_647, 852_516_353], "no sleep exceeds the longest timer delay");
  assert.deepStrictEqual(run.linesBeforeSleep, [0, 0, 1], "a capped wake printed a line");
  assert.deepStrictEqual(run.lines, ["silent 3000000s since 2026-01-01T12:00:00.000Z"]);
});

test("the interval is read as whole seconds and every listed file is watched", () => {
  assert.deepStrictEqual(parseArgs(["--interval", "300", "/a", "/b"]), { intervalMs: 300_000, files: ["/a", "/b"] });
});

test("a missing, non-positive, or fractional interval, or no file, is a usage error", () => {
  const variants = [
    [],
    ["--interval"],
    ["--interval", "300"],
    ["--interval", "0", "/a"],
    ["--interval", "-5", "/a"],
    ["--interval", "1.5", "/a"],
    ["--interval", "abc", "/a"],
    ["--interval", "9".repeat(400), "/a"],
    ["/a"],
    ["--every", "300", "/a"],
  ];
  for (const args of variants) {
    assert.throws(() => parseArgs(args), { code: 2, message: USAGE }, JSON.stringify(args));
  }
});

test("the CLI refuses bad usage with status 2 and the usage line on stderr", () => {
  const child = spawnSync(process.execPath, [SCRIPT, "--interval", "0", fixture("unused")], { encoding: "utf8", timeout: CLI_DEADLINE_MS });

  assert.strictEqual(child.signal, null, "the refused watch kept running");
  assert.strictEqual(child.status, 2);
  assert.strictEqual(child.stdout, "");
  assert.match(child.stderr.trim(), /^\[silence-watch\] usage: node scripts\/silence-watch\.ts --interval <seconds> <file>\.\.\.$/);
});

test("the CLI writes each notice as a line on the real clock and ends with status 0 when its reader closes", async () => {
  const output = fixture("cli-output");
  writeFileSync(output, "");
  const since = new Date(statSync(output).mtimeMs).toISOString();
  const child = spawn(process.execPath, [SCRIPT, "--interval", "1", output], { stdio: ["ignore", "pipe", "pipe"] });
  const deadline = setTimeout(() => child.kill("SIGKILL"), CLI_DEADLINE_MS);
  const exited = new Promise<[number | null, NodeJS.Signals | null]>((resolveExit) => {
    child.once("exit", (code, signal) => resolveExit([code, signal]));
  });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });

  try {
    const first = await new Promise<string>((resolveLine, rejectLine) => {
      let stdout = "";
      child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
        stdout += chunk;
        const end = stdout.indexOf("\n");
        if (end !== -1) resolveLine(stdout.slice(0, end));
      });
      exited.then(() => rejectLine(new Error(`watch exited before a notice; stderr: ${stderr}`)));
    });
    const match = /^silent (\d+)s since (\S+)$/.exec(first);
    assert.ok(match, first);
    assert.ok(Number(match[1]) >= 1, first);
    assert.strictEqual(match[2], since);

    child.stdout.destroy();
    assert.deepStrictEqual(await exited, [0, null], stderr);
  } finally {
    clearTimeout(deadline);
    child.kill("SIGKILL");
  }
});
