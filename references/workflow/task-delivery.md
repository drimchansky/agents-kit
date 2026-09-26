# Task Delivery: Branch and Worktree Creation

Delivery covers task branch/worktree lifecycle and the checkpoint commits below. Other Git and PR actions require their own authorization. Re-entry, removal, convention proposals, and live verification: `./task-delivery-edges.md`.

## Repo delivery declarations

Read delivery declarations once per run from the repository's `AGENTS.md` / `CLAUDE.md` (`../../CORE_RULES.md` § *Workflow*). Use prose, not a second configuration schema.

- **Branch pattern**: substitute only `<slug>` and `<name>`. Slug is the full task-folder basename (`./task-layout.md`). Name removes a leading two-digit `NN-` prefix, or equals slug without one (`./decomposition.md` § *Ordering and numbering*). This strip is syntactic; a repository using name must avoid unintended numeric prefixes. Other placeholders, such as `<initials>`, remain for the team to supply.
- `50-contacts-be-book-crud` maps `feat/<name>` to `feat/contacts-be-book-crud`; worktree directories still use the full slug. Name has no independent uniqueness: `01-api` and `05-api` both map to `feat/api`. Before creation, check branch-name collisions across canonical and registered task roots, including Archive/Backlog. Surface collisions and ask; never guess. Reverse mapping a name token considers both the bare folder and its `NN-` prefixed forms.
- Without a declared pattern, apply `./task-delivery-edges.md` § *Proposing an observed branch convention* before choosing a branch name. That procedure either records an observed prefix or leaves the kit default **`<slug>`** standing. History may support a proposal, never an undeclared convention used silently.
- **Live verification**: a declaration names the environment, observed surface, and verifier required before done. Without one, no live gate fires (`./task-delivery-edges.md` § *The live-verification gate*).

Treat a declaration absent from both files as absent. Branch names, history, and remotes do not substitute for user-confirmed prose.

## Branch and worktree creation

**Which repository.** Apply `./reconciliation-commits.md` § *The scan*: project-local `.agents/tasks/` work uses its containing repository; externally stored tasks use the session's repository. The task folder's location alone does not identify the implementation repository (`./task-store.md`, `./context-schema.md`). Ask when multiple roots remain plausible.

**When it fires.** At execution start, require engineering domain, a resolved Git repository (`git rev-parse --git-dir` succeeds), and at least one plan-named path existing inside it. Containment without existence is insufficient.

- Non-engineering or no repository: skip silently and continue on the invoked checkout/folder. Record no pointer or degrade.
- Repository resolved but no plan paths exist yet: announce the root and missing-path condition, then continue there. This is a skip, not failed creation; record no degrade or branch.

**What is created.** Use the repository's main checkout, the first entry of `git worktree list --porcelain`. The branch follows the declared/default pattern and starts from the default branch's current head unless the user directs another base. Place its worktree at `<main-checkout-path>.worktrees/<slug>/`, outside the project.

**Resolving `<default-branch>`.** Read `git symbolic-ref --short refs/remotes/origin/HEAD` and strip `origin/`. If unset, use `git remote show origin`'s HEAD branch. Without a remote, use the main checkout's current branch; ask if ambiguous. Removal uses this same resolution.

With no recorded branch pointer, check whether the intended branch already exists. If so, ask whether to reuse it, continue on the current checkout, or stop.

On confirmed reuse, locate its worktree by branch identity and re-enter it when present. Otherwise run `git worktree add <main-checkout-path>.worktrees/<slug> <branch>` without `-b`; apply the refusal handling below.

Before failed recovery falls back onto `<default-branch>`, apply the continue-or-stop gate below. Record the branch pointer only after successful re-entry or recreation.

```
git worktree add -b <branch> <main-checkout-path>.worktrees/<slug> <base>
```

Announce branch, path, and base as creation happens. Add `` branch `<branch>` `` to result Current-state Pointers without replacing its existing identifiers (`./one-home.md`, `./reconciliation-commits.md` § *The watermark*). Derive the worktree path; record no separate path pointer.

`scripts/commit-scan.ts` carries the branch-entry shape, a sanctioned copy per `AGENTS.md` § *Consumer lists*.

**The sanction.** The skill's opening paragraph must name task branch/worktree lifecycle among its sanctioned writes. The user's invocation grants that lifecycle permission under `../engineering/rules.md` § *Code & Git discipline*. A model-invoked run grants none: announce the skip and create, recreate, or remove nothing; continue on the current checkout (`./skill-conventions.md` § *The invocation gate*).

