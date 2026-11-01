import { StepKeyedPaymentOperations } from "../src/payments/wrong/step-keyed.payment-operations.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { CaptureWorkflowStart } from "../src/workflows/capture/capture.workflow-start.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import { outcomeOf, settled } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";

/**
 * PS18 — a partial capture: an authorization of 90.00 captured in three shipments of 30.00.
 * Shipment 1 is captured; then two executions (on two instances) capture shipment 2. Wrong: each
 * capture keyed by its step — shipment 2 captured twice. Right: `capture:<charge>:2`, the amount in
 * the request: the second gets the first capture back.
 */
export const ps18: PaymentScenario = {
  id: "ps18",
  title: "A partial capture",
  rows: [
    {
      row: "ps18",
      level: StubLevel.Full,
      wrongOperations: StepKeyedPaymentOperations,
      wrong: { captures: 3, lost: 3000 },
      right: { captures: 2, lost: 0, orderStatus: "captured" },
      async run(context) {
        const order = orderOf("ps18-order", 9000, { capture: false });
        await context.app(0).execute(CheckoutWorkflowStart, order);
        const [authorization] = context.stub.chargesOf(order.orderId);
        if (authorization === undefined) throw new Error("no authorization at the stub");
        const shipment = (n: number) => ({ orderId: order.orderId, chargeId: authorization.chargeId, shipment: n, amountCents: 3000 });
        const one = await settled(context.app(0).execute(CaptureWorkflowStart, shipment(1)));
        const two = await settled(context.app(0).execute(CaptureWorkflowStart, shipment(2)));
        const twoAgain = await settled(context.app(1).execute(CaptureWorkflowStart, shipment(2)));
        return outcomeOf(context, "ps18", "ps18", [order.orderId], [`shipment 1: ${one}`, `shipment 2: ${two}`, `shipment 2 again: ${twoAgain}`]);
      },
    },
  ],
};
