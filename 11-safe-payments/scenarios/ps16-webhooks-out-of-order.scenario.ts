import { PayloadEventsPaymentOperations } from "../src/payments/wrong/payload-events.payment-operations.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { RefundWorkflowStart } from "../src/workflows/refund/refund.workflow-start.js";
import { orderOf } from "./checkout.js";
import { outcomeOf } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";
import { receiverOf } from "./webhooks.js";

/**
 * PS16 — webhooks out of order: the order is paid and then refunded; the stub delivers
 * `refund.succeeded` first and `charge.succeeded` after it. Wrong: each event's payload is applied
 * as it comes — the order ends "paid" while the stub says refunded. Right: the event is a hint; the
 * step reads the charge's current status (G6) and the order ends "refunded".
 */
export const ps16: PaymentScenario = {
  id: "ps16",
  title: "Webhooks out of order",
  rows: [
    {
      row: "ps16",
      level: StubLevel.Full,
      wrongOperations: PayloadEventsPaymentOperations,
      wrong: { refunds: 1, orderStatus: "paid", lost: 2500 },
      right: { refunds: 1, orderStatus: "refunded", lost: 0 },
      async run(context) {
        const order = orderOf("ps16-order", 2500);
        await context.app(0).execute(CheckoutWorkflowStart, order);
        const [charge] = context.stub.chargesOf(order.orderId);
        if (charge === undefined) throw new Error("no charge at the stub");
        await context.app(0).execute(RefundWorkflowStart, {
          orderId: order.orderId,
          chargeId: charge.chargeId,
          amountCents: 2500,
          refundNumber: 1,
          path: "operator",
        });
        const receiver = await receiverOf(context);
        try {
          const refunded = context.stub.eventFor("refund.succeeded", charge.chargeId);
          const succeeded = context.stub.eventFor("charge.succeeded", charge.chargeId);
          // one at a time, to instance 1 then instance 2: the refund's event first
          const statuses = await context.stub.deliver([refunded, succeeded], { to: receiver.url });
          return outcomeOf(context, "ps16", "ps16", [order.orderId], [`deliveries: ${statuses.join(", ")}`]);
        } finally {
          await receiver.close();
        }
      },
    },
  ],
};
