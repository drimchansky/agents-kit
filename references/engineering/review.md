# Code Review

Lenses, calibration, and discipline for any code review. Orchestration and the review objects live in `skills/review-code/SKILL.md`; everything below holds across a diff, a range, and a path set except § *Reviewing a path set*.

Per-surface checklists sit beside this file (`accessibility.md`, `css.md`, `security.md`, `react.md`, …); consult the ones the reviewed set's domains trigger.

## What to Look For

### Impact on Existing Code

For every change to shared code, grep every modified export and verify callers still work; check behavioral changes (a renamed prop, a changed default, a new required field); trace data-shape changes through to the UI; catch breaking changes to interfaces and public APIs.

### Problem Verification

Does the fix address the root cause or the symptom? For bug fixes, is there now a test that would have caught the regression? Search for the same pattern elsewhere; a fix in one place often applies to siblings.

### Touched Comments

Applies to every diff. Comments the diff adds or edits are held to `code-style.md` → Comments; one that discipline prohibits is a finding on its own. Pre-existing comments adjacent to the change are flagged only when the change makes them materially misleading.

### Abstraction Justification

- **Premature extraction:** under ~20 lines rarely needs its own module. Inline until a second or third consumer proves it, unless the unit owns a boundary such as state, hooks, or lifecycle (`react.md` → Components).
- **Wrapper types:** aliases that re-wrap a library's types without adding information.
- **One-use helpers:** functions extracted for "reusability" but called from one place.

### Complexity Signals

Flag as Minor by default; promote to Major when the pattern hides a bug.

- **Deep nesting** (3+ levels): guard clauses or extracted helpers.
- **Long functions** (~50+ lines, or several responsibilities): split into named pieces.
- **Nested ternaries:** if/else, switch, or a lookup map.
- **Boolean parameter flags:** an options object or separate functions.
- **Generic or abbreviated names** (`data`, `temp`, `usr`): rename to describe the content; `id`, `url`, `api` are fine.
- **Repeated conditionals:** extract the predicate to a named function.

Style-level findings defer to `code-style.md`.

### Interface Design

Prefer `children`, render props, or slot patterns over configuration props (`buttonProps`, `mode` flags), which often signal a component doing too many things. Each prop is a contract, so ask whether the interface can be smaller.

### Dead Code

Apply Chesterton's Fence: learn why the code exists (`git blame`, callers) before recommending removal, and flag it as a question if you cannot. List dead code explicitly (unused exports, unreachable branches, commented-out blocks), confirm it is unused by grepping all references, and ask before removing it.

### Accidental Inclusions

Read the added lines for what the author never meant to ship:

- **Debug artifacts:** a `debugger`, a stack dump, or a commented-out probe is a finding on sight; printed output only where it is not what the file exists to emit (a CLI entry point, a logger).
- **Sensitive data:** tokens, keys, passwords, connection strings, or a committed `.env`. Critical whenever it appears; the value needs rotating, since history keeps it.
- **Unrelated formatting churn:** a reindent or import reshuffle riding along with a behavioral change. Ask for a separate commit.

### Multi-Model Review

Hold AI-generated code, and your own earlier output, to the same standards: watch for verbose error handling, unnecessary abstractions, hallucinated APIs, inconsistent naming.

### Assumptions Audit

For non-trivial decisions, ask what this assumes that could change: an API response shape, a component rendered exactly once, a domain constant that should be config. A load-bearing assumption is enforced by types or validated at runtime.

### State Persistence

URL search params for shareable state; ephemeral state for transient UI concerns; `localStorage` only for user preferences that need no sharing. The same conceptual state lives in one place.

### Design Spec Alignment

If the change is UI-facing, verify against the design source. `design-to-code.md` § *Verify* names what the implementation should have reported; its § *Hint priority* orders how a discrepancy is judged.

### Cross-Project Consistency

If sibling projects exist, flag naming divergence for equivalent concepts, reinvented utilities a shared one covers, and pattern drift from established conventions.

## What NOT to Flag

- Style preferences that do not violate project conventions.
- Equally valid alternatives; "I would have done it differently" is not a finding.
- Issues in unchanged code, unless the diff directly affects them.
- Nitpicks on code being deleted or moved.
- Hypothetical future problems, unless the change creates a concrete risk.
- Comment verbosity or style on its own; a comment-only finding clears one of the Touched Comments bars.

