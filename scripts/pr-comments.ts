#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PAGE_SIZE = 100;
const MAX_PAGES = 20;
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
    isResolved: thread.isResolved === true,
    isOutdated: thread.isOutdated === true,
    path: typeof thread.path === "string" ? thread.path : null,
    line: typeof thread.line === "number" ? thread.line : null,
    comments: toComments(thread.comments?.nodes),
    hasMoreComments: thread.comments?.pageInfo?.hasNextPage === true,
  };
}

export function normalize(
  threadPages: readonly ThreadPage[],
  commentPages: readonly CommentPage[],
): Report {
  const collected = new Map<string, CollectedThread>();
  let number: number | null = null;
  let url: string | null = null;
  let author: string | null = null;
  let threadsTotal: number | null = null;

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
      hasUnmatchedCommentPage = true;
      continue;
    }

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

export function parseTarget(argument: string): Target | null {
  const trimmed = argument.trim();
  const url = PR_URL.exec(trimmed);
  if (url) return { owner: url[2], repo: url[3], number: Number(url[4]), host: url[1] };
  return /^\d+$/.test(trimmed) ? { owner: null, repo: null, number: Number(trimmed), host: null } : null;
}

function reason(err: unknown): string {
  if (err instanceof Error && "stderr" in err && typeof err.stderr === "string" && err.stderr.trim()) {
    return err.stderr.trim();
  }
  return err instanceof Error ? err.message : String(err);
}

function graphql<T>(query: string, fields: readonly string[], host: string | null): T {
  const scope = host === null ? [] : ["--hostname", host];
  const output = execFileSync("gh", ["api", "graphql", ...scope, "-f", `query=${query}`, ...fields], {
    encoding: "utf8",
    maxBuffer: MAX_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output);
}

function scopeFields(target: Target): string[] {
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

    const where = target.host === null ? scope : `${scope} on ${target.host}`;
    throw new Exit(1, `no pull request ${target.number} in ${where}.`);
  }

  process.stdout.write(JSON.stringify(report) + "\n");
  for (const warning of warnings) console.error(`[pr-comments] ${warning}`);
}

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
