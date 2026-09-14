# Design to Code

Use design tools/framework docs; translate into project components/tokens/layout (`css.md`, `accessibility.md`, `review.md` § *Design Spec Alignment*).

## Source of truth

- [ ] Pin the exact node/frame/page ID or route. A file-only URL is not a source: ask for the exact node and never guess.
- [ ] Before coding, fetch/read full node context; metadata/screenshots cannot substitute.
- [ ] Without tools, measure images as readings, not tokens; inspect prototype DOM/styles/states.
- [ ] Context failures: retry smaller nodes/report; no silent screenshot fallback.
- [ ] Record URLs/IDs/tools per Record binding and task `CONTEXT.md` References.

## Hint priority

Apply this priority:

1. Component mappings: use the mapped project component.
2. Component documentation: follow linked usage/constraints.
3. Designer annotations: treat states, behavior, and copy as requirements.
4. Tokens: map to project equivalents; surface missing equivalents instead of hard-coding.
5. Raw values: use screenshots for intent, translating into project layout (`css.md`).

## Reuse first

- [ ] Search/reuse components/layouts/tokens before coding.
- [ ] Adapt reference code to project stack; no unchanged pastes.
- [ ] Unmapped elements: scoped components or findings, excluding inline one-offs.

## Assets

- [ ] Exported assets only; no invented SVGs/placeholders/authored icons.
- [ ] Download exact export bytes before committing; URLs expire. Use real sources for dynamic content.
- [ ] Reuse icons only when glyphs visibly match.
- [ ] Size assets/boxes from design (`performance.md` § *CLS*).

## What the design leaves out

- [ ] Ask or state assumptions for responsive gaps; do not invent breakpoints (`css.md` § *Responsive Design*).
- [ ] Check hover/focus/loading/empty/error/disabled states/annotations; ask about gaps.
- [ ] Verify names, roles, focus, and contrast independently (`accessibility.md`).
- [ ] Keep literal copy; ask before shipping apparent placeholders.

## Verify

- [ ] Before each screen/component, specify node/viewport and screenshot or DOM/style criteria.
- [ ] Compare at design size; report every deviation/reason.
- [ ] Report all token mappings/asset substitutions.

## Delegating a design unit

Packet: URLs/IDs/mappings/missing tokens/answered gaps (`../workflow/executor-contract.md` § *Launch packet*). Executors fetch via inherited MCP tools; no pre-read dump. Unavailable/denied access: send the coordinator's verbatim read as identified outside-root content.
