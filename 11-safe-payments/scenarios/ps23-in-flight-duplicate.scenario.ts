import { StubFault, StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import { outcomeOf, settled, until } from "./outcome.js";
import type { PaymentScenario, ScenarioContext, ScenarioOutcome, ScenarioRow } from "./scenario.types.js";
import { frozenPastLease, thawed } from "./steps.js";

/**
 * Instance 1's request hangs at the stub (held before processing) and instance 1 freezes past its
 * lease; instance 2 takes the tree over, reconciles (nothing found: the stub has not processed it
 * yet — a true answer at that moment) and sends again under the same key, while instance 1's
 * request is still at the stub. Then the hung request goes through, and the customer pays again.
 */
async function hungPastAttemptTimeout(context: ScenarioContext, row: string): Promise<ScenarioOutcome> {
  const order = orderOf(`${row.replaceAll(" ", "-")}-order`, 2500);
  context.stub.inject(StubFault.HoldRequest, { operation: "charge" });
  const first = settled(context.app(0).execute(CheckoutWorkflowStart, order));
  await until(() => context.stub.heldCount === 1, "instance 1's request hangs at the stub");
  // its holder freezes past the lease with the request on the wire (A6's window: a send hung past
  // `attemptTimeout` plus the lease is the same to the stores) — instance 2 takes the tree over
  await frozenPastLease(context, context.app(0));
  await until(() => context.stub.requests.some((request) => request.operation === "charge"), "instance 2 sent again");
  context.stub.release();
  thawed(context, context.app(0));
  const firstEnded = await first;
  const again = await settled(context.app(1).execute(CheckoutWorkflowStart, order));
  return outcomeOf(context, "ps23", row, [order.orderId], [`first: ${firstEnded}`, `again: ${again}`]);
}

const rows: ScenarioRow[] = [
  {
    row: "ps23 full",
    level: StubLevel.Full,
    right: { charges: 1, lost: 0, orderStatus: "paid" },
    run: (context) => hungPastAttemptTimeout(context, "ps23 full"),
  },
  {
    row: "ps23 no-keys",
    level: StubLevel.NoKeys,
    stub: { lookup: true },
    right: { charges: 2, lost: 2500 },
    run: (context) => hungPastAttemptTimeout(context, "ps23 no-keys"),
  },
];

/**
 * PS23 — two requests under one key at once: AGBoss sends one attempt per claim; two at once happen
 * only in A6's window (a send hung past `attemptTimeout` plus the lease). Then only the gateway can
 * make them one: on `Full` the second gets `409 in_progress`, and the retry replays the first; on
 * `NoKeys` (a lookup kept, the key ignored) both charge.
 */
export const ps23: PaymentScenario = {
  id: "ps23",
  title: "Two requests under one key at once",
  rows,
};
