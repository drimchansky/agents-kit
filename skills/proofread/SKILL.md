---
name: proofread
description: Use when asked to proofread, check, review, or polish a message, email, or piece of writing.
argument-hint: '[message or file path]'
disable-model-invocation: true
---

## Core Rules

Before doing anything else in this skill:

1. Read the sibling file `./AGENTS.md` (relative to this `SKILL.md`).
2. Apply the rules it defines for the rest of this skill's execution.
3. Output the following line verbatim to the user as a visible confirmation, **before** any other text or tool calls in this skill, on its own line:

    ✅ Core rules applied (./AGENTS.md)

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

# Proofread

Review the provided message and suggest improvements. **Strictly preserve the author's original tone, voice, and style** — don't make casual writing formal or direct writing diplomatic.

## Analysis Criteria

1. **Grammar & Mechanics** — Typos, spelling errors, punctuation, grammatical mistakes.

2. **Structure & Flow** — Logical progression, readability, unclear or ambiguous sentences. Flag paragraphs that bury the point or repeat themselves.

3. **Consistency** — Contradictions within the text, inconsistent terminology, claims that conflict with each other.

4. **Facts** — Verify claims that are checkable (names, dates, numbers, technical terms). Use web search when uncertain. If a claim can't be verified, say so rather than guessing.

## Rules

- Suggest changes only when they fix a real problem — don't rephrase things that are already clear
- For each suggestion, explain _why_ briefly (e.g., "ambiguous reference", "fixes subject-verb agreement", "contradicts paragraph 2")
- Never alter the author's voice — if the message is blunt, keep it blunt; if it's casual, keep it casual
- Distinguish between errors (must fix) and improvements (could fix)
- If the message is clean, say so — don't invent suggestions to fill space

## Output Format

**Errors** (if any) — Issues that should be fixed:

- Quote or location → Fix → Why

**Improvements** (if any) — Optional suggestions:

- Quote or location → Suggestion → Why

One-line overall assessment. Omit empty sections.

**Updated version** — Full message with all fixes and improvements applied. Preserve original formatting and structure. If the message is clean with no changes, skip this section.

## Verification

- [ ] Author's voice and tone preserved
- [ ] Checkable facts verified (web search if uncertain)
- [ ] Errors distinguished from improvements
- [ ] No suggestions that just rephrase without fixing a problem
- [ ] Clean messages acknowledged as clean — no invented suggestions
