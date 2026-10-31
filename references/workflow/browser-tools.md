# Browser tools

## Choose the context

- Honor an explicitly requested browser, integration, or context.
- Use the user's session to act for the user and for regressions that depend on their accounts, integrations, or live data.
- Use an isolated context, with no stored cookies, logins, or profile data, for review capture (`../engineering/review-evidence.md` § *Capture*) and other untrusted code.
- Live-session checks do not replace isolated review capture.
- Ask when the request leaves the context open and signed-in state or side effects make the choice consequential.

## Connect

- Prefer Chrome DevTools MCP: the `chrome-devtools` server for the user's session and `chrome-devtools-isolated` for isolated work.
- Recognize its tools by name, such as `list_pages` and `take_snapshot`. § *Host notes* gives each host's prefix.
- Discover the host's browser tools, including deferred ones, before choosing another integration or reporting a browser unavailable.
- Check each integration's connection separately. One failure does not establish another's unavailability.
- Report a connection failure with its integration name and exact error.
- Before acting in the user's session, confirm the page list shows their open tabs rather than a browser the server launched.

## Act and verify

- List open pages, match the requested URL, and inspect that page before acting.
- Locate elements from the page's accessibility snapshot. Use screenshots to judge visual state.
- Verify the resulting page state after each action.
- Resolve permitted side effects and cleanup from the request and established authorization before acting.
- Check whether an action completed before retrying it; avoid repeating submissions or transactions.
- When verifying UI, check console errors and failed network requests where the integration exposes them.
- Save screenshots used as evidence to files, and record each one's page, viewport, and state.

## Regressions in the user's session

- Confirm the account, environment, connected integrations, and live preconditions before testing.
- Select inputs from current data using the scenario's criteria.
- Assert stable behavior and relationships. Derive expected results from the scenario and observed inputs rather than fixed historical values.
- Record the observation time, relevant starting state, changing inputs, actions, expected outcomes, observed results, and supporting evidence.
- Distinguish application failures, changed preconditions, and unavailable dependencies. Leave unexercised checks unverified.

## Host notes

### Claude Code

- MCP tools appear as `mcp__<server>__<tool>`, such as `mcp__chrome-devtools__list_pages`.
- MCP tools can be deferred. Load them through tool search before reporting them unavailable.
- When Chrome DevTools MCP cannot attach to the user's session, fall back to Claude in Chrome (`mcp__claude-in-chrome__*`).
- The desktop app's built-in browser is not an isolated context.

### Codex

- MCP tool prefixes can show the server name with underscores, such as `mcp__chrome_devtools__list_pages`.
- A `cua_repl` connection failure does not establish that Chrome DevTools MCP is unavailable.