This sanction covers creation plus `./task-delivery-edges.md`'s re-entry and removal, not checkpoint commits. Touch no other ref, except the scoped `git fetch origin <default-branch>` in Removal's merged predicate, also reached during re-entry. That fetch moves only the default branch's remote-tracking ref.

**When creation is unavailable.** A sandbox or permission refusal requests the host's per-command approval once before degrading, when that path is available. Refusal evidence is `Operation not permitted` (EPERM), `Permission denied` (EACCES), `Read-only file system` (EROFS), or a host sandbox-violation report. Also count a failed filesystem write whose path the active host policy explicitly makes unwritable, even without permission text. Generic `cannot lock ref` text alone does not establish refusal. Explicit ref/path conflicts remain ordinary creation failures.

Request the exact refused `git worktree add` command. If that attempt already created the branch, request `git worktree add <main-checkout-path>.worktrees/<slug> <branch>` without `-b` instead. The justification names the user-invoked task branch/worktree sanction above; propose no persistent approval rule. Codex uses `sandbox_permissions="require_escalated"` for this request.

When approval is unavailable or denied, or the approved creation fails, make no further creation attempt or approval request. Never retry with force or relocate the worktree to another writable path.

Before this refusal degrades onto `<default-branch>`, resolved above, ask the user to continue on the current checkout or stop. Edit no file and run no plan step before the answer. A stop answer leaves existing files unchanged. A refusal on a non-default branch degrades without a question.

Every permitted degrade announces and records the failure, then continues in the current checkout as shared tree. Other creation failures take that degrade without approval or a question.

## Checkpoint commits

First establish that the shared implementation tree is a Git checkout. Without one, skip Git-change capture and checkpoint commits; assertions and health still run.

An explicit request to implement an engineering task's **full plan**, including natural language, authorizes commits after authored `### Checkpoint after Step N` gates. Inferred full-plan mode, including the short-plan default, grants none. Step-by-step, other domains, and checkpoint-free plans grant none. An explicit no-commit instruction overrides authorization. There is no implicit tail or final commit.

The coordinator runs each checkpoint commit from the shared implementation tree: task worktree, or current checkout after skip/degrade. Never commit from executor scratch worktrees or an external task-store repository. Before Step 1, capture and inspect staged and unstaged changes to distinguish user work. Task records remain at their resolved location and outside checkpoint staging.

Run assertions and integrated health before staging. A failed gate records failure and no commit, then Stop-the-Line. After a green gate, stage only attributable task work since the prior checkpoint, using explicit paths or hunks. Inspect the complete staged diff and verified bytes. Unrelated staged content or ambiguous overlap blocks the commit; never absorb, reset, or stash it. Then run `skills/commit/SKILL.md` in ordinary mode over that staged set, passing as its argument the why of the steps the checkpoint bounds, from their plan entries. The full-plan request above is the explicit permission its opening paragraph requires. Never pass `--amend`. Its message rules, guard scan, verification gate, signing handling, and report apply unchanged. Name in that argument the manifest path and id the checkpoint's green boundary recorded; `commit`'s gate reuses the boundary when that manifest proves the index is the verified tree.

Never amend, push, or open a PR; `commit` owns message conventions, hooks, and signing. Read its report for the landed message and files. If a hook changes source, re-prove health before continuing. A commit that did not land (a declined guard hit, a failed `commit` verification gate, or a hand-over the user took), or a failed re-proof, blocks later steps. With no task changes, run nothing; record `none — no task changes`.

Append the checkpoint record after the commit attempt, with SHA, no-change result, or failure. A hand-over records `failed — handed over: <message file>; tip <sha>; digest <staged digest>`, naming the branch tip before the attempt and the snapshot digest `commit` printed. Continue only after success or no change.

On resume, settle pending checkpoint commits before later steps, including when the preceding step is checked; do not repeat a recorded success. Settle a hand-over from the branch and the index. A commit after the recorded tip whose `git diff <tip> <sha> | git hash-object --stdin` equals the recorded digest landed: append a dated line `**Commit:** <sha> — settled hand-over, Checkpoint after Step N` to the log. An index that still hashes to that digest re-runs `commit`. Anything else stays blocked, recorded with what was found. Preserve the commit watermark untouched (`./reconciliation-commits.md` § *The watermark*).
