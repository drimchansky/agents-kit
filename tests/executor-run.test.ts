import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { exitStatus, readRequest, type Request } from "../scripts/executor-run.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(REPO, "scripts/executor-run.ts");
const TEMP = realpathSync(mkdtempSync(join(tmpdir(), "executor-run-tests-")));
after(() => rmSync(TEMP, { recursive: true, force: true }));

function fixture(engine: "codex" | "claude" = "codex") {
  const dir = mkdtempSync(join(TEMP, "case-"));
  const root = join(dir, "work '$` root");
  const contractRoot = join(dir, "coordinator '$&` contract");
  mkdirSync(join(dir, ".git"));
  mkdirSync(root);
  mkdirSync(join(contractRoot, "references/workflow"), { recursive: true });
  writeFileSync(join(contractRoot, "references/workflow/executor-contract.md"), "Fixture executor contract\n");
  const packet = join(dir, "packet.txt");
  writeFileSync(packet, 'Literal "quotes", backticks `touch escaped`, $HOME and $(touch escaped)\n');
  const request: Request = {
    root, packet, contractRoot, outputDir: join(dir, "output"),
    model: { name: "fixture-model", effort: "high", provenance: "fixture resolved adapter" },
    ...(engine === "codex" ? { engine, policy: { sandbox: "workspace-write", approval: "never", networkAccess: false, provenance: "fixture authorization" } } :
      { engine, policy: { permissionMode: "acceptEdits", permissionPrompts: "none", network: "inherit", allowedTools: ["Bash(node --test tests/*.test.ts)"], provenance: "fixture authorization" } }),
  };
  const requestPath = join(dir, "request.json");
  const save = () => writeFileSync(requestPath, JSON.stringify(request));
  save();
  return { dir, root, request, requestPath, save };
}

test("request retains the explicit root, model provenance and bounded policy", () => {
  const f = fixture();
  assert.deepEqual(readRequest(f.requestPath), f.request);
  f.request.root = "relative";
  f.save();
  assert.throws(() => readRequest(f.requestPath), /root must be absolute/);
});

test("an output directory at or under root is refused before launching", () => {
  const f = fixture();
  const linked = join(f.dir, "linked root");
  symlinkSync(f.root, linked);
  for (const outputDir of [join(f.root, "output"), f.root, join(linked, "output")]) {
    f.request.outputDir = outputDir;
    f.save();
    assert.throws(() => readRequest(f.requestPath), /outputDir must lie outside root/);
  }
  f.request.outputDir = join(f.dir, "output");
  f.save();
  assert.deepEqual(readRequest(f.requestPath), f.request);
});

test("an output directory under a case-respelled root is refused", (t: TestContext) => {
  const f = fixture();
  const respelled = join(f.dir, "WORK '$` ROOT");
  if (!existsSync(respelled)) {
    t.skip("the case-respelled root case needs a case-insensitive volume");
    return;
  }
  f.request.outputDir = join(respelled, "output");
  f.save();
  assert.throws(() => readRequest(f.requestPath), /outputDir must lie outside root/);
});

test("unresolved settings and omitted policy are refused before launching", () => {
  const f = fixture();
  f.request.model.name = "inherit";
  f.save();
  assert.throws(() => readRequest(f.requestPath), /resolved model/);
  f.request.model.name = "fixture-model";
  delete (f.request.policy as any).networkAccess;
  f.save();
  assert.throws(() => readRequest(f.requestPath), /networkAccess/);
  (f.request.policy as any).networkAccess = false;
  f.request.model.effort = "extreme";
  f.save();
  assert.throws(() => readRequest(f.requestPath), /not a supported explicit effort/);
  const claude = fixture("claude");
  claude.request.model.effort = "minimal";
  claude.save();
  assert.throws(() => readRequest(claude.requestPath), /Claude model.effort/);
});

test("exit status ranks cancellation over transport failure and requires a final reply", () => {
  const child = { pid: 1, started: true, exitCode: 0, signal: null, error: null };
  const clean = { errors: [], failed: false, completed: true, topError: false, fallbacks: [] };
  assert.deepEqual(exitStatus(true, child, { ...clean, errors: ["unreadable event stream"] }, null), [1]);
  assert.deepEqual(exitStatus(false, child, { ...clean, errors: ["unreadable event stream"] }, "/report"), [2]);
  assert.deepEqual(exitStatus(false, { ...child, exitCode: 7 }, clean, "/report"), [1]);
  assert.deepEqual(exitStatus(false, child, { ...clean, completed: false, topError: true }, "/report"), [1]);
  assert.deepEqual(exitStatus(false, child, { ...clean, topError: true }, "/report"), [0]);
  assert.deepEqual(exitStatus(false, child, { ...clean, fallbacks: ["a -> b"] }, "/report"), [1, "CLI switched models: a -> b"]);
  assert.deepEqual(exitStatus(false, child, clean, null), [2, "CLI returned no final reply; inspect saved stdout and stderr"]);
  assert.deepEqual(exitStatus(false, child, { ...clean, completed: false }, "/report"),
    [2, "CLI stream ended without a terminal turn event; the saved reply may be unfinished"]);
  assert.deepEqual(exitStatus(false, child, clean, "/report"), [0]);
});

function gitAbove(dir: string): boolean {
  for (; dirname(dir) !== dir; dir = dirname(dir)) if (existsSync(join(dirname(dir), ".git"))) return true;
  return false;
}

