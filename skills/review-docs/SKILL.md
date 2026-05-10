---
name: review-docs
description: Use when asked to review, audit, or check existing documentation against the codebase — README, AGENTS.md/CLAUDE.md, architecture notes, ADRs, API docs, specs, runbooks, or any other written documentation. Produces an audit; applies fixes only when the user explicitly asks after seeing the review.
argument-hint: '[doc file path]'
disable-model-invocation: true
---

## Core Rules

Before doing anything else in this skill:

1. Read the sibling file `./AGENTS.md` (relative to this `SKILL.md`).
2. Apply the rules it defines for the rest of this skill's execution.
3. Output the following line as a visible confirmation, **before** any other text or tool calls in this skill, on its own line — substitute `<version>` with the value on the **Version** line at the top of `./AGENTS.md`:

    ✅ Core agents-kit@<version> rules applied

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

This skill audits existing documentation against the codebase. It catches stale references, drifted descriptions, missing context, and silent assumptions — producing a clear assessment of what's accurate, what's wrong, and what's missing.

The user provides a documentation file (or points at a documentation area). This can be a README, project rules file (AGENTS.md / CLAUDE.md), architecture note, ADR, API doc, runbook, or feature spec. Your job is to verify whether the document still matches reality and surface what needs to change.

For reviewing an implementation plan against the codebase (not a doc), use `review-plan`.

**CRITICAL**: This skill does not modify the doc on its own. The default output is an assessment in chat — nothing is written to the file. Only after the user has seen the review and explicitly asks for changes ("apply the fixes", "update the version section", "rewrite the commands block") do you edit the file, and only the changes the user authorized. Silent rewrites — even when the drift is obvious — are not allowed.

## References

Before working, read any applicable checklists from `references/engineering/`. Skip ones that don't apply.

## When to Use

**Use when:**

- The user wants to audit a doc before relying on it (onboarding, handoff, decision-making)
- The doc references code, APIs, commands, or files that may have changed
- The codebase has shifted significantly since the doc was last updated
- Multiple readers are about to consume the doc and accuracy matters
- The user wants to know what would need to change to bring a doc back in sync (the rewrite itself happens after, on explicit follow-up)

**Skip when:**

- The doc is a draft that hasn't been reviewed yet — review the draft on its own terms, not against shipped code
- The doc is purely aspirational (vision, roadmap) and not meant to describe current state
- The user wants a brand-new doc written from scratch with no prior file — this skill audits what exists; for greenfield doc creation, draft the doc directly

## Process

### 1. Locate and Read the Doc

If the user gives a path, use it. Otherwise:

- For project docs: look at the repo root for README.md, AGENTS.md, CLAUDE.md
- For feature/architecture docs: search common locations — `docs/`, `architecture/`, `adr/`, `.agents/`
- If multiple candidates exist, list them and ask which one

Read the doc in full. Identify the doc's type and intended audience — that shapes what counts as a real finding.

### 2. Extract Verifiable Claims

Pull out concrete claims that can be checked against the codebase. Examples:

- **References** — File paths, function names, component names, type names, package names
- **Commands** — Build, test, lint, deploy commands
- **Versions** — Language versions, framework versions, dependency versions
- **Behavior** — "X does Y when Z," "the API returns A on B"
- **Structure** — Directory layouts, module organization, naming conventions
- **Configuration** — Environment variables, settings, flags
- **Examples** — Code snippets, sample inputs/outputs

Skip soft claims (philosophy, intent, motivation) — those don't have a ground truth to check against.

### 3. Ground Each Claim

**CRITICAL**: Every claim about the codebase must be verified against the actual source.

For each claim:

- **Verify it still exists** — Grep for the symbol, file, or command. If gone, the claim is stale.
- **Verify it does what the doc says** — Read the code, not just the name. A function whose name matches the doc may behave differently now.
- **Check examples run** — If the doc shows a code snippet, trace it through the current types and APIs. Note breakage.
- **Check commands work** — Confirm scripts referenced in the doc exist (`package.json`, Makefile, etc.). Don't actually run side-effecting commands.
- **Check versions match** — Compare claimed versions against `package.json`, lockfiles, or equivalent.

For each claim, assign one of:

- **Accurate** — Matches the codebase
- **Stale** — Was accurate, now wrong (renamed, removed, behavior changed)
- **Missing context** — Technically accurate but omits something important (a new edge case, a recent flag, an added dependency)
- **Misleading** — Phrasing implies something the code doesn't support

### 4. Identify Gaps

Look for what the doc doesn't say but should:

- **New features** — Code added since the doc was written that the doc doesn't mention
- **New patterns** — A new convention adopted in the codebase that contradicts or extends the doc
- **New dependencies** — Significant additions to `package.json` not reflected in the doc
- **Removed surface** — APIs, commands, or sections that were removed from code but still appear in the doc
- **Implicit knowledge** — Things that work only if the reader knows something the doc doesn't tell them

