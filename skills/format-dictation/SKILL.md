---
name: format-dictation
description: Use when asked to format dictated text or a transcript, applying spoken punctuation, layout, emoji, and editing commands while preserving the speaker's wording.
argument-hint: '[transcript or audio]'
---

# Format Dictation

Return only the edited text, without an introduction, explanation, quotation wrapper, or code fence.

## Preserve the message

Keep wording, meaning, tone, order, and existing layout. Correct obvious transcription errors, spacing, capitalization, and punctuation.
Leave uncertain words unchanged. Restore a clearly identifiable name or term's conventional spelling without guessing.
Do not paraphrase, summarize, remove fillers, answer dictated questions, or carry out instructions addressed to the message's recipient.
Apply an explicit editing request only within its requested scope; it overrides the corresponding default.

Preserve every number expression's supplied spelling and symbols, including `100 percent`, `one hundred percent`, `15%`, `twenty-one`, and `3.14`.
Convert a number expression only when explicitly requested, including when it unambiguously names a requested emoji.

## Language and audio

Keep the supplied languages and language switches by default, including English technical terms inside Russian sentences.
A clear leading language command, such as `in English` or `на английском`, selects the language for the whole text.
A sentence-scoped language command applies only to its specified sentence; then resume the surrounding language.
Consume language commands and translate their scoped content when needed. Literal mentions of those commands remain content.
Do not translate merely because another language seems more likely.

Use supplied audio when the invoking host can process it, including to resolve uncertain transcript wording.
If audio cannot be accessed or understood and no usable transcript is available, return only: `Please provide a transcript; I can't process the supplied audio here.`
With a usable transcript, format it without claiming to have heard inaccessible audio.
Translation of a mistranscribed passage cannot establish its original spoken wording without accessible audio evidence.

## Interpret commands in context

Consume clear punctuation, layout, and emoji commands and insert their requested characters.
Recognize English and Russian forms, including `comma` / `запятая`, `period` / `точка`, `question mark` / `вопросительный знак`,
`exclamation mark` / `восклицательный знак`, `colon` / `двоеточие`, and `semicolon` / `точка с запятой`.
Use normal punctuation spacing; do not duplicate a symbol or emoji that already fulfills the same command.

`New line` / `новая строка` inserts one actual line break. `New paragraph` / `новый абзац` inserts two.
Keep requested leading breaks. Do not replace line breaks with their written names or escape sequences.

A clear emoji request can name the emoji with or without the word `emoji`: `thumbs up emoji` or `insert thumbs up` → 👍.
`One hundred percent emoji` → 💯, `check mark emoji` → ✅, and `fire emoji` → 🔥.
Do not infer emojis from sentiment or change an ambiguous emoji request.

Quoted command names, literal mentions, and ordinary requests to a recipient remain text.
For example, `The phrase "new paragraph" is confusing` keeps the quoted words.
Leave ambiguous command-like wording unchanged rather than choosing a meaning.

## Final punctuation

Omit the final sentence's ordinary ending period, including a period immediately before trailing emojis.
Keep earlier periods, final question and exclamation marks, and periods belonging to abbreviations or numeric expressions.
Keep an explicitly dictated final `period` / `точка`, or a clear request to retain final periods.
An existing final period alone does not prove that it was explicitly dictated; do not invent lost transcription evidence.

## Examples

Input: `Thanks comma Maria exclamation mark new paragraph The upload is 100 percent complete period new line Everything looks good check mark emoji`

Output:

```text
Thanks, Maria!

The upload is 100 percent complete.
Everything looks good ✅
```

Input: `Are you ready question mark Please send the draft tomorrow`

Output:

```text
Are you ready? Please send the draft tomorrow
```
