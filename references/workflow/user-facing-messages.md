# User-Facing Messages: Markers, Blocks, and Surface Adapters

The presentation contract for what a person reads: final chat responses, one-line progress updates, GitHub PR review comments, PR descriptions, and paste-ready Jira task drafts. It fixes visual grammar and ordering only. Each skill's Output owns its content and composes the blocks it needs; workflow contracts keep meaning, gates, and evidence rules and cite this file. Questions, approvals, refusals, errors, and internal reviewer, executor, and probe returns are outside it.

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
- **Finding entry.** The marker, the locator in backticks (`file:line`, or the locator the workflow names), the finding text with its recommendation and impact verbatim, then the verdict or note when the workflow carries one. One entry per issue, never collapsed, ordered by severity where the workflow fixes no other order. Example: 🟡 Major `src/export.ts:42`: rows load into memory before streaming; stream from the cursor; large tenants time out. Confirmed: the loop awaits `toArray()`.
- **Progress line.** Launched or still-running work takes `🔵 In progress: <action> <target>`. Example: `🔵 In progress: reviewer on abc1234...HEAD`. Collected work takes `✅ Complete: <what finished>`.
- **Fact ledger.** One line per checked claim, each claim once, quoted: `✅ Verified: "<claim>" (<evidence>)`, `❌ Incorrect: "<claim>" is <corrected fact> (<evidence>)`, `⚠️ Unverified: "<claim>" (<missing evidence>)`.

## Surface adapters

**Final chat.** A headline first where the skill's Output declares one, then the blocks in the skill's Output order. Lists, never tables (`../../CORE_RULES.md` § *Communication*). Findings render as finding entries with canonical markers, a legacy prefix normalized first.

**Intermediate progress.** One progress line per update while delegated or long-running work is in flight (`./delegated-waiting.md` § *How to wait*). Per-finding text and verdicts wait for the final response; aggregate counts may appear in progress lines.

**GitHub PR review comments.** Each inline comment body, and each body entry for an unanchored finding, opens with its marker: `🔴 Critical` or `🟡 Major` by the finding's severity, `🟢 Minor` for minor findings, `🔵 FYI` for improvements, then the preserved text and notes. Attribution, verdict, and tier gates stay with `skills/publish-pr-review/SKILL.md`.

**PR descriptions.** The Task and link header first, then a concise body. No markers, no review verdict, no AI footer (`skills/review-code/SKILL.md` § *PR description*).

**Jira task drafts.** The ticket structure of `./ticket-format.md` in plain Markdown that pastes into the Jira editor: headings, paragraphs, and `-` bullets, Acceptance Criteria included (`./ticket-format.md` § *Hard rules*). No markers appear in a ticket body.
