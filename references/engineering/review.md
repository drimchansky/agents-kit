# Code Review

Lenses, calibration, and discipline that apply to **any** code review. Mode-specific orchestration lives in `skills/review-pr/SKILL.md` (branch diff against base) and `skills/review-commit/SKILL.md` (the staged pre-commit diff, or the uncommitted change under `-w`). Everything below is mode-agnostic but for one section: § *Working-tree review target* defines the commit-mode object `-w` reviews, kept here so its consumers cite one home instead of restating it.

Other reference checklists cover specific surfaces: `accessibility.md`, `code-style.md`, `css.md`, `forms.md`, `html.md`, `interactions.md`, `performance.md`, `privacy.md`, `react.md`, `security.md`, `tanstack-query.md`, `testing.md`, `typescript.md`. Consult those when the diff touches those domains. This file covers what those checklists don't.

## Working-tree review target

What `review-commit -w` reviews, and what every skill forwarding or driving that flag reviews with it. Defined once here: the review skill, the verify composite, and the loop composite **cite** this section and restate none of it. Assemble the object by the procedure below — its commands are the contract, quoted by a consumer rather than recalled, and **run from the repository root**: `git diff HEAD` is repo-wide while `git ls-files` is scoped to the current directory, so anywhere else the untracked half silently omits everything outside the subtree. A pathspec is not a substitute — `:/` widens the scope but returns cwd-relative paths, which `git hash-object` then resolves against the wrong directory.

1. **Refuse on an unborn HEAD.** `git rev-parse --verify HEAD` failing means there is no commit to diff against: say so and stop. `git diff HEAD` names its commit explicitly, so unlike `git diff --cached` it gets no unborn-branch carve-out; and files staged before the first commit are tracked, so the untracked half cannot see them either. Neither half has anything to read.
2. **The diff half is `git diff HEAD`** — the uncommitted change, index and working tree together. Not `git diff --cached`, which is the index alone and hides a fix the previous pass just made; not `git diff`, which is the tree against the index and hides what is already staged. A path staged and then edited again appears once, carrying both halves of its change.
3. **The untracked half is `git ls-files --others --exclude-standard`** — the diff omits untracked non-ignored files, so this names them, and each one's full current content is reviewed as an added file. Without this half, a fix that creates the test a finding asked for lands invisible, and the next pass reports clean over code it never read.
4. **Merge by path.** A path in one half takes that half. A path in **both** is a tracked file dropped from the index while its file remains in the tree — `git rm --cached`, or a deletion the tree re-creates — since "untracked" means absent from the *index*, not from HEAD. There the untracked entry is the review, carrying what the tree actually holds, and the diff half's deletion is an index-state note rather than content going away. Only where the path is gone from the tree as well is there nothing to re-add from the untracked side.
5. **A failed command is never an empty half.** Both reads write failures to stderr and leave stdout empty, so an unchecked exit status turns a broken read into "nothing changed" — a review silently missing every file, or a false stop over a full tree. Check the status; a non-zero exit is an error to report, never an empty result.

Three properties hold over the assembled object:

- **Neither the index nor the object store is written.** No `git add`, no `git add -N`, no `git stash`, and no `-w` on `git hash-object`. Making untracked files visible to `git diff` by intent-to-add would mutate the index, which is the departure this target exists to avoid; every command here only reads, and the target is assembled from their output.
- **Identity digest, captured per pass.** The target's identity is `{ git diff HEAD; git ls-files --others --exclude-standard; git ls-files --others --exclude-standard -z | xargs -0r git hash-object --; } | git hash-object --stdin` — the diff, then the untracked paths, then their contents, both listings in the same sorted order so the two line up. Paths enter the hash alongside content because a content-only digest moves for neither an added empty file nor a rename that changes nothing else, and each of those changes the review object. Capture it at that pass's own review start and compare it **only within that pass**: what it proves is that the tree did not move *under* the pipeline between the review and the probes verifying its findings. Across passes it is expected to differ — an iterated loop's fix phase moves the tree on purpose — so a digest carried from an earlier pass proves nothing and is never compared against.
- **It is not comparable to a staged-set digest.** `/commit` checks `git diff --cached | git hash-object --stdin` over the index it is about to commit; this target is a different object, so no digest over it can serve that check. A provenance line recording one marks the target in place, and `/commit` refuses that form outright (`skills/commit/SKILL.md` § Preconditions).

## What to Look For

### Impact on Existing Code

The highest-value part of a review. For every change to shared code:

- **Search all usage sites** — Don't just review the diff; grep for every modified export and verify callers still work
- **Check behavioral changes** — A renamed prop, a changed default, a new required field can break distant consumers silently
- **Trace data flow changes** — If data shape changes, follow it through the pipeline to the UI
- **Verify API contracts** — Breaking changes to interfaces or public APIs must be caught

