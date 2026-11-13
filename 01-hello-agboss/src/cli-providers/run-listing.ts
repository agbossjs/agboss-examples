import { spawn } from "node:child_process";
import type { Clock } from "@agboss/core";
import { seconds } from "@agboss/core/units";
import { killTree } from "./run-cli.js";

const TIMEOUT = seconds(30);

/**
 * A short CLI query (`codex features list`): its stdout, or a rejection. On abort or timeout the
 * whole process group is killed, so a child the query spawned does not survive it.
 */
export function runListing(
  binary: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly env: Record<string, string>; readonly signal: AbortSignal; readonly clock: Clock },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const windows = process.platform === "win32";
    const child = spawn(binary, [...args], {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      detached: !windows,
      shell: windows && /\.(cmd|bat)$/iu.test(binary),
    });
    let stdout = "";
    let failure: Error | undefined;
    let closed = false;
    const stop = (error: Error): void => {
      failure ??= error;
      killTree(child.pid, false);
    };
    const onAbort = (): void => {
      stop(options.signal.reason instanceof Error ? options.signal.reason : new Error("aborted"));
    };
    options.signal.addEventListener("abort", onAbort, { once: true });
    void options.clock.sleep(TIMEOUT).then(() => {
      if (!closed) stop(new Error("timed out"));
    });
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.once("error", (error) => {
      closed = true;
      options.signal.removeEventListener("abort", onAbort);
      reject(error);
    });
    child.once("close", (code) => {
      closed = true;
      options.signal.removeEventListener("abort", onAbort);
      killTree(child.pid, false); // anything it left in the group
      if (failure !== undefined) reject(failure);
      else if (code !== 0) reject(new Error(`exit ${String(code)}`));
      else resolve(stdout);
    });
    if (options.signal.aborted) onAbort();
  });
}
