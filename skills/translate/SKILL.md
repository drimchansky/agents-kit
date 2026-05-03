---
name: translate
description: Use when asked to translate text from one language to another.
argument-hint: '[target language] [text]'
disable-model-invocation: true
---

## Core Rules

Before doing anything else in this skill:

1. Read the sibling file `./AGENTS.md` (relative to this `SKILL.md`).
2. Apply the rules it defines for the rest of this skill's execution.
3. Output the following line verbatim to the user as a visible confirmation, **before** any other text or tool calls in this skill, on its own line:

    ✅ Core rules applied (./AGENTS.md)

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

## Rules

1. **Context First**: Don't translate literally; translate the _meaning_.
2. **Tone Matching**: If the source is casual, the target must be casual.
3. **Alternative Options**: If a phrase is ambiguous, provide the 2 best variations.

## Verification

- [ ] Meaning translated, not literal words
- [ ] Tone matches the source
- [ ] Ambiguous phrases have alternative options provided
- [ ] Domain-specific terms translated correctly for the context
