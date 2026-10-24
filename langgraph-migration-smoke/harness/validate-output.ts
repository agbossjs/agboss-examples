import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface MigrationValidationResult {
  readonly agbossCheckPassed: boolean;
  readonly agbossCheckProblemCount: number;
  readonly zeroLangGraphImportsInSrc: boolean;
  readonly dtoClassesCount: number;
  readonly workflowPathsCount: number;
}

async function listTypeScriptFiles(dir: string): Promise<readonly string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTypeScriptFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

export async function validateMigratedProject(
  projectRoot: string = PACKAGE_ROOT,
): Promise<MigrationValidationResult> {
  const agbossBin = join(projectRoot, "node_modules", ".bin", "agboss");
  const { stdout } = await execFileAsync(
    process.execPath,
    [agbossBin, "check", "--json"],
    { cwd: projectRoot },
  );

  const parsed = JSON.parse(stdout.trim()) as {
    readonly ok: boolean;
    readonly result?: { readonly problems?: readonly unknown[] };
  };

  const srcFiles = await listTypeScriptFiles(join(projectRoot, "src"));
  let hasLangGraphImport = false;
  for (const file of srcFiles) {
    const content = await readFile(file, "utf8");
    if (content.includes("@langchain/langgraph")) {
      hasLangGraphImport = true;
    }
  }

  const dtoSource = await readFile(
    join(projectRoot, "src", "support", "support.dto.ts"),
    "utf8",
  );
  const dtoMatches = dtoSource.match(/export class \w+Dto/gu) ?? [];

  const workflowSource = await readFile(
    join(projectRoot, "src", "support", "support.workflow.ts"),
    "utf8",
  );
  const hasStartPath = workflowSource.includes("start(SupportWorkflowStart)");
  const hasReviewerPath = workflowSource.includes("agent(ReplyReviewerAgent)");

  return {
    agbossCheckPassed: parsed.ok === true,
    agbossCheckProblemCount: parsed.result?.problems?.length ?? 0,
    zeroLangGraphImportsInSrc: !hasLangGraphImport,
    dtoClassesCount: dtoMatches.length,
    workflowPathsCount: (hasStartPath ? 1 : 0) + (hasReviewerPath ? 1 : 0),
  };
}
