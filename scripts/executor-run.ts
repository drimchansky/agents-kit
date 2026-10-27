import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, statSync, writeFileSync, type Stats } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { StringDecoder } from "node:string_decoder";

type Model = { name: string; effort: string; provenance: string };
type CodexPolicy = { sandbox: string; approval: "never"; networkAccess: boolean; provenance: string };
type ClaudePolicy = { permissionMode: string; permissionPrompts: "none"; allowedTools: string[]; network: "inherit"; provenance: string };
type CommonRequest = {
  root: string;
  packet: string;
  outputDir: string;
  contractRoot: string;
  model: Model;
};
export type Request = CommonRequest & ({ engine: "codex"; policy: CodexPolicy } | { engine: "claude"; policy: ClaudePolicy });

function object(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function keys(value: Record<string, any>, allowed: string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new Error(`${label} has unsupported fields: ${unknown.join(", ")}`);
}

function nonempty(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error(`${label} must be a nonempty string`);
  return value;
}

function absolute(value: unknown, label: string): string {
  const path = nonempty(value, label);
  if (!isAbsolute(path)) throw new Error(`${label} must be absolute`);
  return path;
}

function insideGit(root: string): boolean {
  for (let dir = realpathSync(root); ; dir = dirname(dir)) {
    if (existsSync(join(dir, ".git"))) return true;
    if (dirname(dir) === dir) return false;
  }
}

function codexPolicy(policy: Record<string, any>, root: string) {
  if (!insideGit(root)) throw new Error("Codex requires root inside a Git repository");
  keys(policy, ["sandbox", "approval", "networkAccess", "provenance"], "Codex policy");
  if (!["read-only", "workspace-write", "danger-full-access"].includes(policy.sandbox) ||
    policy.approval !== "never" || typeof policy.networkAccess !== "boolean") {
    throw new Error("Codex policy requires sandbox, approval never, and boolean networkAccess");
  }
  if ((policy.sandbox === "danger-full-access" && !policy.networkAccess) ||
    (policy.sandbox === "read-only" && policy.networkAccess)) {
    throw new Error("networkAccess is selectable only for workspace-write; read-only requires false and danger-full-access requires true");
  }
}

function claudePolicy(policy: Record<string, any>, contractRoot: string, effort: string) {
  keys(policy, ["permissionMode", "permissionPrompts", "allowedTools", "network", "provenance"], "Claude policy");
  if (!["acceptEdits", "manual", "dontAsk", "plan", "auto", "bypassPermissions"].includes(policy.permissionMode) ||
      policy.permissionPrompts !== "none" || policy.network !== "inherit" || !Array.isArray(policy.allowedTools)) {
    throw new Error("Claude policy requires explicit permissionMode, permissionPrompts none, allowedTools array, and network inherit");
  }
  for (const rule of policy.allowedTools) {
    nonempty(rule, "policy.allowedTools entry");
    const parts = /^([A-Za-z][A-Za-z0-9_-]*)(?:\(([^)]*)\))?$/.exec(rule) ?? /^(mcp__[A-Za-z0-9_-]+__)\*$/.exec(rule);
    const specifier = parts?.[2]?.trim().replace(/:\*$/, " *").trim();
    if (!parts || /[\r\n,]/.test(rule) ||
        (/^(Bash|PowerShell|Monitor)$/.test(parts[1]) && (!specifier || specifier.startsWith("*")))) {
      throw new Error(`allowedTools entry ${JSON.stringify(rule)}: supply separate scoped tool allowances; blanket shell rules are unsupported`);
    }
  }
  if (contractRoots(contractRoot).some((path) => /[*?[\]!\\()]/.test(path))) {
    throw new Error("Claude contractRoot cannot contain *, ?, [, ], !, \\, ( or ) because it becomes a Read allowance");
  }
  if (!["low", "medium", "high", "xhigh", "max"].includes(effort)) {
    throw new Error("Claude model.effort must be low, medium, high, xhigh or max");
  }
}

