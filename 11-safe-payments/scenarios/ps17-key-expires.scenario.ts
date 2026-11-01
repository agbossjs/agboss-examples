import { hours } from "@agboss/core/units";
import { ReplayKeyReconcilePaymentOperations } from "../src/payments/wrong/replay-key-reconcile.payment-operations.js";
import { StepKeyedPaymentOperations } from "../src/payments/wrong/step-keyed.payment-operations.js";
import { StubFault, StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import { outcomeOf, settled, until } from "./outcome.js";
import { lateRetryAfterServerError } from "./runs.js";
import { Variant, type PaymentScenario, type ScenarioContext, type ScenarioOutcome } from "./scenario.types.js";
import { bookedAs, passLive, requestsReached, thawed } from "./steps.js";

/** (a) the first payment completed; the customer pays again 25 hours later. */
async function againAfterCompleted(context: ScenarioContext, row: string): Promise<ScenarioOutcome> {
  const order = orderOf("ps17-a-order", 2500);
  const first = await settled(context.app(0).execute(CheckoutWorkflowStart, order));
  await context.clock.advance(hours(25));
  const again = await settled(context.app(1).execute(CheckoutWorkflowStart, order));
  return outcomeOf(context, "ps17", row, [order.orderId], [`first: ${first}`, `25 h later: ${again}`]);
}

/**
 * (b), (d): the charge processed, its answer lost; every instance down for 25 hours (past the
 * stub's 24 h retention); then instance 2 starts, and its recovery sweep reconciles the intent.
 */
async function reconciledAfterADay(context: ScenarioContext, row: string, booked: boolean): Promise<ScenarioOutcome> {
  const order = orderOf(`${row.replaceAll(" ", "-")}-order`, 2500);
  const [a, b] = [context.app(0), context.app(1)];
  context.stub.inject(StubFault.HoldAnswer, { operation: "charge" });
  const first = settled(a.execute(CheckoutWorkflowStart, order));
  await until(() => context.stub.heldCount === 1, "the stub charged and holds its answer");
  context.leases.stall(a); // instance 1 dies with the answer in flight
  context.leases.stall(b); // and instance 2 is down too
  await context.clock.advance(hours(25));
  thawed(context, b); // instance 2 comes back: its sweep recovers the tree
  await passLive(context, 31);
  if (booked) await bookedAs(context, order.orderId, "paid");
  else await requestsReached(context, "charge", 2);
  context.stub.release();
  thawed(context, a);
  const zombie = await first;
  return outcomeOf(context, "ps17", row, [order.orderId], [`instance 1: ${zombie}`]);
}

/**
 * PS17 — the idempotency key expires before a retry: the stub forgets keys after 24 h, and the
 * repeat comes 25 h later. (a) After a completed charge: AGBoss replays its own stored receipt
 * (`outboundCalls.retention`, 168 h) — nothing reaches the stub; keyed by the step, it is a new
 * charge. (b) After a crash before the answer: reconcile by our reference (which does not expire)
 * finds the charge; "replay the key" (`notSent()`) charges again. (c) After an error of unknown
 * outcome (a 502 after the stub charged): today the `Failed` intent is resent with no lookup — a
 * second charge, the known boundary #657. (d) A gateway whose only lookup is the replay
 * (`NoLookup`): `notSent()` past the key's retention charges again — the known boundary #658.
 */
export const ps17: PaymentScenario = {
  id: "ps17",
  title: "The idempotency key expires before a retry",
  rows: [
    {
      row: "ps17 a",
      level: StubLevel.Full,
      wrongOperations: StepKeyedPaymentOperations,
      wrong: { charges: 2, lost: 2500 },
      right: { charges: 1, lost: 0, orderStatus: "paid" },
      run: (context) => againAfterCompleted(context, "ps17 a"),
    },
    {
      row: "ps17 b",
      level: StubLevel.Full,
      wrongOperations: ReplayKeyReconcilePaymentOperations,
      wrong: { charges: 2, lost: 2500 },
      right: { charges: 1, lost: 0, orderStatus: "paid" },
      run: (context) => reconciledAfterADay(context, "ps17 b", context.variant === Variant.Right),
    },
    {
      row: "ps17 c",
      level: StubLevel.Full,
      right: { charges: 2, lost: 2500, boundary: "#657" },
      run: (context) => lateRetryAfterServerError(context, "ps17", "ps17 c"),
    },
    {
      row: "ps17 d",
      level: StubLevel.NoLookup,
      rightOperations: ReplayKeyReconcilePaymentOperations,
      right: { charges: 2, lost: 2500, boundary: "#658" },
      run: (context) => reconciledAfterADay(context, "ps17 d", false),
    },
  ],
};
