import { StepKeyedPaymentOperations } from "../src/payments/wrong/step-keyed.payment-operations.js";
import { StubFault, StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import { outcomeOf, settled, until } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";

/**
 * PS8 — two executions for one order at once, on two instances (a double click, a retried HTTP
 * request): the first's charge is still at the stub when the second starts. Wrong: keyed by the
 * step, two keys, two charges. Right: the same business key — the second finds the first's intent
 * in flight under a live lease (`OutboundCallInFlightError`, "payment in progress") and sends nothing.
 */
export const ps8: PaymentScenario = {
  id: "ps8",
  title: "Two executions for one order",
  rows: [
    {
      row: "ps8",
      level: StubLevel.Full,
      wrongOperations: StepKeyedPaymentOperations,
      wrong: { charges: 2, lost: 2500 },
      right: { charges: 1, lost: 0, orderStatus: "paid", notes: ["outbound-call.in-flight"] },
      async run(context) {
        const order = orderOf("ps8-order", 2500);
        await context.app(0).ready();
        await context.app(1).ready();
        context.stub.inject(StubFault.HoldRequest, { operation: "charge" });
        const first = settled(context.app(0).execute(CheckoutWorkflowStart, order));
        await until(() => context.stub.heldCount === 1, "the first charge is at the stub");
        const second = await settled(context.app(1).execute(CheckoutWorkflowStart, order));
        context.stub.release();
        const notes = [`first: ${await first}`, `second: ${second}`];
        return outcomeOf(context, "ps8", "ps8", [order.orderId], notes);
      },
    },
  ],
};