## Calibrate Severity

Severity reflects user and production impact, not code aesthetics. Each level renders as its canonical marker on every user-facing surface (`../workflow/user-facing-messages.md` § *Markers*):

- **Critical:** breaks functionality, data loss, a security vulnerability, or a blocking accessibility barrier. Must fix before merge.
- **Major:** causes problems over time: missing tests for complex logic, performance regressions, types that hide bugs, unverified consumers. Should fix before merge.
- **Minor:** simplification, minor duplication, non-blocking naming. Fix if convenient.

Legacy text prefixes are valid input; `../workflow/user-facing-messages.md` § *Markers* maps each to its marker before rendering.

## Findings output shape

One entry per issue, each carrying its severity, `file:line`, the recommendation, and the impact, the list ordered by severity. Minor findings take the same shape, listed individually and never collapsed, and the list is never capped, so `/fix-findings` can take findings one at a time. Each citing skill's Output says where the list sits and renders it as the finding entry `../workflow/user-facing-messages.md` § *Blocks* fixes; a reviewer's return keeps this abstract shape (`../workflow/reviewer-contract.md` § *The return*).

## Approval Bar

Approve when the change definitely improves overall code health, even if imperfect. Block merge only when Critical findings remain. Major findings should be fixed before merge and are not rubber-stamped as "fix in follow-up". Minor findings approve-with-comment.

## Reviewing a path set

A path set is the tracked files under the given paths at one commit, the whole reviewed object rather than a change. Two rules read differently: none of it is unchanged code, so every line is in scope; and the verdict states health, not a decision, from the closed set `sound` / `needs work` (a Critical or Major finding should be fixed) / `needs discussion` (turns on a question the review cannot settle), § *Approval Bar* still calibrating which.

## Prioritize Review Effort

- **High:** new logic, state changes, data flow; shared code; security-relevant code (auth, input handling, API).
- **Medium:** new files and abstractions; test changes (verify they test real behavior).
- **Low:** renames, formatting, import reordering, config, boilerplate.

For large diffs (20+ files): review types and interfaces first, then group remaining files by concern.

## Verification Scripts

`review-code` always runs the project's verification scripts, launched early, except under a caller that substitutes its own evidence; that exception holds on the delegated and inline paths alike:

- **Launch as soon as the reviewed set is known:** the lint, typecheck, and test scripts the project exposes, on the changed files; what the project does not expose is skipped, not simulated.
- **Run them in the background where the host supports it**, waiting per `../workflow/delegated-waiting.md` § *How to wait* (a foreground `sleep` is not a wait, per its § *What is not a wait*); otherwise in the foreground at that same early point.
- **Collect before output:** merge failures and warnings into the findings, each with file location and severity.

Beyond these scripts and the reproduction below, a review executes nothing; `security.md` § *Review Validation Boundaries* draws the line between reading and active validation. The session or its delegated reviewer (`../workflow/reviewer-contract.md`) runs them; a read-only probe runs neither (`../workflow/agent-fanout.md`).

**Both execute-only actions exercise what is on disk, never the review object.** A script failure or reproduced failure at a reviewed path where the tree diverges from the object (an uncommitted change on either side of the index, or an untracked file in a tracked path's place) is **context, never an adopted finding**: report it as such and settle the candidate by the verify route in `../workflow/agent-fanout.md`. The runner records every such path, the reviewer under its return's `Divergence` heading (`../workflow/reviewer-contract.md` § *The return*) and the session on its inline pass; a matching tree records `None`. The review never requires the tree to match.

**Reproduce before adopting.** A safely reproducible failure mode is reproduced in the session's scratch area before adoption, as one isolated invocation (a crafted input, a minimal script), and the finding carries the observed output as evidence. The project's build and suite stay out of bounds, and a probe never runs it. A candidate at a diverging path, or one that does not reproduce (infrastructure, unsafe, not executable), settles by the verify route; security candidates also follow `security.md` § *Review Validation Boundaries*.

## Standard Verification Checklist

Before finalizing, re-read the lenses above against the output: usage sites checked, severity by impact, no style-only or unchanged-code findings, regression tests or the gap flagged, touched comments validated, dead code listed, assumptions identified, findings in the shape § *Findings output shape* defines.
