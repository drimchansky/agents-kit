# User-Facing Messages: Markers, Blocks, and Surface Adapters

Markers, Blocks, and Surface adapters govern final chat responses, progress updates, PR comments and descriptions, and Jira drafts. They fix visual grammar and ordering; Handoff also fixes what each slot admits. Each skill's Output owns its content. Those sections exclude questions, approvals, refusals, errors, and internal returns. Plain wording has its own applicability below.

## Plain wording

Apply to newly authored prose for people: goals, tickets, `CONTEXT.md`, `result.md`'s Current state, chat, PR text, Slack and Jira drafts, and writing-utility output. This includes questions, approvals, refusals, and errors. It adds no marker or Handoff requirements.

- Before saving or returning a draft, revise its wording under these rules. State the actor's action or observable result directly. Prefer ordinary verbs and literal relationships to nominalizations and unnecessary abstractions.
- Remove repetition, artificial contrasts, staged emphasis, candor framing, and closing restatements when they add no meaning.
- Replace structural metaphors with the relationship they describe. Keep necessary technical terms; use context rather than a replacement dictionary.
- Compare the revised draft with its source. Preserve facts, conditions, permissions, comparisons, uncertainty, negation, thresholds, identifiers, and logical scope. Add no claims or recommendations.
- Preserve quotations, commands, code, required formats, recorded decisions, delivery identifiers, and explicitly requested tone or language. When adapting source text, preserve its intended tone and simplify wording the request does not require verbatim.

Leave commit messages, kit instruction prose, and raw executor, reviewer, and probe returns unchanged. Text protected by a verbatim-copy rule stays verbatim; § *Finding entry wording* defines the first-report exception for new review findings.

Wording examples; § *Blocks* still governs Handoff structure:

- Handoff Know: “Release is approval-gated; the staging test result is not yet verified.” → “Release requires approval. The staging test result has not been verified.”
- PR comment: “The retry seam may double-submit on timeout; gate retries on idempotency to protect the payment path.” → “Retries after a timeout may submit the payment twice. Require idempotency before retrying.”

## Finding entry wording

When preparing a new review finding for people, keep the raw return and draft a separate finding under § *Plain wording*. Compare it with its source before accepting the wording: preserve severity, locator, recommendation, impact, certainty, and every distinct claim. Change wording without inferring a new fix or cause.

Prepare once before triage, verification, or publication, even when chat display waits. Apply this also to candidates first raised during verification, before the session verifies and adopts them. Preparation assigns no verdict and adopts no candidate.

Downstream copy rules preserve the prepared text. Their existing marker, corroboration, and verdict transformations still apply. Existing findings imported from a report, PR, file, or pasted list retain their wording.

## Markers

A marker is a text label with a fixed emoji before it. The pair reads the same on every host without color; the emoji never stands alone, and the label never takes another emoji.

- Severity: `🔴 Critical`, `🟡 Major`, `🟢 Minor`. Meaning: `../engineering/review.md` § *Calibrate Severity*.
- Progress and outcome: `🔵 In progress` for launched or still-running work; `✅ Complete` for collected work.
- Informational PR note: `🔵 FYI`.
- Fact verification: `✅ Verified`, `❌ Incorrect`, `⚠️ Unverified`.

Each item carries exactly one marker, at its start. A finding whose source supplies no severity takes none, keeping its locator and text verbatim. No other emoji, ANSI code, or host color carries meaning.

**Legacy prefixes.** Findings written before this contract, PR comments included, open with `Critical:`, `Major:`, `Nit:`, `Optional:`, or `FYI:`. Accept them on input. Earlier chat output also emitted the emoji-plus-label form `🔴 **Critical:**`; accept that too. One recognized prefix or marker is the whole leading run of severity emoji, label, bold markup, and colon, in any combination. It counts only when it carries an emoji or a colon and is followed by whitespace or a delimiter. Before rendering or publishing, remove that whole run, then attach the canonical marker; the text after it stays verbatim.

- `Critical:` renders `🔴 Critical`; `Major:` renders `🟡 Major`.
- `Nit:` and `Optional:` render `🟢 Minor`.
- `FYI:` renders `🔵 FYI`.

## Blocks

