import { ToolCallStatus } from "agboss";
import { describe, expect, it } from "vitest";
import { runPolicyScenario } from "../scenarios/policy.js";

describe("support-refund-desk — Scenario B: Tool Interception & Guardrails", () => {
  it("intercepts over-cap refunds with replyToModel, blocks cross-tenant access, and enforces code & model guardrails", async () => {
    const res = await runPolicyScenario();

    expect(res.overCapInterceptedStatus).toBe(ToolCallStatus.Replied);
    expect(res.overCapFinalDecision).toBe("escalated");
    expect(res.crossTenantBlockedTool).toBe("lookup-order-tool");
    expect(res.inputGuardrailBlockedGuard).toBe("prompt-injection-guardrail");
    expect(res.outputGuardrailBlockedGuard).toBe("unauthorized-payout-guardrail");
  });
});
