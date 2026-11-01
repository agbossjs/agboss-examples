import { WalletUncheckedPaymentOperations } from "../src/payments/wrong/wallet-unchecked.payment-operations.js";
import { OrderBookRepository } from "../src/repositories/order-book.repository.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { SplitOrderWorkflowStart } from "../src/workflows/split-order/split-order.workflow-start.js";
import { outcomeOf, settled } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";

/**
 * PS9 — parallel branches charging one aggregate: a split order's two parts, 70.00 each, drawn in
 * parallel on a wallet of 100.00. Wrong: each branch charges on its own — each exactly once, and
 * 140.00 in all. Right: each branch draws on the wallet's row inside a fenced effect's transaction;
 * the row's own constraint (never below zero) refuses the second — the aggregate's invariant is the
 * application's, the business key alone cannot know it.
 */
export const ps9: PaymentScenario = {
  id: "ps9",
  title: "Parallel branches charging one aggregate",
  rows: [
    {
      row: "ps9",
      level: StubLevel.Full,
      wrongOperations: WalletUncheckedPaymentOperations,
      wrong: { charges: 2, amountCharged: 14_000 },
      right: { charges: 1, amountCharged: 7000, lost: 0 },
      async run(context) {
        const app = context.app(0);
        await app.ready();
        app.resolve(OrderBookRepository).openWallet("ps9-wallet", 10_000);
        const parts = ["ps9-part-1", "ps9-part-2"].map((orderId) => ({ walletId: "ps9-wallet", orderId, amountCents: 7000 }));
        const ended = await settled(app.execute(SplitOrderWorkflowStart, parts));
        const balance = app.resolve(OrderBookRepository).balance("ps9-wallet");
        return outcomeOf(context, "ps9", "ps9", parts.map((part) => part.orderId), [
          `split order: ${ended}`,
          `wallet balance: ${String(balance)}`,
        ]);
      },
    },
  ],
};