test("Codex refuses a root outside a Git repository before launching",
  { skip: gitAbove(TEMP) && "a .git above the temporary directory makes every fixture root a Git root" }, () => {
  const f = fixture();
  rmSync(join(f.dir, ".git"), { recursive: true });
  assert.throws(() => readRequest(f.requestPath), /inside a Git repository/);
  fake(f);
  const { status, receipt } = run(f);
  assert.equal(status, 2);
  assert.deepEqual(receipt.probes, []);
});

test("Codex accepts a linked root outside Git whose target lies inside a Git repository", () => {
  const f = fixture();
  const linked = join(mkdtempSync(join(TEMP, "outside-git-")), "linked root");
  symlinkSync(f.root, linked);
  f.request.root = linked;
  f.save();
  assert.deepEqual(readRequest(f.requestPath), f.request);
  fake(f);
  const { status, receipt } = run(f);
  assert.equal(status, 0);
  assert.equal(receipt.root, linked);
  const observed = JSON.parse(readFileSync(join(f.dir, "observed.json"), "utf8"));
  assert.equal(observed.args[observed.args.indexOf("-C") + 1], linked);
});

function fake(f: ReturnType<typeof fixture>, scenario: Record<string, any> = {}) {
  writeFileSync(join(f.dir, "scenario.json"), JSON.stringify(scenario));
  writeFileSync(join(f.dir, "codex-config.json"), JSON.stringify({ approval_policy: "on-request", approvals_reviewer: "auto_review" }));
  writeFileSync(join(f.dir, f.request.engine), `#!${process.execPath}
const fs = require("node:fs");
const cp = require("node:child_process");
const dir = ${JSON.stringify(f.dir)};
const scenario = JSON.parse(fs.readFileSync(dir + "/scenario.json", "utf8"));
const engine = ${JSON.stringify(f.request.engine)};
const args = process.argv.slice(2);
const stray = (output) => {
  const held = cp.spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {stdio:["ignore", output, output]});
  fs.writeFileSync(dir + "/stray.pid", String(held.pid));
  held.unref();
};
const publish = (name, text) => {
  fs.writeFileSync(dir + "/pending-" + name, text);
  fs.renameSync(dir + "/pending-" + name, dir + "/" + name);
};
fs.appendFileSync(dir + "/calls.jsonl", JSON.stringify(args) + "\\n");
if (args.includes("--help")) {
  console.log(["--no-daemon", "--ask-for-approval", "--json", "--color", "--cd", "--sandbox", "--model", "--config", "--output-last-message", "--print", "--output-format", "--verbose", "--input-format", "--agent", "--agents", "--effort", "--settings", "--permission-mode", "--permission-prompts", "--allowedTools"].filter(x => x !== scenario.missingFlag)
    .map(x => scenario.colorHelp ? "\\x1b[1m" + x + "\\x1b[0m" : x).join(" "));
  if (scenario.unlink && args[0] === "exec") fs.unlinkSync(process.argv[1]);
  if (scenario.recordConflict) fs.mkdirSync(${JSON.stringify(f.request.outputDir)} + "/child.json", { recursive: true });
  if (scenario.helpExit) process.exitCode = scenario.helpExit;
  if (scenario.strayHelp) stray(scenario.strayHelp);
  if (scenario.helpLinger) {
    const held = cp.spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {detached:true, stdio:["ignore","inherit","inherit"]});
    fs.writeFileSync(dir + "/held.pid", String(held.pid));
    held.unref();
  }
  if (scenario.helpStall) {
    publish("probe.ready", String(process.pid));
    setInterval(() => {}, 1000);
  }
} else if (scenario.unread) {
  process.exitCode = scenario.exit;
} else {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", x => input += x);
  process.stdin.on("end", () => {
    const effectiveConfig = JSON.parse(fs.readFileSync(dir + "/codex-config.json", "utf8"));
    if (engine === "codex") {
      for (let index = args.indexOf("exec") + 1; index < args.length; index++) {
        if (args[index] === "-c" || args[index] === "--config") {
          const setting = args[++index];
          const separator = setting.indexOf("=");
          effectiveConfig[setting.slice(0, separator)] = JSON.parse(setting.slice(separator + 1));
        } else if (args[index] === "--sandbox") effectiveConfig.sandbox_mode = args[++index];
        else if (args[index] === "--model") effectiveConfig.model = args[++index];
      }
    }
    fs.writeFileSync(dir + "/observed.json", JSON.stringify({ args, cwd: process.cwd(), input, effectiveConfig,
      effortVariable: process.env.CLAUDE_CODE_EFFORT_LEVEL ?? null }));
    if (scenario.edit) fs.writeFileSync("partial.txt", "partial fixture edit");
    if (scenario.linger) {
      const held = cp.spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {detached:true, stdio:["ignore","inherit","inherit"]});
      fs.writeFileSync(dir + "/held.pid", String(held.pid));
      held.unref();
    }
    if (scenario.stray) stray(scenario.stray);
    const emit = x => console.log(JSON.stringify(x));
    if (scenario.swapEvents) {
      const events = ${JSON.stringify(f.request.outputDir)} + "/events.jsonl";
      fs.unlinkSync(events);
      fs.symlinkSync(scenario.swapEvents, events);
    }
    emit(engine === "codex" ? {type:"thread.started", thread_id:"fixture"} : {type:"system",subtype:"init",session_id:"fixture",permissionMode:"acceptEdits"});
    if (scenario.cancel) {
      if (scenario.cancelReport) {
        if (engine === "codex") emit({type:"item.completed",item:{type:"agent_message",text:scenario.cancelReport}});
        else emit({type:"result",subtype:"success",is_error:false,result:scenario.cancelReport});
      }
      process.on("SIGTERM", () => fs.writeFileSync(dir + "/terminated", "SIGTERM"));
      if (engine === "codex") {
        process.on("SIGINT", () => fs.writeFileSync(dir + "/interrupted", "SIGINT"));
        setInterval(() => {}, 1000);
      }
      const owned = cp.spawn(process.execPath, ["-e", "process.on('SIGTERM',()=>{}); console.log('ready'); setInterval(()=>{},1000)"], {stdio:["ignore","pipe","inherit"]});
      owned.stdout.once("data", () => publish("owned.json", JSON.stringify({parent:process.pid,child:owned.pid})));
      return;
    }
    if (scenario.large) {
      emit({type:"item.completed",item:{type:"reasoning",text:"λ".repeat(1024 * 1024)}});
      process.stderr.write("diagnostic".repeat(200000));
    }
    if (scenario.fallback) emit({type:"system",subtype:scenario.fallback,original_model:"fixture-model",fallback_model:"other-model"});
    if (scenario.itemError) emit({type:"item.completed",item:{type:"error",message:"fixture warning"}});
    if (scenario.topError) emit({type:"error",message:"fixture fatal error"});
    if (scenario.badEvent) process.stdout.write('{"type":');
    if (scenario.truncated) { process.stdout.write('{"type":"res'); return; }
    if (scenario.swapOutput) {
      const output = ${JSON.stringify(f.request.outputDir)};
      fs.renameSync(output, output + ".moved");
      fs.symlinkSync(scenario.swapOutput, output);
    }
    if (!scenario.missing) {
      const report = scenario.report ?? "Outcome: blocked\\nBlockers: fixture permission denied\\n";
      if (engine === "codex") emit({type:"item.completed",item:{type:"agent_message",text:report}});
      else emit({type:"result",subtype:scenario.failed ? "error_during_execution" : "success",is_error:!!scenario.failed,result:report,permission_denials:scenario.denied ? [{tool_name:"Bash",tool_input:{command:"fixture denied"}}] : []});
    }
    if (scenario.truncateAfterFinal) process.stdout.write('{"type":"unterminated');
    if (engine === "codex" && !scenario.noTerminal) emit({type: scenario.failed ? "turn.failed" : "turn.completed"});
    process.exitCode = scenario.exit ?? 0;
  });
}
`, { mode: 0o755 });
}

