# Maintaining agents-kit

This guide is for agents maintaining this **agents-kit source repository**. It does not govern work in a consumer project that has installed the kit.

Start by reading and applying [CORE_RULES.md](./CORE_RULES.md). It is the canonical shared-rules source; follow task-specific sources only after it.

## Ownership

- `skills/<name>/SKILL.md` owns that skill's protocol and its direct reference citations.
- `references/workflow/` owns cross-skill workflow methodology; `references/workflow/domain-packs.md` owns the domain-pack interface.
- `references/<domain>/` owns domain-specific guidance.
- `setup.ts` owns installation and distribution behavior.
- `scripts/` owns the repository's zero-dependency Node helpers; each script's file header owns its own CLI forms and stdout contract.
- `tests/` owns repository verification; `tests/setup-install.test.ts` covers installation and distribution behavior, `tests/health-check.test.ts` the task and install health checks, `tests/task-move.test.ts` the guarded archive and backlog moves, `tests/task-state.test.ts` the task plan-state report, `tests/session-triage.test.ts` the session triage, `tests/pr-comments.test.ts` the pull-request review-thread fetch, `tests/size-report.test.ts` the skill context-size report, `tests/size-check.test.ts` the context-size baseline (`tests/size-baseline.json`), `tests/worktree-merge.test.ts` the coordinator-side worktree merge gates, and `tests/invocation-gate.test.ts` the invocation gate's three-way invariant (`references/workflow/skill-conventions.md` § *The invocation gate*), which no script reads. Run them all with `node --test "tests/*.test.ts"` — quoted, because the runner takes glob patterns and resolves a bare directory as a module path.
- `.agents/tasks/` owns task artifacts and their active work context.

## The `.ts` sources are unchecked by design

`setup.ts`, `scripts/`, and `tests/` run directly on Node under type stripping — no build step, no bundler, no typechecker. **Node 23.6 or newer is the floor every `.ts` source here assumes, `setup.ts` included**, and this section is where that floor is stated: each `.ts` header points here rather than repeating a number that drifts silently, so changing the floor is a one-line change made here. Type stripping runs unflagged from 22.18 as well, so the 22.x line would in fact run this tree; carrying a single floor rather than a two-branch one is a support choice, not a limit of the code. Below either threshold the failure is a parse error on a type annotation, not a version message — under `node --test` too, which matches the globbed `.ts` suites and then fails to load them. Their annotations are erased at run time and nothing validates them, so the typecheck, lint, and build commands of the engineering pack's integrated-health recipe (`references/engineering/rules.md` § *Before presenting changes*) have no target in this repository; its test command does, and `node --test "tests/*.test.ts"` is the whole verification surface. This repository exposes no class that can narrow — no linter, no formatter, no graph-aware runner — so `references/engineering/boundary-scope.md` skips the manifest here and every class falls to its whole-tree case: no delta, that one command over the entire tree at every boundary. Adding a checker would put a `package.json`, a lockfile, and `node_modules` in a tree that otherwise carries only Markdown and the `.ts` sources themselves; that cost is why it is declined, and it is what to weigh if the decision is revisited.

## Change routing

Before changing the kit, identify and inspect:

- the affected `SKILL.md` files and every reference they cite directly;
- shared-contract consumers when changing a workflow reference, domain-pack interface, core rule, or distribution behavior — identify them by reverse search over `skills/`, `references/`, `scripts/`, `agents/`, and `CORE_RULES.md`, never from a derivable list kept in a file header (§ *Consumer lists*);
- the installer integration test (`tests/setup-install.test.ts`) when changing `setup.ts`, native agent definitions, or installed payload behavior — and `scripts/health-check.ts` in the same pass, whose `--installs` mode hardcodes `setup.ts`'s ownership markers, payload categories, and per-host agent extensions;
- the harness under `tests/` covering a script you changed — `node --test tests/setup-install.test.ts` for `setup.ts`, `node --test tests/health-check.test.ts` for `scripts/health-check.ts` and its `scripts/lifecycle-constants.ts` import, `node --test tests/task-move.test.ts` for `scripts/task-move.ts` and `node --test tests/task-state.test.ts` for `scripts/task-state.ts`, which share that import, `node --test tests/session-triage.test.ts` for `scripts/session-triage.ts`, `node --test tests/pr-comments.test.ts` for `scripts/pr-comments.ts`, `node --test tests/size-report.test.ts` for `scripts/size-report.ts`, `node --test tests/size-check.test.ts` for `scripts/size-check.ts`, `node --test tests/worktree-merge.test.ts` for `scripts/worktree-merge.ts`;
- the size baseline (`tests/size-baseline.json`) when changing any `SKILL.md`, reference file, or `CORE_RULES.md` — the measured context loads move with the content, so re-capture with `node scripts/size-check.ts --update .` in the same change; `node --test tests/size-check.test.ts` fails while the committed baseline lags;
- relevant Git history, to preserve the reason behind an existing contract.

