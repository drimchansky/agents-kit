#!/usr/bin/env node
// Fetches one pull request's review threads for the `triage-findings` skill and emits them
// normalized, so the skill spends its prose on judging resolution and acknowledgment rather than on
// a GraphQL query.
// Zero dependencies; runs under Node type stripping — too old a Node fails as a parse error, not a
// version message. Floor in AGENTS.md § The `.ts` sources are unchecked by design.
// Run: node scripts/pr-comments.ts <pr-number-or-url>
// A bare number takes owner, repo, and host from the repository of the current directory, the way
// `gh` resolves them itself; a pull-request URL carries its own owner, repo, and host, so that form
// runs from anywhere — including against an enterprise host that is not the one `gh` would pick.
//
// Contract: stdout is one JSON object,
// {"pullRequest":{"number":N|null,"url":U|null,"author":LOGIN|null},"threadsTotal":N|null,
// "paginationComplete":BOOL,"threads":[…]} — each thread
// {id,isResolved,isOutdated,path,line,acknowledgmentCandidate,commentsComplete,comments:[…]} and
// each comment {author,body,createdAt,url}, threads and comments alike in the order GitHub returned
// them, so a thread's last comment is its most recent. `acknowledgmentCandidate` is mechanical — the
// thread is unresolved, its comments were fetched whole, and the last of them was written by the pull
// request's own author — and says nothing about whether that comment acknowledges a fix; reading it
// is the skill's judgment. It is false on a thread whose `commentsComplete` is false, because the
// last comment fetched is then not known to be the last one written.
// `paginationComplete` is false whenever a page of threads, or of some thread's comments, was left
// unfetched: the report is then a prefix of the review rather than the whole of it, and the
// per-thread `commentsComplete` names which threads are the short ones. `threadsTotal` is the count
// GitHub reported for the whole pull request, so `threads.length` short of it measures the gap.
// Warnings go to stderr. Exit status: 0 = a report was written, complete or not; 1 = nothing to
// report — no `gh`, no such pull request, or a first fetch that failed; 2 = the run could not be
// carried out — bad usage, or an unexpected failure. Those three are the convention this script
// shares with `scripts/task-move.ts` and `scripts/task-state.ts`: 0 did the job, 1 is an outcome the
// script decided, 2 is a run that never got that far. A failed first fetch is an outcome — the
// script asked and got nothing — so it stays on 1; a crash is not, and takes 2.

import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PAGE_SIZE = 100;
// Bounds both walks: a cursor that stops advancing would otherwise page against the API forever.
// Stopping short leaves `hasNextPage` set on the last page fetched, which is what turns
// `paginationComplete` off, so a bounded walk still reports itself as partial rather than as whole.
const MAX_PAGES = 20;
// A single page carries up to PAGE_SIZE comment bodies, well past execFileSync's 1 MiB default —
// which aborts the whole fetch with ENOBUFS rather than returning a shorter page.
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

const USAGE = "usage: node scripts/pr-comments.ts <pr-number-or-url>";

const THREAD_QUERY = `
query($owner:String!, $repo:String!, $number:Int!, $cursor:String) {
  repository(owner:$owner, name:$repo) {
    pullRequest(number:$number) {
      number
      url
      author { login }
      reviewThreads(first:${PAGE_SIZE}, after:$cursor) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first:${PAGE_SIZE}) {
            pageInfo { hasNextPage endCursor }
            nodes { author { login } body createdAt url }
          }
        }
      }
    }
  }
}`;

const COMMENT_QUERY = `
query($thread:ID!, $cursor:String) {
  node(id:$thread) {
    ... on PullRequestReviewThread {
      id
      comments(first:${PAGE_SIZE}, after:$cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { author { login } body createdAt url }
      }
    }
  }
}`;

// The host is captured, not just skipped over: gh resolves its own host from --hostname, GH_HOST, or
// its config, none of which is the URL the caller pasted. Dropping it sends an enterprise PR's owner
// and repo to github.com, where the same path may exist and answer with another project's threads.
const PR_URL = /^https?:\/\/([^/]+)\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#]|$)/;

interface PageInfo {
  readonly hasNextPage?: boolean;
  readonly endCursor?: string | null;
}

interface RawAuthor {
  readonly login?: string;
}

