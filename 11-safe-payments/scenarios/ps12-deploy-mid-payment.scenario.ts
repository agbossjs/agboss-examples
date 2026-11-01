import { RenamedEffectPaymentOperations, deployment } from "../src/payments/wrong/renamed-effect.payment-operations.js";
import { StubFault, StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import { outcomeOf, settled, until } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";
import { passLive } from "./steps.js";

/**
 * PS12 — a rolling deploy mid-payment: instance 1 is stopped (`app.close()`) while its charge is
 * at the stub; it waits for the step to return before it lets the tree go, and instance 2 finishes
 * the tree. Then version 2 is deployed, and an execution of it pays for the same order. Wrong:
 * version 2 renames the call (`charge-v2`), a new key: a second charge. Right: the business key's
 * text, the call's name and the request stay the same across versions: version 2 replays it.
 */
export const ps12: PaymentScenario = {
  id: "ps12",
  title: "A rolling deploy or a graceful stop mid-payment",
  rows: [
    {
      row: "ps12",
      level: StubLevel.Full,
      wrongOperations: RenamedEffectPaymentOperations,
      wrong: { charges: 2, lost: 2500 },
      right: { charges: 1, lost: 0, orderStatus: "paid" },
      async run(context) {
        const order = orderOf("ps12-order", 2500);
        const [a, b] = [context.app(0), context.app(1)];
        await a.ready();
        await b.ready();
        deployment.version = 1;
        try {
          context.stub.inject(StubFault.HoldAnswer, { operation: "charge" });
          const first = settled(a.execute(CheckoutWorkflowStart, order));
          await until(() => context.stub.heldCount === 1, "the charge is at the stub");
          const stopping = a.close(); // SIGTERM: the step running here is waited for
          context.stub.release();
          await stopping;
          await passLive(context, 41); // instance 2's sweep continues the tree
          deployment.version = 2; // the new version rolls out
          const v2 = await settled(b.execute(CheckoutWorkflowStart, order));
          return outcomeOf(context, "ps12", "ps12", [order.orderId], [`version 1: ${await first}`, `version 2: ${v2}`]);
        } finally {
          deployment.version = 1;
        }
      },
    },
  ],
};
