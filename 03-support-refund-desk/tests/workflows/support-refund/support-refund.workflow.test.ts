import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PiiKind, ToolCallStatus } from "agboss";
import { describe, expect, it } from "vitest";
import { runEvalScenario } from "../../../scenarios/evals.js";
import { runMemoryDriftScenario } from "../../../scenarios/memory-drift.js";
import { runPiiScenario } from "../../../scenarios/pii.js";
import { runPolicyScenario } from "../../../scenarios/policy.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("SupportRefundWorkflow — End-to-End Scenarios (PII, Langfuse OTel, Guardrails, Memory Drift & Evals)", () => {
  it("Scenario A: tokenizes customer email and ticket ID before the model, reveals real email to tools, exports masked Langfuse OTel spans, and blocks card numbers", async () => {
    const res = await runPiiScenario();

    expect(res.modelSawMaskedEmailToken).toBe(true);
    expect(res.modelSawMaskedTicketToken).toBe(true);
    expect(res.modelSawRawEmail).toBe(false);
    expect(res.toolReceivedRealEmail).toBe("alice.synth@example.com");
    expect(res.recordMaskedEmail).toBe(true);
    expect(res.blockedCardRefusalKind).toBe(PiiKind.CardNumber);
    expect(res.langfuseTraceUrlMatchesSession).toBe(true);
    expect(res.langfuseOtelSpansExported).toBe(true);
    expect(res.langfuseOtelSpansMaskedPii).toBe(true);
  });

  it("Scenario B: intercepts over-cap refunds with replyToModel, blocks cross-tenant access, and enforces code & model guardrails", async () => {
    const res = await runPolicyScenario();

    expect(res.overCapInterceptedStatus).toBe(ToolCallStatus.Replied);
    expect(res.overCapFinalDecision).toBe("escalated");
    expect(res.crossTenantBlockedTool).toBe("lookup-order-tool");
    expect(res.inputGuardrailBlockedGuard).toBe("prompt-injection-guardrail");
    expect(res.outputGuardrailBlockedGuard).toBe("unauthorized-payout-guardrail");
  });

  it("Scenario C: compacts older turns while stripping superseded v1.0 policy rules and enforcing active v2.0 30-day window", async () => {
    const res = await runMemoryDriftScenario();

    expect(res.turnsExecuted).toBe(5);
    expect(res.compactionSummaryInjected).toBe(true);
    expect(res.preservedOrderFact).toBe(true);
    expect(res.finalTurnDecision).toBe("denied");
    expect(res.finalTurnRefundedUsd).toBe(0);
  });

  it("Scenario D: verifies compact main-baseline.json format, pass@k vs pass^k comparison, Cohen's kappa calibration, chaos/metamorphic runs, incident drafting, and sanitized HTML reports", async () => {
    const baselineRaw = JSON.parse(
      readFileSync(join(PROJECT_ROOT, "eval", "baseline", "main-baseline.json"), "utf8"),
    ) as {
      kind: string;
      schemaVersion: number;
      cases: readonly {
        caseId: string;
        caseHash: string;
        runs: number;
        passed: number;
        passAtK: boolean;
        passHatK: boolean;
        flaky: boolean;
        avgSpendUsd: number;
        verdictSummary: string;
      }[];
    };
    expect(baselineRaw.kind).toBe("agboss.eval-baseline");
    expect(baselineRaw.schemaVersion).toBe(1);
    expect(baselineRaw.cases).toHaveLength(3);

    const res = await runEvalScenario();

    expect(res.baselineComparison.unchangedCase).toBe("eligible-refund-within-policy");
    expect(res.baselineComparison.flakyOnBaselineCase).toBe("over-cap-refund-escalated");
    expect(res.baselineComparison.regressedCase).toBe("policy-drift-past-30-days-denied");
    expect(res.baselineComparison.regressedCasePassAtK).toBe(true);
    expect(res.baselineComparison.regressedCasePassHatK).toBe(false);
    expect(res.baselineComparison.regressedCaseIsUnstable).toBe(true);
    expect(res.baselineComparison.regressedList).toEqual([
      "policy-drift-past-30-days-denied",
    ]);

    expect(res.calibration.matchedLabels).toBe(12);
    expect(res.calibration.unmatchedLabels).toBe(0);
    expect(res.calibration.kappaJudgeAnna).toBeCloseTo(1.0, 2);
    expect(res.calibration.kappaJudgeBen).toBeCloseTo(0.5714, 2);
    expect(res.calibration.disagreementsCount).toBe(1);
    expect(res.calibration.disagreementFailureTags).toEqual([
      "missing-v1-supersession-note",
    ]);

    expect(res.chaosAndMetamorphic.chaosRate).toBe(0.4);
    expect(res.chaosAndMetamorphic.chaosSeed).toBe(7);
    expect(res.chaosAndMetamorphic.chaosInjectedCount).toBeGreaterThan(0);
    expect(res.chaosAndMetamorphic.metamorphicEnabled).toBe(true);
    expect(res.chaosAndMetamorphic.metamorphicPassHatK).toBe(3);

    expect(res.incidentDraft.modifiedSuitePath).toBe(
      "src/eval-suites/refund-desk.eval-suite.ts",
    );
    expect(res.incidentDraft.containsDraftedCase).toBe(true);
    expect(res.incidentDraft.containsPastTurn).toBe(true);
    expect(res.incidentDraft.containsToolCallExpectation).toBe(true);
    expect(res.incidentDraft.containsMaskedEmailToken).toBe(true);
    expect(res.incidentDraft.rawEmailLeakedInDraft).toBe(false);

    expect(res.htmlReport.htmlLength).toBeGreaterThan(1000);
    expect(res.htmlReport.containsSuiteTitle).toBe(true);
    expect(res.htmlReport.containsMaskedEmailToken).toBe(true);
    expect(res.htmlReport.rawEmailLeakedInHtml).toBe(false);
  }, 30_000);
});
