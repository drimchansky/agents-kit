import type { Dirent } from "node:fs";

export const PLAN_VOCAB: ReadonlySet<string> = new Set(["to-do", "executing", "blocked", "in-review", "done", "skipped"]);
export const UNSTARTED_STATUS = "to-do";
export const TERMINAL_STATUSES: ReadonlySet<string | null> = new Set<string | null>(["done", "skipped"]);
export const LIVE_STATUSES: ReadonlySet<string> = new Set([...PLAN_VOCAB].filter((status) => !TERMINAL_STATUSES.has(status)));
export const RESULT_MAX_KB = 20;
export const TASK_MAX_KB = 64;
export const RECORD_MAX_KB = 2;
export const ROLE_FILES: readonly string[] = ["CONTEXT.md", "goals.md", "plan.md", "result.md", "ticket.md"];
export const ROLE_SUFFIXES: readonly string[] = [".plan.md", ".result.md", ".spec.md", ".ticket.md"];

export function holdsRoleFile(fileNames: readonly string[]): boolean {
  return fileNames.some((name) => ROLE_FILES.includes(name) || ROLE_SUFFIXES.some((suffix) => name.endsWith(suffix) && name !== suffix));
}

export const WALK_SKIP_DIRS: ReadonlySet<string> = new Set(["node_modules"]);
export const TASK_STORE_DIR = ".agents";
export const ARCHIVE_DIR = /^archive$/i;
export const BACKLOG_DIR = /^backlog$/i;

export type WalkStep = "prune" | "container" | "claimed" | "descend";

export type WalkDecision =
  | { readonly step: "prune"; readonly childEntries: null }
  | { readonly step: Exclude<WalkStep, "prune">; readonly childEntries: readonly Dirent[] };

export function classifyWalkEntry(entry: Dirent, readChild: () => readonly Dirent[]): WalkDecision {
  if (!entry.isDirectory() || WALK_SKIP_DIRS.has(entry.name)) return { step: "prune", childEntries: null };
  if (entry.name.startsWith(".") && entry.name !== TASK_STORE_DIR) return { step: "prune", childEntries: null };
  const childEntries = readChild();
  if (ARCHIVE_DIR.test(entry.name) || BACKLOG_DIR.test(entry.name)) return { step: "container", childEntries };
  const claimed = holdsRoleFile(childEntries.filter((child) => child.isFile()).map((child) => child.name));
  return { step: claimed ? "claimed" : "descend", childEntries };
}
