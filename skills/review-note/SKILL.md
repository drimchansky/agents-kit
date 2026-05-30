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

---

## Output Format

Start each note's findings with:

> **Note:** [inferred purpose in one sentence]

Then for each finding, produce a bullet:

- Summary of the issue → Suggested fix or clarification

Group bullets by category in the order above. Omit categories with no findings — except **Completeness & Missing Parts** and **Clarifications for Deeper Understanding**, which always appear (they exist to push the note further, not to catch errors).

End with a one-line overall assessment.

---

## Don't Rationalize

- "The note reads well" — Reading well isn't accuracy or depth. Verify each load-bearing claim and look for the missing "why".
- "I'm sure this is right from training" — Doesn't count for time-sensitive claims. Web search and cite.
- "No issues found, all good" — Always check Completeness and Clarifications. There's always room to deepen understanding.
- "The fix is obvious, I'll just rewrite the section" — No. This skill proposes; the user authorizes edits.
- "Adding more detail is always better" — No. Calibrate to note purpose. A cheatsheet bloated with prose stops being a cheatsheet.

---

## Example 1 — Technical

**Input note:** "React useEffect runs after every render by default. Pass an empty array [] to run only on mount."

---

**Note:** Quick reference cheatsheet for React's useEffect hook.

**Completeness & Missing Parts**

- No mention of cleanup function → Add: return a cleanup function to avoid memory leaks (clearing timers, cancelling subscriptions)
- Missing: dependency array gotchas (stale closures, object identity) → Add a brief warning with an example

**Clarifications for Deeper Understanding**

- Missing "why": useEffect exists because React's render must be pure — side effects belong outside render. Adding this reframes the hook as "the escape hatch for side effects" rather than "a thing that runs after render."
- Distinction the note conflates: "runs on mount" with empty array vs. "runs once per component instance" — they differ under Strict Mode (double-invoke in dev). Worth flagging.
- Adjacent idea: contrast with `useLayoutEffect` (synchronous, before paint) — naming the contrast clarifies when to reach for which.

**Learning Curve**

- Key takeaway buried → Surface: "Omitting the dependency array = runs every render (usually a bug)"
- Quiz prompts → "Why does React require effects outside render?" / "When do you need a cleanup function, and what happens without one?"

_Overall: Accurate but minimal — adding the cleanup, dependency gotchas, and the "why effects exist" framing would turn this from a fact-recall card into a working mental model._

---

## Example 2 — Non-technical

**Input note:** "The Stoics taught that we can't control external events, only our reactions. Marcus Aurelius wrote *Meditations* as a personal journal."

---

**Note:** Quick-reference summary of core Stoic ideas and the origin of *Meditations*.

**Factual Accuracy**

- "Marcus Aurelius wrote *Meditations*" → Accurate that he wrote it, but the title is editorial; the original (in Greek) was *Ta eis heauton* ("To Himself"). Worth a parenthetical note for accuracy.
- "Stoics taught… we can't control external events, only our reactions" → The clearest formulation of this is Epictetus's *dichotomy of control* (Enchiridion, Ch. 1), not Marcus or the early Stoics broadly. Attribute it.

**Completeness & Missing Parts**

- No mention of the three core Stoic disciplines (judgment, desire, action) — these are how the dichotomy gets operationalized → Add a sentence linking the principle to practice
- Missing the major figures beyond Marcus (Epictetus, Seneca, Chrysippus) → Add a one-line who's-who so future-you doesn't conflate them

**Clarifications for Deeper Understanding**

- Missing "why": the dichotomy isn't a self-help slogan — it follows from the Stoic view that virtue is the *only* good. If only virtue is good, and virtue lives in our judgments, then externals are "indifferents." Flagging this reframes the principle as a *consequence* of a metaphysical claim, not a free-standing tip.
- Distinction the note risks conflating: Stoic *apatheia* (freedom from destructive passions) is not modern "apathy" (indifference, lack of caring). Stoics still valued *eupatheia* — healthy emotions like joy and reasoned wishing. Worth a sentence.
- Strongest objection worth naming: critics (ancient and modern) argue the dichotomy understates the social/political dimension — what we can influence collectively. Marcus himself, as emperor, clearly didn't think externals were purely irrelevant. Acknowledging this prevents a flat reading.
- Adjacent idea: contrast with Epicureanism (also seeks tranquility, but via avoidance of pain rather than virtue) — names the comparison Stoicism is most often muddled with.

**Maintenance Health**

- Note is durable (philosophy doesn't version), but consider a link to a canonical translation (Hays for *Meditations*, Hard for Epictetus) so future-you can chase down passages.

**Learning Curve**

- Prerequisites are fine (none assumed) — appropriate for an intro note
- Key takeaway buried → Surface: "Virtue is the only good; externals are indifferents — the dichotomy of control follows from that."
- Practice hook → Pick one frustration from this week and run it through the dichotomy: which part was up to you, which wasn't?
- Quiz prompts → "Why, in Stoic terms, would the dichotomy of control follow from the claim that virtue is the only good?" / "How does Stoic *apatheia* differ from modern apathy?"

_Overall: Correct in spirit but loses precision on attribution and the underlying metaphysics — small additions would turn a slogan-level note into a real working model of the position._

---

## Verification

- [ ] Note purpose inferred and stated
- [ ] Factual claims verified (web search for uncertain or time-sensitive ones); citations included
- [ ] Completeness section always present
- [ ] Clarifications for Deeper Understanding section always present
- [ ] Findings are actionable — each has a suggested fix or clarification
- [ ] Learning Curve included (unless clearly inapplicable to note type)
- [ ] Assessment calibrated to note type (cheatsheet vs. deep-dive vs. summary vs. glossary)
- [ ] Note file was **not** edited; fixes were proposed, not applied
