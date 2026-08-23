// Covers scripts/pr-comments.ts: the two-level page merge, the normalized JSON contract it emits,
// the argument forms, and the `gh` invocations the fetch walks build.
// Every case either feeds fixture pages to the pure layer, exercises an argument the script rejects
// before it fetches, or runs the script against a fake `gh` placed first on PATH — so the suite never
// reaches the real CLI or the network. Keep it that way: a case that would need either belongs
// nowhere in this file.
// Zero dependencies; runs under Node type stripping — too old a Node fails as a parse error, not a
// version message. Floor in AGENTS.md § The `.ts` sources are unchecked by design.
// Run: node --test tests/<name>.test.ts   ·   every suite: node --test "tests/*.test.ts"

import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { normalize, parseTarget, type CommentPage, type ThreadPage } from "../scripts/pr-comments.ts";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SCRIPT = join(REPO_DIR, "scripts", "pr-comments.ts");

const PR_NUMBER = 7;
const PR_URL = "https://github.com/acme/kit/pull/7";
const AUTHOR = "pr-author";
const REVIEWER = "reviewer";

interface FixtureComment {
  readonly author: { readonly login: string } | null;
  readonly body: string;
  readonly createdAt: string;
  readonly url: string;
}

interface FixtureThread {
  readonly id: string;
  readonly isResolved: boolean;
  readonly isOutdated: boolean;
  readonly path: string;
  readonly line: number;
  readonly comments: {
    readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string };
    readonly nodes: readonly FixtureComment[];
  };
}

interface ThreadOptions {
  readonly isResolved?: boolean;
  readonly isOutdated?: boolean;
  readonly path?: string;
  readonly line?: number;
  readonly comments?: readonly FixtureComment[];
  readonly hasMoreComments?: boolean;
}

interface PageOptions {
  readonly hasNextPage?: boolean;
  readonly totalCount?: number;
  readonly author?: string | null;
}

function comment(author: string, body: string): FixtureComment {
  return {
    author: { login: author },
    body,
    createdAt: "2026-08-01T12:00:00Z",
    url: `${PR_URL}#discussion_r1`,
  };
}

function thread(id: string, options: ThreadOptions = {}): FixtureThread {
  return {
    id,
    isResolved: options.isResolved ?? false,
    isOutdated: options.isOutdated ?? false,
    path: options.path ?? "src/index.ts",
    line: options.line ?? 12,
    comments: {
      pageInfo: { hasNextPage: options.hasMoreComments ?? false, endCursor: `${id}-comments` },
      nodes: options.comments ?? [comment(REVIEWER, "Critical: this leaks.")],
    },
  };
}

function threadPage(threads: readonly FixtureThread[], options: PageOptions = {}): ThreadPage {
  return {
    data: {
      repository: {
        pullRequest: {
          number: PR_NUMBER,
          url: PR_URL,
          author: options.author === null ? null : { login: options.author ?? AUTHOR },
          reviewThreads: {
            totalCount: options.totalCount ?? threads.length,
            pageInfo: { hasNextPage: options.hasNextPage ?? false, endCursor: "threads-page-1" },
            nodes: threads,
          },
        },
      },
    },
  };
}

function commentPage(id: string, comments: readonly FixtureComment[], hasNextPage = false): CommentPage {
  return {
    data: {
      node: {
        id,
        comments: { pageInfo: { hasNextPage, endCursor: `${id}-more` }, nodes: comments },
      },
    },
  };
}

function bodiesOf(report: ReturnType<typeof normalize>, index: number): string[] {
  return report.threads[index].comments.map((entry) => entry.body);
}

function runScript(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
  const run = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr ?? run.error?.message ?? "" };
}

test("the report carries exactly the contract keys", () => {
  const report = normalize([threadPage([thread("T1")])], []);
  assert.deepStrictEqual(
    Object.keys(report).sort(),
    ["paginationComplete", "pullRequest", "threadsTotal", "threads"].sort(),
    "the report holds the contract keys and nothing else",
  );
});

