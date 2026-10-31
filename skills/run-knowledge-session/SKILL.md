---
name: run-knowledge-session
description: Conduct a learning session scoped by the user's requested number of notes to revisit and new topics to explore. Select and fact-check notes, help update them, and suggest additional topics when requested. Use for recurring knowledge upkeep and guided study; a single-note audit belongs to review-note.
---

## Core Rules

Read and apply `./AGENTS.md` § *Ask Before Assuming*.
Read and apply `./references/workflow/user-facing-messages.md` § *Plain wording* only.

# Run Knowledge Session

Guide the user through the requested note reviews and new topics without a default duration.
Follow the user's pace across turns. Reading reviewed notes is valid participation; answers are not required to continue or complete a session.
Use recall questions or exercises only when requested. A prepared agenda is not a completed learning session.

## Resolve session scope

Resolve these inputs from the request and established preferences:

- Required: the number of existing notes to revisit; zero allows an exploration-only session.
- Optional: topic preferences or exclusions for selecting those notes.
- Required: the new topics to explore, an explicit choice of none, or a request for agent suggestions.
- Optional: whether the agent should suggest new topics; default to no suggestions when unspecified.

Ask for missing required inputs together before starting the agenda; do not ask again for information already supplied.
Do not substitute a time budget or a default note count for the requested scope.
Track completed and remaining notes and topics across turns, incorporating the user's scope changes.

## Resolve the collection

Use the notes directory supplied by the user or established in the conversation.
If it is missing or inaccessible, ask for the directory and continue only with available material.
Keep discovery inside that collection and any explicitly supplied learning history.
Exclude attachments, templates, and the session journal from study candidates.
Do not hardcode a user's vault path or require an Obsidian plugin.

Honor stated interests, exclusions, and learning goals, including preferences already established in the session.
Without review-topic preferences, select existing notes yourself rather than asking the user to nominate them.
Selection must work without note properties. Do not add or require `review_after` or a replacement due-date field.

## Select the session

Survey titles and topic distribution, then read candidate contents before selecting them.
Use an existing learning journal when known; otherwise look for `Knowledge Sessions.md` at the collection root.
Read recent outcomes and unresolved questions to avoid repeating successful sessions without a reason.
On a first session, use the collection itself and mark the learning history as unknown.

Choose the requested number of distinct existing notes.
If fewer suitable notes are available, explain the shortfall and ask whether to reduce the count or broaden the preferences.
Scope long notes to a named section; count each selected note once and make that scope visible in the agenda.
Supporting notes read for context and newly created notes do not count toward the requested reviews.
Rank candidates using:

- Relevance to the user's current interests or work, where that context is actually available.
- Previous recall difficulty, unresolved questions, contradictions, or missing prerequisites in the notes.
- Claims exposed to changing versions, standards, events, or evidence, and weak sourcing of consequential claims.
- Time since actual practice or verification, balanced with coverage of less-visited subjects.

Use `revised_at` with the journal's review scope when judging recency; missing metadata does not prove a note was never reviewed.
File modification time is only a discovery hint; it does not prove practice, verification, or obsolescence.
Note length, file count, and missing topics do not establish the user's competence.
Calibrate apparent gaps to the note's purpose: a reference card need not explain every mechanism.
Allow confident subjects to return when a harder application would deepen them.

## Prepare new topics

Include every user-requested new topic in the agenda; do not replace the list with one agent-selected question.
Read related notes to connect each topic to existing knowledge and avoid assuming it is entirely unfamiliar.
A new application or connection can qualify even when its terms already appear.

Only when suggestions are requested, propose directions from the notes and available user feedback; default to at most two:

- **Possible gap:** an unexplained prerequisite, unresolved contradiction, weak answer, or missing connection that limits another topic.
- **Strength extension:** a well-explained mechanism, successful application, or confident answer that supports a harder case or adjacent field.

