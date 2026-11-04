import { performance } from "node:perf_hooks";
import { ExecutionLeaseEventKind, OutboundCallEventOutcome } from "@agboss/core";
import { hours } from "@agboss/core/units";
import { ReplayWithinRetentionPaymentOperations } from "../src/payments/replay-within-retention.payment-operations.js";
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
 * Until instance 2's recovery reconciled the pending charge and could not settle it — the lease
 * log's `unknown` (#505): reconcile's `notSent()` past the declared `keyRetention` refused (#658).
 * Bounded by real time (it is I/O, not the clock), as `until`.
 */
async function reconciledUnknown(context: ScenarioContext, timeout = 20_000): Promise<void> {
  const b = context.app(1);
  const [pending] = await b.pendingOutboundCalls({ tenantId: "default" });
  if (pending === undefined) throw new Error("the charge's intent is not pending");
  const tree = { tenantId: "default", rootExecutionId: pending.rootExecutionId };
  const isUnknown = async (): Promise<boolean> =>
    (await b.leaseEventsOf(tree)).some(
      (event) => event.kind === ExecutionLeaseEventKind.OutboundCall && event.outcome === OutboundCallEventOutcome.Unknown,
    );
  const deadline = performance.now() + timeout;
  while (!(await isUnknown())) {
    if (performance.now() > deadline) throw new Error("never reached: the pending charge reconciled as unknown");
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

/**
 * (b), (d): the charge processed, its answer lost; every instance down for 25 hours (past the
 * stub's 24 h retention); then instance 2 starts, and its recovery sweep reconciles the intent:
 * `booked` — paid by the lookup; `false` — the replay charged again; `"unknown"` — nothing sent.
 */
async function reconciledAfterADay(context: ScenarioContext, row: string, booked: boolean | "unknown"): Promise<ScenarioOutcome> {
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
  if (booked === true) await bookedAs(context, order.orderId, "paid");
  else if (booked === false) await requestsReached(context, "charge", 2);
  else await reconciledUnknown(context);
  const pending = await context.app(1).pendingOutboundCalls({ tenantId: "default" });
  context.stub.release();
  thawed(context, a);
  const zombie = await first;
  return outcomeOf(context, "ps17", row, [order.orderId], [`instance 1: ${zombie}`, `intents pending: ${String(pending.length)}`]);
}

/**
 * PS17 — the idempotency key expires before a retry: the stub forgets keys after 24 h, and the
 * repeat comes 25 h later. (a) After a completed charge: AGBoss replays its own stored receipt
 * (`outboundCalls.retention`, 168 h) — nothing reaches the stub; keyed by the step, it is a new
 * charge. (b) After a crash before the answer: reconcile by our reference (which does not expire)
 * finds the charge; "replay the key" (`notSent()`) charges again. (c) After an error of unknown
 * outcome (a 502 after the stub charged): the intent stays pending (#657), the retry reconciles by
 * reference — one charge. (d) A gateway whose only lookup is the replay (`NoLookup`): the call
 * declares the key's retention (`keyRetention`, #658), and a `notSent()` past it is never sent —
 * `OutboundCallUnreconciledError`, a person decides.
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
      right: { charges: 1, lost: 0, orderStatus: "paid" },
      run: (context) => lateRetryAfterServerError(context, "ps17", "ps17 c"),
    },
    {
      row: "ps17 d",
      level: StubLevel.NoLookup,
      rightOperations: ReplayWithinRetentionPaymentOperations,
      right: { charges: 1, notes: ["intents pending: 1"] }, // past the key's retention: unknown, nothing sent
      run: (context) => reconciledAfterADay(context, "ps17 d", "unknown"),
    },
  ],
};