test("a thread carries exactly the contract keys", () => {
  const report = normalize([threadPage([thread("T1")])], []);
  assert.deepStrictEqual(
    Object.keys(report.threads[0]).sort(),
    ["acknowledgmentCandidate", "comments", "commentsComplete", "id", "isOutdated", "isResolved", "line", "path"].sort(),
    "each thread holds the contract keys and nothing else",
  );
});

test("a comment carries exactly the contract keys", () => {
  const report = normalize([threadPage([thread("T1")])], []);
  assert.deepStrictEqual(
    Object.keys(report.threads[0].comments[0]).sort(),
    ["author", "body", "createdAt", "url"].sort(),
    "each comment holds the contract keys and nothing else",
  );
});

test("pull request number, url, and author are read off the pages", () => {
  const report = normalize([threadPage([thread("T1")])], []);
  assert.deepStrictEqual(
    report.pullRequest,
    { number: PR_NUMBER, url: PR_URL, author: AUTHOR },
    "the pull request metadata comes from the fetched pages, not from the caller",
  );
});

test("threadsTotal reports what GitHub counted, not what was fetched", () => {
  const report = normalize([threadPage([thread("T1")], { totalCount: 140, hasNextPage: true })], []);
  assert.strictEqual(report.threadsTotal, 140, "the count covers the whole pull request");
  assert.strictEqual(report.threads.length, 1, "only the fetched threads are listed");
});

test("two pages of threads merge into one list in page order", () => {
  const report = normalize(
    [
      threadPage([thread("T1"), thread("T2")], { hasNextPage: true, totalCount: 3 }),
      threadPage([thread("T3")], { totalCount: 3 }),
    ],
    [],
  );
  assert.deepStrictEqual(
    report.threads.map((entry) => entry.id),
    ["T1", "T2", "T3"],
    "both pages contribute, in the order they were fetched",
  );
});

test("a completed two-page walk reports itself complete", () => {
  const report = normalize(
    [threadPage([thread("T1")], { hasNextPage: true, totalCount: 2 }), threadPage([thread("T2")], { totalCount: 2 })],
    [],
  );
  assert.strictEqual(report.paginationComplete, true, "the last page fetched had no next page");
});

// Cursor pagination hands back a node twice when threads change between requests, and a thread
// listed twice would double-count the finding it holds.
test("a thread repeated across pages is listed once", () => {
  const report = normalize(
    [threadPage([thread("T1")], { hasNextPage: true, totalCount: 2 }), threadPage([thread("T1"), thread("T2")])],
    [],
  );
  assert.deepStrictEqual(report.threads.map((entry) => entry.id), ["T1", "T2"], "the repeat is dropped");
});

test("resolution and outdatedness are carried through per thread", () => {
  const report = normalize(
    [
      threadPage([
        thread("T-resolved", { isResolved: true }),
        thread("T-outdated", { isOutdated: true }),
        thread("T-open"),
      ]),
    ],
    [],
  );
  assert.deepStrictEqual(
    report.threads.map((entry) => [entry.isResolved, entry.isOutdated]),
    [[true, false], [false, true], [false, false]],
    "each thread keeps the two flags GitHub reported for it",
  );
});

test("file and line anchor each thread", () => {
  const report = normalize([threadPage([thread("T1", { path: "src/api/client.ts", line: 88 })])], []);
  assert.strictEqual(report.threads[0].path, "src/api/client.ts", "the thread's file");
  assert.strictEqual(report.threads[0].line, 88, "the thread's line");
});