function run(f: ReturnType<typeof fixture>, script = SCRIPT, env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(process.execPath, [script, f.requestPath], {
    encoding: "utf8", env: { ...process.env, PATH: f.dir, ...env }, timeout: 15000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.stderr, "");
  const receipt = JSON.parse(result.stdout);
  assert.equal(result.status, receipt.helperExitCode);
  return { status: result.status, receipt };
}

test("Codex receives literal stdin, exact cwd and contract bootstrap with explicit policy", () => {
  const f = fixture();
  fake(f, { itemError: true });
  const { status, receipt } = run(f);
  assert.equal(status, 0);
  const observed = JSON.parse(readFileSync(join(f.dir, "observed.json"), "utf8"));
  assert.equal(observed.cwd, f.root);
  assert.equal(observed.args[observed.args.indexOf("-C") + 1], f.root);
  assert(observed.args.includes('approval_policy="never"'));
  assert(observed.args.includes("sandbox_workspace_write.network_access=false"));
  assert(observed.input.includes(JSON.stringify(join(f.request.contractRoot, "references/workflow/executor-contract.md"))));
  assert(observed.input.endsWith(readFileSync(f.request.packet, "utf8")));
  assert.equal(readFileSync(receipt.report, "utf8"), "Outcome: blocked\nBlockers: fixture permission denied\n");
  assert.equal(receipt.child.exitCode, 0);
  assert.equal(receipt.engineStatus.failed, false);
  assert.deepEqual(receipt.engineStatus.errorItems, ["fixture warning"]);
  assert.equal("outcome" in receipt, false);
  assert.equal(existsSync(join(f.root, "escaped")), false);
  assert(readFileSync(receipt.artifacts.events, "utf8").includes("fixture warning"));
});

test("Codex exec policy overrides a conflicting saved approval default", () => {
  const f = fixture();
  fake(f, { missingFlag: "--ask-for-approval" });
  const { status, receipt } = run(f);
  assert.equal(status, 0);
  const observed = JSON.parse(readFileSync(join(f.dir, "observed.json"), "utf8"));
  assert.equal(observed.effectiveConfig.approval_policy, receipt.policy.approval);
  assert.equal(observed.effectiveConfig.approvals_reviewer, "auto_review");
  assert.equal(observed.effectiveConfig.sandbox_mode, receipt.policy.sandbox);
  assert.equal(observed.effectiveConfig["sandbox_workspace_write.network_access"], receipt.policy.networkAccess);
  assert.equal(observed.effectiveConfig.model, receipt.model.name);
  assert.equal(observed.effectiveConfig.model_reasoning_effort, receipt.model.effort);
  assert.equal(observed.args.includes("--ignore-user-config"), false);
  assert.equal(observed.args.includes("--no-daemon"), false);
  assert.equal(receipt.child.exitCode, 0);
  assert.equal(readFileSync(receipt.report, "utf8"), "Outcome: blocked\nBlockers: fixture permission denied\n");
});

test("nonzero child status retains its final reply and partial fixture edit", () => {
  const f = fixture();
  fake(f, { exit: 7, failed: true, edit: true, report: "Outcome: blocked\nPartial fixture edit retained\n" });
  const { status, receipt } = run(f);
  assert.equal(status, 1);
  assert.equal(receipt.child.exitCode, 7);
  assert.equal(receipt.engineStatus.failed, true);
  assert.equal(readFileSync(join(f.root, "partial.txt"), "utf8"), "partial fixture edit");
  assert.equal(readFileSync(receipt.report, "utf8"), "Outcome: blocked\nPartial fixture edit retained\n");
});

test("a CLI exiting before it reads the packet decides the status by its own exit at any packet size", () => {
  for (const { size, exit, expected } of [{ size: 0, exit: 3, expected: 1 }, { size: 1024 * 1024, exit: 3, expected: 1 },
    { size: 1024 * 1024, exit: 0, expected: 2 }]) {
    const f = fixture();
    if (size) writeFileSync(f.request.packet, "p".repeat(size));
    fake(f, { unread: true, exit });
    const { status, receipt } = run(f);
    assert.equal(status, expected);
    assert.equal(receipt.child.exitCode, exit);
    if (exit) assert.equal(receipt.child.error, null);
    assert.deepEqual(receipt.cancellation, { requested: false, signal: null, errors: [] });
  }
});

test("missing final reply is a transport failure and an old output directory is refused", () => {
  const f = fixture();
  fake(f, { missing: true });
  const first = run(f);
  assert.equal(first.status, 2);
  assert.equal(first.receipt.report, null);
  writeFileSync(join(f.request.outputDir, "report.txt"), "stale reply");
  const second = run(f);
  assert.equal(second.status, 2);
  assert.equal(second.receipt.child.started, false);
  assert.equal(second.receipt.report, null);
  assert(second.receipt.diagnostics.some((x: string) => x.includes("EEXIST")));
  assert.equal(readFileSync(join(f.dir, "calls.jsonl"), "utf8").trim().split("\n").length, 2);
});

test("missing CLI and launch failure after preflight cannot reach a real vendor", () => {
  const absent = fixture();
  const missing = run(absent);
  assert.equal(missing.status, 2);
  assert.equal(missing.receipt.probes[0].started, false);
  assert.match(missing.receipt.probes[0].error, /ENOENT/);
  const vanished = fixture();
  fake(vanished, { unlink: true });
  const failed = run(vanished);
  assert.equal(failed.status, 2);
  assert.equal(failed.receipt.child.started, false);
  assert.match(failed.receipt.child.error, /ENOENT/);
});

test("unsupported required flags are diagnosed before the packet is delivered", () => {
  for (const flag of ["--json", "--color", "--config"]) {
    const f = fixture();
    fake(f, { missingFlag: flag });
    const { status, receipt } = run(f);
    assert.equal(status, 2);
    assert.match(receipt.diagnostics[0], new RegExp(`required ${flag}`));
    assert.equal(existsSync(join(f.dir, "observed.json")), false);
    assert.deepEqual(Object.keys(receipt.artifacts), ["request", "input"]);
  }
});

test("a help probe exiting non-zero stops before the packet is delivered", () => {
  const f = fixture();
  fake(f, { helpExit: 3 });
  const { status, receipt } = run(f);
  assert.equal(status, 2);
  assert.equal(receipt.probes[0].exitCode, 3);
  assert.match(receipt.diagnostics[0], /cannot inspect codex CLI flags/);
  assert.equal(existsSync(join(f.dir, "observed.json")), false);
});

test("a missing or empty supplied contract is refused before launching", () => {
  const f = fixture();
  const contract = join(f.request.contractRoot, "references/workflow/executor-contract.md");
  writeFileSync(contract, " \n");
  assert.throws(() => readRequest(f.requestPath), /empty executor contract/);
  rmSync(contract);
  assert.throws(() => readRequest(f.requestPath), /ENOENT/);
});

test("ANSI-coloured help satisfies the flag check while its saved output keeps the raw escapes", () => {
  for (const engine of ["codex", "claude"] as const) {
    const f = fixture(engine);
    fake(f, { colorHelp: true });
    const { status, receipt } = run(f);
    assert.equal(status, 0);
    assert.equal(existsSync(join(f.dir, "observed.json")), true);
    for (const probe of receipt.probes) assert(readFileSync(probe.stdout, "utf8").includes("\x1b[1m--model\x1b[0m"));
    const missing = fixture(engine);
    const flag = engine === "codex" ? "--color" : "--agent";
    fake(missing, { colorHelp: true, missingFlag: flag });
    const refused = run(missing);
    assert.equal(refused.status, 2);
    assert.match(refused.receipt.diagnostics[0], new RegExp(`required ${flag}`));
    assert.equal(existsSync(join(missing.dir, "observed.json")), false);
  }
});

test("large UTF-8 event and stderr logs are captured completely", () => {
  const f = fixture();
  fake(f, { large: true, report: "unchanged final reply\n" });
  const { status, receipt } = run(f);
  assert.equal(status, 0);
  assert.equal(readFileSync(receipt.artifacts.stderr, "utf8"), "diagnostic".repeat(200000));
  const event = readFileSync(receipt.artifacts.events, "utf8").trim().split("\n").map((line) => JSON.parse(line))[1];
  assert.equal(event.item.text, "λ".repeat(1024 * 1024));
  assert.equal(readFileSync(receipt.artifacts.events, "utf8"), readFileSync(receipt.artifacts.stdout, "utf8"));
  assert.equal(readFileSync(receipt.report, "utf8"), "unchanged final reply\n");
});

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return;
    await new Promise((done) => setTimeout(done, 30));
  }
  assert.fail("fixture did not reach the expected state within three seconds");
}

