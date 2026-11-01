import { describe, expect } from "vitest";
import { orderOf } from "../scenarios/checkout.js";
import { outcomeOf, settled } from "../scenarios/outcome.js";
import { scenarioTest } from "../scenarios/run-scenario.js";
import { Variant, type ScenarioRow } from "../scenarios/scenario.types.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { CancelWorkflowStart } from "../src/workflows/cancel/cancel.workflow-start.js";
import { CaptureWorkflowStart } from "../src/workflows/capture/capture.workflow-start.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { RefundWorkflowStart } from "../src/workflows/refund/refund.workflow-start.js";
import { SettleWorkflowStart } from "../src/workflows/settle/settle.workflow-start.js";

/**
 * A refund, a capture, a settle or a cancel names a charge the caller gives — an operator's form, a
 * customer's request. It moves money only when the shop's own books tie that charge to the order;
 * another order's charge (an IDOR) is refused before anything reaches the gateway.
 */
const row: ScenarioRow = {
  row: "ownership",
  level: StubLevel.Full,
  right: { charges: 2, captures: 0, refunds: 0, voids: 0 },
  async run(context) {
    const mine = orderOf("own-mine", 5000, { capture: false });
    const theirs = orderOf("own-theirs", 5000, { capture: false });
    await context.app(0).execute(CheckoutWorkflowStart, mine);
    await context.app(0).execute(CheckoutWorkflowStart, theirs);
    const [their] = context.stub.chargesOf(theirs.orderId);
    if (their === undefined) throw new Error("no charge at the stub");
    const chargeId = their.chargeId;
    const app = context.app(1);
    const notes = [
      `refund: ${await settled(app.execute(RefundWorkflowStart, { orderId: mine.orderId, chargeId, amountCents: 1000, refundNumber: 1, path: "operator" }))}`,
      `capture: ${await settled(app.execute(CaptureWorkflowStart, { orderId: mine.orderId, chargeId, shipment: 1, amountCents: 1000 }))}`,
      `settle: ${await settled(app.execute(SettleWorkflowStart, { orderId: mine.orderId, chargeId, amountCents: 5000 }))}`,
      `cancel: ${await settled(app.execute(CancelWorkflowStart, { orderId: mine.orderId, chargeId, amountCents: 5000 }))}`,
    ];
    const both = [outcomeOf(context, "ownership", "ownership", [mine.orderId, theirs.orderId], notes)][0];
    if (both === undefined) throw new Error("no outcome");
    return both;
  },
};

describe("another order's charge", () => {
  scenarioTest(row, Variant.Right)("a refund, a capture, a settle or a cancel of another order's charge is refused, nothing moves", (outcome) => {
    expect([outcome.charges, outcome.captures, outcome.refunds, outcome.voids]).toEqual([2, 0, 0, 0]);
    expect(outcome.notes).toEqual([
      expect.stringContaining("payments.not-the-orders-charge"),
      expect.stringContaining("payments.not-the-orders-charge"),
      expect.stringContaining("payments.not-the-orders-charge"),
      expect.stringContaining("payments.not-the-orders-charge"),
    ]);
  });
});
