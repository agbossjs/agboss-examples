// Helpers of the cluster scripts (agbossjs/agboss#487): kubectl on the kind context, the host's
// NodePorts, waits with a deadline. No `timeout` binary: every wait has its own deadline.
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const CLUSTER = "agboss-scaling";
export const CONTEXT = `kind-${CLUSTER}`;
export const NAMESPACE = "agboss";
export const NODE = `${CLUSTER}-control-plane`;
export const PROJECT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const API = "http://127.0.0.1:18080";
export const STUB = "http://127.0.0.1:18081";
export const PROMETHEUS = "http://127.0.0.1:19090";
/** The node's cap: everything in the cluster shares it. */
export const NODE_CPUS = "3";
export const NODE_MEMORY = "4g";

export const log = (line) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${line}`);

/** Runs a command, inheriting its output; throws on a non-zero exit. */
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", cwd: PROJECT, ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited ${String(result.status)}`);
}

/** Runs a command and returns its stdout. */
export const output = (command, args, options = {}) =>
  execFileSync(command, args, { cwd: PROJECT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });

/** kubectl on the kind context (and the namespace unless `-n` / `-A` is given). */
export const kubectl = (args, options = {}) =>
  output("kubectl", ["--context", CONTEXT, ...(args.includes("-n") || args.includes("-A") ? [] : ["-n", NAMESPACE]), ...args], options);

export const kubectlJson = (args) => JSON.parse(kubectl([...args, "-o", "json"]));

/** Waits until `check()` gives something truthy, every `everyMs`, for at most `timeoutMs`. */
export async function until(what, check, { timeoutMs = 120_000, everyMs = 2_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  for (;;) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    if (Date.now() > deadline)
      throw new Error(`timed out after ${String(timeoutMs / 1000)} s waiting for ${what}${last ? `: ${String(last.message ?? last)}` : ""}`);
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
}

/** A JSON request with a deadline of its own (a frozen pod behind a Service must not hang us). */
export async function http(url, { method = "GET", body, timeoutMs = 5_000 } = {}) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  return { status: response.status, body: text === "" ? undefined : JSON.parse(text) };
}

/** Whether a binary is on the PATH. */
export const has = (binary) => spawnSync(binary, ["version"], { stdio: "ignore" }).error === undefined;