// A field GitHub stopped sending must never file a finding away as addressed.
test("an absent resolution flag reads as unresolved rather than resolved", () => {
  const page: ThreadPage = {
    data: {
      repository: {
        pullRequest: {
          number: PR_NUMBER,
          url: PR_URL,
          author: { login: AUTHOR },
          reviewThreads: { totalCount: 1, pageInfo: { hasNextPage: false }, nodes: [{ id: "T-bare" }] },
        },
      },
    },
  };
  const report = normalize([page], []);
  assert.deepStrictEqual(
    [report.threads[0].isResolved, report.threads[0].isOutdated],
    [false, false],
    "both flags default to the bucket that keeps the finding open",
  );
});

test("a thread with no anchor fields reports them as null", () => {
  const page: ThreadPage = {
    data: {
      repository: {
        pullRequest: {
          reviewThreads: { pageInfo: { hasNextPage: false }, nodes: [{ id: "T-bare" }] },
        },
      },
    },
  };
  const report = normalize([page], []);
  assert.deepStrictEqual(
    [report.threads[0].path, report.threads[0].line],
    [null, null],
    "a missing anchor is null rather than a fabricated location",
  );
});

test("a thread's comment continuation is appended in order", () => {
  const report = normalize(
    [threadPage([thread("T1", { comments: [comment(REVIEWER, "first")], hasMoreComments: true })])],
    [commentPage("T1", [comment(REVIEWER, "second"), comment(AUTHOR, "third")])],
  );
  assert.deepStrictEqual(bodiesOf(report, 0), ["first", "second", "third"], "the later page follows the first");
});

test("a thread whose comments were fully paged reports itself complete", () => {
  const report = normalize(
    [threadPage([thread("T1", { hasMoreComments: true })])],
    [commentPage("T1", [comment(REVIEWER, "second")])],
  );
  assert.strictEqual(report.threads[0].commentsComplete, true, "the continuation had no next page");
  assert.strictEqual(report.paginationComplete, true, "both levels of pagination finished");
});

test("comment pages land on their own thread", () => {
  const report = normalize(
    [threadPage([thread("T1", { hasMoreComments: true }), thread("T2")])],
    [commentPage("T1", [comment(AUTHOR, "late reply")])],
  );
  assert.deepStrictEqual(bodiesOf(report, 0), ["Critical: this leaks.", "late reply"], "T1 grew");
  assert.deepStrictEqual(bodiesOf(report, 1), ["Critical: this leaks."], "T2 is untouched");
});

test("a thread left mid-pagination is reported short, not whole", () => {
  const report = normalize([threadPage([thread("T1", { hasMoreComments: true })])], []);
  assert.strictEqual(report.threads[0].commentsComplete, false, "the thread's own comments were truncated");
  assert.strictEqual(report.paginationComplete, false, "an unfetched comment page leaves the walk incomplete");
});

test("a comment continuation that is itself short leaves the thread short", () => {
  const report = normalize(
    [threadPage([thread("T1", { hasMoreComments: true })])],
    [commentPage("T1", [comment(REVIEWER, "second")], true)],
  );
  assert.strictEqual(report.threads[0].commentsComplete, false, "the continuation reported yet another page");
  assert.strictEqual(report.paginationComplete, false, "the report is a prefix of the thread");
});

test("an unfetched page of threads leaves the walk incomplete", () => {
  const report = normalize([threadPage([thread("T1")], { hasNextPage: true, totalCount: 200 })], []);
  assert.strictEqual(report.paginationComplete, false, "the last page fetched still had a next page");
});

test("no pages at all is not a complete walk", () => {
  const report = normalize([], []);
  assert.deepStrictEqual(report.threads, [], "nothing was fetched, so nothing is listed");
  assert.strictEqual(report.paginationComplete, false, "a walk that never happened never completed");
  assert.strictEqual(report.pullRequest.number, null, "no page carried the pull request");
});

// The comments were fetched, so the thread they belong to is one the thread pages never carried.
test("a comment page for a thread that was never listed leaves the walk incomplete", () => {
  const report = normalize([threadPage([thread("T1")])], [commentPage("T-absent", [comment(AUTHOR, "orphan")])]);
  assert.strictEqual(report.paginationComplete, false, "the thread walk itself came up short");
  assert.deepStrictEqual(bodiesOf(report, 0), ["Critical: this leaks."], "the orphan page is not grafted onto another thread");
});

