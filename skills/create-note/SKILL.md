---
name: create-note
description: Use when asked to create, write, or compose a personal knowledge base note on a topic — researches the best available information and distills it into a compact, self-contained learning note with verified external sources.
argument-hint: '[topic] [optional target file path]'
disable-model-invocation: true
---

# Create Note

Research a topic and distill it into a personal knowledge base note the author will **learn from**: compact, self-contained, and grounded in sources actually verified during the run. Topics can be anything — programming, history, philosophy, science, language learning, finance, cooking.

This is the generative twin of `review-note`: a note produced here should already pass a `/review-note` audit on the day it's written. Same bar, applied at creation time — every rule gets its "why", lookalike concepts get distinguished, volatile claims get date-anchored, and the note ends with links worth following and questions worth re-asking.

## Hard rules

- **Every link in the note was fetched during this run.** Never emit a URL from memory — remembered links rot, move, and hallucinate. If you didn't fetch and read the page, it doesn't go in the note.
- **Calibrated verification.** Always search — even on familiar topics — to find the canonical sources and check emphasis. Verify load-bearing and time-sensitive claims (versions, APIs, laws, prices, current status, recent research) against fetched pages. Stable fundamentals (settled math, history, long-settled concepts) may rest on training knowledge; when in doubt, verify or mark the claim unverified.
- **Prefer primary and canonical sources for claims.** Official docs, standards, the original paper or book. For the "Going deeper" links, the best *teaching* resource wins — a secondary explainer may beat the primary source for learning; link it, and label each link's role (primary source vs. explainer vs. reference).
- **Keep the source's hedges.** If a source says "around 40%" or "reportedly", the note doesn't upgrade that to certainty.
- **Write the note in the language of the request.** Quoted passages stay in their original language, with a brief translation when it differs.
- **Compact is the feature.** Default study note: ~400–800 words (3–5 min read). The note holds the working model; depth lives in the links. Cheatsheets and glossary entries run much tighter.
- **Lists, never tables** — in the note and in chat (tables wrap badly in narrow terminals and resist clean line-by-line diffs).

## Process

### 1. Scope

If the topic is broad or the angle ambiguous ("Kubernetes", "Stoicism"), ask up to three scoping questions before researching: intended use (first contact? working reference? interview prep?), the specific angle, and desired depth. A well-scoped topic ("useEffect cleanup semantics") goes straight through.

Infer the note type — study note (default), cheatsheet, book/paper summary, glossary entry — and calibrate structure and size to it.

### 2. Destination

- Path given in the arguments → that's the target. If the file already exists, read it and ask whether to update it or write elsewhere — never silently overwrite.
- No path → ask where to save before researching, suggesting `<kebab-case-topic>.md` in the folder the user's notes live in, if known. Batch this with the scoping questions — one interruption, not two.
- If the destination folder is known, glance for an existing note on the same topic and offer to update it instead of creating a twin.

### 3. Research

- Start where the canon is: official docs, the original paper or book, the standard, the recognized textbook treatment. Search wide enough to know what the *best* sources are, not just the first ones.
- Fetch and read every page you intend to link. Snippets lie — read enough to confirm the page says what you'll claim it says. For each keeper, record the URL, author/publisher, date if visible, and its role (evidence for a claim / best explainer / reference).
- Chase the **why** behind every rule and fact — the mechanism or rationale. If sources state the what without the why, dig one layer deeper; the why is what turns a note from an incantation into a model.
- Collect along the way (these come from research, not invention):
  - distinctions from lookalike concepts people conflate
  - the strongest objection or counterexample the position must survive
  - genuine connections to adjacent ideas — only ones that illuminate
- Where trustworthy sources disagree, the disagreement is content — it goes in the note, attributed, not silently resolved.

### 4. Distill

Select ruthlessly. Every sentence earns its place by changing understanding or future action; when tempted to include more, link instead. If the material genuinely can't fit the size target, the scope is wrong — narrow it (ask), or propose splitting into multiple notes. No padding, no encyclopedic completeness.

### 5. Compose

Default skeleton — drop sections the note type makes inapplicable (a cheatsheet might keep only the TL;DR, core, pitfalls, and links):

```markdown
# <Topic>
> TL;DR — the working model in 2–3 sentences.

## Key takeaways
The 2–3 insights that matter most, stated as claims — not topic labels.

## Prerequisites
Only when non-obvious: what the reader must already have.

## Core model
The *what* and the *why* — every rule with its mechanism or rationale.

## Distinctions & pitfalls
Lookalike concepts, common conflations, gotchas.

## Connections
Adjacent ideas that illuminate this one. Only genuine ones.

## Strongest objection
The most serious challenge, and how the position survives it — or doesn't.

## Going deeper
Annotated links — each with what it is and why it's the one to read.

## Self-test
2–3 prompts whose answers require understanding, not recall.

_Created <today> · sources fetched <today> · revisit when: <update trigger>_
```

Composition rules:

