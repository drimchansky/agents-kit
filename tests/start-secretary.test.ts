import assert from "node:assert";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { applyProposal, openStore, append, status as runbookStatus } from "../scripts/secretary-state.ts";

import { configure as configureMeeting, start as startMeeting, finish as finishMeeting, status as meetingStatus } from "../scripts/meeting-sync-state.ts";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SKILL_DIR = join(REPO_DIR, "skills", "start-secretary");
const SKILL = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
const WORKFLOW_DIR = join(REPO_DIR, "references", "workflow");
const INIT_CONFIG = readFileSync(join(REPO_DIR, "skills", "init-config", "SKILL.md"), "utf8");
const CONTRACT = readFileSync(join(WORKFLOW_DIR, "secretary-contract.md"), "utf8");
const DUTY = readFileSync(join(REPO_DIR, "references", "secretary", "runbook-maintenance.md"), "utf8");
const CONVENTIONS = readFileSync(join(WORKFLOW_DIR, "skill-conventions.md"), "utf8");
const DOMAIN_PACKS = readFileSync(join(WORKFLOW_DIR, "domain-packs.md"), "utf8");
const HELPER = join(REPO_DIR, "scripts", "secretary-state.ts");
const TEST_ROOT = realpathSync(mkdtempSync(join(tmpdir(), "agents-kit-start-secretary-")));