test("an unresolved thread whose last comment is the PR author is an acknowledgment candidate", () => {
  const report = normalize(
    [threadPage([thread("T1", { comments: [comment(REVIEWER, "Major: unhandled error."), comment(AUTHOR, "fixed in a1b2c3d")] })])],
    [],
  );
  assert.strictEqual(report.threads[0].acknowledgmentCandidate, true, "the reply came from the pull request's author");
});

test("a thread whose last comment is the reviewer's is not a candidate", () => {
  const report = normalize(
    [threadPage([thread("T1", { comments: [comment(AUTHOR, "will fix"), comment(REVIEWER, "still wrong")] })])],
    [],
  );
  assert.strictEqual(
    report.threads[0].acknowledgmentCandidate,
    false,
    "only the last comment decides, not any comment the author left earlier",
  );
});

test("a resolved thread is never an acknowledgment candidate", () => {
  const report = normalize(
    [threadPage([thread("T1", { isResolved: true, comments: [comment(AUTHOR, "done")] })])],
    [],
  );
  assert.strictEqual(report.threads[0].acknowledgmentCandidate, false, "a resolved thread is already addressed");
});

test("a candidate is decided on the merged comment list, not the first page alone", () => {
  const report = normalize(
    [threadPage([thread("T1", { comments: [comment(REVIEWER, "Nit: rename this.")], hasMoreComments: true })])],
    [commentPage("T1", [comment(AUTHOR, "renamed")])],
  );
  assert.strictEqual(report.threads[0].acknowledgmentCandidate, true, "the continuation carried the last comment");
});

test("a thread left mid-pagination is never a candidate, whoever spoke last in the prefix", () => {
  // The prefix ends with the author, but the tail never arrived — a reviewer's answer may sit after
  // it. triage routes a candidate to Verify rather than open, so guessing here would file a still-open
  // finding as likely handled; false routes it to open, which is the recoverable direction.
  const report = normalize(
    [threadPage([thread("T1", { comments: [comment(REVIEWER, "Major: unhandled error."), comment(AUTHOR, "fixed")], hasMoreComments: true })])],
    [],
  );
  assert.strictEqual(report.threads[0].commentsComplete, false, "the thread is reported short");
  assert.strictEqual(
    report.threads[0].acknowledgmentCandidate,
    false,
    "an unfetched tail means the last comment fetched is not known to be the last written",
  );
});

test("a pull request with no discoverable author yields no candidates", () => {
  const report = normalize(
    [threadPage([thread("T1", { comments: [comment(AUTHOR, "done")] })], { author: null })],
    [],
  );
  assert.strictEqual(report.pullRequest.author, null, "the author is reported as absent");
  assert.strictEqual(report.threads[0].acknowledgmentCandidate, false, "with no author to match, nothing is a candidate");
});

test("a pull request URL supplies its own owner, repo, number, and host", () => {
  assert.deepStrictEqual(
    parseTarget("https://github.com/acme/kit/pull/7"),
    { owner: "acme", repo: "kit", number: 7, host: "github.com" },
    "the URL form runs from outside the repository",
  );
});

test("a URL with a trailing path still parses", () => {
  assert.deepStrictEqual(
    parseTarget("https://github.com/acme/kit/pull/7/files#r123"),
    { owner: "acme", repo: "kit", number: 7, host: "github.com" },
    "a link copied off a diff view carries the same target",
  );
});

test("an enterprise URL keeps its own host rather than resolving to the default one", () => {
  assert.deepStrictEqual(
    parseTarget("https://github.example.com/acme/web/pull/12"),
    { owner: "acme", repo: "web", number: 12, host: "github.example.com" },
    "the host is what stops acme/web#12 being fetched from github.com instead",
  );
});

