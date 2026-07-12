---
name: review-note
description: Use when asked to review, validate, check, expand, or improve a personal knowledge base note on any subject. Surfaces inaccuracies, gaps, and clarifications that deepen the author's understanding of the topic. Proposes fixes; does not edit the note.
argument-hint: '[note file path or pasted text]'
disable-model-invocation: true
---

# Review Note

Review the notes provided by the user. These are personal knowledge base notes on any subject — programming, history, philosophy, science, language learning, finance, cooking, anything. Optimize feedback for the author's future reference and deeper understanding of the topic, not for publication polish.

When multiple notes are provided, produce a separate findings block per note, each with its own overall assessment.

This skill **does not modify the note**. The deliverable is an assessment in chat — fixes are proposed, not applied. If the user, after seeing the findings, explicitly asks for changes ("apply the fixes", "rewrite section X"), then edit the file and only the parts the user authorized.

## Analysis Criteria

Work through every step for each note, in order.

### 1. Infer Note Purpose

Before analyzing, identify what kind of note this is — cheatsheet, deep-dive study note, decision record, quick reference, troubleshooting guide, glossary, summary of a book/paper, language flashcard set, etc. State the inferred purpose in one sentence, then calibrate the analysis accordingly. A cheatsheet doesn't need the depth of a study note; a glossary should be ruthlessly concise; a summary should preserve the source's emphasis.

### 2. Factual Accuracy

- Are there statements that are wrong regardless of when written — misunderstandings, wrong numbers, misattributed quotes, flawed reasoning?
- Flag claims that contradict well-established knowledge in the subject.
- For technical claims, trace through the logic; for historical/scientific claims, check against established consensus.

### 3. Information Actualization

- Flag claims that are time-sensitive or likely to have changed (software versions, APIs, best practices, current laws/policies, ecosystem standings, recent research consensus).
- Use web search to verify when uncertain — do not guess or hallucinate corrections.
- If you cannot verify, say so explicitly rather than assuming the note is outdated.
- When citing a correction from web search, include the source URL or note it as unverified.
- For severity-critical corrections (security vulnerabilities, safety issues, breaking changes), cite the primary source — vendor advisory, CVE record, official release notes — not a secondary aggregator that happens to mention it.

### 4. Completeness & Missing Parts

Always run this step — every note has room to grow.

- What internal gaps exist? (unanswered questions, logical jumps, unstated assumptions, missing definitions)
- What additive content is absent but expected for this note type? (prerequisites, caveats, counterexamples, edge cases, references, attribution)
- What sections would a reader expect to find but are missing?

### 5. Clarifications for Deeper Understanding

The core of this skill. Push past surface-level coverage toward the conceptual model the note is really pointing at.

- **Why does this work / why is this true?** — If the note states a fact or rule without the underlying mechanism or rationale, surface the missing "why". A note that says *what* without *why* memorizes; one that includes *why* understands.
- **What's the distinction the author might be missing?** — Concepts that look similar but aren't (e.g., correlation vs. causation, syntax vs. semantics, Stoic apatheia vs. modern "apathy"). Flag conflations.
- **What's the next layer down?** — If the note operates at one level of abstraction, point at the layer beneath it that would deepen understanding. (e.g., a note on `useEffect` could deepen via "what problem does React's reconciliation solve that necessitates effects?")
- **Where does this connect to adjacent ideas?** — Concepts in the same subject area whose connection would illuminate the current topic. Don't force connections; only flag ones that genuinely strengthen the model.
- **What's the strongest objection or counterexample?** — A claim well understood survives contact with its strongest objection. If the note presents a view without acknowledging the most serious challenge to it, name that challenge.

### 6. Maintenance Health

Long-term maintainability — will this note age well?

- **Date-agnostic language** — Prefer anchoring to concepts over specific versions/dates when not load-bearing. Reserve specifics for when they matter.
- **Staleness signals** — Version numbers, dates, or "current state" claims that will age badly. Suggest annotating them (e.g., "as of v5", "as of 2025", "verify before relying on").
- **Structural modifiability** — Can individual sections be updated independently? Flag monolithic prose that tangles multiple concerns.
- **Scope creep** — Is the note trying to cover too much? Flag if it should be split into multiple focused notes.
- **Linkability** — Are there obvious related notes or external resources that should be cross-referenced?
- **Update triggers** — What events (new version release, law change, new edition of a book, ecosystem shift) should prompt a revisit?

### 7. Learning Curve

Turn the note into an active learning tool. Skip this section if the note type makes it clearly inapplicable (e.g., a 2-line quick reference, a glossary entry).

- **Prerequisites** — What should the reader already know? Flag if unstated and non-obvious.
- **Key takeaways** — Are the 2–3 most important insights clearly surfaced, or buried in detail?
- **Practice hook** — Suggest one concrete way to engage with the material: a hands-on exercise, a thought experiment, a real-world scenario, a passage to re-read, a problem to solve.
- **Quiz prompts** — Suggest 1–2 self-test questions suitable for spaced repetition. Phrase them so the answer requires understanding, not just recall.

### 8. Suggestions for Improvement

- How can the note be made more useful or actionable for future-you?
- Are there related resources (primary sources, canonical references, better explanations) worth linking?

---

## Formatting Rules

- Use **lists** for all structured content — never tables (they wrap badly in narrow terminals and resist clean line-by-line diffs).
- Nested lists are allowed for sub-points.
- Quote the note's exact wording when flagging a specific claim, so the author can locate it.
- Quote the proposed text too — whether it replaces something wrong or adds something missing, give the literal words to use, not a description of them.
- Write the findings — and especially the proposed **Replace with:** / **Add:** text, which is pasted verbatim into the note — in the note's own language. Quoted source passages stay in their original language, with a brief translation when it differs.