export function readRequest(path: string): Request {
  const value = object(JSON.parse(readFileSync(path, "utf8")), "request");
  keys(value, ["engine", "root", "packet", "outputDir", "contractRoot", "model", "policy"], "request");
  if (!["codex", "claude"].includes(value.engine)) throw new Error("engine must be codex or claude");
  for (const field of ["root", "packet", "outputDir", "contractRoot"]) absolute(value[field], field);
  if (!statSync(value.root).isDirectory()) throw new Error("root must be an existing directory");
  const output = relative(realpathSync.native(value.root), join(realpathSync.native(dirname(value.outputDir)), basename(value.outputDir)));
  if (!isAbsolute(output) && output !== ".." && !output.startsWith(`..${sep}`)) throw new Error("outputDir must lie outside root");
  if (!statSync(value.packet).isFile()) throw new Error("packet must be a readable regular file");
  if (!readFileSync(join(value.contractRoot, "references/workflow/executor-contract.md"), "utf8").trim()) {
    throw new Error("supplied contractRoot has an empty executor contract");
  }
  const model = object(value.model, "model");
  keys(model, ["name", "effort", "provenance"], "model");
  for (const field of ["name", "effort", "provenance"]) nonempty(model[field], `model.${field}`);
  if (/^(inherit|default)$/i.test(model.name.trim()) || /\$\{|^\$|<|>/.test(model.name + model.effort)) {
    throw new Error("supply resolved model.name and model.effort with their provenance");
  }
  if (!["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"].includes(model.effort)) {
    throw new Error("model.effort is not a supported explicit effort setting");
  }
  const policy = object(value.policy, "policy");
  nonempty(policy.provenance, "policy.provenance");
  if (value.engine === "codex") codexPolicy(policy, value.root);
  else claudePolicy(policy, value.contractRoot, model.effort);
  return value as Request;
}

const FORWARDED: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT"];

function groupAlive(pid: number): boolean {
  try { process.kill(-pid, 0); return true; }
  catch (error: any) { return error.code !== "ESRCH"; }
}

class Control {
  signal: NodeJS.Signals | null = null;
  stopSignal: NodeJS.Signals | null = null;
  interrupt: NodeJS.Signals | null = null;
  groups = new Set<number>();
  errors: string[] = [];
  termination: Promise<void> | null = null;

  send(pid: number, signal: NodeJS.Signals) {
    try { process.kill(-pid, signal); }
    catch (error: any) { if (error.code !== "ESRCH") this.errors.push(`process group ${pid}: ${error.message}`); }
  }

  cancel(signal: NodeJS.Signals) {
    if (this.signal) return;
    this.signal = signal;
    this.stop(signal);
  }

  stop(signal: NodeJS.Signals) {
    if (this.termination) return;
    this.stopSignal = this.interrupt ?? signal;
    for (const pid of this.groups) this.send(pid, this.stopSignal);
    this.termination = new Promise((done) => setTimeout(() => {
      for (const pid of this.groups) this.send(pid, "SIGKILL");
      done();
    }, 3000));
  }

  async sweep(pid: number) {
    this.send(pid, "SIGTERM");
    for (let waited = 0; waited < 3000 && groupAlive(pid); waited += 100) await new Promise((done) => setTimeout(done, 100));
    if (groupAlive(pid)) this.send(pid, "SIGKILL");
  }
}

type ProcessResult = {
  pid: number | null; started: boolean; exitCode: number | null; signal: string | null; error: string | null; strays: boolean;
  undelivered?: string;
};

type Receipt = {
  engine: Request["engine"] | null; root: string | null; contractRoot: string | null; model: Model | null;
  policy: CodexPolicy | ClaudePolicy | null; roleSource: string | null; child: ProcessResult; probes: object[];
  cancellation: { requested: boolean; signal: NodeJS.Signals | null; errors: string[] } | null; report: string | null;
  artifacts: Record<string, string>; diagnostics: string[]; helperExitCode: number;
  engineStatus?: { failed: boolean; completed: boolean; errorEvent: boolean; permissionDenials: string[]; errorItems: string[]; modelFallbacks: string[] };
};

type RunOptions = {
  command: string; args: string[]; root: string; prefix: string; input?: Buffer;
  control: Control; stdout?: (chunk: Buffer) => void; record?: string; env?: NodeJS.ProcessEnv;
};

function recordChild(options: RunOptions, pid: number, result: ProcessResult) {
  if (!options.record) return;
  try {
    writeFileSync(options.record, JSON.stringify({ pid, command: options.command, args: options.args }), { flag: "wx", mode: 0o600 });
  } catch (error: any) {
    result.error ??= `child record: ${error.message}`;
    options.control.stop("SIGTERM");
  }
}

async function settleStrays(pid: number | undefined, control: Control, result: ProcessResult) {
  if (control.termination || !pid || !groupAlive(pid)) return;
  result.strays = true;
  await control.sweep(pid);
}

async function runProcess(options: RunOptions): Promise<ProcessResult> {
  const out = openSync(`${options.prefix}.stdout`, "wx", 0o600);
  const err = openSync(`${options.prefix}.stderr`, "wx", 0o600);
  try {
    return await new Promise((done) => {
      const result: ProcessResult = { pid: null, started: false, exitCode: null, signal: null, error: null, strays: false };
      const child = spawn(options.command, options.args,
        { cwd: options.root, detached: true, stdio: "pipe", shell: false, env: options.env });
      child.on("spawn", () => {
        result.pid = child.pid!;
        result.started = true;
        options.control.groups.add(child.pid!);
        if (options.control.stopSignal) options.control.send(child.pid!, options.control.stopSignal);
        recordChild(options, child.pid!, result);
      });
      child.on("error", (error) => { result.error ??= error.message; });
      let closed = false;
      let drain: NodeJS.Timeout | undefined;
      let cleanup: Promise<void> | undefined;
      child.on("exit", () => {
        cleanup = (async () => {
          await settleStrays(child.pid, options.control, result);
          if (!closed) drain = setTimeout(() => {
            result.error ??= "CLI exited but a descendant still holds its output pipes; later output is not collected";
            child.stdout.destroy();
            child.stderr.destroy();
          }, 3000);
        })();
      });
      child.stdin.on("error", (error: any) => {
        if (["EPIPE", "ECONNRESET", "ERR_STREAM_DESTROYED"].includes(error.code)) {
          result.undelivered ??= `packet not fully delivered: ${error.message}`;
          return;
        }
        result.error ??= `stdin transport: ${error.message}`;
        options.control.stop("SIGTERM");
      });
      const consume = (fd: number, stream: "stdout" | "stderr", chunk: Buffer, callback?: (chunk: Buffer) => void) => {
        try { writeFileSync(fd, chunk); callback?.(chunk); }
        catch (error: any) {
          result.error ??= `cannot save ${basename(options.prefix)}.${stream}: ${error.message}`;
          options.control.stop("SIGTERM");
        }
      };
      for (const stream of [child.stdout, child.stderr]) stream.on("error", (error) => {
        result.error ??= error.message;
        options.control.stop("SIGTERM");
      });
      child.stdout.on("data", (chunk: Buffer) => consume(out, "stdout", chunk, options.stdout));
      child.stderr.on("data", (chunk: Buffer) => consume(err, "stderr", chunk));
      child.on("close", async (code, signal) => {
        closed = true;
        clearTimeout(drain);
        result.exitCode = code;
        result.signal = signal;
        if (result.undelivered && code === 0) result.error ??= `stdin transport: ${result.undelivered}`;
        await cleanup;
        if (options.control.termination) await options.control.termination;
        if (child.pid) options.control.groups.delete(child.pid);
        done(result);
      });
      child.stdin.end(options.input);
    });
  } finally { closeSync(out); closeSync(err); }
}

function codexArgs(request: Request & { engine: "codex" }): string[] {
  return ["exec", "--json", "--color", "never", "-C", request.root,
    "--sandbox", request.policy.sandbox, "--model", request.model.name,
    "-c", `approval_policy=${JSON.stringify(request.policy.approval)}`,
    "-c", `model_reasoning_effort=${JSON.stringify(request.model.effort)}`,
    "-c", `sandbox_workspace_write.network_access=${request.policy.networkAccess}`, "-"];
}

function codexBootstrap(contractRoot: string): string {
  const contract = join(contractRoot, "references/workflow/executor-contract.md");
  return `You are the Codex CLI executor for agents-kit's registered write-mode consumers.\n` +
    `Before acting, read and follow the executor contract at this literal JSON path: ${JSON.stringify(contract)}.\n` +
    `If it cannot be read, report the blocker and make no edit. Preserve live sandbox, approval and managed security restrictions.\n` +
    `Return the contract's evidence report as your final reply; do not write a report file.\n\nCoordinator packet follows:\n`;
}

function claudeRole(request: Request & { engine: "claude" }) {
  const source = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "agents/executor.md");
  let text: string;
  try { text = readFileSync(source, "utf8"); }
  catch (error: any) { throw new Error(`cannot read executor role at ${source}; restore the source/plugin role definition: ${error.message}`); }
  const parts = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/.exec(text);
  const description = parts?.[1].match(/^description: (.+)$/m)?.[1];
  if (!parts || !/^name: executor\r?$/m.test(parts[1]) || !description || !/^Install root: .+$/m.test(parts[2])) {
    throw new Error(`unsupported executor role definition at ${source}; expected executor frontmatter and an Install root paragraph`);
  }
  const prompt = parts[2].replace(/^Install root: .+$/m, () => `Install root (literal JSON path): ${JSON.stringify(request.contractRoot)}.`);
  const name = `agents-kit-executor-${randomBytes(6).toString("hex")}`;
  return { source, name, definition: { [name]: { description, prompt, model: request.model.name, effort: request.model.effort,
    permissionMode: request.policy.permissionMode } } };
}

