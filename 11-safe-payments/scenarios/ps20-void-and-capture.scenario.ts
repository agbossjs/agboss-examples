import { BothDispositionsPaymentOperations } from "../src/payments/wrong/both-dispositions.payment-operations.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { CancelWorkflowStart } from "../src/workflows/cancel/cancel.workflow-start.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { SettleWorkflowStart } from "../src/workflows/settle/settle.workflow-start.js";
import { orderOf } from "./checkout.js";
import { outcomeOf, settled } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";

/**
 * PS20 — a void and a capture race on one authorization: fulfilment captures it while the
 * customer cancels. Wrong: both are sent; the stub refuses the void of a captured authorization,
 * the cancel takes the refusal for "already cancelled", and the order is booked cancelled while the
 * money stays captured — never refunded. Right: one business key for the authorization's outcome,
 * `disposition:<charge>`, the action in the request: the void is the other fingerprint
 * (`IdempotencyKeyConflictError`), and the cancel takes the other route — it refunds.
 */
export const ps20: PaymentScenario = {
  id: "ps20",
  title: "A void and a capture race on one authorization",
  rows: [
    {
      row: "ps20",
      level: StubLevel.Full,
      refundRow: true,
      wrongOperations: BothDispositionsPaymentOperations,
      wrong: { captures: 1, refunds: 0, lost: 4000, orderStatus: "cancelled" },
      right: { captures: 1, refunds: 1, lost: 0, orderStatus: "refunded" },
      async run(context) {
        const order = orderOf("ps20-order", 4000, { capture: false });
        await context.app(0).execute(CheckoutWorkflowStart, order);
        const [authorization] = context.stub.chargesOf(order.orderId);
        if (authorization === undefined) throw new Error("no authorization at the stub");
        const disposition = { orderId: order.orderId, chargeId: authorization.chargeId, amountCents: 4000 };
        const settledByFulfilment = await settled(context.app(0).execute(SettleWorkflowStart, disposition));
        const cancelledByCustomer = await settled(context.app(1).execute(CancelWorkflowStart, disposition));
        return outcomeOf(context, "ps20", "ps20", [order.orderId], [
          `capture: ${settledByFulfilment}`,
          `cancel: ${cancelledByCustomer}`,
        ]);
      },
    },
  ],
};
