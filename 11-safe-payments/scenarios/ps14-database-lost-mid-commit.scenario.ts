import { OutboundCallRepository } from "@agboss/core";
import { override } from "@agboss/core/testing";
import { RetryAfterStoreErrorPaymentOperations } from "../src/payments/wrong/retry-after-store-error.payment-operations.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import { LostAfterCommitOutboundCallRepository, storeFaults } from "./gates.js";
import { outcomeOf, settled } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";

/**
 * PS14 — the database lost mid-commit: the charge's completion commits, then the connection drops
 * and the store throws. The customer pays again. Wrong: "the write failed, so charge again" — a new
 * key, a second charge. Right: the intent is `Completed` (or, had the commit not landed, `Pending`
 * and reconciled): the retry replays the first charge.
 */
export const ps14: PaymentScenario = {
  id: "ps14",
  title: "The database lost mid-commit",
  rows: [
    {
      row: "ps14",
      level: StubLevel.Full,
      wrongOperations: RetryAfterStoreErrorPaymentOperations,
      overrides: [override(OutboundCallRepository, LostAfterCommitOutboundCallRepository)],
      wrong: { charges: 2, lost: 2500 },
      right: { charges: 1, lost: 0, orderStatus: "paid" },
      async run(context) {
        const order = orderOf("ps14-order", 2500);
        storeFaults.lostAfterCommit = 1;
        try {
          const first = await settled(context.app(0).execute(CheckoutWorkflowStart, order));
          const again = await settled(context.app(0).execute(CheckoutWorkflowStart, order));
          return outcomeOf(context, "ps14", "ps14", [order.orderId], [`first: ${first}`, `again: ${again}`]);
        } finally {
          storeFaults.lostAfterCommit = 0;
        }
      },
    },
  ],
};