function contractRoots(contractRoot: string): string[] {
  return [...new Set([contractRoot, realpathSync(contractRoot)].map((path) => path.replace(/\/+$/, "")))];
}

function claudeArgs(request: Request & { engine: "claude" }, role: { name: string; definition: object }): string[] {
  const reads = contractRoots(request.contractRoot).flatMap((path) => [`Read(/${path}/references/**)`, `Read(/${path}/CORE_RULES.md)`]);
  return ["-p", "--output-format", "stream-json", "--verbose", "--input-format", "text", "--agent", role.name,
    "--agents", JSON.stringify(role.definition), "--model", request.model.name, "--effort", request.model.effort,
    "--settings", JSON.stringify({ env: { CLAUDE_CODE_EFFORT_LEVEL: request.model.effort }, fallbackModel: [] }),
    "--permission-mode", request.policy.permissionMode, "--permission-prompts", request.policy.permissionPrompts,
    "--allowedTools", ...request.policy.allowedTools, ...reads];
}

const PROBES: Record<Request["engine"], { args: string[]; flags: string[] }[]> = {
  codex: [
    { args: ["exec", "--help"], flags: ["--json", "--color", "--cd", "--sandbox", "--model", "--config"] },
  ],
  claude: [{ args: ["--help"], flags: ["--print", "--output-format", "--verbose", "--input-format",
    "--agent", "--agents", "--model", "--effort", "--settings", "--permission-mode", "--permission-prompts", "--allowedTools"] }],
};

