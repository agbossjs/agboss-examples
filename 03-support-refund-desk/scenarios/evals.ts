import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createApp } from "@agboss/core";
import {
  CaseComparison,
  type EvalCalibration,
  type EvalRunComparison,
  type EvalRunReport,
} from "@agboss/core/eval";
import { resetAuditTrail } from "../src/interceptors/audit.interceptor.js";
import { resetSupportModel } from "../src/model-providers/support-offline.model-provider.js";
import { SupportRefundDeskApplication } from "../src/support-refund-desk.application.js";
import { SupportRefundWorkflowStart } from "../src/workflows/support-refund/support-refund.workflow-start.js";

const execFileAsync = promisify(execFile);
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AGBOSS_BIN = join(PACKAGE_ROOT, "node_modules", ".bin", "agboss");

interface CliJsonEnvelope<T> {
  readonly schema: number;
  readonly ok: boolean;
  readonly command: string;
  readonly result: T;
}

interface EvalRunWithComparison extends EvalRunReport {
  readonly baseline?: EvalRunComparison;
}

interface EvalCalibrateCliResult extends EvalCalibration {
  readonly reportFile: string;
  readonly labelsFile: string;
}

interface GenerateEvalCaseCliResult {
  readonly dryRun: boolean;
  readonly plan: {
    readonly create: readonly { readonly path: string; readonly content: string }[];
    readonly modify: readonly { readonly path: string; readonly content: string }[];
  };
}

async function runAgbossCli<T>(
  args: readonly string[],
  envOverrides: Readonly<Record<string, string>> = {},
): Promise<CliJsonEnvelope<T>> {
  let stdout = "";
  try {
    const res = await execFileAsync(process.execPath, [AGBOSS_BIN, ...args], {
      cwd: PACKAGE_ROOT,
      env: {
        ...process.env,
        ...envOverrides,
      },
      maxBuffer: 16 * 1024 * 1024,
    });
    stdout = res.stdout;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    if (typeof err.stdout === "string" && err.stdout.trim().length > 0) {
      stdout = err.stdout;
    } else {
      throw new Error(`agboss CLI failed (${args.join(" ")}): ${err.stderr ?? err.message ?? String(error)}`);
    }
  }

  const jsonStart = stdout.indexOf("{\n  \"schema\":");
  const jsonText = jsonStart >= 0 ? stdout.slice(jsonStart) : stdout.trim();
  const parsed = JSON.parse(jsonText) as CliJsonEnvelope<T> & {
    readonly error?: { readonly code: string; readonly message: string };
  };
  if (!parsed.ok && parsed.error !== undefined) {
    throw new Error(`agboss CLI error (${parsed.error.code}): ${parsed.error.message}`);
  }
  return parsed;
}

export interface EvalScenarioResult {
  readonly baselineComparison: {
    readonly unchangedCase: string;
    readonly flakyOnBaselineCase: string;
    readonly regressedCase: string;
    readonly regressedCasePassAtK: boolean;
    readonly regressedCasePassHatK: boolean;
    readonly regressedCaseIsUnstable: boolean;
    readonly regressedList: readonly string[];
  };
  readonly calibration: {
    readonly matchedLabels: number;
    readonly unmatchedLabels: number;
    readonly kappaJudgeAnna: number;
    readonly kappaJudgeBen: number;
    readonly disagreementsCount: number;
    readonly disagreementFailureTags: readonly string[];
  };
  readonly chaosAndMetamorphic: {
    readonly chaosRate: number;
    readonly chaosSeed: number;
    readonly chaosInjectedCount: number;
    readonly metamorphicEnabled: boolean;
    readonly metamorphicPassHatK: number;
  };
  readonly incidentDraft: {
    readonly executionId: string;
    readonly modifiedSuitePath: string;
    readonly containsDraftedCase: boolean;
    readonly containsPastTurn: boolean;
    readonly containsToolCallExpectation: boolean;
    readonly containsMaskedEmailToken: boolean;
    readonly rawEmailLeakedInDraft: boolean;
  };
  readonly htmlReport: {
    readonly htmlLength: number;
    readonly containsSuiteTitle: boolean;
    readonly containsMaskedEmailToken: boolean;
    readonly rawEmailLeakedInHtml: boolean;
  };
}