### 5. Check Doc-Type Specifics

Different doc types have different validation focuses:

- **README** — Setup steps work, project description matches reality, examples run
- **AGENTS.md / CLAUDE.md** — Project structure section matches actual layout, commands accurate, boundaries still apply
- **Architecture / ADRs** — Recorded decisions still hold; if reversed, that should be noted
- **API docs** — Every endpoint or exported symbol exists with the documented signature
- **Runbooks** — Referenced systems, dashboards, and commands still exist
- **Feature specs** — Acceptance criteria match shipped behavior; deviations are documented somewhere

## Findings Output

The audit is the deliverable. Print it to chat and stop — do **not** edit the doc as part of this step, even when the fix is obvious. The user reads the findings and decides what (if anything) to change next.

### Doc Summary

Brief statement of what the doc covers and the date / commit it appears to reflect (if discoverable from git history).

### Accuracy Assessment

For each verifiable claim:

- The claim (quoted or paraphrased, with line reference)
- The verdict (accurate / stale / missing context / misleading)
- Evidence — what in the codebase supports or contradicts it (file paths, line numbers, current state)
- If stale or misleading: what the current reality is

### Gaps

Things the codebase has that the doc should mention but doesn't, grouped by category.

### Questions

Numbered list of points where the doc is ambiguous and the audit cannot determine intent. Each question should:

- Reference the specific part of the doc it relates to
- Explain why the answer matters
- Suggest interpretations when possible

### Confirmed

Sections of the doc that are verified accurate and require no changes.

## Applying Fixes (only on explicit request)

This section runs **only** when the user, after seeing the findings, explicitly asks for changes — phrasing like "apply the fixes", "update the doc", "fix the stale parts", or "rewrite section X". An ambiguous reaction ("looks good", "interesting") is not a request to edit; ask before touching the file.

When the user does authorize edits:

- **Edit only what the user approved.** If they said "fix the version drift", do not also rewrite the architecture section because you noticed gaps there. Honor the scope of the request.
- **Each change still maps back to a finding from the audit.** A change without a finding behind it is invented detail — drop it.
- **Rewrite in place, don't append.** The doc is current truth, not a changelog. Replace stale prose; do not leave both versions side by side.
- **Preserve what was confirmed.** Sections marked `Confirmed` in the audit do not get touched.
- **Match the doc's existing voice and structure.** Don't reformat sibling sections to match a personal preference.
- **Pull examples from real call sites** when updating code snippets. Synthesized examples drift faster than the prose around them.
- **Update versions, paths, and command strings exactly.** Copy from `package.json`, lockfiles, or the source — don't paraphrase.

### Open Questions during a rewrite

- If the codebase or this session answered a previously documented open question, fold the answer into the relevant section and remove the question.
- If new gaps surfaced during the audit and they affect the doc's accuracy, leave them as open questions in the doc (or in the chat summary if the doc has no such section).
- Do not keep a "resolved questions" log inline — the doc is a snapshot of current understanding.

### Verify after editing

Before reporting done:

- Re-grep every file path, function name, and command you wrote into the doc. If it doesn't resolve, fix it.
- Cross-check versions against `package.json` / lockfiles / equivalent.
- Trace every code example through the current types and APIs.
- Diff the doc against the prior version mentally: each change should map back to a finding the user authorized.

## Don't Rationalize

- "The doc reads well" — Reading well isn't accuracy. Verify each claim against code.
- "This file is probably still there" — Grep for it. Probably isn't verified.
- "The example obviously still works" — Trace it through current types. Examples rot.
- "Minor drift, not worth flagging" — Flag it with low severity. Drift compounds.
- "The drift is obvious, I'll just fix it now and save a turn" — No. The audit is the deliverable; the user decides whether to act on it. Silent edits violate the contract of the skill.
- "The user said 'thanks' / 'ok' — that's authorization to apply fixes" — It isn't. Ask explicitly before editing.
- "While I'm rewriting Section A, I might as well clean up Section B" — Edit only what the user authorized. Scope drift in a doc rewrite is the same failure mode as scope drift in code.
- "I'll add some extra detail while I'm in here" — Only include what the code or user supports. Invented detail erodes trust.
- "I'll keep the old phrasing and add the new context below it" — Rewrite the section. The doc is current truth, not a conversation thread.

## Verification

- [ ] Every verifiable claim grounded in actual source code
- [ ] Each claim has a clear verdict with evidence
- [ ] Stale/misleading findings include the current reality, not just "it's wrong"
- [ ] Gaps grouped by category with specific details
- [ ] Code examples traced through current APIs
- [ ] Commands and versions cross-checked against config files
- [ ] Findings printed to chat; the doc file was **not** edited as part of the audit pass
- [ ] If the user requested edits afterward: each rewritten section maps back to a finding the user authorized; no unrequested sections were touched
- [ ] Confirmed sections left untouched
- [ ] Post-rewrite re-grep (when edits were made) confirms paths, symbols, and commands resolve
