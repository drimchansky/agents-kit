# Mermaid Sequence Diagrams

Use for ordered participant interactions. Choose flowcharts for process structure or state diagrams for one object's lifecycle. Apply `./mermaid-core.md`.

## Declaration and participants

- Open with `sequenceDiagram`.
- Declare all participants before messages, in the intended left-to-right order.
- Default to `actor` for humans and `participant` for services/stores because readers recognize the stick-figure/box distinction.
- Use short IDs and prose aliases: `participant api as API gateway`.

```mermaid
sequenceDiagram
    actor rev as Reviewer
    participant ui as Web app
    participant api as API gateway
    rev->>ui: Open review queue
    ui->>api: GET /reviews
```

## Message text is free text, not a label

Do not quote message or note text; double quotes render literally. Text after the colon permits ordinary punctuation, including parentheses and additional colons. Escape semicolons as `#59;` because bare `;` terminates the statement.

Broken:

```
sequenceDiagram
    a->>b: retry; then fail
```

Correct:

```mermaid
sequenceDiagram
    a->>b: retry#59; then fail
    a->>b: Alert fires (Prometheus) at ratio 1:2
```

- Apply the same escaping to `Note` text.
- `end` is safe in message text but fails as a sender/recipient ID.

## Arrows carry meaning

- Use `->>` for calls/requests and `-->>` for replies.
- Use `-)` for fire-and-forget and `-x` for lost/rejected messages.
- Avoid headless `->` and `-->` for messages.
- For portability, avoid bidirectional `<<->>`/`<<-->>` and `create`/`destroy` participants. Use two one-way messages instead of bidirectional arrows.

## Activation discipline

- Add activation bars only when busy duration matters.
- Prefer arrow `+`/`-` shorthand because it shows pairing in place.
- Pair every activation with a later deactivation on the same participant. Reread pairs: rendering catches inactive deactivation but allows unclosed activation.

```mermaid
sequenceDiagram
    a->>+b: Request
    b->>+c: Fetch rows
    c-->>-b: Rows
    b-->>-a: Response
```

## Blocks

- Give `alt`/`else`, `opt`, `loop`, `par`/`and`, and `break` a condition on the opening line; close each with `end`.
- Use `alt` for exclusive branches, `opt` for optional steps, `loop` for repetition, and `par` for concurrency.
- Prefer one nesting level, at most two. Split deeper interactions.

```mermaid
sequenceDiagram
    participant ci as CI runner
    participant k8s as Cluster
    loop every 30s until timeout
        ci->>k8s: Poll rollout status
        alt all pods ready
            k8s-->>ci: Ready
        else still progressing
            k8s-->>ci: Pending
        end
    end
```

## Notes and numbering

- Use `Note over a,b:` for shared facts and `Note right of a:` for one participant. Put preconditions and side effects here.
- Add `autonumber` only when surrounding prose cites step numbers.

## Worked example

```mermaid
sequenceDiagram
    autonumber
    actor dev as Developer
    participant ci as CI runner
    participant reg as Image registry
    participant k8s as Cluster
    dev->>ci: Push tag v1.4.0
    ci->>+reg: Push image (linux/amd64)
    reg-->>-ci: Digest sha256:9f2a
    alt tests green
        ci->>k8s: Apply manifest
        k8s-->>dev: Rollout complete
    else tests failed
        ci-->>dev: Build failed#59; v1.3.9 still live
    end
```