test("a bare number leaves owner, repo, and host to gh", () => {
  assert.deepStrictEqual(
    parseTarget(" 42 "),
    { owner: null, repo: null, number: 42, host: null },
    "a null scope is what selects the current repository's placeholders",
  );
});

test("an argument that is neither number nor pull request URL is rejected", () => {
  assert.strictEqual(parseTarget("main"), null, "a branch name is not a target");
  assert.strictEqual(parseTarget("https://github.com/acme/kit/issues/7"), null, "an issue URL is not a pull request");
  assert.strictEqual(parseTarget(""), null, "an empty argument is not a target");
});

test("a run with no argument exits 2 with the usage line", () => {
  const run = runScript([]);
  assert.strictEqual(run.status, 2, "usage failures exit 2");
  assert.ok(run.stderr.includes("usage: node scripts/pr-comments.ts"), `the usage line is on stderr, got "${run.stderr}"`);
  assert.strictEqual(run.stdout, "", "nothing is written to the JSON channel");
});

test("a run with a second argument exits 2", () => {
  assert.strictEqual(runScript(["7", "8"]).status, 2, "the script takes exactly one target");
});

// The rejection happens before any fetch, which is what keeps this case — and this suite — offline.
test("an unparsable target exits 2 naming what was rejected", () => {
  const run = runScript(["main"]);
  assert.strictEqual(run.status, 2, "usage failures exit 2");
  assert.ok(run.stderr.includes("main is neither"), `the rejected argument is named, got "${run.stderr}"`);
});

// --- The fetch walks, against a fake `gh` --------------------------------------------------------
//
// The cases above stop before the script shells out, so nothing there covers the half that decides
// what `gh` is actually asked: the `-F`/`-f` split that placeholder expansion turns on, the host a URL
// carries, the two cursor loops, and what a failing call does. A stub named `gh`, first on PATH,
// covers all of it offline: it appends its own argv to a log and prints the next scripted response, so
// a case asserts both what was sent and what the script made of what came back.

const FAKE_ROOT = mkdtempSync(join(tmpdir(), "agents-kit-pr-comments-"));

after(() => {
  rmSync(FAKE_ROOT, { recursive: true, force: true });
});

/** One scripted `gh` invocation: a page to print, or a failure to write to stderr and exit 1 on. */
type Reply = { readonly page: unknown } | { readonly fails: string };

interface FakeGh {
  /** Every invocation's argv, one array per call, in call order. */
  readonly calls: () => string[][];
  /** Runs the script with this stub first on PATH. */
  readonly run: (args: readonly string[]) => { status: number | null; stdout: string; stderr: string };
}

/**
 * Writes a `gh` stub that replies with `replies` in order, and returns handles to run against it.
 * The stub is a POSIX shell script rather than a Node one so that PATH lookup, argv passing, and the
 * exit status are the shell's own — the same path the real `gh` is found and run through.
 */
