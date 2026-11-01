import { PayloadEventsPaymentOperations } from "../src/payments/wrong/payload-events.payment-operations.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import { outcomeOf } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";
import { receiverOf } from "./webhooks.js";

/**
 * PS15 — a webhook delivered twice: `charge.authorized` arrives twice at once, on two instances,
 * and the shop captures the first shipment on it. Wrong: every delivery captures, two captures.
 * Right: the capture is an outbound call under `capture:<charge>:1` and the booking a fenced effect
 * under `event:stub:<eventId>` — the second delivery finds the first in flight or replays it.
 */
export const ps15: PaymentScenario = {
  id: "ps15",
  title: "A webhook delivered twice",
  rows: [
    {
      row: "ps15",
      level: StubLevel.Full,
      wrongOperations: PayloadEventsPaymentOperations,
      wrong: { captures: 2, lost: 5000 },
      right: { captures: 1, lost: 0, orderStatus: "captured" },
      async run(context) {
        const order = orderOf("ps15-order", 10_000, { capture: false });
        await context.app(0).execute(CheckoutWorkflowStart, order);
        await context.app(1).ready();
        const [authorization] = context.stub.chargesOf(order.orderId);
        if (authorization === undefined) throw new Error("no authorization at the stub");
        const receiver = await receiverOf(context);
        try {
          const event = context.stub.eventFor("charge.authorized", authorization.chargeId);
          const statuses = await context.stub.deliver([event], { to: receiver.url, times: 2 });
          return outcomeOf(context, "ps15", "ps15", [order.orderId], [`deliveries: ${statuses.join(", ")}`]);
        } finally {
          await receiver.close();
        }
      },
    },
  ],
};
