---
name: validate-note
description: Analyze notes for quality, accuracy, and completeness. Use when asked to validate, review, check, or improve a personal knowledge base note.
---

# Note Validator

Validate all notes provided by the user. Analyze each note for quality, completeness, and relevance — and suggest important missing parts that would make the note more valuable.

These are personal knowledge base notes — optimize for the author's future reference, not for publication. Focus on issues that would mislead or fail future-you; skip nitpicks.

Your goal is to provide a list of improvements, suggestions, and information updates. For every note, also identify important topics or sections that are absent but would significantly improve the note's usefulness.

## Analysis Criteria

1. **Factual Accuracy**:
    - Are there statements that are incorrect regardless of when they were written (misunderstandings, wrong numbers, flawed reasoning)?
    - Flag claims that contradict well-established knowledge.

2. **Information Actualization**:
    - Flag claims that are time-sensitive or likely to have changed (versions, best practices, APIs, ecosystem standings).
    - Use web search to verify when uncertain — do not guess or hallucinate corrections.
    - If you cannot verify, say so explicitly rather than assuming the note is outdated.

3. **Completeness & Depth**:
    - What key perspectives or details are missing?
    - Are there unanswered questions or logical gaps?
    - What important sections, concepts, or context would a reader expect to find but is absent?

4. **Missing Parts** (always run this step):
    - Suggest concrete additions that would make the note more complete.
    - Include missing prerequisites, related concepts, caveats, examples, or references.

5. **Suggestions for Improvement**:
    - How can the note be made more useful or actionable?
    - Are there related topics or resources that should be linked or mentioned?

6. **Clarity & Structure** (Secondary):
    - Is the note easy to understand?
    - Are the main points distinct?

## Formatting Rules

- Use **lists** for all structured content — never tables.
- Nested lists are allowed for sub-points.

## Output Format

For each finding, produce a bullet with:

- Summary of the issue → Suggested fix or action

Example:

- "React 17 is the latest version" → Update to reflect React 19; note key changes (compiler, server components)

Group bullets by category in the order listed above. Omit categories with no findings.

Always include a **Missing Parts** section, even if the note is otherwise accurate — every note has room to grow.

End with a one-line overall assessment.
