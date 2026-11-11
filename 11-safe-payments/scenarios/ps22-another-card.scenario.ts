import { NewKeyPerAttemptPaymentOperations } from "../src/payments/wrong/new-key-per-attempt.payment-operations.js";
import { StubFault, StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import { outcomeOf, settled } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";

/**
 * PS22 — a retry with another card: try 1's answer is lost (the stub charged it); the customer
 * tries another card for the same order. Wrong: a new key for every try — the try that was in fact
 * charged is charged again by the next. Right: the same business key with another request is
 * another fingerprint: `BusinessKeyConflictError`, nothing sent, until try 1's outcome is known —
 * the shop settles it first (its own request again: the stub replays the charge), and numbers a
 * next attempt (`order:<id>:attempt:2`) only after a known decline.
 */
export const ps22: PaymentScenario = {
  id: "ps22",
  title: "A retry with another card after a decline",
  rows: [
    {
      row: "ps22",
      level: StubLevel.Full,
      wrongOperations: NewKeyPerAttemptPaymentOperations,
      wrong: { charges: 3, amountCharged: 7500 },
      right: { charges: 1, lost: 0, orderStatus: "paid", notes: ["fenced-effect.business-key-conflict"] },
      async run(context) {
        const order = orderOf("ps22-order", 2500);
        context.stub.inject(StubFault.AnswerThenDrop, { operation: "charge" });
        const tryOne = await settled(context.app(0).execute(CheckoutWorkflowStart, order));
        const tryTwo = await settled(context.app(0).execute(CheckoutWorkflowStart, orderOf(order.orderId, order.amountCents, { paymentMethod: "card_other" })));
        // the shop settles try 1 first — sending its own request again — before it numbers try 2
        const settledOne = await settled(context.app(0).execute(CheckoutWorkflowStart, order));
        return outcomeOf(context, "ps22", "ps22", [order.orderId], [
          `try 1: ${tryOne}`,
          `try 2 (another card): ${tryTwo}`,
          `try 1 settled: ${settledOne}`,
        ]);
      },
    },
  ],
};