function fakeGh(name: string, replies: readonly Reply[]): FakeGh {
  const dir = join(FAKE_ROOT, name);
  mkdirSync(dir, { recursive: true });
  const log = join(dir, "argv.log");
  writeFileSync(join(dir, "index"), "0\n");
  writeFileSync(log, "");
  replies.forEach((reply, index) => {
    if ("fails" in reply) writeFileSync(join(dir, `fail-${index}`), reply.fails);
    else writeFileSync(join(dir, `resp-${index}`), JSON.stringify(reply.page));
  });
  writeFileSync(
    join(dir, "gh"),
    [
      "#!/bin/sh",
      `DIR="${dir}"`,
      // One argument per line with a terminator between calls, so an argument holding a space or a
      // newline-free query body still reads back as exactly one entry.
      'for a in "$@"; do printf \'%s\\n\' "$a" >> "$DIR/argv.log"; done',
      "printf '=== end of call ===\\n' >> \"$DIR/argv.log\"",
      'N=$(cat "$DIR/index")',
      'echo $((N+1)) > "$DIR/index"',
      'if [ -f "$DIR/fail-$N" ]; then cat "$DIR/fail-$N" >&2; exit 1; fi',
      'if [ -f "$DIR/resp-$N" ]; then cat "$DIR/resp-$N"; exit 0; fi',
      'echo "fake gh: no scripted reply for call $N" >&2; exit 1',
    ].join("\n") + "\n",
    { mode: 0o755 },
  );
  return {
    calls: () =>
      readFileSync(log, "utf8")
        .split("=== end of call ===\n")
        .filter((block) => block !== "")
        .map((block) => block.split("\n").slice(0, -1)),
    run: (args) => {
      const run = spawnSync(process.execPath, [SCRIPT, ...args], {
        encoding: "utf8",
        env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH ?? ""}` },
      });
      return { status: run.status, stdout: run.stdout, stderr: run.stderr ?? run.error?.message ?? "" };
    },
  };
}

/** The one page a case needs when it is asserting the request rather than the merge. */
function onePage(): ThreadPage {
  return threadPage([thread("T1")]);
}

test("a bare number leaves owner and repo to gh's placeholder expansion", () => {
  const gh = fakeGh("bare-number", [{ page: onePage() }]);
  const run = gh.run([String(PR_NUMBER)]);
  assert.strictEqual(run.status, 0, `a served fetch exits 0, got "${run.stderr}"`);
  const [argv] = gh.calls();
  assert.deepStrictEqual(argv.slice(0, 2), ["api", "graphql"], "the GraphQL endpoint is the subcommand");
  // `-F` is what expands {owner}/{repo} from the current directory's repository; `-f` would send the
  // braces through as a literal and the query would resolve against a repository named "{repo}".
  assert.ok(argv.includes("-F") && argv.includes("owner={owner}"), `owner goes through -F, got ${argv.join(" ")}`);
  assert.ok(argv.includes("repo={repo}"), `repo goes through the same expansion, got ${argv.join(" ")}`);
  assert.ok(argv.includes(`number=${PR_NUMBER}`), "the number rides along as a typed field");
  assert.ok(!argv.includes("--hostname"), "the bare form leaves host resolution to gh");
});

test("a pull request URL sends its own owner and repo as literals, not placeholders", () => {
  const gh = fakeGh("url-literals", [{ page: onePage() }]);
  assert.strictEqual(gh.run([PR_URL]).status, 0, "a served fetch exits 0");
  const [argv] = gh.calls();
  // Literals go through `-f`: `-F` would convert an all-digit owner or repo to a JSON number, which
  // the query's `String!` variables reject.
  assert.ok(argv.includes("owner=acme"), `the URL's owner is sent literally, got ${argv.join(" ")}`);
  assert.ok(argv.includes("repo=kit"), `the URL's repo is sent literally, got ${argv.join(" ")}`);
  assert.ok(!argv.includes("owner={owner}"), "a URL never falls back to placeholder expansion");
});

test("an enterprise URL's host reaches gh rather than the default one", () => {
  const gh = fakeGh("enterprise-host", [{ page: onePage() }]);
  assert.strictEqual(gh.run(["https://git.acme.corp/acme/kit/pull/7"]).status, 0, "a served fetch exits 0");
  const [argv] = gh.calls();
  const at = argv.indexOf("--hostname");
  assert.notStrictEqual(at, -1, `the host is passed through, got ${argv.join(" ")}`);
  assert.strictEqual(argv[at + 1], "git.acme.corp", "the host is the one the URL named");
});

test("a second page of threads is fetched with the first page's cursor and merged", () => {
  const first = threadPage([thread("T1")], { hasNextPage: true });
  const gh = fakeGh("thread-paging", [{ page: first }, { page: threadPage([thread("T2")]) }]);
  const run = gh.run([String(PR_NUMBER)]);
  assert.strictEqual(run.status, 0, `a served walk exits 0, got "${run.stderr}"`);
  const calls = gh.calls();
  assert.strictEqual(calls.length, 2, "the walk stopped when the last page said it was the last");
  assert.ok(!calls[0].some((arg) => arg.startsWith("cursor=")), "the first call carries no cursor");
  assert.ok(
    calls[1].includes("cursor=threads-page-1"),
    `the second call advances on the first's cursor, got ${calls[1].join(" ")}`,
  );
  const report = JSON.parse(run.stdout);
  assert.deepStrictEqual(report.threads.map((entry: { id: string }) => entry.id), ["T1", "T2"], "both pages merged in order");
  assert.strictEqual(report.paginationComplete, true, "a walk that reached the end reports itself whole");
});

test("a thread's own comment continuation is fetched and appended", () => {
  const short = thread("T1", { comments: [comment(REVIEWER, "first")], hasMoreComments: true });
  const gh = fakeGh("comment-paging", [
    { page: threadPage([short]) },
    { page: commentPage("T1", [comment(AUTHOR, "second")]) },
  ]);
  const run = gh.run([String(PR_NUMBER)]);
  assert.strictEqual(run.status, 0, `a served walk exits 0, got "${run.stderr}"`);
  const calls = gh.calls();
  assert.strictEqual(calls.length, 2, "one continuation for the one short thread");
  assert.ok(calls[1].includes("thread=T1"), `the continuation names its thread, got ${calls[1].join(" ")}`);
  assert.ok(calls[1].includes("cursor=T1-comments"), "the continuation advances on the thread's own cursor");
  const report = JSON.parse(run.stdout);
  assert.deepStrictEqual(report.threads[0].comments.map((entry: { body: string }) => entry.body), ["first", "second"]);
  assert.strictEqual(report.threads[0].commentsComplete, true, "a fully paged thread is not short");
});

test("a first fetch that fails exits 1 carrying gh's own reason", () => {
  const gh = fakeGh("first-fetch-fails", [{ fails: "gh: authentication required\n" }]);
  const run = gh.run([String(PR_NUMBER)]);
  assert.strictEqual(run.status, 1, "nothing to report exits 1");
  assert.ok(run.stderr.includes("could not fetch review threads"), `the failure is named, got "${run.stderr}"`);
  assert.ok(run.stderr.includes("authentication required"), "gh's own stderr rides along as the reason");
  assert.strictEqual(run.stdout, "", "no partial report is written to the JSON channel");
});

test("a walk that fails partway reports what it got as a prefix, not as whole", () => {
  const first = threadPage([thread("T1")], { hasNextPage: true });
  const gh = fakeGh("mid-walk-fails", [{ page: first }, { fails: "gh: HTTP 502\n" }]);
  const run = gh.run([String(PR_NUMBER)]);
  assert.strictEqual(run.status, 0, "a report was written, so the run succeeded even though it is short");
  const report = JSON.parse(run.stdout);
  assert.strictEqual(report.paginationComplete, false, "a walk that stopped early is not complete");
  assert.deepStrictEqual(report.threads.map((entry: { id: string }) => entry.id), ["T1"], "the page it did get is kept");
  assert.ok(run.stderr.includes("stopped after 1 page"), `the shortfall is warned about, got "${run.stderr}"`);
});

test("a pull request gh does not resolve exits 1 naming where it looked", () => {
  const gh = fakeGh("no-such-pr", [{ page: { data: { repository: { pullRequest: null } } } }]);
  const run = gh.run([PR_URL]);
  assert.strictEqual(run.status, 1, "nothing to report exits 1");
  assert.ok(run.stderr.includes(`no pull request ${PR_NUMBER}`), `the miss is named, got "${run.stderr}"`);
  assert.ok(run.stderr.includes("acme/kit"), "the scope it looked in is named");
});