- **Headline.** Optional. One sentence, outcome first.
- **Finding entry.** The marker, the locator in backticks (`file:line`, or the locator the workflow names), the text retained under § *Finding entry wording* with its recommendation and impact verbatim, then the verdict or note when the workflow carries one. One entry per issue, never collapsed, ordered by severity where the workflow fixes no other order. Example: 🟡 Major `src/export.ts:42`: rows load into memory before streaming; stream from the cursor; large tenants time out. Confirmed: the loop awaits `toArray()`.
- **Progress line.** Launched or still-running work takes `🔵 In progress: <action> <target>`. Example: `🔵 In progress: reviewer on abc1234...HEAD`. Collected work takes `✅ Complete: <what finished>`.
- **Fact ledger.** One line per checked claim, each claim once, quoted: `✅ Verified: "<claim>" (<evidence>)`, `❌ Incorrect: "<claim>" is <corrected fact> (<evidence>)`, `⚠️ Unverified: "<claim>" (<missing evidence>)`.
- **Handoff.** Chat only: the last element of the final response that renders the skill's Output, whatever ended the run. A response that only asks a question, requests approval, refuses, or reports an error renders no Output and carries none. A `**Handoff**` lead line opens it, then one `- **<Slot>:**` item per non-empty slot, in the order Done, Know, Awaiting you, Next. Omit an empty slot. The skill names what fills each slot. A skill that another skill runs as a step prints no block; the run the user invoked composes one for the whole run, a composite's pipeline included (`./skill-conventions.md` § *Adding a behavior*).
    - **Done:** at most three bullets. Each names an outcome of the run and points at the body section holding its detail, repeating none of its entries.
    - **Know:** only items that change the user's next action. Draw them from what was verified versus not run, surprises and risks, and where the work sits: branch, uncommitted changes, PR, the task's handoff token.
    - **Awaiting you:** decisions that block further work, kept apart from optional next steps. Where the body carries an Awaiting decision bucket, point at it and repeat none of its options.
    - **Next:** two or more alternative routes render as nested options lettered A, B, C. Each option gives its pros and cons; exactly one carries `(recommended: <reason>)`. A single route collapses to one line; invent no alternative (`../../CORE_RULES.md` § *Ask Before Assuming*). Steps that all apply, or that follow in order, are not alternatives: list them plainly ahead of any lettered options, each with its own command in backticks.
        - **The proposal line** sits directly above a closing command that names a skill. Compose its question from the target skill's `SKILL.md` authorization provisions and proposal gate, including required sweep scope. Name the skill, its arguments, and all sanctioned writes, Git mutations included. Close with the confirmation word under `./skill-conventions.md` § *The invocation gate*. Where the closing command follows plain steps, the proposal names those steps as its condition. A confirmation given before they are done asks about them instead of launching. A confirmation opens the run through that section's second door; the agent then starts the skill itself with those arguments, through the skill tool on Claude Code or by reading its `SKILL.md` as implicit invocation does on Codex. A closing line that is not a skill command, such as a shell command, a push request, or a request form, carries no proposal line; the owning skill's own gate governs it.
        - **The closing command** is the command that applies the recommended or sole route, after any plain steps. It sits on the slot's last line, in backticks, for a cold reader. A single route keeps the same two lines, proposal and command, below its one line. A task-bound command carries the handoff token `./task-layout.md` § *One task, one flat folder* fixes. Where its skill resolves the session's task (`./task-layout.md` § *Discovery rules for skills*), the command prints bare and that handoff token goes in Know; the bare command relies on the token, which a cold reader appends. A command addressing another task keeps its token.

Example, closing an implementation run:

```markdown
**Handoff**
- **Done:**
    - CSV export streams rows from the cursor (see Changes).
    - A regression test covers a 50k-row tenant (see Verification).
- **Know:** Unit suite green; the e2e suite was not run. Changes sit uncommitted on `feat/csv-export`.
- **Next:**
    - Stage the change: `git add -p`.
    - Commit it: `/commit`.
    - A. Review the branch before pushing (recommended: the change touches the download flow, and the review traces its callers): `/review-code`. Pros: catches a defect before it lands. Cons: about fifteen minutes.
    - B. Push right after the commit: `git push`. Pros: the work lands now. Cons: a defect found later needs a follow-up commit.
    - Once committed, review `feat/csv-export` against `main` with `review-code`? It writes nothing. Say go.
    - `/review-code`
```

## Surface adapters

**Final chat.** A headline first where the skill's Output declares one, then the blocks in the skill's Output order, then the Handoff block where the skill closes with one. Lists, never tables (`../../CORE_RULES.md` § *Communication*). Findings render as finding entries with canonical markers, a legacy prefix normalized first.

**Intermediate progress.** One progress line per update while delegated or long-running work is in flight (`./delegated-waiting.md` § *How to wait*). Per-finding text and verdicts wait for the final response; aggregate counts may appear in progress lines.

**GitHub PR review comments.** Each inline comment body, and each body entry for an unanchored finding, opens with its marker: `🔴 Critical` or `🟡 Major` by the finding's severity, `🟢 Minor` for minor findings, `🔵 FYI` for improvements, then the preserved text and notes. Attribution, verdict, and tier gates stay with `skills/publish-pr-review/SKILL.md`.

**PR descriptions.** The Task and link header first, then a concise body. No markers, no review verdict, no AI footer (`skills/review-code/SKILL.md` § *PR description*).

**Jira task drafts.** The ticket structure of `./ticket-format.md` in plain Markdown that pastes into the Jira editor: headings, paragraphs, and `-` bullets, Acceptance Criteria included (`./ticket-format.md` § *Hard rules*). No markers appear in a ticket body.