after(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

function section(text: string, heading: string): string {
  const level = /^#+/.exec(heading)?.[0].length ?? 0;
  assert.ok(level > 0, `not a heading: ${heading}`);
  const body = text.split(`\n${heading}\n`)[1];
  assert.ok(body !== undefined, `missing heading: ${heading}`);
  return body.split(new RegExp(`\\n#{1,${level}} `))[0];
}

function frontmatter(text: string): Map<string, string> {
  const lines = text.split("\n");
  assert.strictEqual(lines[0], "---", "SKILL.md opens with a frontmatter fence");
  const end = lines.indexOf("---", 1);
  assert.ok(end > 0, "SKILL.md frontmatter is terminated");
  const fields = new Map<string, string>();
  for (const line of lines.slice(1, end)) {
    const match = /^([a-z-]+):\s*(.*)$/.exec(line);
    if (match) fields.set(match[1], match[2]);
  }
  return fields;
}

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function helper(home: string, args: readonly string[], input?: string): Run {
  const result = spawnSync(process.execPath, [HELPER, ...args], {
    encoding: "utf8",
    env: { ...process.env, HOME: home },
    input,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function configuredHome(name: string): { readonly home: string; readonly runbook: string } {
  const home = join(TEST_ROOT, name);
  const runbook = join(home, "runbook");
  mkdirSync(runbook, { recursive: true });
  writeFileSync(join(runbook, "README.md"), "# Runbook\n");
  mkdirSync(join(home, ".config", "agents-kit"), { recursive: true });
  writeFileSync(join(home, ".config", "agents-kit", "config.json"), JSON.stringify({ runbookRoot: "~/runbook" }));
  return { home, runbook };
}

test("frontmatter names the skill and carries a description", () => {
  const fields = frontmatter(SKILL);
  assert.strictEqual(fields.get("name"), "start-secretary");
  assert.notStrictEqual((fields.get("description") ?? "").trim(), "", "the skill has a description");
});

test("the skill links the shared references, ships no AGENTS.md link, and cites no domain pack", () => {
  assert.strictEqual(
    lstatSync(join(SKILL_DIR, "AGENTS.md"), { throwIfNoEntry: false }),
    undefined,
    "the skill ships no AGENTS.md link, so it never loads the core rules itself",
  );
  const references = join(SKILL_DIR, "references");
  assert.ok(lstatSync(references).isSymbolicLink(), "references is a symlink");
  assert.strictEqual(readlinkSync(references), "../../references", "references points at ../../references");
  assert.doesNotMatch(SKILL, /references\/(engineering|documentation)\//, "the skill resolves no domain pack");
});

test("skill-conventions and domain-packs register the skill as a pack-free standalone protocol", () => {
  assert.match(section(CONVENTIONS, "### Standalone protocols"), /^- `start-secretary` — /m);
  const packFree = DOMAIN_PACKS.split("- **Pack-free skills**")[1]?.split("\n\n")[0] ?? "";
  assert.match(packFree, /^ {2}- `start-secretary` /m);
});

test("every section the skill cites exists in its owner", () => {
  const cited = new Set<string>();
  for (const match of SKILL.matchAll(/`\.\/((?:references\/[^`]+|AGENTS)\.md)`(?: § \*([^*]+)\*)?/g)) {
    const [, path, heading] = match;
    cited.add(path);
    const file = join(SKILL_DIR, path);
    assert.ok(existsSync(file), `cited file exists: ${path}`);
    if (heading === undefined) continue;
    const headings = readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => /^#+ /.test(line))
      .map((line) => line.replace(/^#+ /, ""));
    assert.ok(
      headings.some((title) => title === heading || title.startsWith(`${heading} (`)),
      `${path} has § ${heading}`,
    );
  }
  for (const owner of ["references/workflow/secretary-contract.md", "references/scripts/secretary-state.md", "references/secretary/runbook-maintenance.md"]) {
    assert.ok(cited.has(owner), `the skill cites ${owner}`);
  }
  for (const match of SKILL.matchAll(/(?<!` )§ \*([^*]+)\*/g)) {
    assert.ok(SKILL.includes(`\n## ${match[1]}\n`), `the skill's own § ${match[1]} exists`);
  }
});

test("the confirm-gated roster names an existing proposal section for start-secretary and init-config", () => {
  const roster = CONVENTIONS.split("**Confirm-gated skills:**\n")[1]?.trimStart().split("\n\n")[0] ?? "";
  for (const [skill, text] of [["start-secretary", SKILL], ["init-config", INIT_CONFIG]] as const) {
    const entry = roster.split("\n").find((line) => line.startsWith(`- \`${skill}\` — `));
    assert.ok(entry, `the confirm-gated roster lists ${skill}`);
    const heading = /§ \*([^*]+)\*\.$/.exec(entry)?.[1];
    assert.ok(heading, `the ${skill} roster entry names its proposal section`);
    const titles = text.split("\n").filter((line) => /^#+ /.test(line)).map((line) => line.replace(/^#+ /, ""));
    assert.ok(titles.includes(heading), `${skill} has § ${heading}`);
  }
});

test("both secretary adapters carry the role name and contract citation the launch checks read", () => {
  const codex = readFileSync(join(REPO_DIR, "agents", "secretary.toml"), "utf8");
  assert.match(codex, /^name = "secretary"$/m);
  assert.match(codex, /developer_instructions = """[\s\S]*secretary-contract\.md/);
  const [header, body = ""] = readFileSync(join(REPO_DIR, "agents", "secretary.md"), "utf8").split("\n---\n");
  assert.match(body, /`references\/workflow\/secretary-contract\.md`/, "the Claude adapter's body carries the citation the effective-definition check reads");
  assert.doesNotMatch(header, /^tools:/m, "an allowlist would drop the connectors the secretary reads");
});

test("the runbook report renders only the duty's reply headings and its unavailable-evidence class", () => {
  const headings = new Set([...section(DUTY, "## The reply").matchAll(/^- `([^`]+)`:/gm)].map((match) => match[1]));
  assert.ok(headings.size > 0, "the duty lists reply headings");
  assert.match(SKILL, /runbook-maintenance\.md` § \*The reply\*/);
  const report = section(DUTY, "## Coordinator report");
  const blocks = [...report.matchAll(/^- \*\*([^*]+):\*\*/gm)]
    .map((match) => match[1])
    .filter((block) => !["Done", "Know", "Awaiting you", "Next"].includes(block));
  assert.ok(blocks.length > 0, "the report renders blocks");
  for (const block of blocks) assert.ok(headings.has(block), `the duty's reply carries ${block}`);
  const classes = new Set([...section(DUTY, "## Review").matchAll(/^- `([^`]+)`:/gm)].map((match) => match[1]));
  assert.ok(classes.has("unavailable evidence"), "the duty defines the unavailable-evidence class");
  assert.ok(report.includes("`unavailable evidence`"), "the report renders the unavailable-evidence class");
});

test("every section that matches automatic wakes uses the owner tag the wake prompt opens with", () => {
  const tag = "[agents-kit secretary <id>]";
  const prompts = [...section(SKILL, "## Arm the wake").matchAll(/`([^`]+)`/g)].map((match) => match[1]).filter((span) => span.startsWith(`${tag} `));
  assert.strictEqual(prompts.length, 1, `Arm the wake creates one prompt opening with ${tag}`);
  for (const heading of ["## Existing session", "## Arm the wake", "## Wake", "## Stop"]) {
    assert.ok(section(SKILL, heading).includes(`\`${tag}\``), `${heading} matches jobs by ${tag}`);
  }
});

test("status selects another store after retargeting and distinguishes malformed, missing, and unreadable configuration", () => {
  const { home } = configuredHome("stop-identity");
  const original = helper(home, ["status"]);
  assert.strictEqual(original.status, 0, original.stderr);
  const identity = JSON.parse(original.stdout);
  const otherRunbook = join(home, "other-runbook");
  mkdirSync(otherRunbook);
  const config = join(home, ".config", "agents-kit", "config.json");
  writeFileSync(config, JSON.stringify({ runbookRoot: otherRunbook }));
  const changed = helper(home, ["status"]);
  assert.strictEqual(changed.status, 0, changed.stderr);
  const other = JSON.parse(changed.stdout);
  assert.notStrictEqual(other.id, identity.id, "a new configuration selects a different store without an error");
  assert.strictEqual(other.runbook, realpathSync(otherRunbook));

  writeFileSync(config, "{");
  const malformed = helper(home, ["status"]);
  assert.strictEqual(malformed.status, 2, malformed.stderr);
  rmSync(config);
  const missing = helper(home, ["status"]);
  assert.strictEqual(missing.status, 1, missing.stderr);
  mkdirSync(config);
  const unreadable = helper(home, ["status"]);
  assert.strictEqual(unreadable.status, 2, unreadable.stderr);
});

test("the helper commands and status fields the skill uses run against a temporary store", () => {
  const { home, runbook } = configuredHome("commands");
  const token = /such as `(review-[^`]+)`/.exec(SKILL)?.[1];
  assert.ok(token, "the skill gives an example attempt token");
  const owner = "session-20261022T140000Z-a1b2c3";
  const started = helper(home, ["append", "--type", "attempt-started", "--json", "-"], JSON.stringify({ attempt: token, owner, job: "review" }));
  assert.strictEqual(started.status, 0, started.stderr);
  assert.strictEqual(JSON.parse(started.stdout).event.payload.attempt, token);
  const proposal = {
    attempt: token,
    target: "README.md",
    summary: "Name the index owner.",
    evidence: [{ source: "../sources/owner.md", published: "2026-10-01", observed: "2026-10-22" }],
    before: null,
    body: "# Runbook\n\nOwner: synthetic.\n",
  };
  const proposed = helper(home, ["append", "--type", "proposal", "--json", "-"], JSON.stringify(proposal));
  assert.strictEqual(proposed.status, 0, proposed.stderr);
  const { proposal: id, bodyHash } = JSON.parse(proposed.stdout).event.payload;

  const state = helper(home, ["status"]);
  assert.strictEqual(state.status, 0, state.stderr);
  const report = JSON.parse(state.stdout);
  for (const field of ["id", "runbook", "ready", "reason", "lastSeq", "lastReview", "activeAttempt", "review", "next"]) {
    assert.ok(Object.hasOwn(report, field), `status carries ${field}`);
    assert.ok(SKILL.includes(`\`${field}\``), `the skill reads ${field}`);
  }
  for (const field of ["due", "blockedBy"]) {
    assert.ok(Object.hasOwn(report.review, field), `status review carries ${field}`);
    assert.ok([`\`${field}\``, `\`${field}.`, `review.${field}`].some((spelling) => SKILL.includes(spelling)), `the skill reads review.${field}`);
  }
  for (const field of ["owner", "at", "leaseUntil"]) {
    assert.ok(Object.hasOwn(report.review.blockedBy, field), `a blocking attempt carries ${field}`);
    assert.ok(SKILL.includes(`\`${field}\``) || SKILL.includes(`\`<${field}>\``), `the skill reads blockedBy.${field}`);
  }
  for (const field of ["proposal", "revision", "bodyBytes"]) {
    assert.ok(Object.hasOwn(report.pending[0], field), `a pending pointer carries ${field}`);
    assert.ok(SKILL.includes(`<${field}>`) || SKILL.includes(`\`${field}\``), `the skill reads ${field}`);
  }
  assert.strictEqual(report.runbook, realpathSync(runbook));
  assert.strictEqual(report.ready, true);
  assert.strictEqual(report.activeAttempt.attempt, token);
  assert.strictEqual(report.review.blockedBy.owner, owner);
  assert.match(report.id, /^runbook-[0-9a-f]{16}$/);

  const placeholders: Record<string, string> = { "<next>": id, "<kept lastSeq>": "1", "<bodyHash>": bodyHash };
  const commands = new Set([...SKILL.matchAll(/`((?:status|history|body|recover)(?: [^`]*)?)`/g)].map((match) => match[1]));
  for (const name of ["status", "history", "body", "recover"]) {
    assert.ok([...commands].some((command) => command.split(" ")[0] === name), `the skill runs ${name}`);
  }
  for (const command of commands) {
    const args = command.split(" ").reduce<string[]>((list, word) => {
      const last = list.at(-1);
      if (last !== undefined && last.startsWith("<") && !last.endsWith(">")) list[list.length - 1] = `${last} ${word}`;
      else list.push(word);
      return list;
    }, []);
    const resolved = args.map((arg) => placeholders[arg] ?? arg);
    assert.ok(resolved.every((arg) => !arg.startsWith("<")), `every placeholder in \`${command}\` is known`);
    const result = helper(home, resolved);
    assert.strictEqual(result.status, 0, `\`${command}\`: ${result.stderr}`);
  }
  const proposals = JSON.parse(helper(home, ["history", "--after", "1", "--type", "proposal"]).stdout);
  assert.deepStrictEqual(
    proposals.events.map((event: { payload: { proposal: string } }) => event.payload.proposal),
    [id],
  );

  const appends = [...SKILL.matchAll(/`append --type ([a-z-]+) --json -` with the payload `([^`]+)`/g)].map((match) => [match[1], match[2]] as const);
  assert.deepStrictEqual([...new Set(appends.map(([type]) => type))].sort(), ["attempt-stopped", "decision"], "the session records only stops and decisions");
  const stops = appends.filter(([type]) => type === "attempt-stopped");
  assert.deepStrictEqual(stops.map(([, payload]) => JSON.parse(payload.replace("<attempt>", "x")).reason).sort(), ["interrupted", "stopped"]);
  for (const [index, [type, payload]] of stops.entries()) {
    const attempt = index === 0 ? token : `${token}-${index}`;
    if (index > 0) {
      const restarted = helper(home, ["append", "--type", "attempt-started", "--json", "-"], JSON.stringify({ attempt, owner, job: index === 1 ? "apply" : "review" }));
      assert.strictEqual(restarted.status, 0, restarted.stderr);
    }
    const recorded = helper(home, ["append", "--type", type, "--json", "-"], payload.replace("<attempt>", attempt));
    assert.strictEqual(recorded.status, 0, `${type} ${payload}: ${recorded.stderr}`);
    const after = JSON.parse(helper(home, ["status"]).stdout);
    assert.deepStrictEqual([after.activeAttempt, after.review.blockedBy], [null, null], `${payload} clears the attempt`);
    const late = helper(home, ["append", "--type", "proposal", "--json", "-"], JSON.stringify({ ...proposal, attempt }));
    assert.strictEqual(late.status, 1, "a stopped attempt records no late proposal");
  }

  const decisions = appends.filter(([type]) => type === "decision").map(([, payload]) => payload);
  assert.strictEqual(decisions.length, 1, "one decision payload shape");
  const values: Record<string, string> = { "<proposal>": id, "<revision>": "1", "<decision>": "accepted", "<source>": `user message 2026-10-22T14:10:00Z: "accept ${id}@1, it's right"` };
  const filled = Object.entries(values).reduce((text, [placeholder, value]) => text.replace(placeholder, JSON.stringify(value).slice(1, -1)), decisions[0]);
  const decided = helper(home, ["append", "--type", "decision", "--json", "-"], filled);
  assert.strictEqual(decided.status, 0, decided.stderr);
  const pending = JSON.parse(helper(home, ["status"]).stdout).pending;
  assert.deepStrictEqual(pending.map((entry: { proposal: string; decision: string; apply: unknown }) => [entry.proposal, entry.decision, entry.apply]), [[id, "accepted", null]]);
});

test("contract and duty reference targets resolve beside their owner", () => {
  for (const [file, text, required] of [
    [join(WORKFLOW_DIR, "secretary-contract.md"), CONTRACT, ["../secretary/runbook-maintenance.md"]],
    [join(REPO_DIR, "references", "secretary", "runbook-maintenance.md"), DUTY, ["../workflow/runbook.md", "../scripts/secretary-state.md"]],
  ] as const) {
    const cited = new Set<string>();
    for (const [, path, heading] of text.matchAll(/`(\.\.?\/[^`]+\.md)`(?: § \*([^*]+)\*)?/g)) {
      cited.add(path);
      const target = resolve(dirname(file), path);
      assert.ok(existsSync(target), `${file} cites ${path}`);
      if (heading === undefined) continue;
      const owner = readFileSync(target, "utf8");
      assert.ok(owner.includes(`## ${heading}`) || owner.includes(`**${heading}.**`), `${path} has § ${heading}`);
    }
    for (const path of required) assert.ok(cited.has(path), `${file} cites ${path}`);
  }
});

for (const changed of ["retargeted", "malformed", "deleted"] as const) {
  test(`retained lifecycle commands review, read, recover, apply, and stop after config is ${changed}`, () => {
    const { home, runbook } = configuredHome(`retained-lifecycle-${changed}`);
    const config = join(home, ".config", "agents-kit", "config.json");
    const other = join(home, "other");
    mkdirSync(other);
    writeFileSync(join(other, "README.md"), "# Other runbook\n");
    const snapshot = { root: realpathSync(runbook), interval: 17, helper: HELPER, owner: "session-retained", id: "" };
    const call = (args: readonly string[], payload?: unknown): Run => {
      const result = spawnSync(process.execPath, [snapshot.helper, ...args, "--runbook", snapshot.root, "--interval-minutes", String(snapshot.interval)], { encoding: "utf8", env: { ...process.env, HOME: home }, input: payload === undefined ? undefined : JSON.stringify(payload) });
      return { status: result.status, stdout: result.stdout, stderr: result.stderr };
    };
    const ok = (args: readonly string[], payload?: unknown) => {
      const result = call(args, payload);
      assert.strictEqual(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    };
    snapshot.id = ok(["status"]).id;
    const append = (type: string, payload: unknown) => ok(["append", "--type", type, "--json", "-"], payload).event;
    append("attempt-started", { attempt: "review-a", owner: snapshot.owner, job: "review" });
    const body = "# Accepted A\n";
    const proposed = append("proposal", { attempt: "review-a", target: "entry.md", summary: "Update A.", evidence: [{ source: "../source.md", published: null, observed: null }], before: null, body });
    append("review-completed", { attempt: "review-a", outcome: "complete", summary: "Checked.", unavailable: [] });
    append("decision", { proposal: proposed.payload.proposal, revision: 1, decision: "accepted", source: "user message: accept A" });
    append("attempt-started", { attempt: "apply-crash", owner: snapshot.owner, job: "apply" });
    const store = openStore(home, { runbook: snapshot.root, intervalMinutes: snapshot.interval });
    assert.throws(() => applyProposal(store, { attempt: "apply-crash", proposal: proposed.payload.proposal, revision: 1 }, new Date(), { beforeReplace: () => { throw new Error("interrupted"); } }), /interrupted/);
    writeFileSync(config, JSON.stringify({ runbookRoot: other, secretary: { duties: { "runbook-maintenance": { intervalMinutes: 43 } } } }));
    const otherStore = openStore(home);
    const otherStart = helper(home, ["append", "--type", "attempt-started", "--json", "-"], JSON.stringify({ attempt: "review-b", owner: "session-b", job: "review" }));
    assert.strictEqual(otherStart.status, 0, otherStart.stderr);
    const otherProposal = helper(home, ["append", "--type", "proposal", "--json", "-"], JSON.stringify({ attempt: "review-b", target: "entry.md", summary: "B stays pending.", evidence: [{ source: "../other-source.md", published: null, observed: null }], before: null, body: "# B\n" }));
    assert.strictEqual(otherProposal.status, 0, otherProposal.stderr);
    assert.strictEqual(JSON.parse(otherProposal.stdout).event.payload.proposal, proposed.payload.proposal);
    const otherBefore = readFileSync(join(otherStore.dir, "state.json"));
    if (changed === "malformed") writeFileSync(config, "{");
    if (changed === "deleted") rmSync(config);
    const fresh = helper(home, ["status"]);
    assert.strictEqual(fresh.status, changed === "retargeted" ? 0 : changed === "deleted" ? 1 : 2, fresh.stderr);
    if (changed === "retargeted") assert.strictEqual(JSON.parse(fresh.stdout).id, otherStore.id);
    const state = ok(["status"]);
    assert.strictEqual(state.id, snapshot.id);
    assert.strictEqual(state.pending[0].apply.state, "intent");
    assert.strictEqual(ok(["event", "--seq", String(proposed.seq)]).event.payload.summary, "Update A.");
    assert.strictEqual(ok(["body", "--hash", proposed.payload.bodyHash]).text, body);
    assert.ok(ok(["history", "--type", "proposal"]).events.every((event: { payload: { summary: string } }) => event.payload.summary === "Update A."));
    assert.strictEqual(readFileSync(join(snapshot.root, "README.md"), "utf8"), "# Runbook\n");
    const request = ["--proposal", proposed.payload.proposal, "--revision", "1"];
    assert.strictEqual(call(["apply", "--attempt", "apply-crash", ...request]).status, 1);
    const held = ok(["status"]).pending[0];
    assert.strictEqual(held.decision, "accepted");
    assert.strictEqual(held.apply.state, "held");
    append("attempt-started", { attempt: "apply-fresh", owner: snapshot.owner, job: "apply" });
    assert.strictEqual(ok(["apply", "--attempt", "apply-fresh", ...request]).event.payload.outcome, "applied");
    rmSync(join(store.dir, "state.json"));
    assert.strictEqual(ok(["status"]).ready, false);
    assert.strictEqual(ok(["recover"]).complete, true);
    rmSync(config, { force: true });
    append("attempt-started", { attempt: "stop-a", owner: snapshot.owner, job: "review" });
    append("attempt-stopped", { attempt: "stop-a", reason: "stopped" });
    assert.strictEqual(ok(["status"]).activeAttempt, null);
    assert.strictEqual(readFileSync(join(snapshot.root, "entry.md"), "utf8"), body);
    assert.ok(!existsSync(join(other, "entry.md")));
    assert.deepStrictEqual(readFileSync(join(otherStore.dir, "state.json")), otherBefore);
    writeFileSync(config, JSON.stringify({ runbookRoot: other, secretary: { duties: { "runbook-maintenance": { intervalMinutes: 43 } } } }));
    assert.strictEqual(JSON.parse(helper(home, ["status"]).stdout).id, otherStore.id);
    assert.strictEqual(openStore(home).intervalMinutes, 43);
  });
}

test("init-config references, its pack-free registration, and the README duty anchor resolve to their owners", () => {
  const skillDir = join(REPO_DIR, "skills", "init-config");
  const cited = new Set<string>();
  for (const [, path, heading] of INIT_CONFIG.matchAll(/`\.\/((?:references\/[^`]+|AGENTS)\.md)`(?: § \*([^*]+)\*)?/g)) {
    cited.add(path);
    const target = join(skillDir, path);
    assert.ok(existsSync(target), path);
    if (heading === undefined) continue;
    const owner = readFileSync(target, "utf8");
    const titles = owner.split("\n").filter((line) => /^#+ /.test(line)).map((line) => line.replace(/^#+ /, ""));
    assert.ok(titles.some((title) => title === heading || title.startsWith(`${heading} (`)) || owner.includes(`**${heading}.**`), `${path} has § ${heading}`);
  }
  assert.ok(cited.has("references/secretary/runbook-maintenance.md"));
  assert.ok(cited.has("references/scripts/secretary-state.md"));
  const packFree = DOMAIN_PACKS.split("- **Pack-free skills**")[1]?.split("\n\n")[0] ?? "";
  assert.match(packFree, /^ {2}- `init-config` /m);
  const readme = section(readFileSync(join(REPO_DIR, "README.md"), "utf8"), "## Secretary");
  assert.ok(readme.includes("(./references/secretary/runbook-maintenance.md#configuration)"), "the README links the runbook duty's configuration");
  assert.ok(DUTY.includes("\n## Configuration\n"), "the runbook duty has § Configuration");
});

const MEETING_HELPER = join(REPO_DIR, "scripts/meeting-sync-state.ts");
function meetingCommand(home: string, command: string, request: unknown) {
  const result = spawnSync(process.execPath, [MEETING_HELPER, command, "-"], { encoding: "utf8", env: { ...process.env, HOME: home }, input: JSON.stringify(request) });
  assert.strictEqual(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("documented meetings-only commands sync without runbook records and retain targets until restart", () => {
  const home = join(TEST_ROOT, "meetings-only");
  const original = join(home, "original");
  const replacement = join(home, "replacement");
  const config = join(home, ".config/agents-kit/config.json");
  mkdirSync(original, { recursive: true });
  mkdirSync(replacement);
  mkdirSync(dirname(config), { recursive: true });
  const settings = (folder: string, intervalMinutes: number) => ({ secretary: { duties: { "meeting-sync": { folder, intervalMinutes } } } });
  writeFileSync(config, JSON.stringify(settings(original, 17)));
  const retained = meetingCommand(home, "configure", { owner: "session-original" });
  assert.strictEqual(retained.folder, original);
  assert.strictEqual(retained.intervalMinutes, 17);
  const first = meetingCommand(home, "start", { retained });
  meetingCommand(home, "create", { retained, token: first.token, path: "first.md", body: "prep" });
  meetingCommand(home, "finish", { retained, token: first.token, outcome: "complete" });
  writeFileSync(config, JSON.stringify(settings(replacement, 29)));
  const restored = JSON.parse(JSON.stringify({ mode: "on-demand", owner: "session-original", duties: { "meeting-sync": { retained, helper: MEETING_HELPER } }, ownedAgentIds: [] }));
  const next = meetingCommand(home, "start", { retained: restored.duties["meeting-sync"].retained, explicit: true });
  rmSync(config);
  meetingCommand(home, "create", { retained, token: next.token, path: "followup.md", body: "original target" });
  meetingCommand(home, "finish", { retained, token: next.token, outcome: "stopped" });
  assert.strictEqual(readFileSync(join(original, "followup.md"), "utf8"), "original target");
  assert.ok(!existsSync(join(replacement, "followup.md")));
  assert.ok(!existsSync(join(home, ".local/state/agents-kit/secretary/runbook")));
  writeFileSync(config, JSON.stringify(settings(replacement, 29)));
  const fresh = meetingCommand(home, "configure", { owner: "session-restarted" });
  assert.strictEqual(fresh.folder, replacement);
  assert.strictEqual(fresh.intervalMinutes, 29);
  assert.notStrictEqual(fresh.store, retained.store);
  const restarted = meetingCommand(home, "start", { retained: fresh });
  meetingCommand(home, "create", { retained: fresh, token: restarted.token, path: "fresh.md", body: "new target" });
  meetingCommand(home, "finish", { retained: fresh, token: restarted.token, outcome: "complete" });
  assert.ok(!existsSync(join(original, "fresh.md")));
  assert.strictEqual(readFileSync(join(replacement, "fresh.md"), "utf8"), "new target");
});

test("documented combined-duty commands preserve accepted runbook identifiers and history during sync", () => {
  const { home, runbook } = configuredHome("combined-duty");
  const folder = join(home, "meetings");
  mkdirSync(folder);
  writeFileSync(join(home, ".config/agents-kit/config.json"), JSON.stringify({ runbookRoot: runbook, secretary: { duties: { "meeting-sync": { folder } } } }));
  const runbookCall = (args: string[], input?: unknown) => {
    const result = helper(home, [...args, "--runbook", runbook, "--interval-minutes", "1440"], input === undefined ? undefined : JSON.stringify(input));
    assert.strictEqual(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const append = (type: string, input: unknown) => runbookCall(["append", "--type", type, "--json", "-"], input).event;
  const originalId = runbookCall(["status"]).id;
  append("attempt-started", { attempt: "review-combined", owner: "session-combined", job: "review" });
  const proposed = append("proposal", { attempt: "review-combined", target: "accepted.md", summary: "Accepted revision", evidence: [{ source: "source", published: null, observed: null }], before: null, body: "# Accepted\n" });
  append("review-completed", { attempt: "review-combined", outcome: "complete", summary: "Reviewed", unavailable: [] });
  append("decision", { proposal: proposed.payload.proposal, revision: 1, decision: "accepted", source: "user message: accept exact revision" });
  const before = runbookCall(["history"]);
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const historyDigest = digest(before);
  const pending = runbookCall(["status"]).pending;
  const retained = meetingCommand(home, "configure", { owner: "session-combined" });
  const attempt = meetingCommand(home, "start", { retained });
  meetingCommand(home, "create", { retained, token: attempt.token, path: "meeting.md", body: "prep" });
  meetingCommand(home, "finish", { retained, token: attempt.token, outcome: "complete" });
  const second = meetingCommand(home, "start", { retained, explicit: true });
  const duplicate = spawnSync(process.execPath, [MEETING_HELPER, "create", "-"], { encoding: "utf8", env: { ...process.env, HOME: home }, input: JSON.stringify({ retained, token: second.token, path: "meeting.md", body: "replacement" }) });
  assert.strictEqual(duplicate.status, 1);
  assert.match(duplicate.stderr, /destination exists/);
  meetingCommand(home, "finish", { retained, token: second.token, outcome: "complete" });
  assert.strictEqual(readFileSync(join(folder, "meeting.md"), "utf8"), "prep");
  assert.strictEqual(digest(runbookCall(["history"])), historyDigest);
  assert.strictEqual(digest(runbookCall(["status"]).pending), digest(pending));
  assert.deepStrictEqual(runbookCall(["history"]), before);
  assert.deepStrictEqual(runbookCall(["status"]).pending, pending);
  assert.strictEqual(runbookCall(["status"]).id, originalId);
  assert.ok(!existsSync(join(runbook, "accepted.md")));
  append("attempt-started", { attempt: "apply-combined", owner: "session-combined", job: "apply" });
  const applied = runbookCall(["apply", "--attempt", "apply-combined", "--proposal", proposed.payload.proposal, "--revision", "1"]);
  assert.strictEqual(applied.event.payload.outcome, "applied");
  assert.strictEqual(readFileSync(join(runbook, "accepted.md"), "utf8"), "# Accepted\n");
});

test("runbook-only and no-duty initialization leave meeting records absent", () => {
  const { home } = configuredHome("runbook-only-duty");
  assert.strictEqual(meetingCommand(home, "configure", { owner: "session-runbook" }), null);
  assert.strictEqual(helper(home, ["status"]).status, 0);
  assert.ok(!existsSync(join(home, ".local/state/agents-kit/secretary/meeting-sync")));
  const empty = join(TEST_ROOT, "no-duty");
  mkdirSync(empty);
  assert.strictEqual(meetingCommand(empty, "configure", { owner: "session-empty" }), null);
  assert.ok(!existsSync(join(empty, ".local/state")));
});

test("fixed-clock shared deadlines isolate failed meetings while runbook work continues", () => {
  const { home, runbook } = configuredHome("independent-deadlines");
  const folder = join(home, "meetings");
  mkdirSync(folder);
  writeFileSync(join(home, ".config/agents-kit/config.json"), JSON.stringify({ runbookRoot: runbook, secretary: { duties: { "meeting-sync": { folder, intervalMinutes: 60 } } } }));
  const now = Date.parse("2026-11-02T10:00:00Z");
  const retained = configureMeeting(home, "session-clock", now);
  assert.ok(retained);
  const store = openStore(home, { runbook, intervalMinutes: 15 });
  assert.strictEqual(runbookStatus(store, null, new Date(now)).review.due, true);
  assert.strictEqual(meetingStatus(home, retained, now).due, true);
  append(store, "attempt-started", { attempt: "review-clock", owner: retained.owner, job: "review" }, new Date(now));
  append(store, "review-completed", { attempt: "review-clock", outcome: "partial", summary: "Partial fixture", unavailable: ["source missing"] }, new Date(now));
  const token = startMeeting(home, retained, { now });
  finishMeeting(home, retained, { token, outcome: "failed", now: now + 60000 });
  const meetingDeadline = meetingStatus(home, retained, now + 60000).eligible;
  const reviewDeadline = Date.parse(runbookStatus(store, null, new Date(now + 60000)).review.dueAt!);
  assert.strictEqual(Math.min(reviewDeadline, meetingDeadline), now + 15 * 60000);
  assert.strictEqual(meetingDeadline, now + 61 * 60000);
  append(store, "attempt-started", { attempt: "review-healthy", owner: retained.owner, job: "review" }, new Date(reviewDeadline));
  append(store, "review-completed", { attempt: "review-healthy", outcome: "complete", summary: "Healthy fixture", unavailable: [] }, new Date(reviewDeadline));
  assert.strictEqual(meetingStatus(home, retained, reviewDeadline).due, false);
  const explicit = startMeeting(home, retained, { explicit: true, now: reviewDeadline });
  assert.throws(() => startMeeting(home, retained, { explicit: true, now: reviewDeadline + 1 }), /leased/);
  assert.strictEqual(meetingStatus(home, retained, reviewDeadline).eligible, reviewDeadline + 3600000);
  finishMeeting(home, retained, { token: explicit, outcome: "partial", now: reviewDeadline + 1 });
  assert.strictEqual(meetingStatus(home, retained, reviewDeadline + 1).retry, null);
  const missed = now + 10 * 3600000;
  assert.strictEqual(runbookStatus(store, null, new Date(missed)).review.due, true);
  const coalesced = startMeeting(home, retained, { now: missed });
  finishMeeting(home, retained, { token: coalesced, outcome: "complete", now: missed });
  assert.strictEqual(meetingStatus(home, retained, missed).eligible, missed + 3600000);
  assert.throws(() => startMeeting(home, retained, { now: missed }), /not due/);
});
