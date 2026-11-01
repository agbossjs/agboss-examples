import { override } from "@agboss/core/testing";
import { SqliteFencedEffectRepository } from "@agboss/core";
import { PlainCallPaymentOperations } from "../src/payments/wrong/plain-call.payment-operations.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import { GatedFencedEffectRepository, heldAt, holdAt, instanceIdOf, letGo } from "./gates.js";
import { outcomeOf, settled, until } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";
import { bookedAs, frozenPastLease, thawed } from "./steps.js";

/**
 * PS2 — a crash after the charge, before the checkpoint: instance 1's charge was answered, and it
 * froze before booking it (its step's checkpoint never written). Instance 2 takes the tree over and
 * runs the step again. Wrong: a plain client call, a second charge. Right: the outbound call finds
 * its intent `Completed` and replays the receipt; nothing is sent. Also run on real processes,
 * `SIGKILL`ed (`scenarios/processes/`).
 */
export const ps2: PaymentScenario = {
  id: "ps2",
  title: "A crash after the charge, before the checkpoint",
  rows: [
    {
      row: "ps2",
      level: StubLevel.Full,
      wrongOperations: PlainCallPaymentOperations,
      overrides: [override(SqliteFencedEffectRepository, GatedFencedEffectRepository)],
      wrong: { charges: 2, lost: 2500 },
      right: { charges: 1, lost: 0, orderStatus: "paid" },
      async run(context) {
        const order = orderOf("ps2-order", 2500);
        const [a] = [context.app(0), context.app(1)];
        await a.ready();
        await context.app(1).ready();
        holdAt("effect:book-charge", { instanceId: instanceIdOf(a) });
        const first = settled(a.execute(CheckoutWorkflowStart, order));
        await until(() => heldAt("effect:book-charge") === 1, "the charge answered, its booking held");
        await frozenPastLease(context, a);
        await bookedAs(context, order.orderId, "paid");
        letGo();
        thawed(context, a);
        const zombie = await first;
        return outcomeOf(context, "ps2", "ps2", [order.orderId], [`instance 1: ${zombie}`]);
      },
    },
  ],
};
