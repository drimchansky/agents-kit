---
name: run-knowledge-session
description: Conduct a one-hour learning session from a personal notes collection. Select notes to read and fact-check, help update them, and explore a new topic from stated interests or evidence of possible gaps and strengths. Use for recurring knowledge upkeep and guided study; a single-note audit belongs to review-note.
---

## Core Rules

Read and apply `./AGENTS.md` § *Ask Before Assuming*.
Read and apply `./references/workflow/user-facing-messages.md` § *Plain wording* only.

# Run Knowledge Session

Guide the user through reading, one focused note update, and exploration of a new question.
Default to 60 minutes of user effort because this is a weekly learning habit; adapt when another budget is given.
Follow the user's pace across turns. Reading reviewed notes is valid participation; answers are not required to continue or complete a session.
Use recall questions or exercises only when requested. A prepared agenda is not a completed learning session.

## Resolve the collection

Use the notes directory supplied by the user or established in the conversation.
If it is missing or inaccessible, ask for the directory and continue only with available material.
Keep discovery inside that collection and any explicitly supplied learning history.
Exclude attachments, templates, and the session journal from study candidates.
Do not hardcode a user's vault path or require an Obsidian plugin.

Honor stated interests, exclusions, and learning goals, including preferences already established in the session.
Without preferences, select the material yourself rather than asking the user to nominate notes or interests.
Selection must work without note properties. Do not add or require `review_after` or a replacement due-date field.

## Select the session

Survey titles and topic distribution, then read candidate contents before selecting them.
Use an existing learning journal when known; otherwise look for `Knowledge Sessions.md` at the collection root.
Read recent outcomes and unresolved questions to avoid repeating successful sessions without a reason.
On a first session, use the collection itself and mark the learning history as unknown.

Normally choose two notes to revisit, one note or section for verification, and one new learning question.
The verification target may overlap a selected note. Keep long notes scoped to a section that fits the session.
Rank candidates using:

- Relevance to the user's current interests or work, where that context is actually available.
- Previous recall difficulty, unresolved questions, contradictions, or missing prerequisites in the notes.
- Claims exposed to changing versions, standards, events, or evidence, and weak sourcing of consequential claims.
- Time since actual practice or verification, balanced with coverage of less-visited subjects.

File modification time is only a discovery hint; it does not prove practice, verification, or obsolescence.
Note length, file count, and missing topics do not establish the user's competence.
Calibrate apparent gaps to the note's purpose: a reference card need not explain every mechanism.
Allow confident subjects to return when a harder application would deepen them.

## Choose a new question

Follow explicit preferences first. Otherwise infer promising directions from the notes and available user feedback:

- **Possible gap:** an unexplained prerequisite, unresolved contradiction, weak answer, or missing connection that limits another topic.
- **Strength extension:** a well-explained mechanism, successful application, or confident answer that supports a harder case or adjacent field.

Tie each suggestion to specific notes or user feedback and explain its expected value.
Treat gaps and strengths inferred from notes as hypotheses; distinguish an omission in writing from a gap in understanding.
Read related notes before calling a topic new. A new application or connection can qualify even when its terms already appear.
Compare at most two promising directions, choose one, and state why it fits this session.
When evidence is thin, offer an accessible example without assuming the user needs remediation or advanced work.
Revise the choice when discussion reveals a better opportunity or the user redirects the session.

## Conduct the hour

Use these effort budgets as a starting point. Reallocate them to the user's pace without waiting on a timer.

1. **Orient — 5 minutes.** Show linked selections, a brief reason for each, and the intended learning outcome.
2. **Read — 10 minutes.** Present the selected notes or sections with concise explanations of useful connections and mechanisms.
   The user can read, ask for more depth, or point out corrections.
   For requested recall practice, ask one question at a time before revealing its explanation, then give feedback on the answer.
3. **Verify and improve — 25 minutes.** Check the chosen note or section against suitable sources and the user's examples.
   Verify time-sensitive and uncertain claims through current primary sources when available.
   Preserve the note's purpose and language; propose exact replacements or additions with supporting links and applicable dates or versions.
   Unavailable evidence leaves a claim unverified, not disproved. A brief review of one section does not verify the whole note.
   Apply edits the user requests or accepts, honoring authorization already given without asking for it again.
   Re-read before editing to preserve intervening changes, then inspect the result.
4. **Explore — 15 minutes.** Introduce the selected question using one or two checked sources and a worked example.
   Connect it to the existing notes and expand on aspects the user wants to explore further.
   Offer a concise addition or a new note when it captures useful understanding; apply it under the same edit authorization.
5. **Capture — 5 minutes.** Summarize material covered, applied changes, remaining uncertainty, and one useful next step.
   Record the session outcome as described below.

The first response contains the short agenda and a focused review of the first note or section, including supported corrections or explanations.
Let the user read it, request more depth, correct something, or move on.
If recall practice was requested, open with the agenda and first question instead, leaving its explanation until after the attempt or skip.
If the user requests preparation only, return the agenda and reading material without inventing completion.
If the session ends early, record only the completed work and where to resume.

## Keep learning history

A request to conduct the session includes its small local learning record; preparation alone stays in chat unless saving is requested.
Use the established journal, or create `Knowledge Sessions.md` in the collection root when recording the first session.
Respect an explicit request to keep the session read-only or omit history.
Append a dated entry after the session closes; when resuming the same session, update its entry rather than duplicating it.
Preserve existing entries and keep the journal outside the study candidate pool.

Capture only what informs later selection:

- Notes and sections used, distinguishing presented, read as reported by the user, discussed, fact-checked, edited, and merely selected material.
- Recall evidence only when practice occurred: answered independently, answered with help, unresolved, or skipped, with the question or difficulty.
- Verification scope, source links, applied changes, and proposals still awaiting the user's decision.
- The new question, any understanding the user expressed or demonstrated, and any stated interest or exclusion.
- One unresolved question or next step, without a scheduled review date.

Do not infer mastery from polished notes or mark agent-written explanations as the user's learning.
An unanswered or skipped question does not establish a learning difficulty.
Leave note metadata unchanged unless its update was requested; the journal is sufficient for session selection.
Close with a concise outcome, links to changed notes and the journal when written, and the next learning question.
