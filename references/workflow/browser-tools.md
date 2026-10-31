# Browser tools

## Codex

- Honor an explicitly requested browser or integration.
- For actions on the user's existing Google Chrome tabs, prefer Chrome DevTools MCP (`mcp__chrome_devtools__*`).
- Discover available Chrome DevTools tools before choosing another browser integration or reporting that Chrome is inaccessible.
- Start with `list_pages`, match the requested URL, and inspect that page before acting.
- Verify the resulting page state after each action.
- Report a connection failure with its connector name and exact error.
- A `cua_repl` connection failure does not establish that Chrome DevTools MCP is unavailable. Check each connection separately.
- Preserve workflow requirements for isolated browser contexts, including `../engineering/review-evidence.md` § *Capture*.