- Date-anchor volatile claims in place ("as of v5", "as of 2026-07"); prefer date-agnostic, concept-anchored phrasing when the specific version isn't load-bearing.
- Keep sections independently updatable — no monolithic prose tangling several concerns.
- The footer's "revisit when" names the concrete event that should trigger a re-check (new major release, law change, new edition); drop it for durable topics.

### 6. Self-audit

Before delivering, run the note against `review-note`'s criteria yourself (apply its bar; don't invoke the skill): factual accuracy, the missing-why test, completeness for the note type, distinctions/objection/connections present or consciously N/A, learning curve (takeaways surfaced, self-test present), maintenance health (date anchors, update trigger), size within target. Fix what fails before writing the file.

### 7. Deliver

Write the file. In chat, report — don't paste the note:

- **Note** — path, type, word count
- **Verified** — load-bearing claims checked against fetched sources, with URLs
- **On training knowledge** — what rests on stable fundamentals
- **Flags** — anything unverifiable, disputed between sources, or notably time-sensitive

A handful of lines; the note is the deliverable. Mention that `/review-note <path>` is available for an independent pass later, once the note has aged or been edited.

## Don't rationalize

- "Wikipedia is a fine link" — It's a lead. Follow its citations and link the primary source or the best explainer; link the wiki article itself only when it's genuinely the best overview available, labeled as one.
- "More detail makes a better note" — The size cap is the feature; every extra paragraph taxes future rereads. Link instead.
- "The why is obvious" — Then it costs one sentence. Unstated whys are how notes decay into incantations.
- "The topic doesn't fit one page" — Then the scope is wrong, not the cap. Narrow or split; ask.
- "Skip the self-test / objection, the user didn't ask for them" — The skeleton is the ask. Drop a section only when the note type makes it inapplicable, not to save effort.

## Example

**Request:** `/create-note spaced repetition notes/spaced-repetition.md`

Topic is well-scoped and a path was given — no questions needed. After researching (fetching, say, a meta-analysis on distributed practice, an authoritative explainer, and a scheduler's docs), the note comes out like this (abridged to keep the example short — a real study note runs ~400–800 words):

```markdown
# Spaced repetition
> Reviewing material at increasing intervals, timed just before you'd forget,
> beats massed review for long-term retention — because effortful retrieval
> strengthens memory more than re-reading does.

## Key takeaways
- The benefit comes from *retrieval effort*: recalling almost-forgotten
  material strengthens it more than reviewing fresh material.
- Spacing is a schedule, not an app — any system that brings items back
  at growing intervals qualifies.

## Core model
- Forgetting follows a decay curve (Ebbinghaus, 1885); each successful
  recall flattens it, so the next review can wait longer.
- Reviews are timed for *desirable difficulty* — hard enough to require
  effort, early enough to still succeed. That's why cramming feels
  productive but decays fast: recognition is easy, so it strengthens little.

## Distinctions & pitfalls
- Spaced repetition ≠ spaced *practice* of skills — the evidence here is
  for recall of discrete facts; motor and skill learning schedules differ.
- Recognizing a card is not recalling it — grade honestly or intervals inflate.

## Strongest objection
The effect is strongest for isolated facts; understanding of connected
systems benefits less, and card-making can displace real study.
Mitigation: make cards *after* understanding, encoding whys, not just terms.

## Going deeper
- [Cepeda et al. 2006 meta-analysis](…fetched URL…) — the evidence for
  distributed practice across hundreds of comparisons (primary source).
- [Gwern, "Spaced Repetition for Efficient Learning"](…fetched URL…) — the
  best single explainer: history, math, and practice (explainer).
- [Anki manual, scheduling](…fetched URL…) — how a real scheduler
  implements the intervals (reference).

## Self-test
- Why does an *almost-failed* recall strengthen memory more than an easy one?
- What kind of material does spaced repetition help least, and why?

_Created 2026-07-10 · sources fetched 2026-07-10_
```

(URLs in a real run are pages fetched during that run — never reproduced from memory, including these.)

Chat report:

> **Note** — notes/spaced-repetition.md, study note, ~310 words
> **Verified** — spacing-effect evidence against the Cepeda et al. meta-analysis; scheduler behavior against the Anki manual
> **On training knowledge** — Ebbinghaus forgetting-curve history (stable)
> **Flags** — none; durable topic, no revisit trigger needed
>
> Run `/review-note notes/spaced-repetition.md` later for an independent pass.

## Verification

Confirm the hard rules held before finishing:

- [ ] Destination confirmed before writing; nothing silently overwritten
- [ ] Every link in the note fetched and read during this run — zero from-memory URLs
- [ ] Load-bearing and time-sensitive claims verified against fetched sources; hedges preserved; disagreements surfaced and attributed
- [ ] Every rule and fact carries its why; distinctions, strongest objection, and connections present or consciously N/A
- [ ] Volatile claims date-anchored, footer dated (revisit trigger when volatile); size within target
- [ ] Note written in the language of the request; no tables
- [ ] Chat report lists verified vs. training-knowledge claims and flags; note not pasted into chat
