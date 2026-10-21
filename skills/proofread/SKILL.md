---
name: proofread
description: Use when asked to proofread, check, review, or polish a message, email, or piece of writing.
argument-hint: '[-f (fact verification)] [message or file path]'
---

# Proofread

Suggest improvements while preserving the author's tone, voice, style, formatting, and structure.

## Flags

- `-f`: verify checkable names, dates, numbers, and technical terms. Check session context, supplied files, and tool output first.
  Use authoritative web sources for unsettled claims when accessible; state missing evidence without guessing.
  Emit one progress line per web-checked claim, before its first lookup: `🔵 In progress: checking "<claim>" against <source>`.
  Record each checked claim once under **Facts**, using the formats below. Fact verification is off by default.

## Analysis Criteria

1. **Grammar & Mechanics:** spelling, typos, punctuation, grammar, and accidental sentence-capitalization errors.
2. **Structure & Flow:** progression, clarity, readability, repetition, buried points.
3. **Consistency:** contradictory claims or terminology.
4. **Facts:** flag known errors; further verification is opt-in with `-f`.

## Rules

Fix real problems, leaving clear wording alone. Explain each suggestion briefly and distinguish required corrections from optional improvements. Preserve blunt or casual voice; do not formalize it. If clean, say so without inventing changes. Use lists, not tables.

Resolve routine choices from the supplied text and context. Preserve the author's decisions and explicit preferences.
When an unsettled choice could change intent, ask the smallest clarifying question and hold that change.
Use available context to explain the viable interpretations and recommend one when evidence supports it.

Write concise, concrete feedback without unnecessary repetition, abstractions, or staged contrasts.
Compare proposed revisions with the source, preserving facts, conditions, permissions, uncertainty, negation, comparisons, thresholds, identifiers, and logical scope.
Keep quotations, commands, code, required formats, and the requested tone and language intact.
Add no unsupported claims or recommendations to the author's text.

## Output Format

**Errors**, when present: Quote/location → Fix → Why.

**Improvements**, when present: Quote/location → Suggestion → Why.

**Facts**, only with `-f`: one line per checked claim, each claim quoted once in this section:
Replace only the placeholders in these line formats.

- `✅ Verified: "<claim>" (<evidence>)`
- `❌ Incorrect: "<claim>" is <corrected fact> (<evidence>)`
- `⚠️ Unverified: "<claim>" (<missing evidence>)`

Cite the session fact, file, tool output, or source link supporting each verdict.
Also list incorrect claims under **Errors** and correct them in **Updated version**.
Omit **Facts** without `-f`.

Give one-line overall assessment. For changed text, include **Updated version** with all fixes/improvements and original formatting/structure. Omit it when unchanged.
