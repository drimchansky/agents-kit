---
name: create-notion-page
description: Use when asked to create a Notion page — drafts the requested content and creates the page through the session's Notion tools, private by default unless the user names a destination.
argument-hint: '[what the page should contain] [optional destination: page or database]'
---

## Core Rules

Read and apply `./AGENTS.md` § *Ask Before Assuming*.

# Create Notion Page

Create the requested content as a private page by default. Only a destination named in this request changes that placement.

## Hard rules

Use only the session's Notion tools for writes; never improvise an API/token path. Do not share pages or change permissions. No parent unless the user named a destination; do not choose one because it seems related.

## Process

### 1. Find the Notion tools

Locate tools whose names contain notion. If none are connected, stop and suggest the official Notion MCP (`https://mcp.notion.com/mcp`).

For private creation, omit parent even when the schema marks it required. Attempt creation; only a server rejection for missing parent triggers a destination question. Do not silently substitute a parent.

### 2. Draft

Use the request's language and supplied material; fetch or ask for missing facts. Preserve a supplied title, otherwise choose a clear one. Add an obvious icon when useful. Use Notion headings/lists/to-dos/callouts/toggles where helpful, otherwise paragraphs. Tables are allowed inside the page.

Default to drafting and creating together because a private page is easily revised. Ask for content when the request is too thin, or preview when requested; do not pad an empty ask with invented structure.

### 3. Resolve the destination

Without a named destination, omit parent and do not search for a home. Otherwise search Notion and ask among plausible matches. For a database, read its schema and fill only requested properties; leave other values empty.

### 4. Create and report

Create one page unless more were requested. Report title, Private/named placement, the tool-returned URL, and one line describing contents. Do not construct the URL or paste the page into chat. Use lists rather than tables in the report.
