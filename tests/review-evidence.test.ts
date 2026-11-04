import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE = "references/engineering/review-evidence.md";
const REVIEW = "skills/review-code/SKILL.md";
const COMPOSITE = "skills/review-code-triage-verify/SKILL.md";
const PUBLISH = "skills/publish-pr-review/SKILL.md";
const LOOP = "skills/review-pr-loop/SKILL.md";
const METHOD = "references/engineering/review.md";
const MESSAGES = "references/workflow/user-facing-messages.md";
const CONTRACT = "references/workflow/reviewer-contract.md";
const PIPELINE = "references/workflow/verify-pipeline.md";
const TRIAGE = "skills/triage-findings/SKILL.md";
const FIX = "skills/fix-findings/SKILL.md";
const EXECUTOR = "references/workflow/executor-contract.md";
const RECOVERY = "references/workflow/fix-findings-recovery.md";
const FIX_RECONCILE = "skills/fix-findings-reconcile/SKILL.md";
const CONVENTIONS = "references/workflow/skill-conventions.md";

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function section(path: string, heading: string): string {
  const body = source(path).split(`\n## ${heading}\n`)[1]?.split("\n## ")[0];
  assert.ok(body, `${path} has ${heading}`);
  return body;
}

test("the review approval bar loads the evidence gate", () => {
  assert.match(section("references/engineering/review.md", "Approval Bar"), /review-evidence\.md[^\n]*Approval eligibility/);
});