### Problem Verification

- Understand the problem before evaluating the solution — does the fix address the root cause, or just the symptom?
- For bug fixes: is there now a test that would have caught this regression?
- Search for the same pattern elsewhere in the codebase — a fix in one place often applies to siblings

### Touched Comments

Comments ship in diffs of every kind, so this lens applies to **every** diff — it is not gated on which per-surface checklists the diff's domains trigger. Two bars, by what the diff did to the comment:

- **Comments the diff adds or edits** — held to the full discipline in `code-style.md` → Comments. A comment that discipline prohibits is a finding on its own the moment the diff introduces it; the discipline already classes it as a maintenance defect, so it needs no separate impact argument.
- **Pre-existing comments adjacent to the change** — held to the materiality bar: flag only when the change makes them materially misleading to correctness, security, API compatibility, or maintenance. Untouched comments the change doesn't bear on are not the review's business.

### Abstraction Justification

- **Premature extraction** — Under ~20 lines rarely needs its own module. Inline until a second or third consumer proves the abstraction — unless the unit owns a meaningful boundary, such as state, hooks, lifecycle, or a distinct concern, which justifies extraction at a single use site (for components, see `react.md` → Components).
- **Wrapper types** — Custom type aliases that re-wrap a library's types without adding information obscure the original API.
- **One-use helpers** — Functions extracted for "reusability" but called from exactly one place fragment logic without reducing complexity.

### Complexity Signals

Concrete patterns to scan for. Flag as Minor by default; promote to Major if the pattern hides a bug (e.g., deep nesting masking a missing edge-case branch).

- **Deep nesting** (3+ levels of `if`/`for`/`try`) — refactor candidate via guard clauses or extracted helpers
- **Long functions** (~50+ lines, or one function with multiple distinct responsibilities) — split-into-named-pieces candidate
- **Nested ternaries** — replace with if/else, switch, or a lookup map
- **Boolean parameter flags** (`doThing(true, false)`) — prefer an options object or separate functions; positional booleans are unreadable at the call site
- **Generic names** (`data`, `result`, `temp`, `val`, `item`) or **abbreviated names** (`usr`, `cfg`, `btn`, `evt`) — rename to describe the content; allow universal abbreviations (`id`, `url`, `api`)
- **Repeated conditionals** — the same predicate in multiple places — extract to a named function

For style-level findings (3-param function limit, single responsibility), defer to `code-style.md` instead of duplicating here; comments are not among them, since Touched Comments above applies to every diff.

### Interface Design

- Prefer `children`, render props, or slot patterns over configuration props (`buttonProps`, `mode` flags). Boolean/mode props often signal a component doing too many things.
- Can the interface be smaller? Each prop is a contract that must be maintained.

### Dead Code

Apply Chesterton's Fence: before recommending removal, understand why the code exists. Check `git blame`, read callers, look for non-obvious reasons (performance, platform constraint, historical bug fix). If you can't explain why it's there, flag it as a question, not a removal recommendation.

- Identify dead code explicitly: unused exports, unreachable branches, commented-out blocks
- List what you found and ask before removing it — don't delete silently
- Confirm it's truly unused (grep for all references) before recommending removal

### Multi-Model Review

When reviewing AI-generated code (or your own output from an earlier step):

- Apply the same standards as human-written code — AI output is not exempt from review
- Watch for AI-specific patterns: overly verbose error handling, unnecessary abstractions, hallucinated APIs, inconsistent naming

### Assumptions Audit

For non-trivial decisions, ask: **what does this assume that could change?**

- Assumes a specific API response shape, field presence, or ordering
- Assumes a component is rendered exactly once, or in a specific context
- Assumes a domain constant is stable — if it's not, it should be a config value, not an inline literal
- If an assumption is load-bearing, it should be enforced by types or validated at runtime

### State Persistence

- **URL search params** — For state that should be shareable, bookmarkable, or deep-linkable
- **Ephemeral state** — For transient UI concerns (modals, hover, animation). No persistence needed.
- **localStorage** — Only for user preferences that should survive sessions and don't need to be shareable.
- **Avoid multi-store sync** — The same conceptual state should live in one place.

### Design Spec Alignment

If the change is UI-facing, verify against design specs (Figma, mockups). Flag discrepancies between implementation and design intent.

### Cross-Project Consistency

If sibling or related projects exist:

- **Naming divergence** — Different names for equivalent concepts across projects. Align when the concept is the same.
- **Reinvented utilities** — Existing shared utilities that could be reused instead of reimplemented.
- **Pattern drift** — Established conventions in older projects that should carry forward.

