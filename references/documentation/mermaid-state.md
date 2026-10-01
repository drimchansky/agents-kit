# Mermaid State Diagrams

Use for one thing's lifecycle and transition triggers. Choose sequences for participant messages or flowcharts for process steps. Apply `./mermaid-core.md`.

## Traps

- Use single-token state IDs. Spaced names on transitions silently create one state per word.
- Attach prose with `id : Description` or `state "Description" as id`.
- Leave transition labels and `id : Description` text unquoted; quotes render literally. Parentheses and colons are safe bare.
- Escape semicolons as `#59;` in transition labels and descriptions. Bare semicolons produce phantom states; quoting does not prevent this.
- IDs allow letters, digits, and `_`; hyphens fail. Avoid reserved `state` and `note` IDs.
- Connect composites themselves across their boundary. Cross-composite inner-state transitions are upstream-unsupported even when a renderer accepts them.

## States and transitions

- Open with `stateDiagram-v2`.
- Use one `[*]` start and the lifecycle's actual ends. This marker accepts no label or styling.
- Label transitions with triggering events or conditions, consistently labeling all or none.

## Composite states

- Nest with `state parent { ... }` and give each composite its own `[*] -->` start.
- Keep nesting to one level; split deeper machines.

## Choice, fork, and notes

- Use `<<choice>>` for an internal decision: one incoming transition and labeled outgoing branches. For external events, prefer labeled transitions from the state.
- Use `<<fork>>`/`<<join>>` only for paths that run concurrently and actually rejoin. Prefer composite `--` regions for concurrency that persists throughout a state.
- Put invariants and timing facts in `note right of id ... end note`, including leases, deadlines, and external effects.
