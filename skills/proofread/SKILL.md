---
name: proofread
description: Use when asked to proofread, check, review, or polish a message, email, or piece of writing.
argument-hint: '[-f (fact verification)] [message or file path]'
---

# Proofread

Review the provided message and suggest improvements. **Strictly preserve the author's original tone, voice, and style** — don't make casual writing formal or direct writing diplomatic.

## Flags

- `-f` — Fact verification: actively verify checkable claims (names, dates, numbers, technical terms). Check the session's existing context first — earlier conversation, files already read, tool output — since the message often describes work done right here; fall back to web search when the session doesn't settle a claim. When a claim can't be verified either way, say so rather than guessing. Off by default because most proofreads are quick passes over short messages where research adds latency without value.

## Analysis Criteria

1. **Grammar & Mechanics** — Typos, spelling errors, punctuation, grammatical mistakes.

2. **Structure & Flow** — Logical progression, readability, unclear or ambiguous sentences. Flag paragraphs that bury the point or repeat themselves.

3. **Consistency** — Contradictions within the text, inconsistent terminology, claims that conflict with each other.

4. **Facts** — Flag claims you know are wrong; verification beyond your own knowledge is opt-in via `-f` (see Flags).

## Rules

- Suggest changes only when they fix a real problem — don't rephrase things that are already clear
- For each suggestion, explain _why_ briefly (e.g., "ambiguous reference", "fixes subject-verb agreement", "contradicts paragraph 2")
- Never alter the author's voice — if the message is blunt, keep it blunt; if it's casual, keep it casual
- Distinguish between errors (must fix) and improvements (could fix)
- If the message is clean, say so — don't invent suggestions to fill space
- Never use markdown tables; use lists instead (tables wrap badly in narrow terminals and resist clean line-by-line diffs and edits)

## Output Format

**Errors** (if any) — Issues that should be fixed:

- Quote or location → Fix → Why

**Improvements** (if any) — Optional suggestions:

- Quote or location → Suggestion → Why

One-line overall assessment. Omit empty sections.

**Updated version** — Full message with all fixes and improvements applied. Preserve original formatting and structure. If the message is clean with no changes, skip this section.
