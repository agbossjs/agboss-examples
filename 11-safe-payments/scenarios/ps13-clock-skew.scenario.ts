import { ClockSkew } from "@agboss/core/testing";
import { seconds } from "@agboss/core/units";
import { HomemadeLockPaymentOperations } from "../src/payments/wrong/homemade-lock.payment-operations.js";
import { StubFault, StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import { outcomeOf, settled, until } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";

/**
 * PS13 — clock skew: instance 2's clock runs 300 s ahead. Instance 1's charge is slow at the stub
 * when the customer's retry reaches instance 2. Wrong: a homemade lock row per order, expiring by
 * each instance's own clock — instance 2 sees it expired and charges too. Right: the lease and the
 * intent are decided by the store's clock, not the caller's: instance 2 finds the call in flight
 * under a live lease (`OutboundCallInFlightError`).
 */
export const ps13: PaymentScenario = {
  id: "ps13",
  title: "Clock skew and lease expiry",
  rows: [
    {
      row: "ps13",
      level: StubLevel.Full,
      clockSkews: [ClockSkew.none, ClockSkew.ahead(seconds(300))],
      wrongOperations: HomemadeLockPaymentOperations,
      wrong: { charges: 2, lost: 2500 },
      right: { charges: 1, lost: 0, orderStatus: "paid", notes: ["outbound-call.in-flight"] },
      async run(context) {
        const order = orderOf("ps13-order", 2500);
        await context.app(0).ready();
        await context.app(1).ready();
        context.stub.inject(StubFault.HoldAnswer, { operation: "charge" });
        const first = settled(context.app(0).execute(CheckoutWorkflowStart, order));
        await until(() => context.stub.heldCount === 1, "instance 1's charge is slow at the stub");
        const retry = await settled(context.app(1).execute(CheckoutWorkflowStart, order));
        context.stub.release();
        return outcomeOf(context, "ps13", "ps13", [order.orderId], [`instance 1: ${await first}`, `instance 2 (+300 s): ${retry}`]);
      },
    },
  ],
};
