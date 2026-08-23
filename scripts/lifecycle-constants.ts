// The task constants scripts/health-check.ts, scripts/task-move.ts, and scripts/task-state.ts read:
// the plan status vocabulary, the terminal set, the compaction size trigger, and the recognition set
// that identifies a task folder by its contents.
// Zero dependencies; runs under Node type stripping — too old a Node fails as a parse error, not a
// version message. Floor in AGENTS.md § The `.ts` sources are unchecked by design.
// Each value below is owned in prose by the reference cited beside it; this module is their one
// sanctioned machine-readable copy (AGENTS.md § Consumer lists) and changes in the same edit as the
// prose. Left stale, a renamed status reads as `unknown` here, and the lifecycle checks that skip
// `unknown` — stale, done-unarchived, started-in-backlog — go quiet on every task holding it.

// Closed plan vocabulary defined by references/workflow/task-lifecycle.md § Status values; a value
// outside it is "unknown" rather than a guess, so a typo never reads as a lifecycle state.
export const PLAN_VOCAB: ReadonlySet<string> = new Set(["to-do", "executing", "blocked", "in-review", "done", "skipped"]);
// The one not-yet-started plan state, named by the backlog entry gate (task-backlog.md) and the
// archive checks; exported so a rename lands here rather than in each consumer's own literal.
export const UNSTARTED_STATUS = "to-do";
// Terminal (finished) plan states per references/workflow/status-transitions.md § Terminal vs. live
// states.
export const TERMINAL_STATUSES: ReadonlySet<string | null> = new Set<string | null>(["done", "skipped"]);
// The non-terminal complement of the plan vocabulary, derived rather than spelled out so the two
// cannot drift apart when a status is added to or removed from the vocabulary above.
export const LIVE_STATUSES: ReadonlySet<string> = new Set([...PLAN_VOCAB].filter((v) => !TERMINAL_STATUSES.has(v)));
// The compaction trigger, owned by references/workflow/reconciliation-compaction.md § Compaction
// (size trigger), which `maintain` reads at run time and passes as --result-max-kb; this copy only
// keeps a bare health-check run honest when no value is supplied.
export const RESULT_MAX_KB = 20;
// The recognition set defined by references/workflow/task-layout.md § One task, one flat folder: a
// folder is a task folder when it holds one of these files. The suffix forms are legacy names the
// format sweep renames, kept because only the kit's own canonical root is ever swept. Every script
// that decides "is this a task folder?" reads these — the health walk that finds them and the move
// that refuses anything else — so a folder one accepted and another did not is not a thing that can
// happen.
export const ROLE_FILES: readonly string[] = ["CONTEXT.md", "goals.md", "plan.md", "result.md", "ticket.md"];
export const ROLE_SUFFIXES: readonly string[] = [".plan.md", ".result.md", ".spec.md", ".ticket.md"];

// A folder is a task folder when one of its own files is in the recognition set above. Takes the
// file names rather than a path, so a caller that has already read the directory does not read it
// twice; a suffix match excludes the bare suffix itself, which is a dotfile rather than a role file.
export function holdsRoleFile(fileNames: readonly string[]): boolean {
  return fileNames.some((name) => ROLE_FILES.includes(name) || ROLE_SUFFIXES.some((s) => name.endsWith(s) && name !== s));
}
