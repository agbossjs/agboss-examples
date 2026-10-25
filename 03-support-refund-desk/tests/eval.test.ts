import { describe, expect, it } from "vitest";
import { runEvalScenario } from "../scenarios/evals.js";

describe("support-refund-desk — Scenario D: 5-Layer Evaluation & Calibration Discipline", () => {
  it("verifies pass@k vs pass^k baseline comparison, Cohen's kappa calibration, chaos/metamorphic runs, incident drafting, and sanitized HTML reports", async () => {
    const res = await runEvalScenario();

    // 1. Baseline comparison: Unchanged vs FlakyOnBaseline (quarantined) vs Regressed
    expect(res.baselineComparison.unchangedCase).toBe("eligible-refund-within-policy");
    expect(res.baselineComparison.flakyOnBaselineCase).toBe("over-cap-refund-escalated");
    expect(res.baselineComparison.regressedCase).toBe("policy-drift-past-30-days-denied");
    expect(res.baselineComparison.regressedCasePassAtK).toBe(true);
    expect(res.baselineComparison.regressedCasePassHatK).toBe(false);
    expect(res.baselineComparison.regressedCaseIsUnstable).toBe(true);
    expect(res.baselineComparison.regressedList).toEqual([
      "policy-drift-past-30-days-denied",
    ]);

    // 2. Judge calibration against human JSONL labels (Cohen's kappa + confusion matrix + rubric disagreements)
    expect(res.calibration.matchedLabels).toBe(12);
    expect(res.calibration.unmatchedLabels).toBe(0);
    expect(res.calibration.kappaJudgeAnna).toBeCloseTo(1.0, 2);
    expect(res.calibration.kappaJudgeBen).toBeCloseTo(0.5714, 2);
    expect(res.calibration.disagreementsCount).toBe(1);
    expect(res.calibration.disagreementFailureTags).toEqual([
      "missing-v1-supersession-note",
    ]);

    // 3. Deterministic Chaos & Metamorphic verification
    expect(res.chaosAndMetamorphic.chaosRate).toBe(0.4);
    expect(res.chaosAndMetamorphic.chaosSeed).toBe(7);
    expect(res.chaosAndMetamorphic.chaosInjectedCount).toBeGreaterThan(0);
    expect(res.chaosAndMetamorphic.metamorphicEnabled).toBe(true);
    expect(res.chaosAndMetamorphic.metamorphicPassHatK).toBe(3);

    // 4. Incident-to-regression loop (`agboss generate eval-case --from-execution`)
    expect(res.incidentDraft.modifiedSuitePath).toBe(
      "src/eval-suites/refund-desk.eval-suite.ts",
    );
    expect(res.incidentDraft.containsDraftedCase).toBe(true);
    expect(res.incidentDraft.containsPastTurn).toBe(true);
    expect(res.incidentDraft.containsToolCallExpectation).toBe(true);
    expect(res.incidentDraft.containsMaskedEmailToken).toBe(true);
    expect(res.incidentDraft.rawEmailLeakedInDraft).toBe(false);

    // 5. Sanitized HTML report (`agboss eval show --html`)
    expect(res.htmlReport.htmlLength).toBeGreaterThan(1000);
    expect(res.htmlReport.containsSuiteTitle).toBe(true);
    expect(res.htmlReport.containsMaskedEmailToken).toBe(true);
    expect(res.htmlReport.rawEmailLeakedInHtml).toBe(false);
  }, 30_000);
});
