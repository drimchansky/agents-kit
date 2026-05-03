---
name: translate
description: Use when asked to translate text from one language to another.
argument-hint: '[target language] [text]'
disable-model-invocation: true
---

# Translate

## Rules

1. **Context First**: Don't translate literally; translate the _meaning_.
2. **Tone Matching**: If the source is casual, the target must be casual.
3. **Alternative Options**: If a phrase is ambiguous, provide the 2 best variations.

## Verification

- [ ] Meaning translated, not literal words
- [ ] Tone matches the source
- [ ] Ambiguous phrases have alternative options provided
- [ ] Domain-specific terms translated correctly for the context