---

## Output Format

Start each note's findings with:

**Note:** [inferred purpose in one sentence]
**Priority:** [the 2–3 findings worth fixing first, named briefly — a triage pointer, distinct from the overall assessment at the end]

Skip the Priority line when there are only a couple of findings total — everything's already in view.

Then for each finding, produce a bullet in one of two shapes:

- Something in the note is wrong → quote the exact wrong text, then **Replace with:** [the corrected sentence or passage, verbatim]
- Something the note lacks entirely → name the location or gap, then **Add:** [the exact sentence or passage to insert, verbatim]

Both sides of the arrow are literal, quoted, copy-pasteable wording — never a description of the fix ("clarify the wording," "add a caveat about X") standing in for the words themselves. Match the note's own formatting (e.g. italics on a title) in the proposed text.

When the proposed text is more than one line — a new subsection, a multi-item list — drop the inline quotes and set it as a blockquote on the lines beneath the bullet, so line breaks stay real line breaks instead of being escaped into one string:

- Gap description → **Add:**
  > ### Heading
  > First sentence of the new content.
  > - a sub-point
  > - another sub-point

Never write `\n` inside a quoted string to fake a line break, and never let a quote mark span across list items from the outside — once content needs its own lines, give it its own lines.

Append a trailing why — a dash after the closing quote — only when it carries something the pasted text itself can't hold, such as a source URL backing a web-verified correction (Information Actualization). Skip it otherwise; a self-explanatory sentence doesn't need to be re-explained next to itself. The why always trails the proposed text, never precedes it: the left side of the arrow holds only the quote (for a correction) or the gap name (for an addition), nothing more — if the wrongness needs explaining, that explanation goes after the replacement, not stacked in front of the quote.

A bullet that finds a dimension already sound states so in plain prose, with no **Replace with:** / **Add:** — the two shapes above apply only to actual findings.

Group bullets by category in the order above. Omit categories with no findings — except **Completeness & Missing Parts** and **Clarifications for Deeper Understanding**, which always appear (they exist to push the note further, not to catch errors).

End with a one-line overall assessment, then invite the user to reply with a category name (or "all") to apply those fixes to the note.

---

## Don't Rationalize

- "The note reads well" — Reading well isn't accuracy or depth. Verify each load-bearing claim and look for the missing "why".
- "No issues found, all good" — Always check Completeness and Clarifications. There's always room to deepen understanding.
- "Adding more detail is always better" — No. Calibrate to note purpose. A cheatsheet bloated with prose stops being a cheatsheet.
- "The idea is clear enough without spelling out the exact wording" — No. Write the literal sentence or passage. A description of a fix ("clarify the wording," "add a caveat about X") isn't a fix — it hands the writing back to the author, the opposite of proposing one.

---

## Example

**Input note:** "React useEffect runs after every render by default. Pass an empty array [] to run only on mount. Effects run before the browser paints, so they're a safe place to measure layout."

---

**Note:** Quick reference cheatsheet for React's useEffect hook.
**Priority:** the runs-before-paint correction, the missing cleanup-function guidance, and the dependency-array reference-equality gotcha.

**Factual Accuracy**

- "Effects run before the browser paints, so they're a safe place to measure layout" → **Replace with:** "useEffect runs *after* the browser paints. To measure layout before paint — avoiding a visible flicker — use `useLayoutEffect`, its synchronous sibling."

**Completeness & Missing Parts**

- No mention of a cleanup function → **Add:** "If the effect creates a subscription, timer, or listener, return a cleanup function that tears it down — otherwise it leaks on unmount or re-fires before the previous one was cleaned up."
- No warning about dependency array gotchas → **Add:** "Every value the effect reads from component scope (props, state, functions) belongs in the dependency array, or the effect closes over a stale value. Objects and arrays are compared by reference, so `useEffect(() => {...}, [options])` re-runs every render if `options` is a fresh object literal each time, even when its contents haven't changed."

**Clarifications for Deeper Understanding**

- No explanation of why effects exist → **Add:** "Effects exist because React's render function must stay pure — no side effects during render. useEffect is the escape hatch for anything that touches the outside world (network calls, subscriptions, manually changing the DOM), run safely after React has committed the result to the screen."
- No caveat that "run only on mount" means once per mount, not once ever → **Add:** "In React 18 Strict Mode (development only), components mount, unmount, and remount immediately, so an empty-array effect actually runs twice on mount, not once — don't rely on mount-count assumptions without accounting for this."

**Learning Curve**

- Prerequisites are fine (none assumed) — appropriate for a quick reference; no fix needed.
- Key takeaway buried in prose → **Add:** "Omitting the dependency array means the effect re-runs after every render — usually a bug, not an intentional choice."
- No self-test questions → **Add:** "Why does React require effects to run outside of render?" and "When do you need a cleanup function, and what happens if you omit one?"

_Overall: One wrong claim and otherwise minimal — fixing the paint-timing error and adding the cleanup, dependency, and "why effects exist" material would turn this from a fact-recall card into a working mental model._

Reply with a category name or "all" to apply those fixes to the note.

---

## Verification

Confirm before finishing:

- [ ] Note purpose inferred and the analysis calibrated to it; factual and time-sensitive claims verified with citations (primary sources for severity-critical corrections)
- [ ] Completeness and Clarifications sections always present; Learning Curve unless clearly inapplicable
- [ ] Every finding proposes literal text (**Replace with:** / **Add:**) in the note's own language, multi-line proposals as blockquotes, any why trailing the proposed text
- [ ] Assessment ends with the invitation to reply with a category name (or "all")
- [ ] Note file **not** edited — fixes proposed, not applied
