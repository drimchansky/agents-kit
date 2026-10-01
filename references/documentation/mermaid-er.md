# Mermaid Entity Relationship Diagrams

Use for persisted data and record cardinality. Choose class diagrams for code types. Apply `./mermaid-core.md`.

## Traps

- Use single-token entity names. Unquoted spaces silently create separate entities; add a quoted bracketed alias for display: `ORDER_ITEM["Order line item"]`.
- Quote relationship labels containing spaces: `: "places order"`. Extra unquoted words silently become phantom entities.
- Supply every relationship's `: label`, or `: ""` for no visible text.
- Legacy `*id` renders literal text without key metadata; mark keys with `PK`, `FK`, or `UK`, comma-separated when combined.
- Avoid the newer `string?` nullable-type syntax for portability.

## Entities and attributes

- Default to `UPPER_SNAKE` names because they often track tables.
- Attributes require `type name [keys] ["comment"]`; a bare name fails parsing.
- Types accept bare parentheses/brackets, such as `varchar(255)` and `decimal[10,2]`; label quoting does not apply.
- Quote comments and escape internal quotes as `#quot;`.
- Show key attributes and the few others the question needs. Split by subject area.

## Cardinality

- Each marker counts its adjacent entity for one instance at the opposite end. Read both halves: `CUSTOMER ||--o{ ORDER` means one customer per order and zero-or-more orders per customer.
- `--` identifies a child dependent on the parent's key. `..` is non-identifying, with independent child identity.
- Default to `..` for nullable foreign keys because their reference is optional.
- Use label verbs reading parent to child, such as "CUSTOMER places ORDER".