class Events {
  decoder = new StringDecoder("utf8");
  pending = "";
  errors: string[] = [];
  failed = false;
  completed = false;
  topError = false;
  denials: string[] = [];
  errorItems: string[] = [];
  fallbacks: string[] = [];
  report: string | null = null;
  logFailed = false;
  fd: number;
  engine: Request["engine"];

  constructor(path: string, engine: Request["engine"]) {
    this.engine = engine;
    this.fd = openSync(path, "wx", 0o600);
  }

  consume(chunk: Buffer) {
    this.pending += this.decoder.write(chunk);
    let end: number;
    while ((end = this.pending.indexOf("\n")) >= 0) {
      this.line(this.pending.slice(0, end));
      this.pending = this.pending.slice(end + 1);
    }
  }

  line(line: string) {
    if (!line.trim()) return;
    try {
      const event = object(JSON.parse(line), "event");
      this.log(line);
      if (this.engine === "codex") codexEvent(event, this);
      else claudeEvent(event, this);
    } catch (error: any) { this.errors.push(`unreadable event stream: ${error.message}`); }
  }

  log(line: string) {
    try { writeFileSync(this.fd, line + "\n"); }
    catch (error: any) {
      if (!this.logFailed) this.errors.push(`cannot write event log: ${error.message}`);
      this.logFailed = true;
    }
  }

  finish() {
    this.pending += this.decoder.end();
    if (this.pending.trim()) this.line(this.pending);
    closeSync(this.fd);
  }
}

