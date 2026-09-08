# Design to Code

Building UI from a design source — a Figma node, a mockup image, a clickable or HTML prototype — with the design as the unit's ground truth beside the framework docs. Tool-neutral: it names what a **design-context tool** has to hand over, not which one. Where the host has one (the Figma MCP server's `get_design_context` on Claude Code and Codex alike, its vendor skill layered beneath this file), use it; where it has none, the fallbacks below say what the source can still ground. See `css.md` for tokens and layout, `accessibility.md` for what a design never encodes, and `review.md` § *Design Spec Alignment* for the review side.

Mental model: the design is a **reference**, never the output. Everything it hands over — generated code, absolute positions, raw hex — is evidence of intent to translate into the project's stack, components, and tokens; the screenshot shows what the intent looks like and never stands in for the structure.

## Source of truth

- [ ] One source per unit, pinned to the exact node, frame, or page — a Figma URL carrying its `node-id`, a named artboard, a prototype route. A file-level URL or "the design" is not a source: ask for the node, never guess one
- [ ] Structured context before code — where a design-context tool reaches the source, call it on the pinned node before writing anything and read the whole return (reference code, screenshot, hints). Orientation calls (metadata, a screenshot alone) locate a node; they never replace the context call
- [ ] No tool reaches the source: an image is measured (dimensions, spacing, type scale, sampled colors) and each measurement recorded as a read from the image rather than a token; an HTML or interactive prototype is read as code (DOM, styles, states) and treated as reference code below
- [ ] Never degrade silently — when the structured context is reachable but the call failed (timeout, auth, an oversized node), retry on a smaller node or report it. Coding from the screenshot alone while the tool could still answer ships guesses as design intent
- [ ] Record the source per the consumer's Record binding — the pinned URL and node ids and the tool that read them — and, in a task folder, under `CONTEXT.md` § References

## Hint priority

Apply what the source carries in this order; an earlier source overrides a later one:

1. Code Connect or equivalent component mappings — use the mapped project component directly
2. Component documentation links — follow them for usage and constraints
3. Designer annotations — notes on states, behavior, and copy are requirements
4. Design tokens (variables, CSS custom properties) — map each to the project's token; a token with no project equivalent is surfaced as a finding, never replaced by a hard-coded value
5. Raw values (hex, absolute positioning, px) — loosely structured; lean on the screenshot for intent and re-express in the project's layout system (`css.md`)

## Reuse first

- [ ] Search the project for existing components, layout patterns, and tokens matching each part of the design before writing new ones; reuse them and match the surrounding code
- [ ] Reference code the tool returns (typically React + Tailwind) is adapted to the project's language, framework, component library, and styling system — never pasted
- [ ] A design element with no project component and no mapping becomes either a new component named in the unit's declared scope or a finding — not an inline one-off

## Assets

- [ ] Every icon and image renders from the exported asset — never a hand-drawn SVG path, a placeholder, or an authored icon file: the vector data is not yours to invent
- [ ] Exported asset URLs are temporary (Figma's expire in about seven days) — for committed code, download the exact bytes into the project's asset location, or wire dynamic content to its real data source
- [ ] Reuse a project icon only when its glyph visibly matches — a name match is not a match
- [ ] Size from the design — the asset renders at the size the design declares, in a box whose dimensions come from the design (`performance.md` § *CLS* for the sizing mechanic)

## What the design leaves out

- [ ] Responsive behavior between the artboards shown — ask or state the assumption; never invent breakpoints (`css.md` § *Responsive Design*)
- [ ] States the design omits — hover, focus, loading, empty, error, disabled: check the prototype and annotations, then ask
- [ ] Accessibility — names, roles, focus order, contrast (`accessibility.md`); a design's colors do not prove contrast
- [ ] Copy — literal text is content until told otherwise; placeholder-looking text is asked about, not shipped

## Verify

- [ ] Each screen or component is one unit whose criterion is named before building: which node it renders, at which viewport, compared how — a rendered screenshot beside the design's, or DOM and style assertions for tokens and spacing
- [ ] Where the criterion is a rendered comparison, compare the result to the design's screenshot at the design's size; name each deviation and its reason (a missing token, a responsive choice, a reuse decision) in the report
- [ ] List every token mapping and asset substitution in the report — that list is what the review's design-spec alignment reads against

## Delegating a design unit

When the unit goes to an executor (`../workflow/executor-contract.md` § *Launch packet*), the packet carries the pinned source — URL and node ids — and the facts the session established about it: mappings found, tokens with no equivalent, the user's answers on gaps. Never a pre-read dump of the design context: an executor inherits the session's MCP tools on both hosts when its adapter pins none, as the kit executor adapters do, so it reads the node itself. Where the executor cannot reach the source — no tool, a denied sandbox — the coordinator's own read travels verbatim as content outside the effective root, and the packet says so.
