# Mermaid Sequence Diagrams

Use for ordered participant interactions. Choose flowcharts for process structure or state diagrams for one object's lifecycle. Apply `./mermaid-core.md`.

## Participants and arrows

- Declare all participants before messages, in the intended left-to-right order.
- Default to `actor` for humans and `participant` for services/stores because readers recognize the stick-figure/box distinction.
- Use short IDs and prose aliases: `participant api as API gateway`.
- Use `->>` for calls and `-->>` for replies, `-)` for fire-and-forget, and `-x` for lost or rejected messages.
- Avoid headless `->` and `-->` for messages.

## Traps

- Do not quote message or note text; double quotes render literally. Parentheses and colons are safe bare.
- Escape semicolons as `#59;` in message and note text; a bare `;` terminates the statement.
- `end` is safe in message text but fails as a sender/recipient ID.
- Pair every activation with a later deactivation on the same participant. Rendering allows an unclosed activation, so reread the pairs.
- For portability, avoid bidirectional `<<->>`/`<<-->>` and `create`/`destroy` participants.

## Activation, blocks, and notes

- Add activation bars only when busy duration matters. Prefer arrow `+`/`-` shorthand because it shows pairing in place.
- Give `alt`/`else`, `opt`, `loop`, `par`/`and`, and `break` a condition on the opening line; close each with `end`.
- Prefer one nesting level, at most two. Split deeper interactions.
- Put preconditions and side effects in `Note over a,b:` or `Note right of a:`.
- Add `autonumber` only when surrounding prose cites step numbers.
