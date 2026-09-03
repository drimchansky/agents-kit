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
