---
name: create-notion-page
description: Use when asked to create a Notion page — drafts the requested content and creates the page through the session's Notion tools, private by default unless the user names a destination.
argument-hint: '[what the page should contain] [optional destination: page or database]'
disable-model-invocation: true
---

# Create Notion Page

Create a Notion page holding the content the user asked for. Pages land **private by default**: created with no parent, they go to the user's Private section, visible to them alone — a page whose placement nobody chose belongs where nobody else can see it. The user names a destination when they want one.

## Hard rules

- **Notion writes go through the session's Notion tools.** If no Notion tools are connected, stop and say so — suggest connecting the official Notion MCP (`https://mcp.notion.com/mcp`) — and end there. Never improvise a write path (curl against the API, a token found in the environment).
- **No parent unless the user named a destination in this request.** Omitting the parent is the documented way to create a private page — omit it even when the tool schema marks `parent` required. Never pick a parent yourself; a guessed parent publishes private content under an unrelated shared page.
- **Never share the page or change permissions.** Creating is the whole job; sharing is the user's.
- **Report the URL the tool returned** — never a URL constructed from memory.

## Process

### 1. Find the Notion tools

Locate the session's Notion tools (MCP tool names contain `notion`). None connected → hard rule one: stop, suggest, end. Don't pre-judge from the schema whether a server allows a parentless (private) page — the `parent`-required flag doesn't settle it (hard rule two). So attempt the private create (step 4), and only if the server rejects it for a missing parent (some wrap the raw API, which genuinely requires one) do you say so and ask where the page should go — never silently pick.

### 2. Draft

Compose what the user asked for, in the language of the request, from the request and anything they provided; if it needs facts you don't have, fetch or ask rather than invent. Give the page a clear title (the user's words when they gave them); add an icon when an obvious one fits, skip it otherwise. Format for Notion — headings, lists, to-dos, callouts, toggles where they genuinely help, plain paragraphs otherwise. Tables are fine *inside the page* (Notion renders them; the no-tables rule is about terminal chat output).

Default to drafting and creating in one pass, because the page lands private and is cheap to edit or delete. Deviate when the request is too thin to draft from ("make me a page") — ask what should be on it — or when the user asked to see the content first.

### 3. Resolve the destination

- No destination named → no parent, nothing to resolve. Don't search for a home.
- Destination named → resolve it with Notion search. Several plausible matches → list them and ask which. A database destination → fetch its schema first and fill the properties the request supplies; leave the rest empty rather than inventing values.

### 4. Create and report

Create the page — one per request unless the user asked for several. Report in chat: title, where it lives (Private, or the named destination), the returned URL, and a line on what's in it. Don't paste the page back into chat — the page is the deliverable. Lists, never tables, in the report.

## Don't rationalize

- "The schema marks `parent` required, so I have to pick one" — Omitting it is the documented private-page path. A guessed parent is a publish, not a fix.
- "This existing page looks related — nesting it there is tidier" — Related is not requested. Only a destination named in this request moves the page out of Private.
- "The content is clearly for their team, I'll share it" — Creating is the job. Sharing is the user's call, never yours.
- "The request is vague, I'll pad the page with a template" — A thin request gets one scoping question, not an invented structure.

## Verification

Confirm the hard rules held before finishing:

- [ ] Page created through the session's Notion tools — or stopped cleanly with the connect suggestion; no improvised write path
- [ ] Parent omitted unless the user named a destination in this request; ambiguous destinations resolved by asking
- [ ] No sharing, no permission changes
- [ ] Report gives title, placement, and the tool-returned URL; page not pasted into chat; no tables in the report