function alive(pid: number) {
  try { process.kill(pid, 0); return true; }
  catch (error: any) { if (error.code === "ESRCH") return false; throw error; }
}

async function cancelFixture(f: ReturnType<typeof fixture>, signal: NodeJS.Signals, cancelReport?: string) {
  fake(f, { cancel: true, cancelReport });
  const sentinel = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
  const child = spawn(process.execPath, [SCRIPT, f.requestPath], { env: { ...process.env, PATH: f.dir }, stdio: "pipe" });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => stdout += chunk);
  child.stderr.on("data", (chunk) => stderr += chunk);
  const closed = new Promise<number | null>((done) => child.on("close", (code) => done(code)));
  let owned: { parent: number; child: number } | undefined;
  try {
    await until(() => {
      try { owned = JSON.parse(readFileSync(join(f.dir, "owned.json"), "utf8")); return true; }
      catch (error: any) { if (error.code === "ENOENT" || error instanceof SyntaxError) return false; throw error; }
    });
    child.kill(signal);
    assert.equal(await closed, 1);
    assert.equal(stderr, "");
    const receipt = JSON.parse(stdout);
    assert.equal(receipt.cancellation.requested, true);
    assert.equal(receipt.cancellation.signal, signal);
    assert.deepEqual(receipt.cancellation.errors, []);
    assert.equal(receipt.child.started, true);
    assert.equal(receipt.child.pid, owned!.parent);
    assert.equal(JSON.parse(readFileSync(receipt.artifacts.child, "utf8")).pid, receipt.child.pid);
    assert.equal(alive(sentinel.pid!), true);
    await until(() => !alive(owned!.parent) && !alive(owned!.child));
    assert(readFileSync(receipt.artifacts.stdout, "utf8").includes(f.request.engine === "codex" ? "thread.started" : "init"));
    return receipt;
  } finally {
    sentinel.kill("SIGKILL");
    child.kill("SIGKILL");
    if (owned) {
      for (const pid of [owned.parent, owned.child]) {
        try { process.kill(pid, "SIGKILL"); } catch (error: any) { if (error.code !== "ESRCH") throw error; }
      }
    }
  }
}

