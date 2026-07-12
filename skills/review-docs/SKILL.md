---
name: review-docs
description: Use when asked to review, audit, or check existing documentation against the codebase — README, AGENTS.md/CLAUDE.md, architecture notes, ADRs, API docs, specs, runbooks, or any other written documentation. Produces an audit; applies fixes only when the user explicitly asks after seeing the review.
argument-hint: '[doc file path] [-x (cross-vendor grounding probe)]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.
3. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core. See `./references/workflow/domain-packs.md`.

This skill audits existing documentation against the codebase. It catches stale references, drifted descriptions, missing context, and silent assumptions — producing a clear assessment of what's accurate, what's wrong, and what's missing.

The user provides a documentation file (or points at a documentation area). This can be a README, project rules file (AGENTS.md / CLAUDE.md), architecture note, ADR, API doc, runbook, or feature spec. Your job is to verify whether the document still matches reality and surface what needs to change.

For reviewing an implementation plan against the codebase (not a doc), use `review-task`.

**CRITICAL**: This skill does not modify the doc on its own. The default output is an assessment in chat — nothing is written to the file. Only after the user has seen the review and explicitly asks for changes ("apply the fixes", "update the version section", "rewrite the commands block") do you edit the file, and only the changes the user authorized. Silent rewrites — even when the drift is obvious — are not allowed.

## Flags

- `-x` — Cross-check: launch one independent grounding probe on the cross-vendor engine over the doc's verifiable claims and merge it before verdicts are assigned, per the shared contract in `./references/workflow/agent-fanout.md`. Off by default. The probe is read-only; its outcome is recorded on the Doc Summary's `Cross-check:` line.

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

Every claim about the codebase must be verified against the actual source — that's the whole job of this pass.

**With `-x`, launch the grounding probe first.** Once the claims are extracted (Step 2), start one background probe on the **cross-vendor engine** per `./references/workflow/agent-fanout.md`: a self-contained prompt carrying the extracted claims and the doc's path, with the repo root as working root, demanding per-claim `CONFIRMED` / `CONTRADICTED` / `NOT FOUND` verdicts with `file:line` evidence. Ground inline yourself as below while it runs; collect and merge per the contract before assigning verdicts — where the probe contradicts your grounding, re-check that spot first. Record the outcome on the Doc Summary's `Cross-check:` line — including `skipped (<reason>)` when the engine is unavailable, in which case proceed on your own pass.

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

Brief statement of what the doc covers and the date / commit it appears to reflect (if discoverable from git history). With `-x`, end this section with the probe's `Cross-check:` outcome line per `./references/workflow/agent-fanout.md`; without the flag, no such line appears.

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
- "The user said 'thanks' / 'ok' — that's authorization to apply fixes" — It isn't. Ask explicitly before editing.
- "I'll add some extra detail while I'm in here" — Only include what the code or user supports. Invented detail erodes trust.
- "I'll keep the old phrasing and add the new context below it" — Rewrite the section. The doc is current truth, not a conversation thread.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Every verifiable claim grounded in the actual source, with a verdict and evidence; stale/misleading findings include the current reality
- [ ] Code examples traced through current APIs; commands and versions cross-checked against config files
- [ ] Findings printed to chat; the doc was **not** edited as part of the audit pass
- [ ] (on explicit request only) Each edit maps to an authorized finding; Confirmed sections and unrequested sections untouched; post-rewrite re-grep confirms paths, symbols, and commands resolve
- [ ] (`-x`) Probe merged before verdicts and the Doc Summary carries its `Cross-check:` line
