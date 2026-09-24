---
name: prepare-daily-status
description: Prepare or refresh a personal daily work status from Slack, Jira, Granola, GitHub, Notion, Calendar, and an incident tracker. Use for daily updates and stand-up reports; send or edit a Slack message only when requested.
---

## Core Rules

Read and apply `./AGENTS.md` § *Ask Before Assuming*.

# Prepare Daily Status

Produce a concise first-person update grounded in the user's activity. Preserve the session's template, status definitions, and delivery choices.
Use lists rather than Markdown tables in chat and in the message.

## Scope and authorization

Draft in chat unless the user requests Slack delivery. Skill selection alone grants no permission to send or edit messages.
An explicit send or update request authorizes that delivery without another approval step. A later revision edits the posted message only on an update request.
Keep source collection read-only. Reporting a discrepancy does not authorize changing Jira, GitHub, or the source template.

Resolve the reporting date, timezone, user identities, and any supplied template from session context and connected profiles.
Default to the preceding working day because daily updates summarize the last workday; use another period when requested.
Check Calendar for leave or holidays when choosing that day.
The report date is today's local date; the activity date is the day being summarized. Preserve both on refresh.
Use current records for present status and plans, separating them from events inside the reporting window.
A refresh keeps the original reporting window and incorporates later state changes. Ask when the day or destination is ambiguous.

## Gather context

Check Slack, Jira, Granola, GitHub, Notion, Calendar, and the connected incident tracker through available tools.
Reuse evidence already read in the session; refresh mutable states before delivery.
Gather independent sources in parallel with read-only agents when available. Give each agent one source, the shared identity, date window, and attribution rules.
Request dated facts, current states, citations, and coverage limits. Keep drafting and delivery with the coordinating agent.
Merge their evidence by task, retaining source links and event times. Count the same work once across messages, meetings, documents, and tracker records.
Follow pagination and investigate relevant linked threads, issues, PRs, documents, and incidents.

- **Slack:** read the supplied template and the user's messages in the reporting window. Read relevant thread replies for decisions and follow-ups.
- **Jira:** inspect created issues, user-authored comments and transitions, current states, owners, and blocking links. Assignment alone does not establish activity.
- **Granola:** find meetings involving the user within the reporting window. Read relevant notes and preserve their source citations.
  Check meeting metadata when a generated summary contradicts dates or participation. Meetings before the reporting window provide context, not accomplishments.
- **GitHub:** check authored PRs, commits, reviews, merges, and relevant deployment records. Separate authored work, rebased commits, and reviews of others' changes.
  If connector access fails, try an available authenticated `gh` CLI for read-only queries. A failed lookup does not establish absent activity.
- **Notion:** find relevant specs, decisions, and documentation created or edited by the user during the reporting window.
  Read the content and available authorship or revision evidence. A page's modification time alone does not identify the user's contribution.
  Existing pages can support decisions and next steps without becoming newly completed work.
- **Calendar:** inspect the user's work events within the reporting window, respecting event timezones and cancellations.
  Use event details to find related notes and work. Invitations, accepted responses, and scheduled time do not prove attendance or outcomes.
  Attribute meeting contributions only when notes, messages, or the user confirm them. Exclude unrelated personal events.
- **Incident tracker:** inspect incidents and follow-ups with the user's recorded response, investigation, mitigation, or review activity.
  Use timeline entries and comments to establish their contribution. Assignment or on-call rotation membership alone does not prove incident work.
  Link the incident and distinguish the user's action from the team's resolution. An incident marked resolved does not establish a deployed, verified fix.

Attribute collaborators' implementations to them. Describe the user's investigation, coordination, review, or verification without claiming they implemented those changes.
A submitted approval describes that revision; check the latest review state before calling a PR currently approved.
Distinguish PR previews, shared-dev deployments, merges, production deployments, and production verification.

## Resolve discrepancies before drafting

Compare task states across sources using the registry below and the user's explicit workflow conventions.
Surface material conflicts in chat before generating or refreshing the status. Link the conflicting records and explain the proposed interpretation.
For example, an implemented PR awaiting review conflicts with a Jira ticket still in Backlog.
Resolve factual conflicts from fresh evidence or the user's correction. Ask the smallest question when a material conflict remains, holding the draft and send.
Continue independent research while awaiting an answer. Keep reconciliation notes out of the daily message.

Map user-marked Jira Done to Finished only when the user states that convention in the session or a supplied template.
Otherwise treat Done like any other tracker state. Do not claim production completion from a merge or someone else's unrelated transition.
If a source is unavailable, disclose the coverage limit in chat. Do not claim it was checked successfully or infer no activity.
Omit routine empty-source and access-plan commentary from the daily message.

## Status registry

Use labels beside relevant tasks inside the daily sections. The registry is reference material, not a separate Statuses section in the message.

- **In Progress:** implementation is underway; includes draft PRs.
- **In review:** implementation is awaiting or undergoing review.
- **Ready for test:** awaiting deployment to prod and verification.
- **Deployed to dev:** deployment to the shared development environment is confirmed.
- **Deployed to prod:** production deployment is confirmed; verification is pending.
- **Finished:** deployed to prod and verified, or Jira Done under the user's stated convention.

Put blocked work under Blockers with its dependency, owner, and needed decision or action.

## Compose

Use a supplied template after applying the user's corrections. Otherwise use this shape:

```markdown
**Daily status — [report date]**
_Activity: [activity date] · [timezone]. Statuses refreshed [local date and time]._

**Today’s priority**

• **[Status]** — [task link]: intended outcome for today.

**What I plan to do next**

• [Task] — concrete next action.

**Blockers**

• [Task link] — dependency or decision needed, with owner when known.

**What I did yesterday?**

• **[Status, where relevant]** — [task link]: work performed and outcome.

**Other**

• Relevant additional context.

_Automatically generated. Context checked: [sources actually checked]. Today’s priority and next steps are inferred from the open work and agreed follow-ups._
```

Fill the date line for the actual reporting period. Omit Other when empty and state no blockers only when supported.
Keep the automatic-generation disclosure. Include the inference sentence only when priorities or next steps were inferred.
Do not invent commitments or repeat each task's full description across sections. Link the task or PR where it makes the update verifiable.
Check every claim against the evidence, including whose work it was and whether it happened in the reporting window or reflects today's state.

## Deliver or refresh

Without delivery authorization, return the paste-ready status in chat. A refresh rechecks mutable sources; it replaces the posted message only on an update request.
For an explicit send of an already settled status, recheck its status labels and verify the destination instead of restarting research.
Update any changed label in the draft and name it in the delivery report.
Read a supplied Slack permalink to resolve its channel and parent thread. Reply in that thread unless the user requests a channel post.
For a DM, resolve the user's existing conversation or identity. Do not reuse a previous day's stand-up thread for a new report.
When editing, read the current message and preserve intervening user changes. Verify ownership and that the message is the intended update.
Use the session's Slack tools and respect their message-size limits. After an uncertain write result, check the destination before retrying.
Return the tool-confirmed message link after delivery. Update a reusable template only when the user requests that change.
