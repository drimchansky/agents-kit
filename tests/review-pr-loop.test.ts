import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SKILL = join(REPO_DIR, "skills", "review-pr-loop", "SKILL.md");

function watchProgram(): string {
  const source = readFileSync(SKILL, "utf8");
  const match = source.match(/## The watch[\s\S]*?```sh\n([\s\S]*?)```/);
  assert.ok(match, "embedded watch program is present");
  return match[1]
    .replaceAll("<host>/<owner>/<repo>", "example.com/acme/widgets")
    .replaceAll("<host>", "example.com")
    .replaceAll("<number>", "42")
    .replaceAll("<reviewed-head>", "reviewed");
}

function runWatch(responses: readonly string[], sleepMultiplier = 1, readAdvances: readonly number[] = []) {
  const root = mkdtempSync(join(tmpdir(), "review-pr-loop-watch-"));
  const bin = join(root, "bin");
  const clock = join(root, "clock");
  const index = join(root, "index");
  const responsePrefix = join(root, "response");
  const sleepLog = join(root, "sleeps");
  const date = join(bin, "date");
  const sleep = join(bin, "sleep");
  const gh = join(bin, "gh");
  mkdirSync(bin);
  writeFileSync(clock, "0\n");
  writeFileSync(index, "0\n");
  writeFileSync(sleepLog, "");
  responses.forEach((response, index) => writeFileSync(`${responsePrefix}.${index + 1}`, `${response}\n`));
  readAdvances.forEach((advance, index) => writeFileSync(`${responsePrefix}.${index + 1}.advance`, `${advance}\n`));
  writeFileSync(
    date,
    "#!/bin/sh\nIFS= read -r now < \"$WATCH_CLOCK\"\nprintf '%s\\n' \"$now\"\n",
  );
  writeFileSync(
    sleep,
    "#!/bin/sh\nIFS= read -r now < \"$WATCH_CLOCK\"\nprintf '%s\\n' \"$1\" >> \"$WATCH_SLEEP_LOG\"\nprintf '%s\\n' \"$((now + $1 * WATCH_SLEEP_MULTIPLIER))\" > \"$WATCH_CLOCK\"\n",
  );
  writeFileSync(
    gh,
    "#!/bin/sh\n[ \"$GH_HOST\" = example.com ] && [ \"$GH_REPO\" = example.com/acme/widgets ] || exit 1\nIFS= read -r index < \"$WATCH_INDEX\"\nindex=$((index + 1))\nprintf '%s\\n' \"$index\" > \"$WATCH_INDEX\"\n[ -f \"$WATCH_RESPONSE_PREFIX.$index.advance\" ] && { IFS= read -r advance < \"$WATCH_RESPONSE_PREFIX.$index.advance\"; IFS= read -r now < \"$WATCH_CLOCK\"; printf '%s\\n' \"$((now + advance))\" > \"$WATCH_CLOCK\"; }\n[ -f \"$WATCH_RESPONSE_PREFIX.$index\" ] || exit 1\nIFS= read -r line < \"$WATCH_RESPONSE_PREFIX.$index\"\n[ \"$line\" = ERROR ] && exit 1\nprintf '%s\\n' \"$line\"\n",
  );
  chmodSync(date, 0o755);
  chmodSync(sleep, 0o755);
  chmodSync(gh, 0o755);
  try {
    const result = spawnSync("sh", ["-c", watchProgram()], {
      cwd: REPO_DIR,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
        WATCH_CLOCK: clock,
        WATCH_INDEX: index,
        WATCH_RESPONSE_PREFIX: responsePrefix,
        WATCH_SLEEP_LOG: sleepLog,
        WATCH_SLEEP_MULTIPLIER: String(sleepMultiplier),
      },
      timeout: 30_000,
    });
    return {
      status: result.status,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      clock: Number(readFileSync(clock, "utf8").trim()),
      calls: Number(readFileSync(index, "utf8").trim()),
      sleeps: readFileSync(sleepLog, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(Number),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("watch keeps its absolute deadline while the head keeps changing", () => {
  const responses = Array.from({ length: 23 }, (_, index) => `OPEN push-${index + 1}`);
  const result = runWatch(responses, 10);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "stalled: push-23");
  assert.equal(result.clock, 14_400);
  assert.equal(result.calls, 23);
  assert.ok(result.sleeps.every((seconds) => seconds <= 60));
});

test("watch stalls at four hours when no push arrives", () => {
  const result = runWatch(Array.from({ length: 23 }, () => "OPEN reviewed"), 10);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "stalled: reviewed");
  assert.equal(result.clock, 14_400);
  assert.equal(result.calls, 23);
});

test("watch reports a push after five stable minutes", () => {
  const result = runWatch(Array.from({ length: 6 }, () => "OPEN updated"));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "updated: updated");
  assert.equal(result.clock, 360);
  assert.equal(result.calls, 6);
});

test("watch restarts the stability interval after another push", () => {
  const result = runWatch(["OPEN first", "OPEN first", ...Array.from({ length: 6 }, () => "OPEN second")]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "updated: second");
  assert.equal(result.clock, 480);
  assert.equal(result.calls, 8);
});

test("watch reports the latest unstable head at the deadline", () => {
  const result = runWatch(["OPEN reviewed", ...Array.from({ length: 5 }, () => "OPEN late")], 1, [14_030]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "stalled: late");
  assert.equal(result.clock, 14_400);
  assert.equal(result.calls, 6);
  assert.deepEqual(result.sleeps, [60, 60, 60, 60, 60, 60, 10]);
});

test("watch reports a closed pull request", () => {
  const result = runWatch(["CLOSED reviewed"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "closed: CLOSED");
  assert.equal(result.clock, 60);
  assert.equal(result.calls, 1);
});

test("watch reports a GitHub read failure", () => {
  const result = runWatch(["ERROR"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "error: gh pr view failed");
  assert.equal(result.clock, 60);
  assert.equal(result.calls, 1);
});
