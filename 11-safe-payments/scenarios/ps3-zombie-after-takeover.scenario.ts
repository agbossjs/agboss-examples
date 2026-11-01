import { override } from "@agboss/core/testing";
import { PlainCallPaymentOperations } from "../src/payments/wrong/plain-call.payment-operations.js";
import { StubGatewayService } from "../src/services/stub-gateway.service.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import { GatedStubGatewayService, heldAt, holdAt, instanceIdOf, letGo, sendsInFlight } from "./gates.js";
import { outcomeOf, settled, until } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";
import { bookedAs, frozenPastLease, thawed } from "./steps.js";

/**
 * PS3 — a zombie after a takeover: instance 1 froze with its charge decided, the request about to
 * leave. Its lease expired; instance 2 took the tree over and charged. Then instance 1 woke up and
 * sent its request. Wrong: a plain call, a second charge. Right: the zombie's request carries the
 * same key (`call.idempotencyKey`), so the stub replays the first charge (G1, A6), and its
 * completion is fenced — never stored.
 */
export const ps3: PaymentScenario = {
  id: "ps3",
  title: "A zombie after a takeover",
  rows: [
    {
      row: "ps3",
      level: StubLevel.Full,
      wrongOperations: PlainCallPaymentOperations,
      overrides: [override(StubGatewayService, GatedStubGatewayService)],
      wrong: { charges: 2, lost: 2500 },
      right: { charges: 1, lost: 0, orderStatus: "paid" },
      async run(context) {
        const order = orderOf("ps3-order", 2500);
        const a = context.app(0);
        await a.ready();
        await context.app(1).ready();
        holdAt("send:charge", { instanceId: instanceIdOf(a) });
        const first = settled(a.execute(CheckoutWorkflowStart, order));
        await until(() => heldAt("send:charge") === 1, "instance 1 frozen before its request leaves");
        await frozenPastLease(context, a);
        await bookedAs(context, order.orderId, "paid");
        letGo();
        thawed(context, a);
        const zombie = await first;
        // a zombie's plain call outlives its execution: wait for its answer before reading the books
        await until(() => sendsInFlight() === 0, "the zombie's request answered");
        return outcomeOf(context, "ps3", "ps3", [order.orderId], [`instance 1: ${zombie}`]);
      },
    },
  ],
};
