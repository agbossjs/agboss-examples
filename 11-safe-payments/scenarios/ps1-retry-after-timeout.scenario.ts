import { NewKeyPerAttemptPaymentOperations } from "../src/payments/wrong/new-key-per-attempt.payment-operations.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { retryAfterDrop } from "./runs.js";
import type { PaymentScenario } from "./scenario.types.js";

/**
 * PS1 — a retry after a timeout: the stub charges, then drops the connection (the client sees a
 * network error). The customer pays again. Wrong: a new key per attempt, two charges. Right: the
 * same business key, so the same `call.idempotencyKey` — the stub replays the first charge.
 */
export const ps1: PaymentScenario = {
  id: "ps1",
  title: "A retry after a timeout",
  rows: [
    {
      row: "ps1",
      level: StubLevel.Full,
      wrongOperations: NewKeyPerAttemptPaymentOperations,
      wrong: { charges: 2, lost: 2500 },
      right: { charges: 1, lost: 0, orderStatus: "paid" },
      run: (context) => retryAfterDrop(context, "ps1", "ps1"),
    },
  ],
};