test("cancellation terminates the owned process and resisting child while preserving unrelated work", { timeout: 12000 }, async () => {
  const f = fixture();
  const receipt = await cancelFixture(f, "SIGTERM");
  assert.equal(readFileSync(join(f.dir, "interrupted"), "utf8"), "SIGINT");
  assert.equal(receipt.child.signal, "SIGKILL");
  assert.equal(receipt.report, null);
});

test("cancellation during the help probe interrupts it and never launches the CLI", { timeout: 12000 }, async () => {
  const f = fixture();
  fake(f, { helpStall: true });
  const ready = join(f.dir, "probe.ready");
  const child = spawn(process.execPath, [SCRIPT, f.requestPath], { env: { ...process.env, PATH: f.dir }, stdio: "pipe" });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => stdout += chunk);
  child.stderr.on("data", (chunk) => stderr += chunk);
  const closed = new Promise<number | null>((done) => child.on("close", (code) => done(code)));
  try {
    await until(() => existsSync(ready));
    child.kill("SIGTERM");
    assert.equal(await closed, 1);
    assert.equal(stderr, "");
    const receipt = JSON.parse(stdout);
    assert.equal(receipt.helperExitCode, 1);
    assert.deepEqual(receipt.cancellation, { requested: true, signal: "SIGTERM", errors: [] });
    assert.equal(receipt.probes[0].signal, "SIGINT");
    assert.equal(receipt.child.started, false);
    assert.deepEqual(Object.keys(receipt.artifacts), ["request", "input"]);
  } finally {
    child.kill("SIGKILL");
    if (existsSync(ready)) {
      try { process.kill(Number(readFileSync(ready, "utf8")), "SIGKILL"); }
      catch (error: any) { if (error.code !== "ESRCH") throw error; }
    }
  }
});

test("a descendant holding the output pipes cannot keep the receipt waiting", { timeout: 12000 }, () => {
  const f = fixture();
  fake(f, { linger: true });
  try {
    const { status, receipt } = run(f);
    assert.equal(status, 2);
    assert.equal(receipt.child.exitCode, 0);
    assert.match(receipt.child.error, /still holds its output pipes/);
    assert.equal(receipt.child.strays, false);
    assert.equal(readFileSync(receipt.report, "utf8"), "Outcome: blocked\nBlockers: fixture permission denied\n");
  } finally {
    process.kill(Number(readFileSync(join(f.dir, "held.pid"), "utf8")), "SIGKILL");
  }
});

test("processes left in the CLI's own group after a normal exit are stopped and recorded", { timeout: 12000 }, async () => {
  const f = fixture();
  fake(f, { stray: "ignore" });
  let stray = 0;
  try {
    const { status, receipt } = run(f);
    stray = Number(readFileSync(join(f.dir, "stray.pid"), "utf8"));
    assert.equal(status, 0);
    assert.equal(receipt.child.strays, true);
    assert.deepEqual(receipt.probes.map((probe: { strays: boolean }) => probe.strays), [false]);
    await until(() => !alive(stray));
  } finally {
    if (stray) try { process.kill(stray, "SIGKILL"); } catch (error: any) { if (error.code !== "ESRCH") throw error; }
  }
});

for (const holder of ["child", "probe"] as const) {
  test(`a ${holder} process-group member still holding the output pipes is stopped without a transport error`, { timeout: 12000 }, async () => {
    const f = fixture();
    fake(f, holder === "child" ? { stray: "inherit" } : { strayHelp: "inherit" });
    const pidFile = join(f.dir, "stray.pid");
    try {
      const { status, receipt } = run(f);
      const held = holder === "child" ? receipt.child : receipt.probes[0];
      assert.equal(held.exitCode, 0);
      assert.equal(held.error, null);
      assert.equal(held.strays, true);
      assert.equal(status, 0);
      assert.equal(readFileSync(receipt.report, "utf8"), "Outcome: blocked\nBlockers: fixture permission denied\n");
      const stray = Number(readFileSync(pidFile, "utf8"));
      await until(() => !alive(stray));
    } finally {
      if (existsSync(pidFile)) {
        try { process.kill(Number(readFileSync(pidFile, "utf8")), "SIGKILL"); }
        catch (error: any) { if (error.code !== "ESRCH") throw error; }
      }
    }
  });
}

