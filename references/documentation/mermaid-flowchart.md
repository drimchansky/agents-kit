# Mermaid Flowcharts

Use for processes, decisions, and dependency structure. Use sequences for ordered participant interactions. Apply `./mermaid-core.md`.

## Shapes and links

- Open with `flowchart <direction>`; `graph` is older syntax.
- Keep each shape's meaning consistent: rectangle step, rhombus decision, stadium entry or exit, cylinder datastore, subroutine for detail supplied elsewhere.
- Default to these shapes because others lack shared meanings; use another only when the audience has an established convention.
- Use `-.->` for conditional, asynchronous, or out-of-band flow and `==>` for one primary path.
- Choose one label form per diagram: `-- text -->` or `-->|text|`. Quote edge labels carrying special characters.
- Label every decision edge with parallel answers, such as `yes`/`no`.

## Traps

- Avoid lowercase `end` as a node ID. It breaks parsing and can consume a subgraph's closing keyword.
- Separate `---` from IDs beginning with `o` or `x`, or capitalize them. `a---oBuild` silently draws a circle ending to `Build`.
- `--o` and `--x` produce circle/cross endings; use sparingly.
- First declare each node inside its single intended subgraph. Later reuse does not move an external declaration inside.

## Subgraphs

- Declare `subgraph id["Title"] ... end` with an explicit ID and quoted title.
- Connect inner nodes for flow. Edges between subgraph IDs claim relationships between the groups themselves.
- Treat internal `direction TB` as a hint; external edges may cause renderers to ignore it.
- Limit nesting to one level; split deeper structures.
