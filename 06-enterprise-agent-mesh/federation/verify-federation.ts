import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCheckOutput } from "../../scripts/tooling/assertions/diagnostics.js";
import { runProcess } from "../../scripts/tooling/runner/process-runner.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(currentDir, "..");

export interface FederationVerificationResult {
  readonly compatibleOk: boolean;
  readonly breakingExitCode: number;
  readonly breakingCodes: readonly string[];
  readonly blastRadiusWorkflows: readonly string[];
  readonly hubAppNames: readonly string[];
}

export function ensureBreakingSnapshots(): string {
  const compatibleDir = resolve(currentDir, "snapshots/compatible");
  const breakingDir = resolve(currentDir, "snapshots/breaking");
  mkdirSync(breakingDir, { recursive: true });

  const triageRaw = readFileSync(
    resolve(compatibleDir, "triage.describe.json"),
    "utf8",
  );
  writeFileSync(resolve(breakingDir, "triage.describe.json"), triageRaw, "utf8");

  const billing = JSON.parse(
    readFileSync(resolve(compatibleDir, "billing.describe.json"), "utf8"),
  ) as {
    result: {
      application: {
        contracts: {
          exports: {
            input: { schemaHash: string };
            outputs: { schemaHash: string }[];
          }[];
          schemas: Record<
            string,
            {
              schemaHash: string;
              jsonSchema: {
                properties: Record<string, unknown>;
                required: string[];
              };
            }
          >;
        };
      };
    };
  };

  const brokenHash =
    "0000000000000000000000000000000000000000000000000000000000000001";
  const inquirySchema =
    billing.result.application.contracts.schemas["BillingInquiryDto"];
  if (inquirySchema !== undefined) {
    inquirySchema.schemaHash = brokenHash;
    inquirySchema.jsonSchema.properties["accountRegion"] = {
      type: "string",
      description: "Required account billing region added without consumer migration",
    };
    inquirySchema.jsonSchema.required.push("accountRegion");
  }
  const firstExport = billing.result.application.contracts.exports[0];
  if (firstExport !== undefined) {
    firstExport.input.schemaHash = brokenHash;
  }

  writeFileSync(
    resolve(breakingDir, "billing.describe.json"),
    `${JSON.stringify(billing, null, 2)}\n`,
    "utf8",
  );

  const catalog = JSON.parse(
    readFileSync(resolve(compatibleDir, "catalog.describe.json"), "utf8"),
  ) as {
    result: {
      application: {
        contracts: {
          exports: { tool?: string }[];
        };
      };
    };
  };
  catalog.result.application.contracts.exports =
    catalog.result.application.contracts.exports.filter(
      (entry) => entry.tool !== "lookup-sku-tool",
    );

  writeFileSync(
    resolve(breakingDir, "catalog.describe.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
    "utf8",
  );

  return breakingDir;
}

export async function runFederationBlastRadiusProof(): Promise<FederationVerificationResult> {
  const compatibleDir = resolve(currentDir, "snapshots/compatible");
  const breakingDir = ensureBreakingSnapshots();

  const compatibleRun = await runProcess(
    "npx",
    ["agboss", "check", "--federation", compatibleDir, "--json"],
    { cwd: projectRoot },
  );

  const breakingRun = await runProcess(
    "npx",
    ["agboss", "check", "--federation", breakingDir, "--json"],
    { cwd: projectRoot },
  );

  const breakingReport = parseCheckOutput(breakingRun.stdout);
  const problems = breakingReport.result?.problems ?? [];
  const hasTriageBlastRadius = problems.some((p) =>
    p.message.includes("triage-gateway-application › triage-workflow"),
  );

  const hubRun = await runProcess(
    "npx",
    ["agboss", "hub", "show", compatibleDir, "--json"],
    { cwd: projectRoot },
  );
  const hubJson = JSON.parse(hubRun.stdout) as {
    result: {
      applications: { name: string }[];
    };
  };

  return {
    compatibleOk: compatibleRun.exitCode === 0,
    breakingExitCode: breakingRun.exitCode,
    breakingCodes: problems.map((p) => p.code),
    blastRadiusWorkflows: hasTriageBlastRadius
      ? ["triage-gateway-application › triage-workflow"]
      : [],
    hubAppNames: hubJson.result.applications.map((a) => a.name),
  };
}
