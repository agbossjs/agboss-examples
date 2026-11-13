import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Clock } from "@agboss/core";
import { seconds } from "@agboss/core/units";
import { CliSetupError } from "./errors.js";

const MAX_LINE_BYTES = 8 * 1024 * 1024;
const STDERR_HEAD_BYTES = 2048;
const KILL_GRACE = seconds(2);

/** One CLI process at a time in this process, across every vendor: a FIFO mutex. */
let queueTail: Promise<void> = Promise.resolve();

async function acquire(): Promise<() => void> {
  const previous = queueTail;
  let release: () => void = () => undefined;
  queueTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  return release;
}

/** Kills the whole tree: the process group on POSIX (SIGTERM, then SIGKILL), `taskkill /T /F` on Windows. */
export function killTree(pid: number | undefined, soft = true): void {
  if (pid === undefined) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
    } else {
      process.kill(-pid, soft ? "SIGTERM" : "SIGKILL");
    }
  } catch {
    // already gone
  }
}

export interface CliRunOptions {
  readonly binary: string;
  readonly env: Record<string, string>;
  readonly signal: AbortSignal;
  readonly clock: Clock;
  /** Gets the fresh, empty working directory: writes the vendor's own files there, returns the call. */
  readonly prepare: (dir: string) => Promise<{ readonly args: readonly string[]; readonly stdin: string }>;
  /** Each JSON line the CLI prints. Throw to kill the run: the call fails with that error. */
  readonly onEvent: (event: unknown) => void;
}

export interface CliRunResult {
  readonly exitCode: number | null;
  readonly stderr: string;
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function spawnAndRead(
  options: CliRunOptions,
  dir: string,
  call: { readonly args: readonly string[]; readonly stdin: string },
): Promise<CliRunResult> {
  return new Promise((resolve, reject) => {
    const windows = process.platform === "win32";
    const child = spawn(options.binary, [...call.args], {
      cwd: dir,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      detached: !windows,
      shell: windows && /\.(cmd|bat)$/iu.test(options.binary),
    });
    let failure: Error | undefined;
    let closed = false;
    let stderr = "";
    let pending = "";

    const fail = (error: Error): void => {
      if (failure !== undefined) return;
      failure = error;
      killTree(child.pid);
      // still alive after the grace: the whole group gets SIGKILL
      void options.clock.sleep(KILL_GRACE).then(() => {
        if (!closed) killTree(child.pid, false);
      });
    };
    const onAbort = (): void => {
      fail(asError(options.signal.reason));
    };
    const line = (text: string): void => {
      if (text.trim() === "") return;
      let event: unknown;
      try {
        event = JSON.parse(text);
      } catch {
        return; // not JSON: skipped
      }
      try {
        options.onEvent(event);
      } catch (error) {
        fail(asError(error));
      }
    };
    const finish = (settle: () => void): void => {
      options.signal.removeEventListener("abort", onAbort);
      closed = true;
      settle();
    };

    options.signal.addEventListener("abort", onAbort, { once: true });
    child.once("error", (error: NodeJS.ErrnoException) => {
      const missing = error.code === "ENOENT" || error.code === "EACCES";
      finish(() => {
        reject(
          missing
            ? new CliSetupError(`cannot start ${options.binary}: install it and log in, or set its AGBOSS_*_BINARY`)
            : error,
        );
      });
    });
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      pending += chunk;
      for (let at = pending.indexOf("\n"); at >= 0; at = pending.indexOf("\n")) {
        line(pending.slice(0, at));
        pending = pending.slice(at + 1);
      }
      if (pending.length > MAX_LINE_BYTES) fail(new Error("cli.line-too-long: one JSONL line is over 8 MB"));
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      if (stderr.length < STDERR_HEAD_BYTES) stderr = (stderr + chunk).slice(0, STDERR_HEAD_BYTES);
    });
    // the CLI's own children outlive it unless the group is killed too
    child.once("exit", () => {
      if (failure !== undefined) killTree(child.pid, false);
    });
    child.once("close", (exitCode) => {
      line(pending);
      finish(() => {
        if (failure !== undefined) reject(failure);
        else resolve({ exitCode, stderr });
      });
    });
    child.stdin.on("error", () => undefined); // the CLI may exit before reading all of it
    child.stdin.end(call.stdin);
    if (options.signal.aborted) onAbort();
  });
}

/**
 * One CLI run: waits its turn, makes a fresh empty temp directory, runs the CLI in it, and only
 * after the process has exited removes the directory and lets the next run start.
 */
export async function runCli(options: CliRunOptions): Promise<CliRunResult> {
  const release = await acquire();
  let dir: string | undefined;
  try {
    options.signal.throwIfAborted();
    dir = await mkdtemp(join(tmpdir(), "agboss-cli-")); // mode 0700
    return await spawnAndRead(options, dir, await options.prepare(dir));
  } finally {
    if (dir !== undefined) await rm(dir, { recursive: true, force: true });
    release();
  }
}