interface RawComment {
  readonly author?: RawAuthor | null;
  readonly body?: string;
  readonly createdAt?: string;
  readonly url?: string;
}

interface RawCommentConnection {
  readonly pageInfo?: PageInfo;
  readonly nodes?: readonly (RawComment | null)[] | null;
}

interface RawThread {
  readonly id?: string;
  readonly isResolved?: boolean;
  readonly isOutdated?: boolean;
  readonly path?: string;
  readonly line?: number | null;
  readonly comments?: RawCommentConnection | null;
}

/** One `gh api graphql` response carrying a page of the pull request's review threads. */
export interface ThreadPage {
  readonly data?: {
    readonly repository?: {
      readonly pullRequest?: {
        readonly number?: number;
        readonly url?: string;
        readonly author?: RawAuthor | null;
        readonly reviewThreads?: {
          readonly totalCount?: number;
          readonly pageInfo?: PageInfo;
          readonly nodes?: readonly (RawThread | null)[] | null;
        } | null;
      } | null;
    } | null;
  } | null;
}

/** One `gh api graphql` response carrying a further page of a single thread's comments. */
export interface CommentPage {
  readonly data?: {
    readonly node?: RawThread | null;
  } | null;
}

export interface Comment {
  readonly author: string | null;
  readonly body: string;
  readonly createdAt: string | null;
  readonly url: string | null;
}

export interface Thread {
  readonly id: string | null;
  readonly isResolved: boolean;
  readonly isOutdated: boolean;
  readonly path: string | null;
  readonly line: number | null;
  readonly acknowledgmentCandidate: boolean;
  readonly commentsComplete: boolean;
  readonly comments: readonly Comment[];
}

export interface Report {
  readonly pullRequest: {
    readonly number: number | null;
    readonly url: string | null;
    readonly author: string | null;
  };
  readonly threadsTotal: number | null;
  readonly paginationComplete: boolean;
  readonly threads: readonly Thread[];
}

export interface Target {
  readonly owner: string | null;
  readonly repo: string | null;
  readonly number: number;
  // The host a URL named, or null for the bare-number form, which leaves host resolution to gh along
  // with owner and repo.
  readonly host: string | null;
}

interface CollectedThread {
  readonly id: string | null;
  readonly isResolved: boolean;
  readonly isOutdated: boolean;
  readonly path: string | null;
  readonly line: number | null;
  comments: Comment[];
  hasMoreComments: boolean;
}

const warnings: string[] = [];

class Exit extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

function toComments(nodes: readonly (RawComment | null)[] | null | undefined): Comment[] {
  const comments: Comment[] = [];
  for (const node of nodes ?? []) {
    if (!node) continue;
    comments.push({
      author: typeof node.author?.login === "string" ? node.author.login : null,
      body: typeof node.body === "string" ? node.body : "",
      createdAt: typeof node.createdAt === "string" ? node.createdAt : null,
      url: typeof node.url === "string" ? node.url : null,
    });
  }
  return comments;
}

function collectThread(thread: RawThread, id: string | null): CollectedThread {
  return {
    id,
    // An absent flag reads as unresolved and not outdated, so a field GitHub stopped sending can
    // only ever leave a finding open — never file it away as already addressed.
    isResolved: thread.isResolved === true,
    isOutdated: thread.isOutdated === true,
    path: typeof thread.path === "string" ? thread.path : null,
    line: typeof thread.line === "number" ? thread.line : null,
    comments: toComments(thread.comments?.nodes),
    hasMoreComments: thread.comments?.pageInfo?.hasNextPage === true,
  };
}

/**
 * Merges fetched pages into the stdout report: thread pages in the order they were fetched, then
 * each thread's own comment continuations. Pure — pages in, report out, no network.
 */
