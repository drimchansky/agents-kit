---
name: proofread
description: Use when asked to proofread, check, review, or polish a message, email, or piece of writing.
argument-hint: '[-f (fact verification)] [message or file path]'
---

## Core Rules

Read and apply `./AGENTS.md` § *Ask Before Assuming*.

# Proofread

Suggest improvements while preserving the author's tone, voice, style, formatting, and structure.

## Flags

- `-f`: verify checkable names, dates, numbers, and technical terms. Check session context/files/tool output first, then web sources for unsettled claims. Emit one progress line per web-checked claim: `🔵 In progress: checking "<claim>" against <source>` (`./references/workflow/user-facing-messages.md` § *Blocks*). Render every checked claim once in the **Facts** ledger of § *Output Format* (`./references/workflow/user-facing-messages.md` § *Blocks*). State unverifiable claims without guessing. Off by default because short proofreads rarely need research. <!-- cold -->

## Analysis Criteria

1. **Grammar & Mechanics:** spelling, typos, punctuation, grammar.
2. **Structure & Flow:** progression, clarity, readability, repetition, buried points.
3. **Consistency:** contradictory claims or terminology.
4. **Facts:** flag known errors; further verification is opt-in with `-f`.

## Rules

Fix real problems, leaving clear wording alone. Explain each suggestion briefly and distinguish required corrections from optional improvements. Preserve blunt or casual voice; do not formalize it. If clean, say so without inventing changes. Use lists, not tables.

## Output Format

**Errors**, when present: Quote/location → Fix → Why.

**Improvements**, when present: Quote/location → Suggestion → Why.

**Facts**, only with `-f`: render the shared fact ledger (`./references/workflow/user-facing-messages.md` § *Blocks*). <!-- cold --> An incorrect claim also lands in Errors so the Updated version carries the correction. Without `-f`, no ledger.

Give one-line overall assessment. For changed text, include **Updated version** with all fixes/improvements and original formatting/structure. Omit it when unchanged.
