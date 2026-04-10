---
name: validate-note
description: Analyzes notes for quality, accuracy, and completeness. Use when asked to validate, review, check, update, expand, or improve a personal knowledge base note.
---

# Note Validator

Validate all notes provided by the user. When multiple notes are provided, produce a separate findings block per note, each with its own overall assessment.

These are personal knowledge base notes — optimize for the author's future reference, not for publication. Focus on issues that would mislead or fail future-you; skip nitpicks.

## Analysis Criteria

Work through every step for each note, in order.

### 1. Infer Note Purpose

Before analyzing, identify what kind of note this is — cheatsheet, deep-dive study note, decision record, quick reference, troubleshooting guide, etc. State the inferred purpose in one sentence, then calibrate the analysis accordingly. A cheatsheet doesn't need the depth of a study note; a decision record should capture rationale, not tutorials.

### 2. Factual Accuracy

- Are there statements incorrect regardless of when written (misunderstandings, wrong numbers, flawed reasoning)?
- Flag claims that contradict well-established knowledge.

### 3. Information Actualization

- Flag claims that are time-sensitive or likely to have changed (versions, best practices, APIs, ecosystem standings).
- Use web search to verify when uncertain — do not guess or hallucinate corrections.
- If you cannot verify, say so explicitly rather than assuming the note is outdated.
- When citing a correction from web search, include the source URL or note it as unverified.

### 4. Completeness & Missing Parts

Always run this step — every note has room to grow.

- What internal gaps exist? (unanswered questions, logical jumps, unstated assumptions)
- What additive content is absent but expected for this note type? (prerequisites, caveats, examples, edge cases, references)
- What sections would a reader expect to find but are missing?

### 5. Maintenance Health

Long-term maintainability — will this note age well?

- **Date-agnostic language** — Prefer anchoring to concepts over version numbers when the version isn't essential (e.g., "React's compiler (v19+)" over "React 19's new compiler"). Reserve specific versions for when they're load-bearing.
- **Staleness signals** — Version numbers, dates, or ecosystem claims that will age badly. Suggest annotating them (e.g., "as of v5", "verify before using").
- **Structural modifiability** — Can individual sections be updated independently? Flag monolithic prose that tangles multiple concerns — modular structure ages better.
- **Scope creep** — Is the note trying to cover too much? Flag if it should be split into multiple focused notes.
- **Linkability** — Are there obvious related concepts or notes that should be cross-referenced?
- **Update triggers** — What events (new version release, API change, ecosystem shift) should prompt a revisit?

### 6. Learning Curve

Turn the note into an active learning tool.

- **Prerequisites** — What should the reader already know? Flag if unstated and non-obvious.
- **Key takeaways** — Are the 2–3 most important insights clearly surfaced, or buried in detail?
- **Practice hook** — Suggest one hands-on exercise or real-world scenario where this knowledge applies.
- **Quiz prompts** — Suggest 1–2 self-test questions suitable for spaced repetition.

### 7. Suggestions for Improvement

- How can the note be made more useful or actionable?
- Are there related resources worth linking?

---

## Formatting Rules

- Use **lists** for all structured content — never tables.
- Nested lists are allowed for sub-points.

---

## Output Format

Start each note's findings with:

> **Note:** [inferred purpose in one sentence]

Then for each finding, produce a bullet:

- Summary of the issue → Suggested fix or action

Group bullets by category in the order above. Omit categories with no findings — except **Completeness & Missing Parts**, which always appears. Include **Learning Curve** unless the note type makes it clearly inapplicable (e.g., a 2-line quick reference).

End with a one-line overall assessment.

---

## Example

**Input note:** "React useEffect runs after every render by default. Pass an empty array [] to run only on mount."

---

**Note:** Quick reference cheatsheet for React's useEffect hook.

**Information Actualization**

- React 19 introduced the compiler which may eliminate many useEffect patterns → Note that useEffect usage is evolving; link to React 19 compiler docs (unverified — verify at react.dev)

**Completeness & Missing Parts**

- No mention of cleanup function → Add: return a cleanup function to avoid memory leaks (e.g., clearing timers, cancelling subscriptions)
- Missing: dependency array gotchas (stale closures, object identity) → Add a brief warning with example

**Maintenance Health**

- No version context → Annotate with "as of React 18"; update trigger: React 19 compiler GA

**Learning Curve**

- Key takeaway buried → Surface: "Omitting the dependency array = runs every render (usually a bug)"
- Quiz prompts → "What happens if you omit the dependency array?" / "When do you need a cleanup function?"

_Overall: Accurate but minimal — adding cleanup, dependency gotchas, and a version note would make this significantly more reliable as a reference._

## Verification

- [ ] Note purpose inferred and stated
- [ ] Factual claims verified (web search for uncertain ones)
- [ ] Completeness section always present
- [ ] Findings are actionable — each has a suggested fix
- [ ] Learning Curve included (unless clearly inapplicable)
- [ ] Assessment calibrated to note type (cheatsheet vs. deep-dive vs. decision record)