export function normalize(
  threadPages: readonly ThreadPage[],
  commentPages: readonly CommentPage[],
): Report {
  const collected = new Map<string, CollectedThread>();
  let number: number | null = null;
  let url: string | null = null;
  let author: string | null = null;
  let threadsTotal: number | null = null;
  // A walk that produced no page at all is as short as one that stopped partway.
  let hasMoreThreads = threadPages.length === 0;

  for (const page of threadPages) {
    const pullRequest = page?.data?.repository?.pullRequest;
    if (!pullRequest?.reviewThreads) {
      hasMoreThreads = true;
      continue;
    }
    const connection = pullRequest.reviewThreads;
    if (number === null && typeof pullRequest.number === "number") number = pullRequest.number;
    if (url === null && typeof pullRequest.url === "string") url = pullRequest.url;
    if (author === null && typeof pullRequest.author?.login === "string") author = pullRequest.author.login;
    if (threadsTotal === null && typeof connection.totalCount === "number") threadsTotal = connection.totalCount;
    for (const thread of connection.nodes ?? []) {
      if (!thread) continue;
      const key = typeof thread.id === "string" ? thread.id : `#${collected.size}`;
      // Cursor pagination hands back a node twice when threads change between pages, and a thread
      // listed twice would double-count the finding it holds.
      if (collected.has(key)) continue;
      collected.set(key, collectThread(thread, typeof thread.id === "string" ? thread.id : null));
    }
    hasMoreThreads = connection.pageInfo?.hasNextPage === true;
  }

  let hasUnmatchedCommentPage = false;
  for (const page of commentPages) {
    const node = page?.data?.node;
    const target = typeof node?.id === "string" ? collected.get(node.id) : undefined;
    if (!node || !target) {
      // Comments were fetched for a thread no page of threads carried, so the thread walk itself
      // came up short; dropping them quietly would claim a completeness the pages do not support.
      hasUnmatchedCommentPage = true;
      continue;
    }
    // A page carrying no comments connection leaves the thread marked short, since the continuation
    // it was fetched for never arrived.
    if (!node.comments) continue;
    target.comments.push(...toComments(node.comments.nodes));
    target.hasMoreComments = node.comments.pageInfo?.hasNextPage === true;
  }

  const threads = [...collected.values()].map((thread) => ({
    id: thread.id,
    isResolved: thread.isResolved,
    isOutdated: thread.isOutdated,
    path: thread.path,
    line: thread.line,
    // Gated on a complete comment walk: on a truncated thread the last comment fetched is not the
    // thread's last, so a trailing author reply may have a reviewer's answer after it that never
    // arrived — and triage routes a candidate to Verify rather than open, which would file a still-open
    // finding as likely handled. False here means "not established", which routes it to open instead.
    acknowledgmentCandidate:
      !thread.isResolved &&
      !thread.hasMoreComments &&
      author !== null &&
      (thread.comments.at(-1)?.author ?? null) === author,
    commentsComplete: !thread.hasMoreComments,
    comments: thread.comments,
  } satisfies Thread));

  return {
    pullRequest: { number, url, author },
    threadsTotal,
    paginationComplete:
      !hasMoreThreads && !hasUnmatchedCommentPage && threads.every((thread) => thread.commentsComplete),
    threads,
  };
}

/** Splits `<pr-number-or-url>` into a pull request number and, for a URL, the owner and repo on it. */
export function parseTarget(argument: string): Target | null {
  const trimmed = argument.trim();
  const url = PR_URL.exec(trimmed);
  if (url) return { owner: url[2], repo: url[3], number: Number(url[4]), host: url[1] };
  return /^\d+$/.test(trimmed) ? { owner: null, repo: null, number: Number(trimmed), host: null } : null;
}

function reason(err: unknown): string {
  // execFileSync's own message is only that the command failed; gh's reason — no auth, a 404, a
  // GraphQL error — arrives on the child's stderr.
  if (err instanceof Error && "stderr" in err && typeof err.stderr === "string" && err.stderr.trim()) {
    return err.stderr.trim();
  }
  return err instanceof Error ? err.message : String(err);
}