export async function runEvalScenario(): Promise<EvalScenarioResult> {
  // 1. pass@k vs pass^k + Baseline comparison (`FlakyOnBaseline` vs `Regressed`)
  const baselineEnvelope = await runAgbossCli<EvalRunWithComparison>(
    [
      "eval",
      "run",
      "--suite",
      "refund-desk-eval-suite",
      "--runs",
      "2",
      "--baseline",
      "eval/baseline/main-baseline.json",
      "--json",
    ],
    { AGBOSS_SIMULATE_FLAKY_EVAL: "1" },
  );
  const runReport = baselineEnvelope.result;
  const comparison = runReport.baseline;
  if (!comparison) {
    throw new Error("Expected baseline comparison in eval run report");
  }
  const unchangedEntry = comparison.cases.find(
    (c) => c.comparison === CaseComparison.Unchanged,
  );
  const flakyEntry = comparison.cases.find(
    (c) => c.comparison === CaseComparison.FlakyOnBaseline,
  );
  const regressedEntry = comparison.cases.find(
    (c) => c.comparison === CaseComparison.Regressed,
  );
  const regressedCaseReport = runReport.cases.find(
    (c) => c.name === "policy-drift-past-30-days-denied",
  );

  // 2. Judge calibration (`agboss eval calibrate`)
  const calibrateEnvelope = await runAgbossCli<EvalCalibrateCliResult>([
    "eval",
    "calibrate",
    "--report",
    "eval/calibration/calibration-run.json",
    "--labels",
    "eval/human-labels/refund-desk-eval-suite.jsonl",
    "--json",
  ]);
  const cal = calibrateEnvelope.result;
  const judgeCal = cal.judges.find((j) => j.judge === "grounded-answer-judge");
  const annaAgreement = judgeCal?.agreements.find(
    (a) => a.raters.includes("grounded-answer-judge") && a.raters.includes("anna"),
  );
  const benAgreement = judgeCal?.agreements.find(
    (a) => a.raters.includes("grounded-answer-judge") && a.raters.includes("ben"),
  );

  // 3. Deterministic Chaos (`--chaos 0.4 --chaos-seed 7`) & Metamorphic (`--metamorphic`)
  const chaosEnvelope = await runAgbossCli<EvalRunReport>([
    "eval",
    "run",
    "--suite",
    "refund-desk-eval-suite",
    "--runs",
    "1",
    "--chaos",
    "0.4",
    "--chaos-seed",
    "7",
    "--json",
  ]);
  const metamorphicEnvelope = await runAgbossCli<EvalRunReport>([
    "eval",
    "run",
    "--suite",
    "refund-desk-eval-suite",
    "--runs",
    "1",
    "--metamorphic",
    "--json",
  ]);

  // 4. Incident-to-regression loop (`agboss generate eval-case --from-execution`)
  const tempDir = await mkdtemp(join(tmpdir(), "agboss-refund-eval-"));
  const sqlitePath = join(tempDir, "support-desk.sqlite");
  const htmlPath = join(tempDir, "eval-report.html");

  try {
    resetSupportModel();
    resetAuditTrail();
    const rawEmail = "alice.synth@example.com";
    const threadId = "thread-incident-draft-1";

    const app = await createApp(SupportRefundDeskApplication, {
      env: "dev",
      processEnv: {
        OPENROUTER_API_KEY:
          process.env.OPENROUTER_API_KEY ??
          process.env.OPEN_ROUTER_KEY ??
          "offline-test-openrouter-api-key",
        SQLITE_PATH: sqlitePath,
        PII_PSEUDONYM_KEY: "agboss-test-pseudonym-key",
      },
    });

    let secondExecutionId = "";
    try {
      await app.execute(
        SupportRefundWorkflowStart,
        {
          customerName: "Alice Synth",
          message: `Hi, my email is ${rawEmail} and ticket is TCK-402910. Can you check order ORD-1002?`,
        },
        {
          threadId,
          tenant: { tenantId: "acme", maxAutoRefundUsd: 500 },
          execution: { locale: "en" },
          record: true,
        },
      );

      const secondTurn = await app.execute(
        SupportRefundWorkflowStart,
        {
          customerName: "Alice Synth",
          message: `Thanks, please process order ORD-1001 for ${rawEmail}.`,
        },
        {
          threadId,
          tenant: { tenantId: "acme", maxAutoRefundUsd: 500 },
          execution: { locale: "en" },
          record: true,
        },
      );
      secondExecutionId = secondTurn.executionId;
    } finally {
      await app.close();
    }

    const draftEnvelope = await runAgbossCli<GenerateEvalCaseCliResult>(
      [
        "generate",
        "eval-case",
        "drafted-from-incident",
        "--suite",
        "refund-desk-eval-suite",
        "--from-execution",
        secondExecutionId,
        "--tenant",
        "acme",
        "--env",
        "dev",
        "--dry-run",
        "--json",
      ],
      {
        SQLITE_PATH: sqlitePath,
        PII_PSEUDONYM_KEY: "agboss-test-pseudonym-key",
      },
    );

    const modifiedSuite = draftEnvelope.result.plan.modify[0];
    const draftedSource = modifiedSuite?.content ?? "";
    const draftedStartIndex = draftedSource.indexOf("\"drafted-from-incident\"");
    const draftedCaseSnippet =
      draftedStartIndex >= 0 ? draftedSource.slice(draftedStartIndex) : "";
    const chaosInjectedMap = (chaosEnvelope.result.chaos?.injected ?? {}) as unknown as Readonly<
      Record<string, number>
    >;
    const chaosInjectedCount = Object.values(chaosInjectedMap).reduce(
      (sum, count) => sum + count,
      0,
    );

    // 5. Sanitized self-contained HTML report (`agboss eval show --html`)
    await runAgbossCli<unknown>([
      "eval",
      "show",
      "eval/calibration/calibration-run.json",
      "--html",
      htmlPath,
      "--json",
    ]);
    const htmlContent = await readFile(htmlPath, "utf8");

    return {
      baselineComparison: {
        unchangedCase: unchangedEntry?.name ?? "",
        flakyOnBaselineCase: flakyEntry?.name ?? "",
        regressedCase: regressedEntry?.name ?? "",
        regressedCasePassAtK: regressedCaseReport?.passAtK ?? false,
        regressedCasePassHatK: regressedCaseReport?.passHatK ?? true,
        regressedCaseIsUnstable: regressedCaseReport?.isUnstable ?? false,
        regressedList: comparison.regressed,
      },
      calibration: {
        matchedLabels: cal.matched,
        unmatchedLabels: cal.unmatched,
        kappaJudgeAnna: annaAgreement?.kappa ?? 0,
        kappaJudgeBen: benAgreement?.kappa ?? 0,
        disagreementsCount: judgeCal?.disagreements.length ?? 0,
        disagreementFailureTags: judgeCal?.disagreements[0]?.failureTags ?? [],
      },
      chaosAndMetamorphic: {
        chaosRate: chaosEnvelope.result.chaos?.rate ?? 0,
        chaosSeed: chaosEnvelope.result.chaos?.seed ?? 0,
        chaosInjectedCount,
        metamorphicEnabled: metamorphicEnvelope.result.metamorphic === true,
        metamorphicPassHatK: metamorphicEnvelope.result.summary.passHatK,
      },
      incidentDraft: {
        executionId: secondExecutionId,
        modifiedSuitePath: modifiedSuite?.path ?? "",
        containsDraftedCase: draftedCaseSnippet.length > 0,
        containsPastTurn: draftedCaseSnippet.includes("pastTurn("),
        containsToolCallExpectation: draftedCaseSnippet.includes("toolCall(LookupOrderTool"),
        containsMaskedEmailToken: draftedCaseSnippet.includes("<email:d1ac5c>"),
        rawEmailLeakedInDraft: draftedCaseSnippet.includes(rawEmail),
      },
      htmlReport: {
        htmlLength: htmlContent.length,
        containsSuiteTitle: htmlContent.includes("refund-desk-eval-suite"),
        containsMaskedEmailToken:
          htmlContent.includes("&lt;email:d1ac5c&gt;") ||
          htmlContent.includes("<email:d1ac5c>"),
        rawEmailLeakedInHtml:
          htmlContent.includes("alice.synth@example.com") ||
          htmlContent.includes("carol.synth@example.com"),
      },
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await runEvalScenario();
  console.log("[scenario:evals] Verified 5-layer evaluation discipline:", JSON.stringify(result, null, 2));
}
