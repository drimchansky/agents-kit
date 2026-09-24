---
name: prepare-release-announcement
description: Draft a production release announcement from task folders, Jira tickets, or supplied release context. Use for internal Slack release announcements; post or revise a Slack message only when requested.
---

## Core Rules

Read and apply `./AGENTS.md` § *Ask Before Assuming*.

# Prepare Release Announcement

Turn the named changes into a concise announcement of what users can now do and why it helps.
Preserve the user's latest wording, formatting, and destination across revisions.

## Gather release context

Resolve task folders and slugs per `./references/workflow/task-layout.md` § *Discovery rules for skills*, base resolution.
Use supplied Jira tickets or pasted context directly.
Read group context root-to-task per `./references/workflow/task-store.md` § *Shared group context*, then each task's ticket, context, and latest result. Use plans to explain intent, not to establish delivered behavior.
Reuse session evidence and follow relevant source links when facts are missing or conflicting.
For independent tasks, use read-only agents when available. Assign each its source and combine their findings into one announcement.

Identify each change's user-visible outcome, limitations, Jira URL, and deployment evidence.
Use the task's own Jira issue, not its epic or a related ticket. Do not construct unknown issue IDs or URLs.
Ask for essential missing facts; omit optional details that cannot be supported.
Keep source collection read-only and leave task records unchanged.

## Establish availability

A completed implementation, merged PR, or preview does not establish production availability.
Use deployment evidence or the user's confirmation to describe a release as live.
When availability is unknown, ask whether the changes are live or the user wants a draft for after deployment.
Continue preparing supported feature copy while awaiting that answer.
For a future-release draft, label it outside the announcement; its opening can describe the intended post-deployment state.
Preserve that draft status through later formatting edits and delivery to the user's DM.
For a partial rollout, adjust the opening and state availability beside the affected change.

## Compose

Use this shape, repeating the change block only as needed:

```markdown
@team [App] updates are live [on prod](production-url) 🚀

**[Concrete change title] ([JIRA-ID](jira-url))**

[What changed for users and why it matters. Include a relevant limitation here.]
```

Take the team mention from the nearest `DOC_CONVENTIONS.md` (`./references/workflow/task-store.md`), and the product name and production URL from the group or task context. Ask when none supplies a value. Keep the link text exactly “on prod”.

- Put the Jira link in parentheses within each bold section header, followed by an empty line.
- Prefer literal descriptions of the change over promotional headlines. Cover fixes and improvements as well as features.
- Keep each section to a short paragraph, adding a caveat or required action only when it affects readers.
- Explain behavior in product terms. Include technical details only when they help readers understand the change.
- Exclude navigation or reproduction paths, arrow lines, separate “Open in prod” links, the waving-hand emoji, and a feedback footer.
- Add credits or follow-up requests only when requested and supported by the supplied context.

Check claims against the collected evidence, including retention periods, rollout limits, and the difference between cached and fresh data.
Keep research notes and unresolved deployment questions outside the paste-ready message.

## Deliver and revise

Return the announcement in chat by default. Invoking this skill does not authorize Slack delivery.
An explicit request to post or edit authorizes that write.
A later revision edits the posted message only on an explicit edit request.
Resolve the requested destination and real Slack user-group mention through available tools. Do not hardcode conversation or group IDs.
Posting a future-release draft to the user's DM is not confirmation that the release is live.
Before public delivery of that draft, establish production availability or use wording that accurately describes the upcoming release.
When revising a posted message, read its current text and apply the requested delta without losing intervening edits.
Preserve Jira links, blank lines, and resolved mentions using the Slack tool's supported formatting.
If a write's outcome is uncertain, inspect the destination before retrying. Return the confirmed message link after success.
