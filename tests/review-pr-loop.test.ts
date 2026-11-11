import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SKILL = join(REPO_DIR, "skills", "review-pr-loop", "SKILL.md");
const WAITING = join(REPO_DIR, "references", "workflow", "delegated-waiting.md");

test("the check poll and watch cite the shared shell-commands section, which exists", () => {
  const skill = readFileSync(SKILL, "utf8");
  assert.ok(readFileSync(WAITING, "utf8").includes("\n## Shell commands\n"), "delegated-waiting.md has § Shell commands");
  for (const heading of ["Check poll", "The watch"]) {
    const section = skill.split(`## ${heading}\n`)[1]?.split("\n## ")[0];
    assert.match(section ?? "", /delegated-waiting\.md[^\n]*Shell commands/, heading);
  }
});

function embeddedProgram(heading: string, heartbeat: string): string {
  const source = readFileSync(SKILL, "utf8");
  const match = source.split(`## ${heading}\n`)[1]?.match(/```sh\n([\s\S]*?)```/);
  assert.ok(match, `embedded program under ${heading} is present`);
  return match[1]
    .replaceAll("<host>/<owner>/<repo>", "example.com/acme/widgets")
    .replaceAll("<host>", "example.com")
    .replaceAll("<number>", "42")
    .replaceAll("<reviewed-head>", "reviewed")
    .replaceAll("<heartbeat-file>", heartbeat);
}

function runWatch(responses: readonly string[], sleepMultiplier = 1, readAdvances: readonly number[] = []) {
  return runProgram("The watch", responses, sleepMultiplier, readAdvances);
}

function runProgram(
  heading: string,
  responses: readonly string[],
  sleepMultiplier = 1,
  readAdvances: readonly number[] = [],
) {
  const root = mkdtempSync(join(tmpdir(), "review-pr-loop-watch-"));
  const bin = join(root, "bin");
  const clock = join(root, "clock");
  const index = join(root, "index");
  const responsePrefix = join(root, "response");
  const sleepLog = join(root, "sleeps");
  const heartbeat = join(root, "heartbeat");
  const beatLog = join(root, "beats");
  const readBeatLog = join(root, "read-beats");
  const beatReference = join(root, "beat-reference");
  const date = join(bin, "date");
  const sleep = join(bin, "sleep");
  const gh = join(bin, "gh");
  mkdirSync(bin);
  writeFileSync(clock, "0\n");
  writeFileSync(index, "0\n");
  writeFileSync(sleepLog, "");
  writeFileSync(beatLog, "");
  writeFileSync(readBeatLog, "");
  writeFileSync(beatReference, "");
  utimesSync(beatReference, new Date(1970, 0, 3), new Date(1970, 0, 3));
  responses.forEach((response, index) => writeFileSync(`${responsePrefix}.${index + 1}`, `${response}\n`));
  readAdvances.forEach((advance, index) => writeFileSync(`${responsePrefix}.${index + 1}.advance`, `${advance}\n`));
  writeFileSync(
    date,
    "#!/bin/sh\nIFS= read -r now < \"$WATCH_CLOCK\"\nprintf '%s\\n' \"$now\"\n",
  );
  writeFileSync(
    sleep,
    "#!/bin/sh\nIFS= read -r now < \"$WATCH_CLOCK\"\nprintf '%s\\n' \"$1\" >> \"$WATCH_SLEEP_LOG\"\n{ [ \"$WATCH_HEARTBEAT\" -nt \"$WATCH_BEAT_REFERENCE\" ] && printf 1 || printf 0; } >> \"$WATCH_BEAT_LOG\"\ntouch -c -t 197001020000 \"$WATCH_HEARTBEAT\"\nprintf '%s\\n' \"$((now + $1 * WATCH_SLEEP_MULTIPLIER))\" > \"$WATCH_CLOCK\"\n",
  );
  writeFileSync(
    gh,
    "#!/bin/sh\n{ [ \"$WATCH_HEARTBEAT\" -nt \"$WATCH_BEAT_REFERENCE\" ] && printf 1 || printf 0; } >> \"$WATCH_READ_BEAT_LOG\"\n[ \"$GH_HOST\" = example.com ] && [ \"$GH_REPO\" = example.com/acme/widgets ] || exit 1\nIFS= read -r index < \"$WATCH_INDEX\"\nindex=$((index + 1))\nprintf '%s\\n' \"$index\" > \"$WATCH_INDEX\"\n[ -f \"$WATCH_RESPONSE_PREFIX.$index.advance\" ] && { IFS= read -r advance < \"$WATCH_RESPONSE_PREFIX.$index.advance\"; IFS= read -r now < \"$WATCH_CLOCK\"; printf '%s\\n' \"$((now + advance))\" > \"$WATCH_CLOCK\"; }\n[ -f \"$WATCH_RESPONSE_PREFIX.$index\" ] || exit 1\nIFS= read -r line < \"$WATCH_RESPONSE_PREFIX.$index\"\n[ \"$line\" = ERROR ] && exit 1\nprintf '%s\\n' \"$line\"\n",
  );
  chmodSync(date, 0o755);
  chmodSync(sleep, 0o755);
  chmodSync(gh, 0o755);
  try {
    const result = spawnSync("sh", ["-c", embeddedProgram(heading, heartbeat)], {
      cwd: REPO_DIR,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
        WATCH_BEAT_LOG: beatLog,
        WATCH_BEAT_REFERENCE: beatReference,
        WATCH_CLOCK: clock,
        WATCH_HEARTBEAT: heartbeat,
        WATCH_INDEX: index,
        WATCH_READ_BEAT_LOG: readBeatLog,
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
      beats: readFileSync(beatLog, "utf8"),
      readBeats: readFileSync(readBeatLog, "utf8"),
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

test("watch touches its heartbeat after each read", () => {
  const result = runWatch(Array.from({ length: 6 }, () => "OPEN updated"));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "updated: updated");
  assert.equal(result.beats, "011111");
  assert.equal(result.readBeats, "000000");
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

test("check poll exits early when the head moves", () => {
  const result = runProgram("Check poll", ["reviewed", "1", "pushed"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "moved: pushed");
  assert.equal(result.clock, 60);
  assert.equal(result.calls, 3);
});

test("check poll settles on the reviewed head once no check is pending", () => {
  const result = runProgram("Check poll", ["reviewed", "1", "reviewed", "0"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "settled");
  assert.equal(result.clock, 60);
  assert.equal(result.calls, 4);
});

test("check poll falls through to the checks read when the head read fails", () => {
  const result = runProgram("Check poll", ["ERROR", "2", "reviewed", "0"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "settled");
  assert.equal(result.clock, 60);
  assert.equal(result.calls, 4);
});

test("check poll gives up as pending after 30 minutes", () => {
  const responses = Array.from({ length: 31 }, () => ["reviewed", "1"]).flat();
  const result = runProgram("Check poll", responses);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "pending");
  assert.equal(result.clock, 1800);
  assert.equal(result.calls, 62);
});

test("check poll touches its heartbeat on every iteration", () => {
  const result = runProgram("Check poll", ["reviewed", "1", "reviewed", "1", "reviewed", "0"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "settled");
  assert.equal(result.beats, "11");
  assert.equal(result.readBeats, "000000");
});