Keep each change with its authoritative owner; update dependent consumers only when the contract they consume changes.

## Consumer lists

A contract file's header often enumerates who consumes it. Most such enumerations duplicate what search derives; a few carry information search cannot recover. One test separates them.

**Membership test: grep reconstructs the full membership.** Run the reverse search over `skills/`, `references/`, `scripts/`, `agents/`, and `CORE_RULES.md`. When grep reconstructs the full membership, the list is derivable. When any member consumes the contract without citing it, or membership carries classification rationale beyond the fact of citing, the list is semantic.

- **Derivable citation lists are not maintained.** A "Cited by …" enumeration the reverse search reproduces does not belong in a file header: it goes stale silently — nothing fails when a new consumer forgets to add itself — and it duplicates the search that would have found the truth. Remove it, and identify consumers by running the search.
- **Semantic registries are maintained**, and each states in place why it can't be derived — which member consumes the contract without citing it, or what authored rationale the entries carry beyond membership.
- **Sanctioned copies carry an explicit mirror note.** A deliberate self-contained copy of contract content says it is a copy and names the mirror obligation, as `references/engineering/code-style.md:14` does for the executor adapters: "When this section changes, mirror the change into both."

Derivable — these enumerations were removed and are not re-added; find these consumers by reverse search:

- `references/workflow/task-layout.md:3` — the "Cited by …" sentence. It was already stale, omitting `review-docs`: the failure mode in miniature.
- `references/workflow/ticket-format.md:3` — the "Cited by …" sentence.
- `references/workflow/decomposition.md:3` — "Cited by the `decompose-task` skill, which runs the method end to end." The neighboring sentence splitting when/where against how across `plan-task`, `task-siblings.md`, and that file is an ownership boundary, not a citation list; it stays.
- `references/workflow/agent-fanout.md:3` — the citer enumeration (the review skills' `-x`, the triage-verify composites, `maintain`). Only the header enumeration is derivable; the write-mode registry formerly in this file is semantic and now lives in `references/workflow/executor-contract.md` § *Write-mode routing*, beside the § *Bindings* entry below.
- `references/workflow/verify-pipeline.md:3` — no citer enumeration, by this test rather than by removal: every composite that runs the pipeline cites the file by path, so the reverse search reconstructs the membership in full. The header states what the file owns and what each member's own file keeps instead.
- `references/workflow/task-store.md` § *Resolving `<kit-root>`* — no citer enumeration, same test: every skill that runs a `scripts/` helper cites the section by path at its invocation, so the reverse search reconstructs the membership. The section states the rule and what an absent kit root means; whether the skill then stops or falls back is its own call and each states it in place.
- `references/engineering/rules.md:3` — the loader enumeration, each named skill's `SKILL.md` citing the overlay (confirmed by grep). The `commit` exception is semantic and stays: `commit` cites the file only to state that it does *not* load it, so a reverse search would misread that citation as membership — the exception can't be re-derived from the citation graph.
- `references/documentation/rules.md:3` — the pack-contributed loader enumeration, each named skill's `SKILL.md` citing the overlay (confirmed by grep). Unlike the engineering entry, nothing semantic accompanies it — the pack has no `commit`-style exception.

Semantic — maintained, each with the reason it can't be derived:

- `references/workflow/task-lifecycle.md:3` propagate list — membership is "reads or writes these status fields", and three members — `refine-idea`, `resume-task-reconcile`, and `review-task-reconcile` — act on the fields without citing the file by name, so grep cannot reconstruct it.
- `references/workflow/context-schema.md:3` consumer registry — membership is "reads or writes these section names", and its members — `review-task`, `implement-task`, `resume-task`, `reconcile-task`, `reconciliation.md`'s annotation rows and its satellite `reconciliation-sweep.md`'s scope rows, and through those two the reconcile composites — consume the schema without citing the file, so grep cannot reconstruct it. The producer half (`refine-idea`, `plan-task`, `decompose-task`, each citing the file) is derivable and stays de-listed.
- `references/workflow/skill-conventions.md` § *Current members* — entries carry per-member classification rationale (why composite, why flag) that is authored rather than derivable, and that file's own registration step mandates recording each new member there.
- `references/workflow/skill-conventions.md` § *The invocation gate* member list — the gated skills are themselves derivable (`grep -rl "disable-model-invocation" skills/`), but what surrounds them is not: the deliberate non-members and the criterion that placed each skill on its side are authored rationale, and that section's registration line mandates an entry whenever a door opens or closes.
- `references/workflow/executor-contract.md` § *Bindings* — each binding *defines* per-consumer behavior (unit, packet, edit surface, fallback, merge order). Contract content, not a citation list.
- `references/workflow/reconciliation.md:5` direction membership — keys the per-skill mapping sections in the two direction files it names, `reconciliation-docs-to-reality.md` and `reconciliation-session-to-docs.md`. Contract structure, not a citation list.
- `references/workflow/execution-loop.md` intro ("Three skills run it: …") — keys the per-consumer sections of its satellite `references/workflow/execution-bindings.md`; same class as `reconciliation.md:5`.
- `references/workflow/domain-packs.md` § *The split* spine-skill enumeration — a design classification of which skills are methodology-only, not a record of who cites the file.
- `references/engineering/verification.md:3` gate-runner parenthetical — membership is "runs the neutral verification tiers on code", reached by domain resolution (the loop's "resolved domain's `verification.md`") rather than citation, so grep cannot reconstruct it; `fix-findings`, `implement-task`, and `implement` also cite the path directly, but the remaining members reach it only by resolution.
- `references/documentation/verification.md:3` gate-runner parenthetical — the documentation twin, same resolution-based membership. Its one direct citer, `review-docs`, cites the file only to place its judgment pass against the mechanical tiers — what the pass covers, and where it runs — never as a tier-runner, so a reverse search would misread those citations as membership — the same class as the `commit` exception.
- `references/engineering/exploration.md:3` loader gloss — membership is "loads the grounding recipe for its phase", and `refine-idea` reaches it through `../workflow/ideation.md` § *Ground in what exists* without citing the path, so grep cannot reconstruct it.
- `references/engineering/execution.md:3` loader sentence — membership is "carries out code units through the execution loop", and `implement` (and `fix-findings`, whose fixes run the same loop) resolves the recipe without citing the path, so grep cannot reconstruct it.

Sanctioned copy — mirror note required:

- `references/engineering/code-style.md:14` — `agents/executor.md` and `agents/executor.toml` carry a condensed digest of § *Comments* in their system-prompt text, so a delegated executor holds the comment discipline without a read hop. One mirror note at the home covers both adapter copies, since the two say the same thing in each host's format; when the section changes, both change with it.
- `references/workflow/task-lifecycle.md` § *Status values*, `references/workflow/status-transitions.md` § *Terminal vs. live states*, `references/workflow/reconciliation-compaction.md` § *Compaction (size trigger)*, and `references/workflow/task-layout.md` § *One task, one flat folder* — `scripts/lifecycle-constants.ts` carries the machine-readable copy of the plan status vocabulary, the terminal set, the compaction trigger, and the recognition set, because the scripts that enforce these values cannot read prose at run time. Four homes, four mirror notes, one module: each home names the copy, and a change to any of those values changes the module in the same edit. The importers are the enumeration the homes point here for: `scripts/health-check.ts` (all four), `scripts/task-move.ts` (vocabulary, terminal set, recognition set), and `scripts/task-state.ts` (vocabulary). Kept here rather than in each home because the membership is per-constant, so no one home can state it without stating the other three's as well.
