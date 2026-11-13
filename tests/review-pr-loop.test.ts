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

function embeddedProgram(heading: string, heartbeat: string, ciChecks: string): string {
  const source = readFileSync(SKILL, "utf8");
  const match = source.split(`## ${heading}\n`)[1]?.match(/```sh\n([\s\S]*?)```/);
  assert.ok(match, `embedded program under ${heading} is present`);
  return match[1]
    .replaceAll("<host>/<owner>/<repo>", "example.com/acme/widgets")
    .replaceAll("<host>", "example.com")
    .replaceAll("<number>", "42")
    .replaceAll("<reviewed-head>", "reviewed")
    .replaceAll("<heartbeat-file>", heartbeat)
    .replaceAll("<ci-checks>", () => ciChecks);
}

type ProgramOptions = { sleepMultiplier?: number; ciChecks?: string };

function runWatch(responses: readonly string[], options: ProgramOptions = {}) {
  return runProgram("The watch", responses, options);
}

function runProgram(heading: string, responses: readonly string[], { sleepMultiplier = 1, ciChecks = "" }: ProgramOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), "review-pr-loop-watch-"));
  const bin = join(root, "bin");
  const clock = join(root, "clock");
  const index = join(root, "index");
  const responsePrefix = join(root, "response");
  const heartbeat = join(root, "heartbeat");
  const beatLog = join(root, "beats");
  const readBeatLog = join(root, "read-beats");
  const checksLog = join(root, "checks");
  const beatReference = join(root, "beat-reference");
  const date = join(bin, "date");
  const sleep = join(bin, "sleep");
  const gh = join(bin, "gh");
  mkdirSync(bin);
  writeFileSync(clock, "0\n");
  writeFileSync(index, "0\n");
  writeFileSync(beatLog, "");
  writeFileSync(readBeatLog, "");
  writeFileSync(checksLog, "");
  writeFileSync(beatReference, "");
  utimesSync(beatReference, new Date(1970, 0, 3), new Date(1970, 0, 3));
  responses.forEach((response, index) => writeFileSync(`${responsePrefix}.${index + 1}`, `${response}\n`));
  writeFileSync(
    date,
    "#!/bin/sh\nIFS= read -r now < \"$WATCH_CLOCK\"\nprintf '%s\\n' \"$now\"\n",
  );
  writeFileSync(
    sleep,
    "#!/bin/sh\nIFS= read -r now < \"$WATCH_CLOCK\"\n{ [ \"$WATCH_HEARTBEAT\" -nt \"$WATCH_BEAT_REFERENCE\" ] && printf 1 || printf 0; } >> \"$WATCH_BEAT_LOG\"\ntouch -c -t 197001020000 \"$WATCH_HEARTBEAT\"\nprintf '%s\\n' \"$((now + $1 * WATCH_SLEEP_MULTIPLIER))\" > \"$WATCH_CLOCK\"\n",
  );
  writeFileSync(
    gh,
    "#!/bin/sh\n{ [ \"$WATCH_HEARTBEAT\" -nt \"$WATCH_BEAT_REFERENCE\" ] && printf 1 || printf 0; } >> \"$WATCH_READ_BEAT_LOG\"\n[ \"$2\" = checks ] && printf '%s\\n' \"${CI_CHECKS-}\" >> \"$WATCH_CHECKS_LOG\"\n[ \"$GH_HOST\" = example.com ] && [ \"$GH_REPO\" = example.com/acme/widgets ] || exit 1\nIFS= read -r index < \"$WATCH_INDEX\"\nindex=$((index + 1))\nprintf '%s\\n' \"$index\" > \"$WATCH_INDEX\"\n[ -f \"$WATCH_RESPONSE_PREFIX.$index\" ] || exit 1\nIFS= read -r line < \"$WATCH_RESPONSE_PREFIX.$index\"\n[ \"$line\" = ERROR ] && exit 1\nprintf '%s\\n' \"$line\"\n",
  );
  chmodSync(date, 0o755);
  chmodSync(sleep, 0o755);
  chmodSync(gh, 0o755);
  try {
    const result = spawnSync("sh", ["-c", embeddedProgram(heading, heartbeat, ciChecks)], {
      cwd: REPO_DIR,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
        WATCH_BEAT_LOG: beatLog,
        WATCH_BEAT_REFERENCE: beatReference,
        WATCH_CHECKS_LOG: checksLog,
        WATCH_CLOCK: clock,
        WATCH_HEARTBEAT: heartbeat,
        WATCH_INDEX: index,
        WATCH_READ_BEAT_LOG: readBeatLog,
        WATCH_RESPONSE_PREFIX: responsePrefix,
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
      beats: readFileSync(beatLog, "utf8"),
      readBeats: readFileSync(readBeatLog, "utf8"),
      checkNames: readFileSync(checksLog, "utf8"),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("watch keeps polling past four hours when no push arrives", () => {
  const result = runWatch([...Array.from({ length: 25 }, () => "OPEN reviewed"), "CLOSED reviewed"], { sleepMultiplier: 10 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "closed: CLOSED");
  assert.equal(result.clock, 15_600);
  assert.equal(result.calls, 26);
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

test("watch reports a GitHub read failure after five consecutive failed head reads", () => {
  const result = runWatch(Array.from({ length: 5 }, () => "ERROR"));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "error: gh pr view failed");
  assert.equal(result.clock, 300);
  assert.equal(result.calls, 5);
});

test("watch keeps polling when fewer than five head reads fail before a successful read", () => {
  const result = runWatch([...Array.from({ length: 4 }, () => "ERROR"), "CLOSED reviewed"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "closed: CLOSED");
  assert.equal(result.clock, 300);
  assert.equal(result.calls, 5);
});

test("watch restarts the failed-read count after a successful head read", () => {
  const failures = Array.from({ length: 4 }, () => "ERROR");
  const result = runWatch([...failures, "OPEN reviewed", ...failures, "CLOSED reviewed"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "closed: CLOSED");
  assert.equal(result.clock, 600);
  assert.equal(result.calls, 10);
});

test("watch touches its heartbeat after a failed head read and skips that poll's checks read", () => {
  const result = runWatch(["ERROR", "OPEN reviewed", "failing", "CLOSED reviewed"], { ciChecks: '["build"]' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "closed: CLOSED");
  assert.equal(result.calls, 4);
  assert.equal(result.beats, "011");
  assert.equal(result.readBeats, "0000");
});

test("watch reports cleared checks once a named failing check passes on the reviewed head", () => {
  const result = runWatch(["OPEN reviewed", "failing", "OPEN reviewed", "cleared"], { ciChecks: '["build"]' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "cleared: reviewed");
  assert.equal(result.clock, 120);
  assert.equal(result.calls, 4);
});

test("watch keeps polling while a named check still fails", () => {
  const result = runWatch(["OPEN reviewed", "failing", "OPEN reviewed", "failing", "CLOSED reviewed"], { ciChecks: '["build"]' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "closed: CLOSED");
  assert.equal(result.clock, 180);
  assert.equal(result.calls, 5);
});

test("watch keeps polling while a check is pending", () => {
  const result = runWatch(["OPEN reviewed", "pending", "OPEN reviewed", "pending", "CLOSED reviewed"], { ciChecks: '["build"]' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "closed: CLOSED");
  assert.equal(result.clock, 180);
  assert.equal(result.calls, 5);
});

test("watch keeps polling when the checks read fails", () => {
  const result = runWatch(["OPEN reviewed", "ERROR", "OPEN reviewed", "cleared"], { ciChecks: '["build"]' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "cleared: reviewed");
  assert.equal(result.clock, 120);
  assert.equal(result.calls, 4);
});

test("watch with check names reports a push without reading checks on the moved head", () => {
  const result = runWatch(["OPEN reviewed", "failing", ...Array.from({ length: 6 }, () => "OPEN pushed")], { ciChecks: '["build"]' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "updated: pushed");
  assert.equal(result.clock, 420);
  assert.equal(result.calls, 8);
});

test("watch touches its heartbeat once per iteration after the checks read", () => {
  const result = runWatch(["OPEN reviewed", "failing", "OPEN reviewed", "failing", "CLOSED reviewed"], { ciChecks: '["build"]' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.beats, "011");
  assert.equal(result.readBeats, "00000");
});

test("watch passes a check name with spaces and quotes to the checks read intact", () => {
  const ciChecks = JSON.stringify(['e2e "smoke" it\'s $HOME `id`', "build"]);
  const result = runWatch(["OPEN reviewed", "failing", "OPEN reviewed", "cleared"], { ciChecks });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "cleared: reviewed");
  assert.equal(result.checkNames, `${ciChecks}\n${ciChecks}\n`);
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