test("hangup cancels like an interrupt and collects the owned processes", { timeout: 12000 }, async () => {
  const receipt = await cancelFixture(fixture(), "SIGHUP");
  assert.equal(receipt.report, null);
});

test("quit cancels like an interrupt and collects the owned processes", { timeout: 12000 }, async () => {
  const f = fixture();
  await cancelFixture(f, "SIGQUIT");
  assert.equal(readFileSync(join(f.dir, "interrupted"), "utf8"), "SIGINT");
});

test("a failed turn remains distinct from zero OS exit and malformed streams remain available", () => {
  const failed = fixture();
  fake(failed, { failed: true, topError: true });
  const failure = run(failed);
  assert.equal(failure.status, 1);
  assert.equal(failure.receipt.child.exitCode, 0);
  assert.equal(failure.receipt.engineStatus.errorEvent, true);
  const truncated = fixture();
  fake(truncated, { badEvent: true, missing: true });
  const unreadable = run(truncated);
  assert.equal(unreadable.status, 2);
  assert(unreadable.receipt.diagnostics.some((x: string) => x.includes("unreadable event")));
  assert(readFileSync(unreadable.receipt.artifacts.stdout, "utf8").includes('{"type":'));
});

test("Claude receives a local executor definition referencing an independent contract root and literal packet", () => {
  const f = fixture("claude");
  fake(f, { denied: true, report: "Outcome: needs-decision\nPending choices: fixture unresolved\n" });
  const { status, receipt } = run(f, SCRIPT, { CLAUDE_CODE_EFFORT_LEVEL: "low" });
  assert.equal(status, 0);
  const observed = JSON.parse(readFileSync(join(f.dir, "observed.json"), "utf8"));
  assert.equal(observed.effortVariable, null);
  const args: string[] = observed.args;
  const name = args[args.indexOf("--agent") + 1];
  assert.match(name, /^agents-kit-executor-[0-9a-f]{12}$/);
  const definitions = JSON.parse(args[args.indexOf("--agents") + 1]);
  assert.deepEqual(Object.keys(definitions), [name]);
  const definition = definitions[name];
  assert.equal(observed.cwd, f.root);
  assert.equal(observed.input, readFileSync(f.request.packet, "utf8"));
  assert.equal(definition.model, f.request.model.name);
  assert.equal(definition.effort, f.request.model.effort);
  assert.equal(definition.permissionMode, "acceptEdits");
  assert(definition.prompt.includes(JSON.stringify(f.request.contractRoot)));
  assert(definition.prompt.includes("references/workflow/executor-contract.md"));
  assert.equal(definition.prompt.includes("CLAUDE_PLUGIN_ROOT"), false);
  assert.equal(existsSync(join(f.request.contractRoot, "agents/executor.md")), false);
  assert.equal(receipt.roleSource, join(REPO, "agents/executor.md"));
  assert.deepEqual(JSON.parse(readFileSync(receipt.artifacts.role, "utf8")), definitions);
  assert.equal(args[args.indexOf("--permission-prompts") + 1], "none");
  assert.equal(args[args.indexOf("--permission-mode") + 1], "acceptEdits");
  assert.deepEqual(args.slice(args.indexOf("--allowedTools") + 1),
    ["Bash(node --test tests/*.test.ts)", `Read(/${f.request.contractRoot}/references/**)`, `Read(/${f.request.contractRoot}/CORE_RULES.md)`]);
  assert.deepEqual(JSON.parse(args[args.indexOf("--settings") + 1]), { env: { CLAUDE_CODE_EFFORT_LEVEL: f.request.model.effort }, fallbackModel: [] });
  for (const flag of ["--bare", "--system-prompt", "--dangerously-skip-permissions", "--fallback-model"]) assert.equal(args.includes(flag), false);
  assert.equal("outcome" in receipt, false);
  assert.equal(readFileSync(receipt.report, "utf8"), "Outcome: needs-decision\nPending choices: fixture unresolved\n");
  assert(readFileSync(receipt.artifacts.events, "utf8").includes("fixture denied"));
  assert.deepEqual(receipt.engineStatus.permissionDenials, ["Bash"]);
});

test("Claude engine error and permission diagnostics preserve the raw zero exit and unchanged reply", () => {
  const f = fixture("claude");
  fake(f, { failed: true, topError: true, denied: true, edit: true, report: "Outcome: blocked\nUnfinished work\n" });
  const { status, receipt } = run(f);
  assert.equal(status, 1);
  assert.equal(receipt.child.exitCode, 0);
  assert.equal(receipt.engineStatus.failed, true);
  assert(readFileSync(receipt.artifacts.events, "utf8").includes("permission_denials"));
  assert(readFileSync(receipt.artifacts.stdout, "utf8").includes("fixture fatal error"));
  assert.equal(readFileSync(receipt.report, "utf8"), "Outcome: blocked\nUnfinished work\n");
  assert.equal(readFileSync(join(f.root, "partial.txt"), "utf8"), "partial fixture edit");
});