## What NOT to Flag

- **Style preferences** that don't violate project conventions — if it's valid and consistent, leave it
- **Equally valid alternatives** — "I would have done it differently" is not a review finding
- **Issues in unchanged code** — unless the diff directly affects them
- **Nitpicks on code being deleted or moved** — don't review dead code
- **Hypothetical future problems** — flag only if the current change creates a concrete risk
- **Comment verbosity or style on its own** — never a standalone finding; a comment-only finding has to clear one of the two bars in Touched Comments above

## Calibrate Severity

Severity reflects **user and production impact**, not code aesthetics:

- 🔴 **Critical** — Breaks functionality, causes data loss, security vulnerability, accessibility barrier that blocks users. Must fix before merge.
- 🟡 **Major** — Causes problems over time: missing tests for complex logic, performance regressions, incorrect types that hide bugs, shared code changes without verifying consumers. Should fix before merge.
- 🟢 **Minor** — Could be better: simplification opportunities, minor duplication, non-blocking naming suggestions. Fix if convenient.

When suggesting findings the user will paste as inline PR comments, prefix the comment text instead of using the emoji: `Critical:` (🔴, blocks merge), `Major:` (🟡, should fix before merge), `Nit:` / `Optional:` (🟢, non-blocking), `FYI:` (informational, no action requested).

## Approval Bar

Approve when the change **definitely improves overall code health**, even if it isn't perfect. The bar is improvement over the current state, not perfection — chasing perfect blocks shippable improvements. Block merge only when Critical findings remain. Major findings should be fixed before merge but don't get rubber-stamped as "fix in follow-up." Minor findings approve-with-comment.

## Prioritize Review Effort

Not all changes deserve equal attention:

- **High** — New logic, state changes, data flow (where bugs live)
- **High** — Changes to shared code: components, utils, types (widest blast radius)
- **High** — Security-relevant code: auth, input handling, API (highest stakes)
- **Medium** — New files and new abstractions (design decisions that compound)
- **Medium** — Test changes (verify they test real behavior)
- **Low** — Renames, formatting, import reordering (unlikely to introduce bugs)
- **Low** — Config and boilerplate changes (skim for obvious errors)

For large diffs (20+ files): review types and interfaces first to understand the contract, then group remaining files by feature/concern rather than reviewing file-by-file.

## Don't Rationalize

- "The code looks fine to me" — Trace all usage sites for changed shared code. "Looks fine" isn't a review.
- "I would have done it differently" — Preference isn't a finding. Different isn't wrong.
- "It's just a small change" — Small changes to shared code have the widest blast radius. Check consumers.
- "The tests pass" — Passing tests prove the tests pass, not that the code is correct. Tests have gaps.
- "I'll flag it next time" — Note it now. Use severity levels to indicate urgency.
- "Fix it in a follow-up PR" — Deferred fixes don't get fixed. Block on it now or accept it forever; don't pretend a Critical finding is a follow-up.
- "It's mostly good, just approve" — Rubber-stamping is not review. If you didn't trace the shared-code consumers, you didn't review them.
- "This code is obviously dead/redundant" — Chesterton's Fence: check `git blame` and callers before recommending removal or simplification. Accumulated complexity often has a real reason; if you can't explain why it's there, ask, don't remove.

## Verification Scripts

Diff reviews (`review-commit`, `review-pr`) always run the project's verification scripts, launched early rather than after the review:

- **Launch as soon as the reviewed set is known** — for `review-commit` the staged set, or the working-tree target above when `-w` is passed; for `review-pr` the diff against the base. Identify what the project exposes — lint, typecheck, and test scripts (check `package.json` scripts, a `Makefile`, or the stack's conventional commands) — and start them on the changed/staged files where they exist; what the project doesn't expose is skipped, not simulated.
- **Run them in the background where the host supports it**, reviewing inline while they run; where it doesn't, run them in the foreground at that same early point.
- **Collect before output** — merge failures and warnings into the findings, each with file location and severity.

The scripts are a review's only execution surface: everything else stays analysis — read the code, reason about it. Read-only probes never run them (`../workflow/agent-fanout.md`).

## Standard Verification Checklist

Before finalizing any review output, confirm:

- [ ] All usage sites of modified shared code checked
- [ ] Severity ratings reflect user/production impact, not aesthetics
- [ ] No findings on style preferences alone
- [ ] No findings on unchanged code
- [ ] Bug fixes have regression tests, or the gap is flagged
- [ ] Touched comments validated per `code-style.md` → Comments; any comment-only finding clears the bar Touched Comments assigns it
- [ ] Dead code identified and listed explicitly
- [ ] Assumptions in non-trivial decisions identified
