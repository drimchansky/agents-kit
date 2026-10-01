# Mermaid Class Diagrams

Use for code types and their relationships. Choose ER for persisted data or state diagrams for one object's lifecycle. Apply `./mermaid-core.md`.

## Traps

- Avoid spaces in class IDs. Mermaid silently removes them, and later partial references create extra classes.
- Put display text in quoted bracketed labels: `class ord["Order (draft)"]`.
- Write generics with tildes: `List~String~`. Angle-bracket parameters parse but vanish as HTML tags.
- Prefer named types over comma-separated generic parameters; upstream documents those as unsupported.
- Parentheses mark methods; without them, members are attributes. Put attribute qualifiers in names, such as `grossTotal`, to avoid silent conversion.
- Put `<<interface>>`, `<<abstract>>`, or `<<enumeration>>` inside the member block. A standalone annotation before its class crashes.

## Members

- Use `{ }` for several members or `Class : +int id` for one. Do not mix forms.
- Put return types after closing parentheses: `+charge(Money amount) bool`.
- Show members carrying invariants; omit accessors and framework boilerplate.

## Relationships

- Attach decorated ends to the parent: base class, whole, or interface. Keep that end on the left consistently.
- Choose composition or aggregation by lifetime. When lifetime is unknown, use association and explain the nuance in prose.
- Quote multiplicities at each end; each counts the adjacent class. Put relationship labels after the colon: `Order "1" *-- "0..*" LineItem : contains`.
- Use `namespace pkg { }` for meaningful groups and `note for Shape "text"` for needed caveats.
