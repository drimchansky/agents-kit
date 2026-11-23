import assert from "node:assert";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Exit, WAKE_MARKER, WAKE_SUBJECT, parseArgs, runDir } from "../scripts/orca-status-timer.ts";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(resolve(TESTS_DIR, ".."), "scripts", "orca-status-timer.ts");
const TEST_ROOT = mkdtempSync(join(tmpdir(), "agents-kit-orca-status-timer-"));
const RUN = "run_f039b096e068";
const NOW = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));
const WAIT_LIMIT_MS = 15_000;
const armedTimers: { readonly pid: number; readonly token: string }[] = [];
const decoys = new Set<ChildProcess>();

function isOwnedTimer(pid: number, token: string): boolean {
  const listing = spawnSync("ps", ["-ww", "-p", String(pid), "-o", "command="], { encoding: "utf8" });
  return listing.status === 0 && listing.stdout.includes(`orca-status-timer.ts fire --run ${RUN} --token ${token}`);
}

after(() => {
  for (const child of decoys) child.kill("SIGKILL");
  for (const { pid, token } of armedTimers) {
    if (!isOwnedTimer(pid, token)) continue;
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

interface Fixture {
  readonly home: string;
  readonly orca: string;
  readonly log: string;
}

let fixtureCount = 0;

function fixture(sendStatus = 0): Fixture {
  const root = join(TEST_ROOT, `case-${++fixtureCount}`);
  const home = join(root, "home");
  const orca = join(root, "fake-orca");
  const log = join(root, "orca-calls.jsonl");
  mkdirSync(home, { recursive: true });
  writeFileSync(orca, `#!${process.execPath}
const { appendFileSync } = require("node:fs");
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ argv: process.argv.slice(2), at: Date.now() }) + "\\n");
process.stdout.write('{"ok":true}\\n');
process.stderr.write(${JSON.stringify(sendStatus === 0 ? "" : "fake orca refused the send\n")});
process.exitCode = ${sendStatus};
`);
  chmodSync(orca, 0o755);
  return { home, orca, log };
}

function cli(f: Fixture, args: readonly string[]) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", env: { ...process.env, HOME: f.home } });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function json(f: Fixture, args: readonly string[]) {
  const result = cli(f, args);
  assert.strictEqual(result.status, 0, `${args[0]} failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

function arm(f: Fixture, inMs: number) {
  const at = new Date(Date.now() + inMs).toISOString();
  const output = json(f, ["arm", "--run", RUN, "--at", at, "--orca", f.orca]);
  armedTimers.push({ pid: output.timer.pid, token: output.timer.token });
  return output;
}

function calls(f: Fixture): { readonly argv: readonly string[]; readonly at: number }[] {
  if (!existsSync(f.log)) return [];
  return readFileSync(f.log, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(condition: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + WAIT_LIMIT_MS;
  while (!condition()) {
    if (Date.now() > deadline) assert.fail(`timed out waiting for ${what}`);
    await delay(100);
  }
}

function retarget(f: Fixture, token: string, pid: number): void {
  const path = join(runDir(f.home, RUN), `${token}.timer.json`);
  const record = JSON.parse(readFileSync(path, "utf8"));
  writeFileSync(path, `${JSON.stringify({ ...record, pid })}\n`);
}

function decoy(): number {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" });
  child.unref();
  assert.ok(child.pid !== undefined);
  decoys.add(child);
  return child.pid;
}

function exitCode(run: () => unknown): number | undefined {
  try {
    run();
  } catch (err) {
    if (err instanceof Exit) return err.code;
    throw err;
  }
  return undefined;
}

test("arguments are validated before any timer starts", () => {
  const future = "2026-01-01T12:15:00Z";
  assert.deepStrictEqual(parseArgs(["arm", "--run", RUN, "--at", future, "--orca", "orca"], NOW), { kind: "arm", run: RUN, at: "2026-01-01T12:15:00.000Z", orca: "orca" });
  assert.deepStrictEqual(parseArgs(["cancel", "--run", RUN], NOW), { kind: "cancel", run: RUN });
  for (const argv of [
    ["arm", "--run", RUN, "--at", "2026-01-01T12:00:00Z", "--orca", "orca"],
    ["arm", "--run", RUN, "--at", "2026-01-01 12:15", "--orca", "orca"],
    ["arm", "--run", RUN, "--at", "2026-02-30T12:15:00Z", "--orca", "orca"],
    ["arm", "--run", "../other", "--at", future, "--orca", "orca"],
    ["arm", "--run", RUN, "--at", future],
    ["arm", "--run", RUN, "--at", future, "--orca", ""],
    ["status", "--run", RUN, "--extra", "x"],
    ["status", "--run", RUN, "--run", RUN],
    ["fire", "--run", RUN, "--token", "not-a-token", "--at", future, "--orca", "orca"],
    ["wake"],
    [],
  ]) {
    assert.strictEqual(exitCode(() => parseArgs(argv, NOW)), 2, `accepted ${JSON.stringify(argv)}`);
  }
});

test("a past deadline exits 2 on the CLI without creating state or calling Orca", () => {
  const f = fixture();
  const result = cli(f, ["arm", "--run", RUN, "--at", "2020-01-01T00:00:00Z", "--orca", f.orca]);
  assert.strictEqual(result.status, 2);
  assert.strictEqual(result.stdout, "");
  assert.match(result.stderr, /--at must be in the future/);
  assert.strictEqual(existsSync(join(f.home, ".local")), false);
  assert.deepStrictEqual(calls(f), []);
});

test("status reports no timer for a Run that never armed one, without creating state", () => {
  const f = fixture();
  assert.deepStrictEqual(json(f, ["status", "--run", RUN]), { run: RUN, timer: null });
  assert.strictEqual(existsSync(join(f.home, ".local")), false);
});

describe("timer lifecycle", { concurrency: true }, () => {
  test("an armed timer sends one literal wake mail to the Run mailbox at its deadline, then exits", async () => {
    const f = fixture();
    const armed = arm(f, 1500);
    assert.strictEqual(armed.timer.state, "pending");
    assert.strictEqual(armed.superseded, null);
    const { token, at, pid } = armed.timer;

    await waitFor(() => json(f, ["status", "--run", RUN]).timer.state === "sent", "the wake to be sent");
    await waitFor(() => !isAlive(pid), "the timer process to exit");
    await delay(500);

    const sent = calls(f);
    assert.strictEqual(sent.length, 1, "the timer sent more or fewer than one wake");
    assert.deepStrictEqual(sent[0].argv, [
      "orchestration", "send",
      "--to", `run:${RUN}`,
      "--subject", WAKE_SUBJECT,
      "--body", `${WAKE_MARKER}\nrun: ${RUN}\ntoken: ${token}`,
      "--json",
    ]);
    assert.ok(sent[0].at >= Date.parse(at), "the wake was sent before its deadline");
    const reported = json(f, ["status", "--run", RUN]).timer;
    assert.strictEqual(reported.token, token);
    assert.strictEqual(reported.result.outcome, "sent");
    assert.strictEqual(reported.result.status, 0);
  });

  test("cancel stops the owned timer process and no wake is sent", async () => {
    const f = fixture();
    const { token, pid } = arm(f, 60_000).timer;

    const cancelled = json(f, ["cancel", "--run", RUN]);

    assert.strictEqual(cancelled.timer.token, token);
    assert.strictEqual(cancelled.timer.state, "cancelled");
    assert.strictEqual(cancelled.process, "stopped");
    await waitFor(() => !isAlive(pid), "the cancelled timer process to be gone");
    assert.strictEqual(json(f, ["status", "--run", RUN]).timer.state, "cancelled");
    assert.strictEqual(json(f, ["cancel", "--run", RUN]).process, "untouched");
    assert.deepStrictEqual(calls(f), []);
  });

  test("cancel signals only the recorded timer process, and the surviving timer's re-check sends nothing", async () => {
    const f = fixture();
    const { token, pid } = arm(f, 2000).timer;
    const unrelated = decoy();
    retarget(f, token, unrelated);

    const cancelled = json(f, ["cancel", "--run", RUN]);

    assert.strictEqual(cancelled.timer.state, "cancelled");
    assert.strictEqual(cancelled.process, "not-running");
    assert.strictEqual(isAlive(unrelated), true, "cancel signalled a process the timer does not own");
    assert.strictEqual(isAlive(pid), true, "the fixture expects the real timer process to survive");
    await waitFor(() => !isAlive(pid), "the surviving timer process to reach its deadline and exit");
    assert.deepStrictEqual(calls(f), []);
  });

  test("an unclaimed timer that is no longer the Run's current token sends nothing at its deadline", async () => {
    const f = fixture();
    const { token, pid } = arm(f, 1500).timer;
    const dir = runDir(f.home, RUN);
    const replacement = "00000000-0000-4000-8000-000000000000";
    const record = JSON.parse(readFileSync(join(dir, `${token}.timer.json`), "utf8"));
    writeFileSync(join(dir, `${replacement}.timer.json`), `${JSON.stringify({ ...record, token: replacement, pid: decoy() })}\n`);
    writeFileSync(join(dir, "current.json"), `${JSON.stringify({ token: replacement })}\n`);

    await waitFor(() => !isAlive(pid), "the replaced timer process to reach its deadline and exit");

    assert.strictEqual(existsSync(join(dir, `${token}.claim`)), false, "the replaced timer claimed its token");
    assert.deepStrictEqual(calls(f), []);
  });

  test("re-arming supersedes the earlier timer, so only the current token is sent", async () => {
    const f = fixture();
    const first = arm(f, 2000).timer;
    const unrelated = decoy();
    retarget(f, first.token, unrelated);
    const second = arm(f, 3500);

    assert.deepStrictEqual(second.superseded, { token: first.token, state: "cancelled", process: "not-running" });
    assert.strictEqual(isAlive(unrelated), true, "arm signalled a process the timer does not own");
    await waitFor(() => !isAlive(first.pid), "the superseded timer process to reach its deadline and exit");
    assert.deepStrictEqual(calls(f), [], "the superseded timer sent a wake");
    await waitFor(() => json(f, ["status", "--run", RUN]).timer.state === "sent", "the current wake to be sent");

    const sent = calls(f);
    assert.strictEqual(sent.length, 1);
    assert.ok(sent[0].argv.includes(`${WAKE_MARKER}\nrun: ${RUN}\ntoken: ${second.timer.token}`));
  });

  test("re-arming stops a pending owned timer process", async () => {
    const f = fixture();
    const first = arm(f, 60_000).timer;
    const second = arm(f, 60_000);

    assert.deepStrictEqual(second.superseded, { token: first.token, state: "cancelled", process: "stopped" });
    await waitFor(() => !isAlive(first.pid), "the superseded timer process to be gone");
    assert.strictEqual(json(f, ["status", "--run", RUN]).timer.token, second.timer.token);
    assert.strictEqual(json(f, ["cancel", "--run", RUN]).process, "stopped");
  });

  test("a failed send is recorded for status, exits 1, and is not retried", async () => {
    const f = fixture(3);
    const { token, at, pid } = arm(f, 3000).timer;

    const fired = cli(f, ["fire", "--run", RUN, "--token", token, "--at", new Date().toISOString(), "--orca", f.orca]);

    assert.strictEqual(fired.status, 1);
    assert.match(fired.stderr, new RegExp(`wake for run ${RUN} token ${token} was not sent: status 3`));
    const reported = json(f, ["status", "--run", RUN]).timer;
    assert.strictEqual(reported.state, "failed");
    assert.strictEqual(reported.result.status, 3);
    assert.match(reported.result.stderr, /fake orca refused the send/);
    await waitFor(() => !isAlive(pid) && Date.now() > Date.parse(at), "the armed timer process to pass its deadline and exit");
    assert.strictEqual(calls(f).length, 1, "the armed timer sent a second wake after the failure");
  });

  test("a timer whose process ended without sending reports lost", async () => {
    const f = fixture();
    const { pid } = arm(f, 60_000).timer;
    process.kill(pid, "SIGKILL");
    await waitFor(() => !isAlive(pid), "the killed timer process to end");

    assert.strictEqual(json(f, ["status", "--run", RUN]).timer.state, "lost");
    assert.deepStrictEqual(calls(f), []);
  });
});