test("a Claude model switch fails the run and names both models", () => {
  for (const fallback of ["model_fallback", "model_refusal_fallback"]) {
    const f = fixture("claude");
    fake(f, { fallback });
    const { status, receipt } = run(f);
    assert.equal(status, 1);
    assert.deepEqual(receipt.engineStatus.modelFallbacks, ["fixture-model -> other-model"]);
    assert(receipt.diagnostics.includes("CLI switched models: fixture-model -> other-model"));
    assert.equal(readFileSync(receipt.report, "utf8"), "Outcome: blocked\nBlockers: fixture permission denied\n");
  }
});

test("Claude truncated streams retain raw evidence and any available final reply", () => {
  for (const scenario of [{ truncated: true }, { truncateAfterFinal: true }]) {
    const f = fixture("claude");
    fake(f, scenario);
    const { status, receipt } = run(f);
    assert.equal(status, 2);
    assert.equal(receipt.child.exitCode, 0);
    assert(receipt.diagnostics.some((x: string) => x.includes("unreadable event")));
    assert(readFileSync(receipt.artifacts.stdout, "utf8").includes('{"type":"'));
    if (scenario.truncateAfterFinal) assert.match(readFileSync(receipt.report, "utf8"), /Outcome: blocked/);
    else assert.equal(receipt.report, null);
  }
});

test("a Codex stream ending without a terminal turn event keeps its last message but is not a normal collection", () => {
  const f = fixture();
  fake(f, { noTerminal: true });
  const { status, receipt } = run(f);
  assert.equal(status, 2);
  assert.equal(receipt.child.exitCode, 0);
  assert.equal(receipt.engineStatus.completed, false);
  assert(receipt.diagnostics.includes("CLI stream ended without a terminal turn event; the saved reply may be unfinished"));
  assert.equal(readFileSync(receipt.report, "utf8"), "Outcome: blocked\nBlockers: fixture permission denied\n");
});

test("Claude refuses missing role definitions, unresolved settings and unsupported flags without recovery writes", () => {
  const noRole = fixture("claude");
  const script = join(noRole.dir, "source/scripts/executor-run.ts");
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(SCRIPT, script);
  fake(noRole);
  const missing = run(noRole, script);
  assert.equal(missing.status, 2);
  assert.match(missing.receipt.diagnostics[0], /cannot read executor role/);
  assert.equal(existsSync(join(noRole.dir, "calls.jsonl")), false);
  const roleFile = join(noRole.dir, "source/agents/executor.md");
  mkdirSync(dirname(roleFile), { recursive: true });
  writeFileSync(roleFile, readFileSync(join(REPO, "agents/executor.md"), "utf8").replace(/^Install root: .+$/m, ""));
  noRole.request.outputDir = join(noRole.dir, "output-2");
  noRole.save();
  const malformed = run(noRole, script);
  assert.equal(malformed.status, 2);
  assert.match(malformed.receipt.diagnostics[0], /unsupported executor role definition/);
  assert.equal(existsSync(join(noRole.dir, "calls.jsonl")), false);
  const unresolved = fixture("claude");
  unresolved.request.model.name = "${UNRESOLVED_MODEL}";
  unresolved.save();
  const settings = run(unresolved);
  assert.equal(settings.status, 2);
  assert.match(settings.receipt.diagnostics[0], /resolved model/);
  for (const flag of ["--agent", "--settings", "--permission-prompts"]) {
    const unsupported = fixture("claude");
    fake(unsupported, { missingFlag: flag });
    const result = run(unsupported);
    assert.equal(result.status, 2);
    assert.match(result.receipt.diagnostics[0], new RegExp(`required ${flag}`));
    assert.equal(existsSync(join(unsupported.dir, "observed.json")), false);
  }
});

test("Claude rejects unscoped shell allowances before launching", () => {
  for (const rule of ["Bash", "Bash(*)", "Bash( *)", "Bash()", "Bash(:*)", "Bash( :*)", "PowerShell", "PowerShell(:*)",
    "Monitor", "Monitor(*)", "Monitor(:*)",
    "Bash(git status) Bash(*)", "Read(a) Bash(*)", "Bash(git *)\tEdit", 'Bash(node -e "f()")', "Bash(git diff,Bash)",
    "Read(src\nCORE_RULES.md)"]) {
    const f = fixture("claude");
    if (f.request.engine !== "claude") assert.fail("Claude fixture required");
    f.request.policy.allowedTools = [rule];
    f.save();
    const { status, receipt } = run(f);
    assert.equal(status, 2);
    assert.match(receipt.diagnostics[0], /scoped tool allowances/);
    assert.ok(receipt.diagnostics[0].includes(JSON.stringify(rule)));
    assert.equal(receipt.child.started, false);
  }
});

test("Claude accepts hyphenated tool names, MCP server wildcards, and scoped Monitor rules, and names each refused entry", () => {
  const f = fixture("claude");
  if (f.request.engine !== "claude") assert.fail("Claude fixture required");
  f.request.policy.allowedTools = ["mcp__figma-dev-mode__get_code", "mcp__github__*", "mcp__plugin_my-plugin_database-tools__*", "mcp__github", "Monitor(npm run dev)"];
  f.save();
  assert.deepEqual(readRequest(f.requestPath), f.request);
  for (const rule of ["mcp__*", "*", "-Bash"]) {
    f.request.policy.allowedTools = [rule];
    f.save();
    assert.throws(() => readRequest(f.requestPath),
      (error: Error) => /scoped tool allowances/.test(error.message) && error.message.includes(JSON.stringify(rule)));
  }
});