// `host` is the one the target URL named; null leaves resolution to gh, which is what the bare-number
// form wants. Passed as an argument rather than read from a module-level target, so the two walks
// below cannot drift onto different hosts.
function graphql<T>(query: string, fields: readonly string[], host: string | null): T {
  const scope = host === null ? [] : ["--hostname", host];
  const output = execFileSync("gh", ["api", "graphql", ...scope, "-f", `query=${query}`, ...fields], {
    encoding: "utf8",
    maxBuffer: MAX_OUTPUT_BYTES,
    // gh's stderr is captured rather than inherited, so a failure is reported once, through this
    // script's own prefixed message; the default would print gh's unlabeled copy of it as well.
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output);
}

function scopeFields(target: Target): string[] {
  // `-F` is the only form that expands `{owner}`/`{repo}` from the current directory's repository,
  // and it also converts an all-digit value to a JSON number, which the `String!` variables reject —
  // so a literal owner or repo read off a URL goes through `-f` instead.
  if (target.owner === null || target.repo === null) return ["-F", "owner={owner}", "-F", "repo={repo}"];
  return ["-f", `owner=${target.owner}`, "-f", `repo=${target.repo}`];
}

function fetchThreadPages(target: Target): ThreadPage[] {
  const pages: ThreadPage[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const fields = [...scopeFields(target), "-F", `number=${target.number}`];
    if (cursor !== null) fields.push("-f", `cursor=${cursor}`);
    let response: ThreadPage;
    try {
      response = graphql<ThreadPage>(THREAD_QUERY, fields, target.host);
    } catch (err) {
      if (pages.length === 0) throw new Exit(1, `could not fetch review threads: ${reason(err)}`);
      warnings.push(`stopped after ${pages.length} page(s) of review threads: ${reason(err)}`);
      break;
    }
    pages.push(response);
    const info = response?.data?.repository?.pullRequest?.reviewThreads?.pageInfo;
    if (info?.hasNextPage !== true || typeof info.endCursor !== "string") break;
    cursor = info.endCursor;
  }
  return pages;
}

function fetchCommentPages(threadPages: readonly ThreadPage[], host: string | null): CommentPage[] {
  const pages: CommentPage[] = [];
  // Cursor pagination hands back a node twice when threads change between pages, and the thread-level
  // dedupe in normalize does not reach the continuations fetched for it: walking the same thread twice
  // appends its comments twice, silently, since paginationComplete stays true either way.
  const walked = new Set<string>();
  for (const page of threadPages) {
    for (const thread of page?.data?.repository?.pullRequest?.reviewThreads?.nodes ?? []) {
      const id = thread?.id;
      if (typeof id !== "string" || walked.has(id)) continue;
      walked.add(id);
      let info = thread.comments?.pageInfo;
      for (let n = 0; n < MAX_PAGES && info?.hasNextPage === true && typeof info.endCursor === "string"; n++) {
        let response: CommentPage;
        try {
          response = graphql<CommentPage>(COMMENT_QUERY, ["-f", `thread=${id}`, "-f", `cursor=${info.endCursor}`], host);
        } catch (err) {
          warnings.push(`stopped paging the comments of thread ${id}: ${reason(err)}`);
          break;
        }
        pages.push(response);
        info = response?.data?.node?.comments?.pageInfo;
      }
    }
  }
  return pages;
}

function main(): void {
  // stdout is asynchronous on a pipe, so the report is written and the module then ends: exiting
  // after the write would discard whatever the pipe buffer could not take. A reader that closes
  // early then raises EPIPE on a stream nothing awaits, which would surface as exit 1 — the status
  // this contract reserves for having had nothing to report at all.
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EPIPE") throw err;
  });

  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Exit(2, USAGE);
  const target = parseTarget(args[0]);
  if (target === null) {
    throw new Exit(2, `${args[0]} is neither a pull request number nor a pull request URL. ${USAGE}`);
  }

  const threadPages = fetchThreadPages(target);
  const report = normalize(threadPages, fetchCommentPages(threadPages, target.host));
  if (report.pullRequest.number === null) {
    const scope = target.owner === null ? "this repository" : `${target.owner}/${target.repo}`;
    // The host is named whenever the target carried one, so a miss on an enterprise URL cannot read as
    // a miss on the default host.
    const where = target.host === null ? scope : `${scope} on ${target.host}`;
    throw new Exit(1, `no pull request ${target.number} in ${where}.`);
  }

  process.stdout.write(JSON.stringify(report) + "\n");
  for (const warning of warnings) console.error(`[pr-comments] ${warning}`);
}

// Only a direct run may reach the network: the pure layer above is imported by tests, and fetching
// at module scope would put a live `gh` call behind every import. The entry path goes through
// realpath because Node leaves `process.argv[1]` as it was typed while `import.meta.url` is already
// resolved, so a run through a symlinked path would otherwise look like an import.
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  try {
    main();
  } catch (err) {
    const exit = err instanceof Exit ? err : new Exit(2, `pr-comments failed: ${reason(err)}`);
    console.error(`[pr-comments] ${exit.message}`);
    process.exitCode = exit.code;
  }
}