function codexEvent(event: Record<string, any>, state: Events) {
  if (event.type === "turn.failed") state.failed = true;
  if (event.type === "turn.completed") state.completed = true;
  if (event.type === "error") state.topError = true;
  if (event.type === "item.completed" && event.item?.type === "error") state.errorItems.push(String(event.item.message ?? ""));
  if (event.type === "item.completed" && event.item?.type === "agent_message" && typeof event.item.text === "string") state.report = event.item.text;
}

function claudeEvent(event: Record<string, any>, state: Events) {
  if (event.type === "error") state.topError = true;
  if (event.type === "system" && /^model(_refusal)?_fallback$/.test(event.subtype)) {
    state.fallbacks.push(`${event.original_model ?? "unknown"} -> ${event.fallback_model ?? "unknown"}`);
  }
  if (event.type !== "result") return;
  state.completed = true;
  state.failed = event.is_error === true || (typeof event.subtype === "string" && event.subtype.startsWith("error"));
  if (typeof event.result === "string") state.report = event.result;
  if (Array.isArray(event.permission_denials)) {
    state.denials = event.permission_denials.map((denial: any) => String(denial?.tool_name ?? "unknown"));
  }
}

export function exitStatus(cancelled: boolean, child: ProcessResult,
  events: Pick<Events, "errors" | "failed" | "completed" | "topError" | "fallbacks">, report: string | null): [number, string?] {
  if (cancelled) return [1];
  if (!child.started || child.error || events.errors.length) return [2];
  if (child.exitCode !== 0 || events.failed || (events.topError && !events.completed)) return [1];
  if (events.fallbacks.length) return [1, `CLI switched models: ${events.fallbacks.join(", ")}`];
  if (!report) return [2, "CLI returned no final reply; inspect saved stdout and stderr"];
  if (!events.completed) return [2, "CLI stream ended without a terminal turn event; the saved reply may be unfinished"];
  return [0];
}