test("Claude reads a linked contract root through both paths and refuses one a Read rule cannot express", () => {
  const f = fixture("claude");
  const linked = join(f.dir, "linked contract");
  symlinkSync(f.request.contractRoot, linked);
  f.request.contractRoot = linked;
  (f.request.policy as any).allowedTools = [];
  f.save();
  fake(f);
  const { status } = run(f);
  assert.equal(status, 0);
  const args: string[] = JSON.parse(readFileSync(join(f.dir, "observed.json"), "utf8")).args;
  assert.deepEqual(args.slice(args.indexOf("--allowedTools") + 1), [`Read(/${linked}/references/**)`, `Read(/${linked}/CORE_RULES.md)`, `Read(/${realpathSync(linked)}/references/**)`, `Read(/${realpathSync(linked)}/CORE_RULES.md)`]);
  const bracketed = join(f.dir, "contract [v2]");
  symlinkSync(realpathSync(linked), bracketed);
  f.request.contractRoot = bracketed;
  f.save();
  assert.throws(() => readRequest(f.requestPath), /becomes a Read allowance/);
});

test("Claude cancellation also collects its owned processes and preserves unrelated work", { timeout: 12000 }, async () => {
  const f = fixture("claude");
  const receipt = await cancelFixture(f, "SIGINT", "Outcome: blocked\nReply before interruption\n");
  assert.equal(readFileSync(join(f.dir, "terminated"), "utf8"), "SIGTERM");
  assert.equal(receipt.child.signal, "SIGKILL");
  assert.equal(readFileSync(receipt.report, "utf8"), "Outcome: blocked\nReply before interruption\n");
});

test("Claude receives SIGTERM whatever signal cancels it", { timeout: 12000 }, async () => {
  const f = fixture("claude");
  await cancelFixture(f, "SIGHUP");
  assert.equal(readFileSync(join(f.dir, "terminated"), "utf8"), "SIGTERM");
});

test("unsupported policy fields and incompatible network promises are refused", () => {
  const codex = fixture();
  if (codex.request.engine !== "codex") assert.fail("Codex fixture required");
  codex.request.policy.sandbox = "danger-full-access";
  codex.save();
  assert.throws(() => readRequest(codex.requestPath), /networkAccess is selectable only/);
  const claude = fixture("claude");
  (claude.request.policy as any).networkAccess = false;
  claude.save();
  assert.throws(() => readRequest(claude.requestPath), /unsupported fields: networkAccess/);
  codex.request.policy.sandbox = "read-only";
  codex.request.policy.networkAccess = true;
  codex.save();
  assert.throws(() => readRequest(codex.requestPath), /read-only requires false/);
});

test("a receipt larger than a pipe buffer is complete JSON after natural process termination", () => {
  const f = fixture();
  f.request.model.provenance = "fixture provenance ".repeat(10000);
  f.save();
  fake(f);
  const { status, receipt } = run(f);
  assert.equal(status, 0);
  assert.equal(receipt.model.provenance, f.request.model.provenance);
});

test("an output directory swapped for a link mid-run cannot redirect the final-reply write or the receipt's paths", () => {
  const f = fixture();
  const outside = mkdtempSync(join(TEMP, "outside-"));
  fake(f, { swapOutput: outside });
  const { status, receipt } = run(f);
  assert.equal(status, 2);
  assert.equal(receipt.report, null);
  assert.deepEqual(receipt.artifacts, {});
  assert.equal(receipt.probes[0].stdout, undefined);
  assert(receipt.diagnostics.includes("outputDir was replaced during the run; its paths no longer reach the saved artifacts"));
  assert.deepEqual(readdirSync(outside), []);
  assert.equal(readFileSync(join(`${f.request.outputDir}.moved`, "report.txt"), "utf8"),
    "Outcome: blocked\nBlockers: fixture permission denied\n");
});

test("an artifact swapped for a link mid-run cannot redirect the helper's writes", () => {
  const f = fixture();
  const outside = join(f.dir, "outside.txt");
  writeFileSync(outside, "ORIGINAL TARGET\n");
  fake(f, { swapEvents: outside });
  const { status, receipt } = run(f);
  assert.equal(status, 0);
  assert.equal(readFileSync(outside, "utf8"), "ORIGINAL TARGET\n");
  assert.equal(readFileSync(receipt.report, "utf8"), "Outcome: blocked\nBlockers: fixture permission denied\n");
  const observed = JSON.parse(readFileSync(join(f.dir, "observed.json"), "utf8"));
  assert.equal(observed.args.includes("--output-last-message"), false);
});

test("a help probe that exits cleanly with a transport error stops before the packet is delivered", { timeout: 12000 }, () => {
  const f = fixture();
  fake(f, { helpLinger: true });
  try {
    const { status, receipt } = run(f);
    assert.equal(status, 2);
    assert.equal(receipt.probes.length, 1);
    assert.equal(receipt.probes[0].exitCode, 0);
    assert.match(receipt.diagnostics[0], /cannot inspect codex CLI flags/);
    assert.match(receipt.diagnostics[0], /still holds its output pipes/);
    assert.equal(receipt.child.started, false);
    assert.equal(existsSync(join(f.dir, "observed.json")), false);
  } finally {
    process.kill(Number(readFileSync(join(f.dir, "held.pid"), "utf8")), "SIGKILL");
  }
});

test("a failed child record stops the started child and returns a transport-failure receipt", () => {
  const f = fixture();
  fake(f, { recordConflict: true });
  const { status, receipt } = run(f);
  assert.equal(status, 2);
  assert.equal(receipt.child.started, true);
  assert.match(receipt.child.error, /^child record: .*EEXIST/);
  assert.equal(receipt.child.exitCode, null);
  assert.equal(receipt.child.signal, "SIGINT");
  assert.equal(receipt.cancellation.requested, false);
  assert.equal(receipt.report, null);
});
