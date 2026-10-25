import { describe, expect, it } from "vitest";
import { runMemoryDriftScenario } from "../scenarios/memory-drift.js";

describe("support-refund-desk — Scenario C: Memory Compaction vs Policy Drift", () => {
  it("compacts older turns while stripping superseded v1.0 policy rules and enforcing active v2.0 30-day window", async () => {
    const res = await runMemoryDriftScenario();

    expect(res.turnsExecuted).toBe(5);
    expect(res.compactionSummaryInjected).toBe(true);
    expect(res.preservedOrderFact).toBe(true);
    expect(res.finalTurnDecision).toBe("denied");
    expect(res.finalTurnRefundedUsd).toBe(0);
  });
});
