import { override } from "@agboss/core/testing";
import { OutboundCallRepository } from "@agboss/core";
import { HomemadeFenceCheckPaymentOperations } from "../src/payments/wrong/homemade-fence-check.payment-operations.js";
import { StubGatewayService } from "../src/services/stub-gateway.service.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import {
  GatedOutboundCallRepository,
  GatedStubGatewayService,
  heldAt,
  holdAt,
  instanceIdOf,
  letGo,
  letGoOldest,
  sendsInFlight,
} from "./gates.js";
import { outcomeOf, settled, until } from "./outcome.js";
import { Variant, type PaymentScenario } from "./scenario.types.js";
import { bookedAs, frozenPastLease, thawed } from "./steps.js";

/**
 * PS4 — the zombie reaches the write first: instance 1 checked its lease and froze before its
 * write; instance 2 took the tree over and is itself held before its write; instance 1 wakes and
 * writes first. Wrong: a homemade check (`fence.assertHeld()`) and then the call — the check passed
 * before the freeze, two charges. Right: the outbound-call store checks the lease in the write's own
 * transaction (`LeaseCheck.Atomic`): the zombie's intent is refused (`ExecutionFencedError`) before
 * anything is sent, even though nobody wrote before it.
 */
export const ps4: PaymentScenario = {
  id: "ps4",
  title: "The zombie reaches the write first",
  rows: [
    {
      row: "ps4",
      level: StubLevel.Full,
      wrongOperations: HomemadeFenceCheckPaymentOperations,
      overrides: [
        override(OutboundCallRepository, GatedOutboundCallRepository),
        override(StubGatewayService, GatedStubGatewayService),
      ],
      wrong: { charges: 2, lost: 2500 },
      right: { charges: 1, lost: 0, orderStatus: "paid", notes: ["lease-lost"] },
      async run(context) {
        const order = orderOf("ps4-order", 2500);
        const [a, b] = [context.app(0), context.app(1)];
        await a.ready();
        await b.ready();
        // each instance is held at its write: the intent (right) or the request after the homemade
        // check (wrong) — instance 1 first, then instance 2 once it took the tree over
        const write = context.variant === Variant.Right ? "record:charge" : "send:charge";
        holdAt(write, { instanceId: instanceIdOf(a) });
        holdAt(write, { instanceId: instanceIdOf(b) });
        const first = settled(a.execute(CheckoutWorkflowStart, order));
        await until(() => heldAt() === 1, "instance 1 frozen at its write");
        await frozenPastLease(context, a);
        await until(() => heldAt() === 2, "instance 2 took over, held at its write");
        // the zombie writes first
        letGoOldest();
        thawed(context, a);
        const zombie = await first;
        // a zombie's plain call outlives its execution: wait for its answer before reading the books
        await until(() => sendsInFlight() === 0, "the zombie's request answered");
        letGo();
        await bookedAs(context, order.orderId, "paid");
        return outcomeOf(context, "ps4", "ps4", [order.orderId], [`instance 1: ${zombie}`]);
      },
    },
  ],
};
