import { override } from "@agboss/core/testing";
import { SqliteFencedEffectRepository } from "@agboss/core";
import { PlainRefundPaymentOperations } from "../src/payments/wrong/plain-refund.payment-operations.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import { GatedFencedEffectRepository, heldAt, holdAt, instanceIdOf, letGo } from "./gates.js";
import { outcomeOf, settled, until } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";
import { bookedAs, frozenPastLease, thawed } from "./steps.js";

/**
 * PS10 — a saga: the carrier refuses the order, so the charge's undo refunds it (less a restocking
 * fee). Instance 1's refund was answered, and it froze before the undo was marked done. Instance 2
 * finishes the undo. Wrong: the refund is a plain call in the undo action — it runs again, two
 * refunds. Right: the refund is an outbound call under `refund:<charge>:1`; the undo run again
 * replays it, and an undo marked done never runs again (#607).
 */
export const ps10: PaymentScenario = {
  id: "ps10",
  title: "A saga: a charge and its refund, replayed or interrupted",
  rows: [
    {
      row: "ps10",
      level: StubLevel.Full,
      refundRow: true,
      wrongOperations: PlainRefundPaymentOperations,
      overrides: [override(SqliteFencedEffectRepository, GatedFencedEffectRepository)],
      wrong: { charges: 1, refunds: 2, amountRefunded: 4000, lost: 2000 },
      right: { charges: 1, refunds: 1, amountRefunded: 2000, lost: 0, orderStatus: "refunded" },
      async run(context) {
        const order = orderOf("ps10-order", 5000, { failShipping: true, restockingFeeCents: 3000 });
        const a = context.app(0);
        await a.ready();
        await context.app(1).ready();
        holdAt("effect:book-refund", { instanceId: instanceIdOf(a) });
        const first = settled(a.execute(CheckoutWorkflowStart, order));
        await until(() => heldAt("effect:book-refund") === 1, "the refund answered, the undo not yet marked done");
        await frozenPastLease(context, a);
        await bookedAs(context, order.orderId, "refunded");
        letGo();
        thawed(context, a);
        const zombie = await first;
        return outcomeOf(context, "ps10", "ps10", [order.orderId], [`instance 1: ${zombie}`]);
      },
    },
  ],
};
