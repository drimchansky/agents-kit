#!/usr/bin/env node
import { realpathSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const USAGE = "usage: node scripts/silence-watch.ts --interval <seconds> <file>...";
const MAX_TIMER_MS = 2 ** 31 - 1;
const POSITIVE_WHOLE = /^[1-9][0-9]*$/;

export interface Options {
  readonly intervalMs: number;
  readonly files: readonly string[];
}

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

class Exit extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

export function parseArgs(args: readonly string[]): Options {
  const [flag, seconds, ...files] = args;
  if (flag !== "--interval" || seconds === undefined || !POSITIVE_WHOLE.test(seconds) || files.length === 0) {
    throw new Exit(2, USAGE);
  }
  const intervalMs = Number(seconds) * 1000;
  if (!Number.isSafeInteger(intervalMs)) throw new Exit(2, USAGE);
  return { intervalMs, files };
}

function newestChange(files: readonly string[], lastRead: Map<string, number>): number | null {
  let newest: number | null = null;
  for (const file of files) {
    let modified: number;
    try {
      modified = statSync(file).mtimeMs;
    } catch {
      const remembered = lastRead.get(file);
      if (remembered === undefined) continue;
      modified = remembered;
    }
    lastRead.set(file, modified);
    if (newest === null || modified > newest) newest = modified;
  }
  return newest;
}

function notice(silenceMs: number, since: number): string {
  return `silent ${Math.floor(silenceMs / 1000)}s since ${new Date(since).toISOString()}`;
}

export async function watch(options: Options, clock: Clock, write: (line: string) => void): Promise<never> {
  const started = clock.now();
  const lastRead = new Map<string, number>();
  let previous: { readonly since: number; readonly multiple: number } | null = null;
  for (;;) {
    const since = newestChange(options.files, lastRead) ?? started;
    const silence = clock.now() - since;
    const multiple = Math.floor(silence / options.intervalMs);
    const isNewMultiple = previous !== null && multiple >= 1 && (since !== previous.since || multiple > previous.multiple);
    if (isNewMultiple) write(notice(silence, since));
    previous = { since, multiple };
    const elapsed = ((silence % options.intervalMs) + options.intervalMs) % options.intervalMs;
    await clock.sleep(Math.min(Math.ceil(options.intervalMs - elapsed), MAX_TIMER_MS));
  }
}

async function main(): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EPIPE" && err.code !== "ENOTCONN") throw err;
    clearTimeout(timer);
  });

  const options = parseArgs(process.argv.slice(2));
  const clock: Clock = {
    now: Date.now,
    sleep: (ms) => new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms);
    }),
  };
  await watch(options, clock, (line) => process.stdout.write(`${line}\n`));
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
  main().catch((err: unknown) => {
    const exit = err instanceof Exit ? err : new Exit(2, `silence-watch failed: ${(err as Error).message}`);
    console.error(`[silence-watch] ${exit.message}`);
    process.exitCode = exit.code;
  });
}