async function checkFlags(request: Request, control: Control, probes: object[]): Promise<boolean> {
  for (const [index, { args, flags }] of PROBES[request.engine].entries()) {
    const prefix = join(request.outputDir, `help-${index}`);
    const result = await runProcess({ command: request.engine, args, root: request.root, prefix, control });
    probes.push({ args, ...result, stdout: `${prefix}.stdout`, stderr: `${prefix}.stderr` });
    if (control.signal) return false;
    if (!result.started || result.exitCode !== 0 || result.error) throw new Error(`cannot inspect ${request.engine} CLI flags; see ${prefix}.stderr: ${result.error ?? result.signal ?? result.exitCode}`);
    const help = readFileSync(`${prefix}.stdout`, "utf8").replace(/\x1b\[[0-?]*[ -\/]*[@-~]/g, "");
    for (const flag of flags) if (!new RegExp(`(^|\\s)${flag}(?=[\\s<,=]|$)`).test(help)) {
      throw new Error(`${request.engine} lacks required ${flag}; use a CLI supporting this flag; see ${prefix}.stdout`);
    }
  }
  return true;
}

function saveReport(fd: number, path: string, report: Buffer): string | null {
  if (!report.toString("utf8").trim()) return null;
  writeFileSync(fd, report);
  return path;
}

function sameDirectory(path: string, created: Stats): boolean {
  try {
    const current = lstatSync(path);
    return current.isDirectory() && current.dev === created.dev && current.ino === created.ino;
  } catch { return false; }
}

async function execute(path: string): Promise<Receipt> {
  const control = new Control();
  const cancel = (signal: NodeJS.Signals) => control.cancel(signal);
  for (const signal of FORWARDED) process.on(signal, cancel);
  const receipt: Receipt = {
    engine: null, root: null, contractRoot: null, model: null, policy: null,
    roleSource: null, child: { pid: null, started: false, exitCode: null, signal: null, error: null, strays: false },
    probes: [], cancellation: null, report: null, artifacts: {}, diagnostics: [], helperExitCode: 2,
  };
  let output: { path: string; stats: Stats } | undefined;
  try {
    const request = readRequest(path);
    Object.assign(receipt, { engine: request.engine, root: request.root, contractRoot: request.contractRoot,
      model: request.model, policy: request.policy });
    control.interrupt = request.engine === "codex" ? "SIGINT" : "SIGTERM";
    if (process.platform === "win32") throw new Error("owned-process cancellation requires a local POSIX host");
    mkdirSync(request.outputDir, { mode: 0o700 });
    output = { path: request.outputDir, stats: lstatSync(request.outputDir) };
    const artifact = (name: string) => join(request.outputDir, name);
    receipt.artifacts = { request: artifact("request.json"), input: artifact("input.txt"), command: artifact("command.json"),
      stdout: artifact("run.stdout"), stderr: artifact("run.stderr"), events: artifact("events.jsonl"), child: artifact("child.json") };
    writeFileSync(receipt.artifacts.request, JSON.stringify(request, null, 2), { flag: "wx", mode: 0o600 });
    const role = request.engine === "claude" ? claudeRole(request) : null;
    if (role) {
      receipt.roleSource = role.source;
      receipt.artifacts.role = artifact("agents.json");
      writeFileSync(receipt.artifacts.role, JSON.stringify(role.definition, null, 2), { flag: "wx", mode: 0o600 });
    }
    const input = request.engine === "codex" ?
      Buffer.concat([Buffer.from(codexBootstrap(request.contractRoot)), readFileSync(request.packet)]) : readFileSync(request.packet);
    writeFileSync(receipt.artifacts.input, input, { flag: "wx", mode: 0o600 });
    if (!(await checkFlags(request, control, receipt.probes))) { receipt.helperExitCode = 1; return receipt; }
    const args = request.engine === "codex" ? codexArgs(request) : claudeArgs(request, role!);
    writeFileSync(receipt.artifacts.command, JSON.stringify({ command: request.engine, args, cwd: request.root }, null, 2), { flag: "wx", mode: 0o600 });
    const events = new Events(receipt.artifacts.events, request.engine);
    const reportFd = openSync(artifact("report.txt"), "wx", 0o600);
    const { undelivered, ...child } = await runProcess({ command: request.engine, args, root: request.root, prefix: artifact("run"),
      input, control, record: receipt.artifacts.child, stdout: (chunk) => events.consume(chunk),
      env: request.engine === "claude" ? { ...process.env, CLAUDE_CODE_EFFORT_LEVEL: undefined } : undefined });
    receipt.child = child;
    if (undelivered) receipt.diagnostics.push(undelivered);
    events.finish();
    receipt.diagnostics.push(...events.errors);
    receipt.engineStatus = { failed: events.failed, completed: events.completed, errorEvent: events.topError,
      permissionDenials: events.denials, errorItems: events.errorItems, modelFallbacks: events.fallbacks };
    let saveFailed = false;
    try {
      receipt.report = saveReport(reportFd, artifact("report.txt"), Buffer.from(events.report ?? ""));
    } catch (error: any) { saveFailed = true; receipt.diagnostics.push(`cannot save final reply: ${error.message}`); }
    finally { closeSync(reportFd); }
    const [code, diagnostic] = exitStatus(control.signal !== null, receipt.child, events, receipt.report);
    if (diagnostic && !(saveFailed && diagnostic.startsWith("CLI returned no final reply"))) receipt.diagnostics.push(diagnostic);
    receipt.helperExitCode = code;
  } catch (error: any) { receipt.diagnostics.push(error.message); }
  finally {
    for (const signal of FORWARDED) process.removeListener(signal, cancel);
    receipt.cancellation = { requested: control.signal !== null, signal: control.signal, errors: control.errors };
    if (output && !sameDirectory(output.path, output.stats)) {
      receipt.diagnostics.push("outputDir was replaced during the run; its paths no longer reach the saved artifacts");
      receipt.report = null;
      receipt.artifacts = {};
      for (const probe of receipt.probes as Record<string, unknown>[]) { delete probe.stdout; delete probe.stderr; }
      if (!control.signal) receipt.helperExitCode = 2;
    } else receipt.artifacts = Object.fromEntries(Object.entries(receipt.artifacts).filter(([, file]) => existsSync(file)));
  }
  return receipt;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.on("error", (error: any) => { if (error.code !== "EPIPE" && error.code !== "ENOTCONN") throw error; });
  const receipt: Pick<Receipt, "helperExitCode" | "diagnostics"> = process.argv.length === 3 ? await execute(process.argv[2]) :
    { helperExitCode: 2, diagnostics: ["usage: node executor-run.ts <launch-request.json>"] };
  process.stdout.write(JSON.stringify(receipt) + "\n");
  process.exitCode = receipt.helperExitCode;
}
