---
name: review-docs
description: Use when asked to review, audit, or check existing documentation — README, AGENTS.md/CLAUDE.md, architecture notes, ADRs, API docs, specs, runbooks, or any other written documentation. Grounds claims against the codebase and runs the whole-doc quality pass (coherence, register); the documentation pack wires it in before staging or publishing a deliverable. Produces an audit; applies fixes only when the user explicitly asks after seeing the review.
argument-hint: '[doc file path] [-x (cross-vendor grounding probe)]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is a documentation-pack skill: also read `./references/documentation/rules.md` and apply it on top of the core — its repo-grounding license covers the against-codebase audit below.

Audit documentation for source accuracy and whole-document quality (`./references/documentation/verification.md`). Report in chat without editing. Only a subsequent explicit request after the review authorizes scoped fixes. Implementation plans use `review-task`.

## Flags

- `-x`: one read-only cross-vendor grounding probe, off by default. Apply `./references/workflow/probe-cross-check.md`, `./references/workflow/probe-shape-grounding.md`, `./references/workflow/agent-fanout.md`, and `./references/workflow/probe-engines-cross-vendor.md`. Merge before verdicts and record Cross-check in Doc Summary. <!-- cold -->

## When to Use

Use for existing-doc accuracy audits, drift assessment, or pre-publication/staging review. At documentation checkpoints, run quality as judgment separate from mechanical checks (`./references/documentation/verification.md` § *Integration assertions*).

Skip accuracy-versus-code on drafts; their quality pass still applies. Skip purely aspirational documents that do not describe current state. Greenfield writing is drafting, not this audit.

## Process

### 1. Locate and Read the Doc

Use the supplied path. Otherwise search README/AGENTS/CLAUDE at the root, or docs/architecture/adr/.agents for topic documents. Ask among multiple candidates. Read the whole document and identify type and audience.

### 2. Extract Verifiable Claims

Extract references, commands, versions, behavior, structure, configuration, and examples. Exclude philosophy, intent, and other claims without checkable ground truth.

### 3. Ground Each Claim

With `-x`, launch after extraction: a self-contained prompt with claims, document path, and repository working root. Require CONFIRMED/CONTRADICTED/NOT FOUND with file:line evidence under the cited probe contracts. Ground inline concurrently; merge before verdicts, rechecking contradictions. Record unavailable engines as Cross-check skipped with reason and continue the primary pass. <!-- cold -->

For every claim, locate the source and read its actual behavior. Trace examples through current types/APIs. Check command definitions without running side-effecting commands; compare versions with manifests/lockfiles. Report even minor drift with appropriate severity; names and plausible examples alone are not proof.

Assign **Accurate** for a source match, **Stale** for former truth now changed, **Missing context** for material omissions, or **Misleading** for unsupported implications.

### 4. Identify Gaps

Check missing features, adopted patterns, significant dependencies, removed surface still documented, and prerequisites the reader would otherwise need to guess.

### 5. Check Doc-Type Specifics

- **README:** setup, description, examples.
- **AGENTS.md / CLAUDE.md:** structure, commands, boundaries.
- **Architecture / ADRs:** decisions still hold or reversals are noted.
- **API docs:** endpoints/exports and exact signatures.
- **Runbooks:** systems, dashboards, commands exist.
- **Feature specs:** criteria match shipped behavior; deviations are documented.

### 6. Doc-Quality Pass

Read end to end for contradictions, stale internal references, consistent terms/numbering, and a TL;DR matching the body. Check audience-appropriate language, expanded acronyms, and consistent voice/tense. Apply `./references/documentation/adr-format.md` or `./references/documentation/rfc-format.md` where relevant, plus discovered DOC_CONVENTIONS (`./references/workflow/task-store.md` § *Store-level artifacts*).

For documents without codebase claims, this may be the entire review.

## Findings Output

Print the audit in chat and stop. Finding an obvious fix does not authorize an edit.

### Doc Summary

State coverage and the apparent date/commit from history when discoverable. With `-x`, include the required Cross-check outcome under `./references/workflow/probe-cross-check.md`. <!-- cold -->

### Accuracy Assessment

For each claim, give its wording/location, verdict, source evidence, and current reality when stale or misleading.

### Gaps

Group relevant undocumented codebase behavior by category.

### Quality

Give coherence/register findings with section pointers, or explicitly state none.

### Questions

Number unresolved ambiguities; cite the passage, explain why its meaning matters, and suggest supported interpretations.

### Confirmed

Name verified sections requiring no changes.

## Applying Fixes (only on explicit request)

Run only after the user saw findings and explicitly requested edits. Ambiguous reactions such as thanks/ok are not edit authorization; ask.

- Map every edit to an approved finding; omit invented or unsupported detail.
- Rewrite stale prose in place, preserving Confirmed and unrequested sections, voice, and structure.
- Take examples from real call sites; copy exact versions, paths, and commands from source.

### Open Questions during a rewrite

Fold source/session answers into the relevant text and remove answered questions. Put new accuracy gaps in Open Questions, or chat when no such section exists. Keep no inline resolved-question history.

### Verify after editing

Re-grep every written path, symbol, and command; fix unresolved references. Cross-check versions and trace every example. Compare the actual diff with approved findings before reporting completion.