Tie each suggestion to specific notes or user feedback and explain its expected value.
Treat gaps and strengths inferred from notes as hypotheses; distinguish an omission in writing from a gap in understanding.
Keep suggestions separate from the agreed agenda until the user selects them or explicitly delegates the choice.
Continue independent note reviews while a proposed topic is awaiting the user's choice.
When evidence is thin, offer an accessible example without assuming the user needs remediation or advanced work.
Adapt the topics when the user redirects the session.

## Conduct the session

Work through the agreed notes and topics at the user's pace; interleave them when useful.

1. **Orient.** Show the requested note count, linked selections and scopes, reasons for selection, and the agreed new topics.
2. **Read.** Present each selected note or section with concise explanations of useful connections and mechanisms.
   The user can read, ask for more depth, or point out corrections.
   For requested recall practice, ask one question at a time before revealing its explanation, then give feedback on the answer.
3. **Verify and improve.** Check each selected note's review scope against suitable sources and the user's examples.
   Verify time-sensitive and uncertain claims through current primary sources when available.
   Preserve the note's purpose and language; propose exact replacements or additions with supporting links and applicable dates or versions.
   Unavailable evidence leaves a claim unverified, not disproved. A brief review of one section does not verify the whole note.
   Apply edits the user requests or accepts, honoring authorization already given without asking for it again.
   Re-read before editing to preserve intervening changes, then inspect the result.
4. **Explore.** Introduce each agreed new topic using suitable checked sources and a worked example.
   Connect it to the existing notes and expand on aspects the user wants to explore further.
   Offer a concise addition or a new note when it captures useful understanding; apply it under the same edit authorization.
5. **Capture.** After the agreed work is covered or the user ends the session, summarize material covered, changes, and remaining uncertainty.
   Record the session outcome as described below.

Once required inputs are resolved, open with the short agenda and a focused review of the first note or section.
Include supported corrections or explanations; for an exploration-only session, begin with the first agreed new topic.
Let the user read it, request more depth, correct something, or move on.
If recall practice was requested, open with the agenda and first question instead, leaving its explanation until after the attempt or skip.
When only topic suggestions are requested, present them for selection before starting exploration.
If the user requests preparation only, return the agenda and reading material without inventing completion.
If the session ends early, record only the completed work and where to resume.

## Record note review dates

After reviewing an existing note or saving a new note during the session, update `revised_at` in its YAML frontmatter.
Use the review or creation date as `YYYY-MM-DD` in the user's timezone.
Update the date before moving to another note or topic, without waiting for session closure.
A completed review includes checking the selected scope and presenting findings, even when no content changes are needed.
Discovery reads, selected notes, and unsaved drafts do not qualify.
Re-read saved content, including user-created notes and edits, before updating the date; preserve the body and other metadata.
Create frontmatter when absent and inspect the saved result.
For a section-only review, capture its scope and remaining uncertainty in the journal; the date does not assert whole-note verification.

## Keep learning history

A request to conduct the session includes per-note review dates and its small local learning record.
Preparation alone stays in chat unless saving is requested.
Use the established journal, or create `Knowledge Sessions.md` in the collection root when recording the first session.
Honor read-only or no-history requests for both note dates and the journal.
Append a dated entry after the session closes; when resuming the same session, update its entry rather than duplicating it.
Preserve existing entries and keep the journal outside the study candidate pool.

Capture only what informs later selection:

- Requested review count, topic preferences, and whether agent suggestions were enabled.
- Notes and sections used, distinguishing presented, read as reported by the user, discussed, fact-checked, edited, and merely selected material.
- Recall evidence only when practice occurred: answered independently, answered with help, unresolved, or skipped, with the question or difficulty.
- Verification scope, source links, applied changes, and proposals still awaiting the user's decision.
- Requested new topics and agent suggestions, distinguishing explored topics from pending or declined ones.
- Any understanding the user expressed or demonstrated, and any stated interest or exclusion.
- One unresolved question or next step, without a scheduled review date.

Do not infer mastery from polished notes or mark agent-written explanations as the user's learning.
An unanswered or skipped question does not establish a learning difficulty.
Close with a concise outcome, links to changed notes and the journal when written, and any unfinished notes or topics.
