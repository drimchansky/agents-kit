---
name: fact-check
description: Use when asked to fact-check, verify, or validate factual claims against trustworthy sources on the internet — not against the model's pretraining data.
argument-hint: '[claim, message, or file path]'
disable-model-invocation: true
---

# Fact-check

Verify factual claims in the provided input against **live, trustworthy sources on the internet**. Pretraining data is not evidence — it may be outdated, incomplete, or wrong, and it cannot be cited. If you can't ground a claim in a source you actually fetched, the claim is unverified.

The user provides one or more claims (text, message, file, or topic). Your job is to extract checkable claims, look them up, and report each verdict with citations.

## Hard rules

- **No pretraining-only verdicts.** Every "verified" or "contradicted" verdict must cite at least one URL fetched during this run. If you didn't fetch it, you didn't verify it.
- **Prefer primary and authoritative sources.** Official sites, regulators, peer-reviewed papers, standards bodies, original press releases, vendor docs at the version in question. Treat aggregators, blogs, social posts, AI summaries, and crowdsourced wikis as secondary — useful for leads, not as final evidence.
- **Cross-check load-bearing claims.** For anything consequential (numbers, dates, attributions, current status, version-sensitive behavior), require at least two independent sources that agree, or one undisputed primary source.
- **Recency matters.** Note the publication / last-updated date of each source. If the claim is time-sensitive (current officeholders, prices, "as of" data, library APIs), prefer sources dated after the claim's implied moment and explicitly flag stale evidence.
- **Don't paraphrase the source into a stronger claim than it makes.** If the source says "around 40%", don't report "40%". If it says "reportedly", don't drop the hedge.
- **Disagreement is a finding, not noise.** If trustworthy sources disagree, report the disagreement; don't pick a winner silently.
- **Respond in the language of the input.** Detect the language of the information being fact-checked and write the entire report — verdicts, evidence summaries, notes, headings — in that same language. Quoted source passages stay in their original language; if the source language differs from the input language, follow the quote with a brief translation in the input language. Never switch into English just because the sources are English.

## Process

### 1. Decompose the input into claims

Pull out concrete, checkable assertions. A single sentence may contain several. Examples of checkable claim types:

- **Identities & attributions** — who said / wrote / built / leads what
- **Dates & timelines** — when something happened, was released, expires
- **Numbers & statistics** — counts, percentages, prices, measurements
- **Definitions & status** — what something is, current state, classification
- **Causal / behavioral claims** — "X causes Y", "the API returns Z when W"
- **Quotes** — exact wording attributed to a person or document
- **Comparisons** — "the largest", "the first", "more than"

Skip subjective claims (taste, opinion, prediction). Note them as out-of-scope rather than rating them.

### 2. Plan the lookup

For each claim, decide:

- What source type would be authoritative (official site, standards doc, regulator, vendor doc at version X, peer-reviewed study)
- What query phrasing is most likely to surface that source
- Whether the claim is time-sensitive — if yes, you'll filter or weight by date

Don't outsource this judgment to a single search. Plan before searching.

### 3. Fetch and read

Use web search to find candidate sources, then **fetch the actual page** for any source you intend to cite. Read enough of the page to confirm it actually says what the search snippet implied — snippets lie or get truncated.

For each source you cite, record:

- URL
- Publisher / author (if relevant)
- Publication or last-updated date (if visible)
- The exact passage that supports or contradicts the claim

If a source paywalls, redirects, or returns a thin stub, note that and find another. Don't cite a page you couldn't actually read.

### 4. Assign a verdict

For each claim, one of:

- **Verified** — Multiple independent trustworthy sources agree, or one undisputed primary source confirms it. Cite the strongest.
- **Partially correct** — Some elements check out; others are wrong, missing, or overstated. Spell out which is which.
- **Contradicted** — Trustworthy sources directly contradict the claim. Cite them.
- **Unverifiable** — No trustworthy source could be found within reasonable effort, or the claim is too vague / subjective to check. Say what you searched for and why it didn't resolve.
- **Disputed** — Trustworthy sources disagree. Report the disagreement and the strongest source on each side.
- **Outdated** — The claim was true at some point but is no longer current. Cite both the older and current state.

### 5. Be honest about coverage

- If you ran out of time, sources, or access, say so. Don't fill the gap with a hedge that reads like a verdict.
- If the input has many claims and you only checked some, list which you checked and which you didn't.
- If your evidence base is thin (one secondary source), say "low-confidence" — don't dress it up.

## Don't rationalize

- "I'm sure this is right from training" — Doesn't count. Fetch a source.
- "The first search result looks fine" — Open it. Snippets misrepresent the page.
- "Wikipedia says so" — Useful as a lead, weak as final evidence. Follow its citations to the primary source.
- "Close enough" — Either the claim matches the source or it doesn't. Quote the part that matters.
- "This is obviously true" — Obvious things still need a citation when the user asked you to fact-check.

## Output Format

**Summary** — One line: how many claims checked, how many verified vs. issues found.

**Findings** — One entry per claim:

- **Claim** — Quoted or paraphrased, with location reference if from a longer text
- **Verdict** — Verified / Partially correct / Contradicted / Unverifiable / Disputed / Outdated
- **Evidence** — Bullet list of sources actually fetched. For each: URL, publisher, date (if known), and the supporting passage (quoted or tightly paraphrased)
- **Notes** — Caveats, hedges the source uses that the claim drops, time-sensitivity, low-confidence flags

**Out of scope** (if any) — Claims you didn't rate (subjective, prediction, definition-only) and why.

**Coverage gaps** (if any) — Claims you couldn't reach in this pass and what would be needed to check them.

## Verification

- [ ] Every "verified" / "contradicted" verdict cites at least one URL fetched in this run
- [ ] Load-bearing claims have ≥2 independent sources or one undisputed primary
- [ ] Source dates noted for time-sensitive claims
- [ ] No verdict relies solely on the model's pretraining
- [ ] Hedges in the source preserved in the report
- [ ] Disagreements between sources reported, not papered over
- [ ] Unverifiable claims explicitly labeled, not silently dropped
- [ ] Report written in the same language as the input; foreign-language quotes accompanied by a translation
