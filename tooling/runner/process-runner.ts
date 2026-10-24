import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ProcessRunOptions {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly timeoutMs?: number;
  readonly input?: string;
}

export interface ProcessRunResult {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly exitCode: number;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
}

/**
 * Minimal child-process runner for verification harnesses (Rule R3).
 * Runs a command in an isolated environment and captures exit code, stdout, stderr, and elapsed time.
 */
export async function runProcess(
  command: string,
  args: readonly string[],
  options: ProcessRunOptions,
): Promise<ProcessRunResult> {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? 120_000;

  return new Promise<ProcessRunResult>((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: {
        ...process.env,
        npm_config_cache: join(tmpdir(), "agboss-npm-cache"),
        NO_COLOR: "1",
        FORCE_COLOR: "0",
        ...options.env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    if (options.input !== undefined) {
      child.stdin.write(options.input);
    }
    child.stdin.end();

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        command,
        args,
        cwd: options.cwd,
        exitCode: code ?? (timedOut ? 124 : 1),
        signal,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
  });
}
