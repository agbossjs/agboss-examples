import { KeyPerPathRefundPaymentOperations } from "../src/payments/wrong/key-per-path-refund.payment-operations.js";
import { StubFault, StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { RefundWorkflowStart } from "../src/workflows/refund/refund.workflow-start.js";
import { orderOf } from "./checkout.js";
import { outcomeOf, settled } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";

/**
 * PS19 — a refund retried: the operator refunds 20.00 of a 50.00 payment and the stub's answer is
 * lost (the connection drops after it refunded); the customer's own request for that refund
 * follows. Wrong: each path builds its own key — two refunds. Right: every path refunds under one
 * business key, `refund:<charge>:1`: the second sends the same key, and the stub replays the first.
 */
export const ps19: PaymentScenario = {
  id: "ps19",
  title: "A refund retried",
  rows: [
    {
      row: "ps19",
      level: StubLevel.Full,
      refundRow: true,
      wrongOperations: KeyPerPathRefundPaymentOperations,
      wrong: { refunds: 2, amountRefunded: 4000 },
      right: { refunds: 1, amountRefunded: 2000, lost: 0, orderStatus: "refunded" },
      async run(context) {
        const order = orderOf("ps19-order", 5000);
        await context.app(0).execute(CheckoutWorkflowStart, order);
        const [charge] = context.stub.chargesOf(order.orderId);
        if (charge === undefined) throw new Error("no charge at the stub");
        const refund = (path: string) => ({ orderId: order.orderId, chargeId: charge.chargeId, amountCents: 2000, refundNumber: 1, path });
        context.stub.inject(StubFault.AnswerThenDrop, { operation: "refund" });
        const operator = await settled(context.app(0).execute(RefundWorkflowStart, refund("operator")));
        const customer = await settled(context.app(1).execute(RefundWorkflowStart, refund("customer")));
        return outcomeOf(context, "ps19", "ps19", [order.orderId], [`operator: ${operator}`, `customer: ${customer}`]);
      },
    },
  ],
};
