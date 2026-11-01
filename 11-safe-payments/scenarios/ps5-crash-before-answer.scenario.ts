import { NewKeyPerAttemptPaymentOperations } from "../src/payments/wrong/new-key-per-attempt.payment-operations.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { crashBeforeAnswer } from "./runs.js";
import type { PaymentScenario } from "./scenario.types.js";

/**
 * PS5 — a crash after the send, before the answer: the stub charged and holds its answer; instance
 * 1 dies. Instance 2 recovers the tree. Wrong: it sends again with a new key, two charges. Right:
 * the intent is still `Pending`, so `reconcile` looks the charge up by the order's reference and
 * finds it (`Reconciled`): nothing is sent. Also run on real processes (`scenarios/processes/`).
 */
export const ps5: PaymentScenario = {
  id: "ps5",
  title: "A crash after the send, before the answer",
  rows: [
    {
      row: "ps5",
      level: StubLevel.Full,
      wrongOperations: NewKeyPerAttemptPaymentOperations,
      wrong: { charges: 2, lost: 2500 },
      right: { charges: 1, lost: 0, orderStatus: "paid" },
      run: (context) => crashBeforeAnswer(context, "ps5", "ps5"),
    },
  ],
};
