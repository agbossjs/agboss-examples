import { describe, expect } from "vitest";
import { orderOf } from "../scenarios/checkout.js";
import { failureOf, outcomeOf, settled } from "../scenarios/outcome.js";
import { scenarioTest } from "../scenarios/run-scenario.js";
import { Variant, type ScenarioRow } from "../scenarios/scenario.types.js";
import { StubFault, StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { CaptureWorkflowStart } from "../src/workflows/capture/capture.workflow-start.js";

/**
 * agbossjs/agboss#890 AC3 — the operator's path, `.onError(OutboundCallUnreconciledError, …)`: the
 * gateway captures a shipment and its answer is lost. The capture is never sent again — there is
 * no lookup by shipment, `reconcile` says `unknown` — and instead of failing, the retried capture
 * ends at its own finish (`capture-held-workflow-finish`), nothing booked, its intent pending for a
 * person (`app.pendingOutboundCallsOf`).
 */
const row: ScenarioRow = {
  row: "operator path",
  level: StubLevel.Full,
  right: { charges: 1, captures: 1 },
  async run(context) {
    const order = orderOf("operator-settle", 5000, { capture: false });
    await context.app(0).execute(CheckoutWorkflowStart, order);
    const [charge] = context.stub.chargesOf(order.orderId);
    if (charge === undefined) throw new Error("no charge at the stub");
    const shipment = { orderId: order.orderId, chargeId: charge.chargeId, shipment: 1, amountCents: 2000 };
    context.stub.inject(StubFault.AnswerThenDrop, { operation: "capture" });
    const first = await settled(context.app(0).execute(CaptureWorkflowStart, shipment));
    const held = await context.app(1).execute(CaptureWorkflowStart, shipment);
    const { calls } = await context.app(1).pendingOutboundCallsOf({ tenantId: "default" });
    const notes = [
      `first: ${first}`,
      `finish: ${held.finish?.name ?? "none"}`,
      `handled: ${held.handledErrors.map((handled) => failureOf(handled.error)).join(", ")}`,
      `pending: ${calls.map((call) => call.operation).join(", ")}`,
    ];
    return outcomeOf(context, "operator", "operator path", [order.orderId], notes);
  },
};

describe("AC3: an unreconciled capture goes to an operator, never sent again", () => {
  scenarioTest(row, Variant.Right)(
    "AC3: .onError(OutboundCallUnreconciledError, …) ends the capture at the operator's finish; the gateway captured once, nothing booked",
    (outcome) => {
      expect([outcome.charges, outcome.captures]).toEqual([1, 1]);
      expect(outcome.orderStatus).not.toBe("captured");
      expect(outcome.notes.slice(1)).toEqual([
        "finish: capture-held-workflow-finish",
        "handled: step.action ← outbound-call.unreconciled",
        "pending: capture",
      ]);
    },
  );
});
