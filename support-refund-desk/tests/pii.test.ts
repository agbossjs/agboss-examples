import { PiiKind } from "agboss";
import { describe, expect, it } from "vitest";
import { runPiiScenario } from "../scenarios/pii.js";

describe("support-refund-desk — Scenario A: PII Token Roundtrip & Boundary Refusal", () => {
  it("tokenizes customer email and ticket ID before the model, reveals real email to tools, masks traces, and blocks card numbers", async () => {
    const res = await runPiiScenario();

    expect(res.modelSawMaskedEmailToken).toBe(true);
    expect(res.modelSawMaskedTicketToken).toBe(true);
    expect(res.modelSawRawEmail).toBe(false);
    expect(res.toolReceivedRealEmail).toBe("alice.synth@example.com");
    expect(res.recordMaskedEmail).toBe(true);
    expect(res.blockedCardRefusalKind).toBe(PiiKind.CardNumber);
  });
});