test("risk sorts each change into three tiers and resolves doubt upward", () => {
  const risk = section(EVIDENCE, "Risk");
  assert.match(risk, /branch or range[^\n]*`low`, `standard`, or `high`[^\n]*record the reason/);
  assert.match(risk, /`high` covers a change to any sensitive path[^\n]*behavior that path owns/);
  assert.match(risk, /`low` covers changes confined to documentation, comments, tests, copy, or styling[^\n]*no change to logic, data shape, or shared interfaces/);
  assert.match(risk, /Every other change is `standard`/);
  assert.match(risk, /does not settle a tier, use the higher one/);
  assert.match(risk, /`paths`[^\n]*risk `not-applicable`/);
  assert.match(risk, /`\.github\/workflows\/`[^\n]*`CODEOWNERS`/);
  assert.match(risk, /reviewed repository's `AGENTS\.md` or `CLAUDE\.md` declares sensitive/);
  assert.match(risk, /declares sensitive at the merge-base or the head, and any change to those declarations/);
});

test("approval callers classify risk before applicability and eligibility", () => {
  assert.match(section("references/engineering/review.md", "Approval Bar"), /classify risk and applicability under `\.\/review-evidence\.md` §§ \*Risk\* and \*Applicability\*/);
  const capture = section(REVIEW, "Review pass").split("**Capture evidence.**")[1]?.split("\n\n")[0];
  assert.ok(capture);
  assert.match(capture, /review-evidence\.md` §§ \*Risk\*, \*Applicability\*, and \*Capture\*/);
});

test("high risk requires sign-off whether or not end users can observe the change", () => {
  const presentation = section(EVIDENCE, "Presentation and sign-off");
  assert.match(presentation, /`Evidence: risk <low\|standard\|high\|not-applicable> \(<reason>\); <applicability>; capture/);
  assert.match(presentation, /Risk `high` takes sign-off `pending` for every applicability until the engineer confirms/);
  assert.match(presentation, /Below risk `high`, `none` also uses `not-required` for sign-off and takes approval `eligible`/);
  assert.match(presentation, /`none` at risk `high`, present the object identity, the risk reason, and the code assessment/);
  assert.match(presentation, /`none` at risk `high`, ask whether the engineer signs off on the reviewed object/);
  assert.match(presentation, /Request sign-off only for `required` evidence or `none` at risk `high`, and only while sign-off is `pending`\./);
  assert.match(presentation, /`unknown` reports its gaps without asking, since no confirmation makes it eligible\./);
  assert.match(presentation, /combine sign-off and posting permission[^\n]*that evidence or object/);
  const eligibility = section(EVIDENCE, "Approval eligibility");
  assert.match(eligibility, /existing findings and verification bar plus applicability `none` below risk `high`/);
  assert.match(eligibility, /Confirmation covers required evidence, or the reviewed object for `none` at risk `high`/);
});

test("complete evidence at low risk is eligible without sign-off while gaps still need it", () => {
  const presentation = section(EVIDENCE, "Presentation and sign-off");
  assert.match(presentation, /At risk `low`, `complete` required evidence takes sign-off `not-required` and approval `eligible`/);
  assert.match(presentation, /Any other `required` evidence takes sign-off `pending` and approval `pending` until the engineer confirms/);
  assert.match(presentation, /Incomplete `required` evidence keeps approval pending until the engineer signs off[^\n]*every risk including `low`/);
  const eligibility = section(EVIDENCE, "Approval eligibility");
  assert.match(eligibility, /`complete` required evidence at risk `low`, or matching session confirmation/);
  assert.match(eligibility, /route needing confirmation without a valid one[^\n]*approval `pending`/);
});

test("evidence applicability distinguishes changed behavior from snapshots and uncertainty", () => {
  const applicability = section(EVIDENCE, "Applicability");
  assert.match(applicability, /branch or range/);
  assert.match(applicability, /visual and nonvisual/);
  assert.match(applicability, /`none`[^\n]*source-grounded reason/);
  assert.match(applicability, /[Uu]ncertain[^\n]*`unknown`/);
  assert.match(applicability, /`paths`[^\n]*`not-applicable`/);
});

test("capture retains authentic artifacts and runtime provenance outside disposable trees", () => {
  const capture = section(EVIDENCE, "Capture");
  assert.match(capture, /~\/\.local\/state\/agents-kit\/review-evidence\//);
  assert.match(capture, /changed feature flow end to end through the host's browser integration/);
  assert.match(capture, /browser context with no stored cookies, logins, or profile data/);
  assert.match(capture, /`no isolated browser context`/);
  assert.match(capture, /real screenshot at each step[^\n]*what that step showed/);
  assert.match(capture, /observable output[^\n]*nonvisual/);
  assert.match(capture, /runtime represents the reviewed object/);
  assert.match(capture, /head alone cannot establish[^\n]*running server/);
  assert.match(capture, /On a fork PR \(`isCrossRepository` true, whatever the PR's state\), run no command from the PR; capture of a `required` change stays `incomplete` with the gap `fork PR: local execution not authorized`/);
  assert.match(capture, /Run commands only once a lookup has established the head's status through one of these outcomes:\n\n- An OPEN PR at the reviewed head reading `isCrossRepository` false\./);
  assert.match(capture, /On a branch, its OPEN PR reading `isCrossRepository` false whose head is an ancestor of the reviewed `HEAD`/);
  assert.match(capture, /A completed lookup finding no open PR, when the reviewed head is the checkout's `HEAD`\. It completes when `gh pr view` reports no pull request for the branch\. The commit query in `\.\.\/workflow\/pr-lookup\.md`, run without its open-state filter, must also return no PR whose head repository differs from its base\. `No commit found for SHA` counts as no PR\. A repository with no remote completes the lookup without either call/);
  assert.match(capture, /Every other outcome runs no command[^\n]*`fork status unknown: local execution not authorized`\. That includes a skipped or failed lookup and a non-GitHub remote/);
  assert.match(section(REVIEW, "Setup"), /On a range with any other `b`[^\n]*pr-lookup\.md`, naming `isCrossRepository` among its fields/);
  assert.match(section(REVIEW, "Setup"), /missing `gh` or a non-GitHub remote skips the lookup, and a repository with no remote completes it with no PR/);
  assert.match(capture, /denied execution[^\n]*`incomplete`/);
  assert.match(capture, /denial grants no retry/);
  assert.match(capture, /only local or synthetic backends/);
  assert.match(capture, /no real credentials, accounts, sessions, or private data/);
  assert.match(capture, /Start every capture process with a cleared environment \(`env -i`\)[^\n]*temporary `HOME`/);
  assert.match(capture, /Pass no credential variables or agent sockets/);
  assert.match(capture, /names of the variables it passed and cleared, never their values/);
  assert.match(capture, /Preserve complete and incomplete sets[^\n]*worktree cleanup/);
  assert.match(capture, /Remove it with `git worktree remove --force` whenever capture ends, including on a stop or failure/);
  assert.match(capture, /Stop processes started for capture whenever capture ends, including on a stop or failure/);
  assert.match(section(LOOP, "Review head checks"), /review commands, and capture processes/);
});

test("confirmation is bound to presented immutable bytes and a direct session answer", () => {
  const capture = section(EVIDENCE, "Capture");
  const confirmation = section(EVIDENCE, "Presentation and sign-off");
  assert.match(capture, /index[^\n]*artifact hashes[^\n]*fingerprint/);
  assert.match(confirmation, /engineer's explicit answer/);
  assert.match(confirmation, /invocation, standing publishing consent, silence, CI, GitHub approval, and saved metadata supply no sign-off/);
  assert.match(confirmation, /another session's reply grants no current consent/);
  assert.match(confirmation, /Before accepting a reply[^\n]*before publication/);
  assert.match(confirmation, /`required`[^\n]*index hash[^\n]*every artifact hash[^\n]*both points/);
  assert.match(confirmation, /A reply that passes these rechecks updates the retained Evidence field: sign-off `confirmed`, and approval per § \*Approval eligibility\*/);
  assert.match(confirmation, /Later steps and publication read that updated field/);
  assert.match(confirmation, /invalidates confirmation[^\n]*fresh evidence and sign-off/);
  assert.match(confirmation, /Incomplete `required` evidence keeps approval pending until the engineer signs off/);
  assert.match(confirmation, /sign-off on the demonstrated changes together with those named gaps/);
  assert.match(section(EVIDENCE, "Approval eligibility"), /Confirmation of incomplete evidence names each gap/);
});

test("attached evidence reaches the PR author only through publication", () => {
  assert.match(section(EVIDENCE, "Capture"), /Upload artifacts only through[^\n]*publish-pr-review[^\n]*evidence selection/);
  const delivery = section(EVIDENCE, "Author delivery");
  assert.match(delivery, /`Evidence for the author:`/);
  assert.match(delivery, /uploaded screenshot for each step/);
  const process = section(PUBLISH, "Process");
  assert.match(process, /`Attach evidence — summary and K screenshots uploaded to GitHub` or `No evidence`/);
  assert.match(process, /upload each screenshot through the browser integration[^\n]*comment box/);
  assert.match(process, /failed upload stops before submission/);
  assert.match(process, /Both evidence stops report `Publish stopped: evidence not attached \(<reason>\)` and submit nothing/);
  assert.match(section(LOOP, "The pass"), /A named evidence-not-attached outcome reruns that submission once with `No evidence` pinned, recording `not attached \(<reason>\)` under \*\*Evidence\*\*\. Any other publication stop ends the loop/);
  assert.match(section(LOOP, "The pass"), /Pin `Attach evidence` only when publish step 4 offers it \(step 3 prepared an attachment and a browser integration is available\) and no earlier submission in this run attached the same evidence fingerprint; otherwise pin `No evidence`/);
  assert.match(section(LOOP, "Output"), /\*\*Evidence:\*\*[^\n]*each evidence set's attachment state \(attached, naming its submission, or not attached\)/);
});

test("publication identity checks do not require capture hashes for unaffected changes", () => {
  const confirmation = section(EVIDENCE, "Presentation and sign-off");
  const universal = confirmation.split("\n").find(line => line.startsWith("Before accepting a reply"));
  assert.ok(universal);
  assert.match(universal, /before publication[^\n]*repository, review kind, head[^\n]*merge-base/);
  assert.doesNotMatch(universal, /hash/);
  assert.match(confirmation, /`none`[^\n]*no capture directory, index, or artifact hashes/);
  const eligibility = section(EVIDENCE, "Approval eligibility");
  assert.match(eligibility, /existing findings and verification bar[^\n]*applicability `none`/);
  assert.match(eligibility, /Applicability `unknown`[^\n]*approval `pending`/);
});

test("capture follows reviewer intake and precedes wording on delegated and inline routes", () => {
  const pass = section(REVIEW, "Review pass");
  assert.match(pass, /After intake[^\n]*\*\*Capture evidence\*\*[^\n]*\*\*Prepare finding wording\*\*/);
  const capture = pass.split("**Capture evidence.**")[1]?.split("\n\n")[0];
  assert.ok(capture);
  assert.match(capture, /review-evidence\.md/);
  assert.match(capture, /once[^\n]*all primary reviewers are collected/);
  assert.match(capture, /`-n` and `-x` do not duplicate/);
  assert.match(pass, /Then apply[^\n]*\*\*Capture evidence\*\* and \*\*Prepare finding wording\*\*/);
  assert.match(section(REVIEW, "Output"), /composite caller owns[^\n]*question instead/);
});

test("review output keeps evidence separate from approval and preserves provenance", () => {
  const output = section(REVIEW, "Output");
  assert.match(output, /\*\*Evidence:\*\*[^\n]*review-evidence\.md/);
  assert.match(output, /Pending evidence or sign-off[^\n]*without an approval recommendation/);
  assert.match(output, /Reviewed <kind> at <head-sha> \(merge-base <base-sha>\) by <model>/);
  assert.match(output, /`paths`[^\n]*health verdict/);
});

test("the composite forwards evidence and asks only after the no-findings or verified route", () => {
  assert.match(section(COMPOSITE, "Phase 1 — Review"), /Retain[^\n]*Evidence field[^\n]*Suppress[^\n]*sign-off question/);
  const output = section(COMPOSITE, "Output");
  assert.match(output, /After Phase 3[^\n]*no findings[^\n]*review-evidence\.md/);
  assert.match(output, /\*\*Evidence:\*\*[^\n]*no-findings route still reports/);
  assert.match(output, /Verification verdicts do not replace evidence or confirmation/);
  assert.match(source(COMPOSITE), /No phase edits code[^\n]*writes to any source/);
});

test("publication consumes evidence from the reviewed source and holds missing metadata unknown", () => {
  const process = section(PUBLISH, "Process");
  assert.match(process, /source's Evidence field[^\n]*review-evidence\.md/);
  assert.match(process, /Missing metadata remains unknown/);
  assert.match(process, /Use the same evidence when tiers come from the loop/);
  assert.match(section(PUBLISH, "Preconditions — stop if unmet"), /Reject `paths`/);
});

test("every selected tier and approval-equivalent COMMENT body is subject to eligibility", () => {
  const process = section(PUBLISH, "Process");
  assert.match(process, /Use COMMENT when[^\n]*evidence approval is pending; APPROVE otherwise/);
  assert.match(process, /Minor findings or Improvements[^\n]*eligible loop approval/);
  assert.match(process, /approval sentence only on those three routes, when evidence eligibility permits[^\n]*findings bar/);
  assert.match(process, /pending empty review posts nothing[^\n]*own-PR or range COMMENT/);
  assert.match(process, /Every other COMMENT reports its entries without approving/);
});

test("an empty review can combine specific evidence sign-off with counted posting consent", () => {
  const process = section(PUBLISH, "Process");
  assert.match(process, /Before offering any sign-off option, present the identity, links, gaps, and fingerprint of evidence awaiting only session confirmation\./);
  assert.match(process, /Before offering any sign-off option[\s\S]*Sign off on this evidence and post <tier> with approval/);
  assert.match(process, /Sign off on this evidence and post approval — 0 comments/);
  assert.match(process, /sign-off variant beside each tier option whose findings bar allows approval/);
  assert.match(process, /On a branch, for evidence awaiting only session confirmation[^\n]*A range offers sign-off only through the all-empty `post clean review` option below/);
  assert.match(process, /question explicitly asks both engineer sign-off and posting permission/);
  assert.match(process, /Otherwise post nothing and name the evidence gap/);
});

test("a high-risk change no end user observes takes an object sign-off", () => {
  const process = section(PUBLISH, "Process");
  assert.match(process, /`none` at risk `high` awaiting only session confirmation takes the same sign-off options/);
  assert.match(process, /`Sign off on this change` in place of `Sign off on this evidence`/);
  assert.match(process, /presentation names the object identity and risk reason/);
  const pass = section(LOOP, "The pass");
  assert.match(pass, /\*\*Engineer sign-off\.\*\* Present the retained evidence, or the reviewed object for `none` at risk `high`/);
  assert.match(pass, /index and artifact hashes for required evidence/);
});

test("an approving body states whether approval was automatic or signed off by an engineer", () => {
  const process = section(PUBLISH, "Process");
  assert.match(process, /exactly one metadata block/);
  assert.match(process, /\n\s*Published: <selected cumulative tiers>; <N> inline, <M> in the body\n\s*\[Approval: <automatic or signed off by an engineer> \(risk <tier>; <reason or confirmed subject>\)\]\n/);
  assert.match(process, /`Approval:` line only when the payload carries an approval verdict or approval-equivalent wording/);
  assert.match(process, /Only three routes carry either: APPROVE, the own-PR COMMENT fallback that replaces an approval, and a range clean-review COMMENT/);
  assert.match(process, /Derive its route from the source Evidence field's `sign-off` slot as updated by any accepted session confirmation \(`\.\/references\/engineering\/review-evidence\.md` § \*Presentation and sign-off\*\), step 4's picker included/);
  assert.match(process, /Sign-off `not-required` posts `Approval: automatic \(risk <tier>; <reason>\)`/);
  assert.match(process, /`no end-user-visible change` for applicability `none`, or `complete evidence` for complete required evidence at risk `low`/);
  assert.match(process, /Sign-off `confirmed` posts `Approval: signed off by an engineer \(risk <tier>; <confirmed subject>\)`/);
  assert.match(process, /`evidence` for complete evidence, `evidence with named gaps` for incomplete evidence, or `reviewed change` for `none` at risk `high`/);
  assert.match(process, /Every other payload, including a COMMENT under the loop's override and a range COMMENT with findings, carries no `Approval:` line/);
  assert.match(process, /excluding the metadata block, approval sentence, and evidence list/);
});

test("the publication report names the approval route the posted body states", () => {
  const report = section(PUBLISH, "Process").split("**Report.**")[1];
  assert.ok(report);
  assert.match(report, /Name the approval route the posted `Approval:` line states, when the body carries one/);
});

test("post-selection drift cannot silently substitute or upgrade the consented payload", () => {
  const process = section(PUBLISH, "Process");
  assert.match(process, /before accepting the reply/);
  assert.match(process, /finding-only selection retains its previewed COMMENT payload/);
  assert.match(process, /Before any upload, repeat the live head\/merge-base checks[^\n]*Recheck evidence and confirmation[^\n]*upload each screenshot through the browser integration/);
  assert.match(process, /upload each screenshot through the browser integration[^\n]*Repeat the live head\/merge-base checks immediately before posting[^\n]*gh api --method POST/);
  assert.match(process, /approval that loses eligibility stops[^\n]*without submission or substitution as COMMENT/);
  assert.match(process, /never retry a rejected verdict as another verdict/);
});

test("all approval producers load the same evidence owner", () => {
  for (const path of ["references/engineering/review.md", PUBLISH, LOOP]) {
    assert.match(source(path), /review-evidence\.md/, `${path} has an evidence gate`);
  }
});

test("the loop preserves CI substitution while retaining capture and deferring the inner question", () => {
  const loop = source(LOOP);
  assert.match(loop, /This substitution does not skip evidence capture/);
  const pass = section(LOOP, "The pass");
  assert.match(pass, /Suppress the inner sign-off question/);
  assert.match(pass, /Retain its Evidence field, object identity, and fingerprint/);
  assert.match(pass, /verification scripts: skip — the session reads the PR's checks/);
});

test("the loop cannot mark green CI clean without eligible evidence", () => {
  const pass = section(LOOP, "The pass");
  assert.match(pass, /Mark code\/CI clear only when[^\n]*original Critical\/Major tier is empty[^\n]*nonempty check snapshot/);
  assert.match(pass, /Mark the pass clean only when code\/CI is clear and evidence approval is eligible/);
  assert.match(pass, /Only a clean pass[^\n]*pins `Post approval — 0 comments`/);
  assert.match(pass, /publish retained findings as COMMENT first, skip an empty submission[^\n]*Engineer sign-off/);
});

test("confirmation waiting rechecks bytes and CI without duplicating findings or advancing a stale pass", () => {
  const pass = section(LOOP, "The pass");
  assert.match(pass, /Unknown applicability ends[^\n]*approval pending/);
  assert.match(pass, /Incomplete evidence takes the same confirmation, naming each gap/);
  assert.match(pass, /Hold for an explicit reply[^\n]*silence cannot advance/);
  assert.match(pass, /Before accepting confirmation[^\n]*index and artifact hashes for required evidence\. A moved head/);
  assert.match(pass, /moved head takes \*\*Head moved\*\*/);
  assert.match(pass, /Changed base or evidence invalidates confirmation[^\n]*a failed identity or hash read counts as changed/);
  assert.match(pass, /A non-OPEN PR or failed selected-PR read stops/);
  assert.match(pass, /update the retained Evidence field[^\n]*without rerunning Review or incrementing the pass/);
  assert.match(pass, /Previously submitted entries stay excluded/);
});

test("a pre-existing finding is confirmed at the merge-base and never blocks approval", () => {
  const preexisting = section(METHOD, "Pre-existing findings");
  assert.match(preexisting, /branch or range, a finding carries the `Pre-existing` label when its defect is present at the merge-base and the change neither introduces nor worsens it/);
  assert.match(preexisting, /Whoever assigns the label confirms both conditions\. `git show <merge-base>:<path>` or `git blame` shows the defect at the merge-base\. The diff adds no caller, input, or path reaching it, and does not worsen it/);
  assert.match(preexisting, /defects found in the changed files and their blast radius, keeping severity by impact/);
  assert.match(preexisting, /newly reachable or worse owns the finding, so the label does not apply/);
  assert.match(preexisting, /A `Pre-existing` finding never blocks approval or merge/);
  assert.match(preexisting, /Fixing it is optional for the change/);
  assert.match(preexisting, /A path set has no baseline and assigns no label/);
});

test("unchanged code in the blast radius reports as labeled findings outside the approval bar", () => {
  assert.match(section(METHOD, "What NOT to Flag"), /- Issues in unchanged code outside the changed files and their blast radius\./);
  assert.match(section(METHOD, "Findings output shape"), /Each entry also carries the `Pre-existing` label where § \*Pre-existing findings\* assigns it/);
  assert.match(section(METHOD, "Approval Bar"), /§ \*Pre-existing findings\* exempts labeled findings from this bar/);
  assert.match(section(METHOD, "Standard Verification Checklist"), /no style-only findings, unchanged-code findings labeled `Pre-existing` unless the change owns them/);
});

test("finding entries and PR comments render the Pre-existing label after the marker", () => {
  const blocks = section(MESSAGES, "Blocks");
  assert.match(section(MESSAGES, "Finding entry wording"), /preserve severity, locator, the `Pre-existing` label, recommendation, impact, certainty, and every distinct claim\./);
  assert.match(blocks, /\*\*Finding entry\.\*\* The marker, then `\(Pre-existing\)` where the finding carries that label \(`\.\.\/engineering\/review\.md` § \*Pre-existing findings\*\), then the locator/);
  assert.match(blocks, /A labeled entry opens 🟡 Major \(Pre-existing\) `src\/export\.ts:42`/);
  assert.match(section(MESSAGES, "Surface adapters"), /\*\*GitHub PR review comments\.\*\*[^\n]*opens with its marker[^\n]*Any `\(Pre-existing\)` label follows the marker, then the preserved text/);
  assert.doesNotMatch(section(MESSAGES, "Markers"), /Pre-existing/);
  assert.match(section(PIPELINE, "Output: Batches and the Verified line"), /its canonical severity marker, a legacy prefix normalized first, then any `\(Pre-existing\)` label, then `file:line`/);
  assert.match(section(TRIAGE, "Output"), /its canonical severity marker, any `\(Pre-existing\)` label, its anchor/);
});

test("publication keeps the Pre-existing label and lets labeled Critical/Major entries approve", () => {
  const process = section(PUBLISH, "Process");
  assert.match(process, /A skipped Critical\/Major in \*\*verify\*\* without the `Pre-existing` label is unsettled\./);
  assert.match(process, /Use COMMENT when the selection contains a Critical\/Major entry without the `Pre-existing` label, an unsettled entry exists/);
  assert.match(process, /Keep any `\(Pre-existing\)` label directly after the GitHub marker/);
  assert.match(process, /\*\*Own-PR Approve fallback:\*\*[^\n]*Selections holding a Critical\/Major entry without the `Pre-existing` label already use COMMENT, as do range selections/);
});

test("the loop publishes Pre-existing entries without letting them hold code/CI clear", () => {
  const pass = section(LOOP, "The pass");
  assert.match(pass, /Entries labeled `Pre-existing` \(`\.\/references\/engineering\/review\.md` § \*Pre-existing findings\*\) publish in their severity tier but never count as original Critical\/Major entries for code\/CI-clear, clean, or ending decisions/);
  assert.match(pass, /Mark code\/CI clear only when that original Critical\/Major tier is empty and a nonempty check snapshot contains only `pass` or `skipping`\./);
});

test("the settle spot-checks Critical/Major Pre-existing labels against the merge-base", () => {
  assert.match(section(CONTRACT, "The settle"), /Spot-check only Critical\/Major anchors against the object\. Also spot-check each Critical\/Major `Pre-existing` label against the merge-base and the diff \(`\.\.\/engineering\/review\.md` § \*Pre-existing findings\*\)\. Remove the label when the merge-base lacks the defect or the diff reaches or worsens it\. Remove it too when either check is unclear/);
  assert.match(section(CONTRACT, "The settle"), /Intake and the `Pre-existing` label spot-check still run/);
  assert.match(section(PIPELINE, "The review composite"), /The adopt, anchor spot-check, and final-verdict steps do not run\. The `Pre-existing` label spot-check still runs on Critical\/Major entries, in full as `\.\/reviewer-contract\.md` § \*The settle\* defines it, including the rule for pooled returns that disagree on a label/);
});

test("fix-findings keeps the Pre-existing label and asks once whether to include labeled findings", () => {
  assert.match(section(FIX, "Source"), /Preserve each finding's wording, severity, `Pre-existing` label, anchor, root cause, and fix options as supplied/);
  const gate = section(FIX, "The Gate: Auto vs Ask");
  assert.match(gate, /In the same batched round, ask one question whether to include the selected actionable findings labeled `Pre-existing` \(`\.\/references\/engineering\/review\.md` § \*Pre-existing findings\*\)\./);
  assert.match(gate, /A `Pre-existing` finding the user named individually, by number, anchor, or quoted text, counts as included and stays out of the question\./);
  assert.match(gate, /Route included findings like any other finding\./);
  assert.match(gate, /Report excluded ones under \*\*Decided\*\* as excluded `Pre-existing` findings\./);
  assert.match(gate, /until the inclusion question and every initial Ask finding have an explicit user decision/);
  assert.doesNotMatch(gate, /\*\*Ask:\*\*[^\n]*`Pre-existing`/);
  const output = section(FIX, "Output");
  assert.match(output, /Preserve the finding's original text, severity, and any `Pre-existing` label in each entry/);
  assert.match(output, /\*\*Decided:\*\*[^\n]*`Pre-existing` findings the user excluded through the inclusion question, with that reason/);
});

test("fix-findings applies verified and non-functional fixes without asking", () => {
  const gate = section(FIX, "The Gate: Auto vs Ask");
  assert.match(source(FIX).split("\n---\n")[0], /\ndescription:[^\n]*Applies eligible Confirmed and non-functional fixes automatically/);
  assert.match(gate, /\*\*Withdrawn and Inconclusive findings are never edited\.\*\* Put them in Untouched with their verdict\. Apply a fix without asking only when it meets an Auto tier/);
  assert.match(gate, /\*\*Auto, verified:\*\* a Confirmed finding with one unambiguous targeted change, confined to reviewed files, with no new dependency or public API or behavior change beyond the finding\. A fix that changes behavior qualifies\./);
  assert.match(gate, /\*\*Auto, non-functional:\*\* a finding with any verdict or none, except Withdrawn or Inconclusive, whose fix is one unambiguous targeted change confined to reviewed files\. The change must fall within the `low` tier of `\.\/references\/engineering\/review-evidence\.md` § \*Risk\*\./);
  assert.doesNotMatch(gate, /\*\*Ask:\*\*[^\n]*unverified findings/);
  assert.doesNotMatch(section(TRIAGE, "Output"), /asking approval for unverified fixes/);
  assert.match(gate, /Route a consequential change in a document's claim, decision, or intended audience to Ask/);
  assert.match(gate, /Route a test edit to Ask unless its finding is Confirmed\./);
  assert.match(gate, /Treat a file named only as a proposed remedy as outside the reviewed files for Auto\. Route that fix to Ask\./);
});

test("fix-findings asks ask-routed findings as option questions without diffs", () => {
  const gate = section(FIX, "The Gate: Auto vs Ask");
  const frontmatter = source(FIX).split("\n---\n")[0];
  assert.match(frontmatter, /\ndescription:[^\n]*other actionable fixes ask the user to pick from analyzed options with a recommendation/);
  assert.doesNotMatch(frontmatter, /diff/i);
  assert.match(gate, /For each Ask finding, show the finding, its viable fix options, their material trade-offs, and your recommended option\./);
  assert.match(gate, /the executors it will launch for those fixes and for each option the Ask round approves/);
  assert.match(gate, /A decision picks one shown option, or skips, defers, or rejects the finding\. A general go-ahead that names no option picks none, unless the question showed only one option\./);
  assert.doesNotMatch(gate, /concrete diff/);
  assert.doesNotMatch(gate, /\bdiffs?\b/i);
});

test("fix-findings delegates picked options like Auto fixes and its executor binding applies none inline", () => {
  const applying = section(FIX, "Applying Fixes");
  const strategy = applying.split("\n### Execution strategy")[1]?.split("\n### ")[0];
  assert.ok(strategy);
  assert.match(strategy, /Delegate every fix the run applies, Auto or Ask[^\n]*An Ask fix settles when the user picks its option\./);
  assert.match(applying, /An executor that returns a pending impactful choice for any fix, Auto or picked, restores the same way[^\n]*re-executes only after the user picks from a fresh option question with a recommendation/);
  const binding = section(EXECUTOR, "Bindings").split("\n### fix-findings\n")[1];
  assert.ok(binding);
  assert.match(binding, /delegated once its change is settled: an Auto fix, or an Ask fix after the user picks its option\./);
  assert.match(binding, /A picked option takes the same packet as an Auto fix: the picked option is the chosen fix, and the prior-decisions item carries the user's pick\./);
  assert.match(binding, /\*\*Picked-option intake:\*\* before recording a picked option's change set, compare the report's `Changes` with the picked option\./);
  assert.match(binding, /\*\*Outside the delegation surface:\*\* findings the run does not fix receive no edits/);
  assert.doesNotMatch(binding, /coordinator applies[^\n]*inline/);
  assert.doesNotMatch(binding, /Approved-diff intake/);
  assert.doesNotMatch(binding, /approved diff|concrete diff|apply that diff|formatter-only drift/i);
  assert.doesNotMatch(section(EXECUTOR, "Write-mode routing"), /concrete change/);
  assert.doesNotMatch(source(FIX), /approved diff|concrete diff|approved-diff|formatter-only drift/i);
});

test("fix-findings recovery re-executes picked options like Auto fixes", () => {
  assert.match(section(RECOVERY, "Dependency-safe recovery"), /An Auto fix or a picked option may be re-executed through the selected executor\./);
  assert.doesNotMatch(source(RECOVERY), /approved diff|concrete diff|concrete-diff|approved-diff|fresh diff|replay[^\n]*verbatim|verbatim[^\n]*replay/i);
});

test("pending endings retain the worktree and report evidence even without findings", () => {
  assert.match(section(LOOP, "Ending"), /Pending endings retain it[^\n]*Preserve evidence directories/);
  assert.match(section(LOOP, "Output"), /\*\*Evidence:\*\*[^\n]*name evidence gaps even with no findings/);
  assert.match(section(LOOP, "The pass"), /discards[^\n]*evidence confirmation[^\n]*Retain artifact directories as stale evidence/);
});

function override(name: string): string {
  const line = section(FIX_RECONCILE, "Core Rules").split("\n").find((entry) => entry.startsWith(`- **${name}**: `));
  assert.ok(line, `${FIX_RECONCILE} states the ${name} override`);
  return line;
}

test("fix-findings-reconcile runs fix-findings in full, then reconcile-task in full", () => {
  const skill = source(FIX_RECONCILE);
  assert.match(section(FIX_RECONCILE, "Core Rules"), /Phase 1 runs `\.\.\/fix-findings\/SKILL\.md`'s full protocol; Phase 2 runs `\.\.\/reconcile-task\/SKILL\.md`'s full protocol\./);
  assert.ok(skill.indexOf("\n## Phase 1 — Fix\n") < skill.indexOf("\n## Phase 2 — Reconcile\n"));
  assert.match(section(FIX_RECONCILE, "Phase 1 — Fix"), /^\nExecute `\.\.\/fix-findings\/SKILL\.md` end to end/);
  assert.match(section(FIX_RECONCILE, "Phase 2 — Reconcile"), /^\nExecute `\.\.\/reconcile-task\/SKILL\.md` end to end against the folder resolved before Phase 1, with Phase 1's Output as session evidence\./);
});

test("fix-findings-reconcile passes the source and fix flags through and takes no task argument", () => {
  const frontmatter = source(FIX_RECONCILE).split("\n---\n")[0];
  assert.match(frontmatter, /\nargument-hint: '\[source\] \[-e native\|codex\|claude\] \[-1 [^\n]*\] — passed through to the fix phase'/);
  assert.doesNotMatch(frontmatter, /\nargument-hint:[^\n]*task/);
  assert.match(section(FIX_RECONCILE, "Flags"), /`-e native\|codex\|claude` and `-1` pass through to `\.\.\/fix-findings\/SKILL\.md` unchanged[^\n]*Neither changes Phase 2\./);
  assert.match(section(FIX_RECONCILE, "Phase 1 — Fix"), /passing the source argument and the flags through unchanged/);
  assert.match(section(FIX_RECONCILE, "When to Use"), /\n`\/fix-findings-reconcile` takes no task argument; its one positional argument is the findings source\. A Handoff prints it bare, and a cold reader appends no handoff token\. A cold session picks the task from the active list, as `\.\.\/reconcile-task\/SKILL\.md` § \*1\. Resolve the Task Folder\* does when no task is established\.\n/);
});

test("fix-findings-reconcile resolves the task before Phase 1 and defers the loader's repair", () => {
  const resolution = override("Task resolution first");
  assert.match(resolution, /resolve the folder under `\.\.\/reconcile-task\/SKILL\.md` § \*1\. Resolve the Task Folder\* before Phase 1 starts\./);
  assert.match(resolution, /Announce it before the run's first write\./);
  assert.match(resolution, /With no active task, stop before any edit and point at `\/fix-findings`\./);
  assert.match(resolution, /Resolution only reads; the loader's identifier repair \(`\.\.\/reconcile-task\/SKILL\.md` § \*2\. Load Artifacts\*\) waits for Phase 2\./);
  assert.match(resolution, /Resolution still checks the plan's Status before loading \(`\.\/references\/workflow\/task-layout\.md` § \*Reading a resolved folder\*, step 1\)\. On a `skipped` plan, stop before any edit and point at `\/fix-findings`\./);
  assert.match(resolution, /Phase 2 reuses the resolved folder\./);
  assert.match(section(FIX_RECONCILE, "When to Use"), /\*\*Skip when\*\* no task applies, or the task's plan is `skipped` → `\/fix-findings`;/);
});

test("fix-findings-reconcile starts Phase 2 only after Phase 1 prints its Output", () => {
  const boundary = override("Phase boundary");
  assert.match(boundary, /Phase 2 starts only after Phase 1 prints its Output\./);
  assert.match(boundary, /A Phase 1 stop that renders no Output[^\n]*no findings, staged content, or a rejected flag, ends the run with no task-doc write\./);
  assert.match(override("Chat display"), /Phase 1's Output prints in full, except its Handoff, before Phase 2 starts\./);
  assert.match(override("Phase 2 stop"), /a Phase 2 stop before any task-doc write, such as a loader exit 2 whose `recovery` is `none` or `restored` \(`\.\/references\/workflow\/task-layout\.md` § \*Reading a resolved folder\*\), ends the run with Phase 1's Output and commits standing\./);
  const rules = section(FIX_RECONCILE, "Core Rules");
  assert.strictEqual(rules.split("\n").filter((entry) => /^- \*\*[^*]+\*\*: /.test(entry)).length, 7);
  assert.match(rules, /Seven overrides apply pipeline-wide:/);
});

test("fix-findings-reconcile composes one Handoff for both phases", () => {
  assert.match(override("Handoff"), /neither inner Handoff prints; this skill's Output composes one block for both phases\./);
  const output = section(FIX_RECONCILE, "Output");
  assert.strictEqual(output.split("Close with the Handoff block").length, 2);
  assert.match(output, /\*\*Fix\*\*: Phase 1's Output[^\n]*without its Handoff\./);
  assert.match(output, /\*\*Reconcile\*\*: Phase 2's findings report[^\n]*without its Handoff\./);
  assert.match(output, /- \*\*Done:\*\* the landed commits and fixed findings, pointing at \*\*Commits\*\* and \*\*Fixed\*\*, and the reconciled task docs, pointing at \*\*Reconciliation applied\*\*\. After a Phase 2 stop, Done drops the \*\*Reconciliation applied\*\* pointer\./);
  assert.match(output, /\*\*Reconcile\*\*: [^\n]*After a Phase 2 stop, this section carries Phase 2's stop report instead\./);
  assert.match(output, /- \*\*Know:\*\* [^\n]*After a Phase 2 stop, state that no task record was written and why\. When the loader's `recovery` is `partial`, name the `unrecovered` paths and their `recoveryErrors` instead\./);
  assert.match(output, /- \*\*Know:\*\* [^\n]*Point at \*\*Health uncertifiable\*\*, \*\*Retained, failing\*\*, or \*\*Fix failed\*\* when they hold entries\./);
  assert.match(output, /- \*\*Know:\*\* [^\n]*With mixed code and documentation fixes, name the second review: `\/review-docs` on each changed document\./);
  assert.match(output, /- \*\*Know:\*\* [^\n]*Name any compaction trigger Phase 2 left untested\./);
  assert.match(output, /- \*\*Awaiting you:\*\* point at Phase 1's \*\*Awaiting decision\*\* bucket and the \*\*Awaiting decision\*\* rows under \*\*Not reconciled:\*\*\. Name any compaction proposal Phase 2 left awaiting your confirmation\./);
  assert.match(output, /- \*\*Next:\*\* a review of the landed fixes[^\n]*`\/review-code` or `\/review-code-triage-verify` over `<start>\.\.HEAD`, or `\/review-docs` for documentation-only fixes\./);
  assert.match(output, /- \*\*Next:\*\* [^\n]*Uncommitted fixes take the `\/commit` route that `\.\.\/fix-findings\/SKILL\.md` § \*Output\* names\./);
  assert.match(output, /- \*\*Next:\*\* [^\n]*Route each \*\*Needs work\*\* row under \*\*Not reconciled:\*\* to the skill or other owner it names, such as `\/plan-task` or `\/verify-issue`\./);
});

test("fix-findings-reconcile sanctions settled corrections alongside delegation and batch commits", () => {
  const rules = section(FIX_RECONCILE, "Core Rules");
  assert.match(rules, /\*\*Sanctioned writes\.\*\* Invocation sanctions three writes: executor delegation for every applied fix, a commit per concern batch or one commit under `-1`, and the settled corrections Phase 2 applies to the resolved folder\./);
  assert.match(rules, /A proposal or Next line for this skill names all three \(`\.\/references\/workflow\/user-facing-messages\.md` § \*Blocks\* → \*\*The proposal line\*\*\)\./);
  assert.match(rules, /Phase 2 writes task docs within `\.\/references\/workflow\/reconciliation-session-to-docs\.md` § \*Write surface\*\./);
  assert.match(rules, /The run makes no push, source reply, thread resolution, live-page write, or other Git mutation\./);
});

test("fix-findings-reconcile's own gate replaces the fix phase's proposal and makes both phases user-invoked", () => {
  const lines = source(FIX_RECONCILE).split("\n");
  assert.strictEqual(lines[lines.indexOf("## Core Rules") + 4], "**Model invocation:** requires a confirmed proposal (`./references/workflow/skill-conventions.md` § *The invocation gate*).");
  assert.doesNotMatch(source(FIX_RECONCILE).split("\n---\n")[0], /disable-model-invocation/);
  const gate = override("Invocation gate");
  assert.match(gate, /this skill's proposal \(§ \*Phase 1 — Fix\*\) replaces `fix-findings`' model-invoked proposal \(`\.\.\/fix-findings\/SKILL\.md` § \*The Gate: Auto vs Ask\*\)\./);
  assert.match(gate, /A typed command or a confirmed proposal makes both phases user-invoked\./);
  assert.match(gate, /Phase 1 takes its batch commits \(`\.\.\/fix-findings\/SKILL\.md` § \*Batch commits\*\) and executor delegation \(`\.\/references\/workflow\/executor-routing\.md` § \*The registry and its authorization\*\) from that invocation\./);
  assert.match(gate, /Phase 2 takes its settled corrections from it \(`\.\/references\/workflow\/reconciliation\.md` § \*Consent model: findings apply, the record carries them\*\)\./);
  assert.match(gate, /A proposal that left the corrections unnamed makes Phase 2 ask before each correction\./);
  const phase = section(FIX_RECONCILE, "Phase 1 — Fix");
  assert.match(phase, /After task resolution and once `fix-findings`' classification stands, a model-invoked run asks one proposal\. It comes before any edit, executor launch, staging, commit, or task-doc write\./);
  assert.match(phase, /It names the task folder, the findings, and the Auto fixes applied unasked\. It names the executors for those fixes and for each option the Ask round approves\./);
  assert.match(phase, /It names a commit per concern batch, or one commit under `-1`, and the settled corrections Phase 2 applies to the folder\./);
  assert.match(phase, /The `Pre-existing` question and the Ask round still run through either door\./);
});

test("skill-conventions registers fix-findings-reconcile as a confirm-gated composite with fix-phase batch commits", () => {
  assert.match(section(CONVENTIONS, "Current members"), /\n- `fix-findings-reconcile` — apply findings through `fix-findings`, then record them in the session's task through `reconcile-task`\./);
  const invocation = section(CONVENTIONS, "The invocation gate");
  assert.match(invocation, /\n- `fix-findings-reconcile` — the user's preference for explicit invocation; the proposal is its § \*Phase 1 — Fix\*\./);
  assert.match(invocation, /A `fix-findings` run, or the fix phase of a `fix-findings-reconcile` run, grants concern-batch commits only under `skills\/fix-findings\/SKILL\.md` § \*Batch commits\*\. There, the invoked skill's invocation through either door is the explicit request `commit` requires\./);
});

test("fix-findings-reconcile maps each fix-findings bucket to a reconcile-task row", () => {
  const phase = section(FIX_RECONCILE, "Phase 2 — Reconcile");
  assert.match(phase, /Phase 1's buckets add these rows to its session mapping \(`\.\/references\/workflow\/reconciliation-session-to-docs\.md` § \*`reconcile-task` — session findings\*\)/);
  assert.match(phase, /- \*\*Commits\*\* and \*\*Fixed\*\* take the session-narrative row\. The Reconciliation entry names each landed SHA, each fixed finding, and the label of each option the user picked\./);
  assert.match(phase, /- \*\*Fix failed\*\*, \*\*Retained, failing\*\*, and \*\*Health uncertifiable\*\* findings go under Not reconciled as Needs work rows\. So do \*\*Decided\*\* findings the user deferred, \*\*Untouched\*\* findings the run's selection excluded, and \*\*Untouched\*\* findings listed `not attempted`\. Their owner is `\/fix-findings-reconcile`, or `\/plan-task` when the finding needs redesign\./);
  assert.match(phase, /- \*\*Untouched\*\* Inconclusive findings, triage `verify` entries, and `anchor moved` entries go under Not reconciled as Needs work rows, owner `\/verify-issue`\./);
  assert.match(phase, /- \*\*Untouched\*\* external-page fixes held back by the working-tree write limit go under Not reconciled as Needs work rows, owner the user\./);
  assert.match(phase, /- Each Needs work row names its bucket and its reason\./);
  assert.match(phase, /- \*\*Decided\*\* findings the user rejected or skipped, and excluded `Pre-existing` findings, take the session-narrative row with their reason\. So do \*\*Untouched\*\* Withdrawn findings, resolved threads, triage `addressed` entries, and `not actionable` complaints\. None of them gets a Not reconciled row\./);
  assert.match(phase, /- Phase 1's \*\*Awaiting decision\*\* findings go under Not reconciled as Awaiting decision rows with their options and recommendation, owner `\/fix-findings-reconcile`\./);
  assert.match(phase, /- \*\*No result owed\*\*: when the task has no result and is owed none \(`\.\/references\/workflow\/reconciliation\.md` § \*The record\*\), the printed change list and dated headings in the context or plan carry the record\. Phase 2 creates no result solely to log the fixes\./);
});

function nextLine(path: string): string {
  const line = source(path).split("\n").find((entry) => entry.startsWith("- **Next:** "));
  assert.ok(line, `${path} has a Handoff Next line`);
  return line;
}

test("fix-findings-reconcile's When to Use states the proven-link condition and its three proof forms", () => {
  const use = section(FIX_RECONCILE, "When to Use");
  assert.match(use, /\*\*Route from a review\*\* to this skill only when the session has an established task and the reviewed work is provably that task's\. Proof is one of three forms:/);
  assert.match(use, /\n- a reviewed branch or PR that matches the task's `result\.md` Pointers;\n- a review started on the task folder;\n- a reviewed document that is the task's deliverable or a path its plan names\.\n/);
  assert.match(use, /With an established task but no proof, offer this skill and `\/fix-findings`, preferring `\/fix-findings` of the two\. That preference leaves the Handoff's overall recommendation open\./);
  assert.match(use, /Without an established task, propose `\/fix-findings` alone\./);
});

test("the six review Handoff Next lines route to fix-findings-reconcile only on a proven link", () => {
  const cite = "(`../fix-findings-reconcile/SKILL.md` § *When to Use*)";
  const routes: [string, RegExp, RegExp][] = [
    [REVIEW, /When the reviewed paths provably belong to the session's task \(`[^`]+` § \*When to Use\*\), they go to `\/fix-findings-reconcile` instead\./, /With a session task and no proof, offer both routes and recommend `\/fix-findings`\./],
    [COMPOSITE, /`\/fix-findings-reconcile` takes the place of `\/fix-findings` when the reviewed object is provably the session task's work, as `\.\.\/fix-findings-reconcile\/SKILL\.md` § \*When to Use\* defines proof\./, /Without that proof but with a session task, list both fix routes and prefer `\/fix-findings` to `\/fix-findings-reconcile`\./],
    ["skills/review-docs/SKILL.md", /Offer `\/fix-findings-reconcile` in place of `\/fix-findings` when the audited document is provably the session task's \(`[^`]+` § \*When to Use\*\)\./, /If a session task exists without that proof, show `\/fix-findings` and `\/fix-findings-reconcile`, favoring `\/fix-findings` of the two\./],
    [LOOP, /When the PR provably carries the session task's work \(`[^`]+` § \*When to Use\*\), propose `\/fix-findings-reconcile` in place of `\/fix-findings`\./, /A session task without that proof gets both fix routes, with `\/fix-findings` preferred over `\/fix-findings-reconcile`\./],
    [TRIAGE, /Where the triaged findings provably concern the session task's work \(`[^`]+` § \*When to Use\*\), name `\/fix-findings-reconcile` instead/, /Lacking proof while a session task exists, present both fix routes and rank `\/fix-findings` above `\/fix-findings-reconcile`\./],
    ["skills/triage-findings-verify/SKILL.md", /Swap in `\/fix-findings-reconcile` for `\/fix-findings` when the findings' work is provably the session task's \(`[^`]+` § \*When to Use\*\)\./, /A session task with no proof shows `\/fix-findings` and `\/fix-findings-reconcile`, the first preferred over the second\./],
  ];
  for (const [path, proven, unproven] of routes) {
    const next = nextLine(path);
    assert.match(next, proven, `${path} routes a proven link to the composite`);
    assert.match(next, unproven, `${path} prefers /fix-findings over the composite without proof`);
    assert.ok(next.includes(path === COMPOSITE ? "`../fix-findings-reconcile/SKILL.md` § *When to Use*" : cite), `${path} cites the composite's When to Use`);
  }
  const [prRoute, pathsRoute] = nextLine(REVIEW).split("A `paths` object sits on no PR");
  assert.ok(pathsRoute);
  assert.match(prRoute, /on a `pr` object, `\/publish-pr-review` posts the selected severity tier/);
  assert.doesNotMatch(prRoute, /fix-findings/);
  assert.match(pathsRoute, /`\/fix-findings-reconcile`/);
  assert.match(nextLine("skills/review-docs/SKILL.md"), /The request form, such as `apply findings 1 and 3`, is the explicit request's paste-ready line\./, "review-docs gives the request form to the explicit-request route");
});
