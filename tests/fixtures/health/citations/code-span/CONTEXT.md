# Citations inside inline code spans

Synthetic grounding whose `](` sequences sit inside code spans, where no link can live.

## References

- `grep -rEn "['\"](access_token|refresh_token)['\"]" libs/accounts/` returns zero hits.
- A dead link inside a code span: `[x](./gone-in-code.md)` is literal text.
- A double-backtick span: `` `[y](./also-gone.md)` `` is literal text too.
- One span and one live link on a line: `[q](./in-span.md)` beside [z](./gone-outside.md).
- A stray backtick ` closes nothing, so [w](./gone-after-tick.md) is a real link.
- A backticked link is no link here, so `[d](Legacy/DECISIONS.md)` reads as a plain-text path.
