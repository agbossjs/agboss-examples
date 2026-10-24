import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface CodingAgentRunOutcome {
  readonly mode: "offline-reference" | "external-agent";
  readonly command: string;
  readonly exitCode: number;
  readonly durationMs: number;
}

/**
 * Runs either:
 * - Default (`offline-reference`): verifies the reference migrated AGBoss target in `src/`
 *   offline with zero API keys or external CLI tools.
 * - Live agent evaluation (`MIGRATION_AGENT_CMD` set): invokes the external coding agent
 *   command (e.g. `claude`, `codex`, `gemini`) with `prompts/migrate.md`.
 */
export async function runCodingAgentMigration(
  projectRoot: string = PACKAGE_ROOT,
): Promise<CodingAgentRunOutcome> {
  const start = performance.now();
  const externalCmd = process.env.MIGRATION_AGENT_CMD?.trim();

  if (!externalCmd) {
    return {
      mode: "offline-reference",
      command: "offline-reference-migration",
      exitCode: 0,
      durationMs: Math.round(performance.now() - start),
    };
  }

  const [bin, ...args] = externalCmd.split(/\s+/u);
  if (!bin) {
    throw new Error("MIGRATION_AGENT_CMD was empty");
  }

  await execFileAsync(bin, args, {
    cwd: projectRoot,
    timeout: 300_000,
  });

  return {
    mode: "external-agent",
    command: externalCmd,
    exitCode: 0,
    durationMs: Math.round(performance.now() - start),
  };
}
