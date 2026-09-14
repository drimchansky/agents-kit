---
name: review-note
description: Use when asked to review, validate, check, expand, or improve a personal knowledge base note on any subject. Surfaces inaccuracies, gaps, and clarifications that deepen the author's understanding of the topic. Proposes fixes; does not edit the note.
argument-hint: '[note file path or pasted text]'
---

# Review Note

Review each note for the author's future reference and understanding, calibrated to its purpose. Return a separate findings block and overall assessment per note. Propose fixes in chat; edit only on an explicit follow-up after the findings, within the authorized scope.

## Analysis Criteria

Work through these in order for each note.

### 1. Infer Note Purpose

State its purpose in one sentence, then calibrate depth: a cheatsheet stays concise, a study note explains mechanisms, a summary preserves source emphasis.

### 2. Factual Accuracy

Check load-bearing claims, numbers, attribution, and reasoning. Trace technical logic and compare historical/scientific statements with established knowledge.

### 3. Information Actualization

Identify time-sensitive claims and verify uncertainty through web sources. Do not guess corrections or assume an unverifiable note is outdated; state the limitation. Link sources for web corrections or mark them unverified. Safety, security, and breaking-change corrections require primary sources such as advisories or official release notes.

### 4. Completeness & Missing Parts

Always examine internal gaps, unstated assumptions, missing definitions, prerequisites, caveats, counterexamples, references, attribution, and expected sections. Match additions to the note's purpose.

### 5. Clarifications for Deeper Understanding

Always look for missing mechanisms, conflated concepts, the useful layer beneath an abstraction, illuminating adjacent ideas, and the strongest objection/counterexample. Suggest depth that strengthens understanding without bloating the note.

### 6. Maintenance Health

Prefer durable conceptual wording unless a version/date matters. Annotate time-sensitive claims with their scope and revisit triggers. Check independently editable sections, excessive scope, missing cross-references, and events that should prompt an update.

### 7. Learning Curve

Skip only when clearly inapplicable, such as a two-line reference or glossary entry. Otherwise check prerequisites and 2–3 key takeaways; suggest one concrete practice activity and 1–2 understanding-based self-test questions.

### 8. Suggestions for Improvement

Suggest ways to improve future usefulness and relevant primary sources, canonical references, or clearer explanations.

---

## Formatting Rules

Use lists, including nested lists when helpful; no tables. Quote the note's exact claim and literal replacement/addition. Write findings and proposed text in the note's language, matching its formatting. Source quotations retain their language with a brief translation when different.

---

## Output Format

Open each block with **Note:** and the inferred purpose. Add **Priority:** naming the top 2–3 fixes unless only a couple of findings exist.

- For wrong text: exact quoted claim → **Replace with:** literal corrected wording.
- For missing content: location/gap → **Add:** literal insertable wording.

Do not substitute descriptions such as “clarify this” for the actual words. Multiline proposals use blockquotes below the bullet, preserving real line breaks and lists. Never fake newlines with `\n` or wrap several list items in one outside quote.

- Gap description → **Add:**
  > ### Heading
  > New content.
  > - Supporting point.

Put any necessary explanation or source URL after the proposed text, not before the claim. Omit explanations already conveyed by the proposal. Sound dimensions get plain prose without Replace with/Add.

Group findings in analysis order; omit empty categories except Completeness & Missing Parts and Clarifications for Deeper Understanding, which always appear. Include Learning Curve unless clearly inapplicable. End with one-line overall assessment and an invitation to name a category or “all” to apply fixes.

---

## Example

**Input note:** “A square has three equal sides.”

**Note:** Quick reference for recognizing squares.

**Priority:** Correct the square definition, add perimeter units, and distinguish squares from other rectangles.

**Factual Accuracy**

- “A square has three equal sides.” → **Replace with:** “A square has four equal sides and four right angles.”

**Completeness & Missing Parts**

- No units for perimeter → **Add:** “Perimeter uses the same length unit as the sides.”

**Clarifications for Deeper Understanding**

- No contrast with rectangles → **Add:** “Every square is a rectangle; a rectangle with unequal adjacent sides is not a square.”

Overall: Correct the definition and add the two clarifications for a usable quick reference.

Reply with a category name or “all” to apply those fixes to the note.
