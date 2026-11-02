import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { applyProposal, openStore } from "../scripts/secretary-state.ts";

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

function canonicalMarkerLine(): string {
  const spans = [...CONVENTIONS.matchAll(/this exact line: ``(.+?)``/g)];
  assert.strictEqual(spans.length, 1, "skill-conventions.md renders one canonical model-invocation line");
  return spans[0][1];
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

test("frontmatter names the skill and states when to use it", () => {
  const fields = frontmatter(SKILL);
  assert.strictEqual(fields.get("name"), "start-secretary");
  assert.match(fields.get("description") ?? "", /^Use when asked to start the secretary/);
  assert.match(fields.get("description") ?? "", /on demand/);
});

test("Core Rules loads the whole neutral core through the skill's shared-rule links", () => {
  const firstRule = section(SKILL, "## Core Rules")
    .split("\n")
    .find((line) => line.trim() !== "");
  assert.strictEqual(firstRule, "1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.");
  for (const [link, target] of [
    ["AGENTS.md", "../../CORE_RULES.md"],
    ["references", "../../references"],
  ]) {
    const path = join(SKILL_DIR, link);
    assert.ok(lstatSync(path).isSymbolicLink(), `${link} is a symlink`);
    assert.strictEqual(readlinkSync(path), target, `${link} points at ${target}`);
  }
  assert.doesNotMatch(SKILL, /references\/(engineering|documentation)\//, "the skill resolves no domain pack");
});

test("the model-invocation line follows Core Rules and the roster points at the Setup proposal", () => {
  const lines = SKILL.split("\n");
  let next = lines.indexOf("## Core Rules") + 1;
  assert.ok(next > 0, "SKILL.md has a Core Rules block");
  while (next < lines.length && (lines[next].trim() === "" || /^\d+\. /.test(lines[next]))) next += 1;
  assert.strictEqual(lines[next], canonicalMarkerLine());
  const roster = CONVENTIONS.split("**Confirm-gated skills:**\n")[1]?.trimStart().split("\n\n")[0] ?? "";
  const entry = roster.split("\n").find((line) => line.startsWith("- `start-secretary` — "));
  assert.ok(entry, "the confirm-gated roster lists start-secretary");
  assert.match(entry, /the proposal is its § \*Setup\*/);
  assert.ok(SKILL.includes("\n## Setup\n"), "the roster's cited § Setup exists");
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

test("the Codex adapter registers the secretary role, cites the contract, and overrides no permission", () => {
  const adapter = readFileSync(join(REPO_DIR, "agents", "secretary.toml"), "utf8");
  assert.match(adapter, /^name = "secretary"$/m);
  assert.match(adapter, /developer_instructions = """[\s\S]*secretary-contract\.md/);
  assert.doesNotMatch(adapter, /^(?:sandbox_mode|approval_policy|network_access|model_provider)\s*=/m);
});

test("the reply blocks the report renders are the contract's reply headings", () => {
  const headings = new Set([...section(DUTY, "## The reply").matchAll(/^- `([^`]+)`:/gm)].map((match) => match[1]));
  assert.ok(headings.size > 0, "the contract lists reply headings");
  assert.match(SKILL, /runbook-maintenance\.md` § \*The reply\*/);
  const report = section(DUTY, "## Coordinator report");
  const blocks = [...report.matchAll(/^- \*\*([^*]+):\*\*/gm)]
    .map((match) => match[1])
    .filter((block) => !["Done", "Know", "Awaiting you", "Next"].includes(block));
  assert.ok(blocks.length > 0, "the report renders blocks");
  for (const block of blocks) assert.ok(headings.has(block), `the contract's reply carries ${block}`);
});

test("helper status selects another store after retargeting and refuses malformed, missing, or unreadable configuration", () => {
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
  const ownerShape = /mint one as `(session-[^`]+)`/.exec(SKILL)?.[1];
  assert.strictEqual(ownerShape, "session-<YYYYMMDDTHHMMSSZ>-<six random lowercase letters or digits>");
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
  for (const field of ["due", "blockedBy", "wake"]) {
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

test("the Claude adapter withholds direct edits and launches, keeps connectors, and cites the contract", () => {
  const adapter = readFileSync(join(REPO_DIR, "agents", "secretary.md"), "utf8");
  const header = adapter.split("\n---\n")[0];
  assert.match(header, /^disallowedTools: Write, Edit, NotebookEdit, Agent, SendMessage, Monitor, TaskStop$/m, "the adapter withholds direct file edits, agent launches, messaging, monitors, and job stops");
  assert.doesNotMatch(header, /^tools:/m, "an allowlist would drop the connectors the secretary reads");
  const body = adapter.split("\n---\n")[1] ?? "";
  assert.match(body, /`references\/workflow\/secretary-contract\.md`/, "the kit adapter's body carries the contract citation");
});

test("the skill and contract bind every helper command to the retained root and interval flags", () => {
  assert.match(section(SKILL, "## Startup"), /node <retained helper path> <command> --runbook <original physical root> --interval-minutes <retained interval>/);
  assert.match(section(CONTRACT, "## Unavailable"), /`node <packet helper path> <command> --runbook <packet root> --interval-minutes <packet interval>`/);
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


test("wake prompt settings round-trip escaped paths, interval, owner, and store identity", () => {
  const arm = section(SKILL, "## Arm the wake");
  const prompt = /this prompt: `([^`]+)`/.exec(arm)?.[1] ?? "";
  const fields = { runbook: '/physical/runbook, "private"', intervalMinutes: 17, helper: "/candidate kit/scripts/secretary-state.ts", owner: "session-retained" };
  const substitutions: Record<string, string> = { "<id>": "runbook-original", "<physical root>": JSON.stringify(fields.runbook).slice(1, -1), "<interval minutes>": "17", "<absolute helper path>": JSON.stringify(fields.helper).slice(1, -1), "<owner label>": fields.owner };
  const restored = Object.entries(substitutions).reduce((text, [key, value]) => text.replace(key, value), prompt);
  assert.ok(restored.startsWith("[agents-kit secretary runbook-original]"));
  assert.deepStrictEqual(JSON.parse(/settings (\{.*\}): continue/.exec(restored)?.[1] ?? ""), fields);
});

test("init-config duty references and its proposal registration resolve to their owners", () => {
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
  const registry = CONVENTIONS.split("\n").find((line) => line.startsWith("- `init-config` —")) ?? "";
  assert.match(registry, /2\. Select setup and inspect inputs/);
  const packFree = DOMAIN_PACKS.split("- **Pack-free skills**")[1]?.split("\n\n")[0] ?? "";
  assert.match(packFree, /^ {2}- `init-config` /m);
});
