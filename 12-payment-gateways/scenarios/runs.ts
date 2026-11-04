import { ExecutionLeaseEventKind, OutboundCallEventOutcome } from "@agboss/core";
import { hours } from "@agboss/core/units";
import { StubFault } from "../src/stub-kit/stub-kit.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { CaptureWorkflowStart } from "../src/workflows/capture/capture.workflow-start.js";
import { RefundWorkflowStart } from "../src/workflows/refund/refund.workflow-start.js";
import { frozenPastLease, outcomeOf, passLive, settled, until, type GatewayOutcome, type GatewayRow, type RunContext } from "./harness.js";

/** The scenarios of #654 that apply to a gateway, as runs of its stub and its wiring (right only). */

const order = (context: RunContext, scenario: string, amountCents = 2500) => ({
  orderId: `${context.gateway.slug}-${scenario}`,
  amountCents,
  capture: true,
  failShipping: false,
});

/** Until no intent waits for reconciliation: the recovering instance settled it (or failed it). */
async function settledIntents(context: RunContext): Promise<number> {
  const pending = async () => (await context.app(1).pendingOutboundCalls({ tenantId: "default" })).length;
  let left = await pending();
  // bounded: an intent may stay pending for a person (unknown) — then this many are reported
  for (let turn = 0; turn < 200 && left > 0; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    left = await pending();
  }
  return left;
}

/**
 * Until the recovering instance's `reconcile` of an intent left pending could not settle it — the
 * lease log's `unknown` (#505; a `notSent()` past `keyRetention`, #658): `"reconciled: unknown"`,
 * else nothing within the bound (the intent was never reconciled).
 */
async function unknownNotes(context: RunContext): Promise<string[]> {
  const b = context.app(1);
  const [pending] = await b.pendingOutboundCalls({ tenantId: "default" });
  if (pending === undefined) return [];
  const tree = { tenantId: "default", rootExecutionId: pending.rootExecutionId };
  for (let turn = 0; turn < 200; turn += 1) {
    const events = await b.leaseEventsOf(tree);
    if (events.some((event) => event.kind === ExecutionLeaseEventKind.OutboundCall && event.outcome === OutboundCallEventOutcome.Unknown))
      return ["reconciled: unknown"];
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return [];
}

/** PS1: the charge's answer dropped after the gateway processed it; the customer pays again. */
export const ps1: GatewayRow = {
  scenario: "ps1",
  title: "a retry after a timeout",
  expected: { charges: 1 },
  async run(context) {
    const paid = order(context, "ps1");
    context.gateway.stub.inject(StubFault.AnswerThenDrop, { operation: context.gateway.chargeOperation });
    const first = await settled(context.app(0).execute(CheckoutWorkflowStart, paid));
    const again = await settled(context.app(0).execute(CheckoutWorkflowStart, paid));
    return outcomeOf(context, "ps1", paid.orderId, [`first: ${first}`, `again: ${again}`]);
  },
};

/** PS2: the charge answered and stored, the step's checkpoint never written; the other instance runs it again. */
export const ps2: GatewayRow = {
  scenario: "ps2",
  title: "a crash after the charge, before the checkpoint",
  expected: { charges: 1 },
  async run(context) {
    const paid = order(context, "ps2");
    const a = context.app(0);
    context.gateway.stub.inject(StubFault.HoldAnswer, { operation: context.gateway.chargeOperation });
    const first = settled(a.execute(CheckoutWorkflowStart, paid));
    await until(() => context.gateway.stub.heldCount === 1, "the charge answered, the answer on its way");
    context.leases.stall(a); // the holder freezes: its checkpoint's lease renewal never comes
    context.gateway.stub.release(); // …but the answer arrives and the intent completes
    await settledIntents(context);
    await frozenPastLease(context, a);
    await passLive(context, 31);
    context.leases.resume(a);
    const calls = await context.app(1).outboundCallsOf({ tenantId: "default", rootExecutionId: "execution-1" });
    const charge = calls.map((call) => `${call.operation} ${call.status} attempt ${String(call.attempt)}`);
    return outcomeOf(context, "ps2", paid.orderId, [`instance 1: ${await first}`, ...charge]);
  },
};

/** PS5: the gateway processed the charge and its answer is held; instance 1 dies; instance 2 reconciles. */
export const ps5: GatewayRow = {
  scenario: "ps5",
  title: "a crash after the send, before the answer",
  expected: { charges: 1 },
  async run(context) {
    const paid = order(context, "ps5");
    const a = context.app(0);
    context.gateway.stub.inject(StubFault.HoldAnswer, { operation: context.gateway.chargeOperation });
    const first = settled(a.execute(CheckoutWorkflowStart, paid));
    await until(() => context.gateway.stub.heldCount === 1, "the gateway charged and holds its answer");
    await frozenPastLease(context, a);
    const left = await settledIntents(context);
    context.gateway.stub.release();
    context.leases.resume(a);
    return outcomeOf(context, "ps5", paid.orderId, [`instance 1: ${await first}`, `intents left pending: ${String(left)}`]);
  },
};

/** PS8: the first execution's charge is still at the gateway when a second for the same order starts. */
export const ps8: GatewayRow = {
  scenario: "ps8",
  title: "two executions for one order",
  expected: { charges: 1, notes: ["outbound-call.in-flight"] },
  async run(context) {
    const paid = order(context, "ps8");
    context.gateway.stub.inject(StubFault.HoldRequest, { operation: context.gateway.chargeOperation });
    const first = settled(context.app(0).execute(CheckoutWorkflowStart, paid));
    await until(() => context.gateway.stub.heldCount === 1, "the first charge is at the gateway");
    const second = await settled(context.app(1).execute(CheckoutWorkflowStart, paid));
    context.gateway.stub.release();
    return outcomeOf(context, "ps8", paid.orderId, [`first: ${await first}`, `second: ${second}`]);
  },
};

/** PS17 (a): the payment completed; the customer pays again `after` hours later — AGBoss replays its receipt. */
export const ps17Completed = (after: number): GatewayRow => ({
  scenario: "ps17a",
  title: `the key expired (${String(after)} h later), after a completed charge`,
  expected: { charges: 1 },
  async run(context) {
    const paid = order(context, "ps17a");
    const first = await settled(context.app(0).execute(CheckoutWorkflowStart, paid));
    await context.clock.advance(hours(after));
    const again = await settled(context.app(1).execute(CheckoutWorkflowStart, paid));
    return outcomeOf(context, "ps17a", paid.orderId, [`first: ${first}`, `${String(after)} h later: ${again}`]);
  },
});

/** PS17 (b), (d): the answer lost, every instance down `after` hours, then the recovery reconciles. */
export const ps17Pending = (scenario: string, after: number, expected: GatewayRow["expected"]): GatewayRow => ({
  scenario,
  title: `the key expired (${String(after)} h later), after a crash before the answer`,
  expected,
  async run(context) {
    const paid = order(context, scenario);
    const [a, b] = [context.app(0), context.app(1)];
    context.gateway.stub.inject(StubFault.HoldAnswer, { operation: context.gateway.chargeOperation });
    const first = settled(a.execute(CheckoutWorkflowStart, paid));
    await until(() => context.gateway.stub.heldCount === 1, "the gateway charged and holds its answer");
    context.leases.stall(a);
    context.leases.stall(b);
    await context.clock.advance(hours(after));
    context.leases.resume(b);
    await passLive(context, 41);
    const left = await settledIntents(context);
    const unknown = await unknownNotes(context);
    context.gateway.stub.release();
    context.leases.resume(a);
    return outcomeOf(context, scenario, paid.orderId, [`instance 1: ${await first}`, `intents left pending: ${String(left)}`, ...unknown]);
  },
});

/** PS17 (c): a 502 after the gateway charged (an error of unknown outcome, #657); the customer pays again later. */
export const ps17Failed = (after: number, expected: GatewayRow["expected"]): GatewayRow => ({
  scenario: "ps17c",
  title: `the key expired (${String(after)} h later), after a 502 the gateway had processed`,
  expected,
  async run(context) {
    const paid = order(context, "ps17c");
    context.gateway.stub.inject(StubFault.ServerErrorAfterProcessing, { operation: context.gateway.chargeOperation });
    const first = await settled(context.app(0).execute(CheckoutWorkflowStart, paid));
    await context.clock.advance(hours(after));
    const again = await settled(context.app(1).execute(CheckoutWorkflowStart, paid));
    return outcomeOf(context, "ps17c", paid.orderId, [`first: ${first}`, `${String(after)} h later: ${again}`]);
  },
});

/** The payment id of a finished checkout (its tracking number is `track-<paymentId>`). */
export function paymentIdOf(output: unknown): string {
  const tracking = (output as { trackingNumber?: unknown } | undefined)?.trackingNumber;
  if (typeof tracking !== "string") throw new Error("the checkout did not finish");
  return tracking.slice("track-".length);
}

/** PS19: the operator's refund answer lost (the gateway refunded); the customer's request for it follows. */
export const ps19 = (refundOperation: string, expected: GatewayRow["expected"] = { charges: 1, refunds: 1 }): GatewayRow => ({
  scenario: "ps19",
  title: "a refund retried",
  expected,
  async run(context) {
    const paid = order(context, "ps19", 5000);
    const checkout = await context.app(0).execute(CheckoutWorkflowStart, paid);
    const refund = { orderId: paid.orderId, paymentId: paymentIdOf(checkout.output), amountCents: 2000, refundNumber: 1 };
    context.gateway.stub.inject(StubFault.AnswerThenDrop, { operation: refundOperation });
    const operator = await settled(context.app(0).execute(RefundWorkflowStart, refund));
    const customer = await settled(context.app(1).execute(RefundWorkflowStart, refund));
    return outcomeOf(context, "ps19", paid.orderId, [`operator: ${operator}`, `customer: ${customer}`]);
  },
});

/** PS18: an authorization captured in shipments; shipment 2 captured by two executions. */
export const ps18Shipments: GatewayRow = {
  scenario: "ps18",
  title: "a partial capture",
  expected: { charges: 1, captures: 2 },
  async run(context) {
    const authorized = { ...order(context, "ps18", 9000), capture: false };
    const checkout = await context.app(0).execute(CheckoutWorkflowStart, authorized);
    const shipment = (n: number) => ({ orderId: authorized.orderId, paymentId: paymentIdOf(checkout.output), shipment: n, amountCents: 3000 });
    const notes = [
      `shipment 1: ${await settled(context.app(0).execute(CaptureWorkflowStart, shipment(1)))}`,
      `shipment 2: ${await settled(context.app(0).execute(CaptureWorkflowStart, shipment(2)))}`,
      `shipment 2 again: ${await settled(context.app(1).execute(CaptureWorkflowStart, shipment(2)))}`,
    ];
    return outcomeOf(context, "ps18", authorized.orderId, notes);
  },
};

/**
 * PS23: instance 1's charge hangs at the gateway (held before processing) and instance 1 freezes
 * past its lease; instance 2 reconciles and sends again under the same key while the first is
 * still at the gateway — only the gateway can make them one. Then the customer pays again.
 */
export const ps23 = (expected: GatewayRow["expected"]): GatewayRow => ({
  scenario: "ps23",
  title: "two requests under one key at once",
  expected,
  async run(context) {
    const paid = order(context, "ps23");
    const a = context.app(0);
    context.gateway.stub.inject(StubFault.HoldRequest, { operation: context.gateway.chargeOperation });
    const first = settled(a.execute(CheckoutWorkflowStart, paid));
    await until(() => context.gateway.stub.heldCount === 1, "instance 1's request hangs at the gateway");
    await frozenPastLease(context, a);
    await until(() => context.gateway.stub.requests.some((request) => request.operation === context.gateway.chargeOperation), "instance 2 sent again");
    context.gateway.stub.release();
    context.leases.resume(a);
    const firstEnded = await first;
    const again = await settled(context.app(1).execute(CheckoutWorkflowStart, paid));
    const seen = context.gateway.stub.requests.filter((request) => request.operation === context.gateway.chargeOperation).map((request) => request.outcome);
    return outcomeOf(context, "ps23", paid.orderId, [`first: ${firstEnded}`, `again: ${again}`, `at the gateway: ${seen.join(", ")}`]);
  },
});

export type { GatewayOutcome };

/**
 * A refund of a payment that is not the order's (an IDOR: the caller names order A and order B's
 * payment). The refund is tied to the order by the shop's own records: refused, nothing refunded.
 */
export const refundOwnership: GatewayRow = {
  scenario: "idor",
  title: "a refund of another order's payment is refused",
  expected: { charges: 2, refunds: 0, notes: ["payments.not-the-orders-payment"] },
  async run(context) {
    const mine = order(context, "idor-mine");
    const theirs = order(context, "idor-theirs");
    await context.app(0).execute(CheckoutWorkflowStart, mine);
    const other = await context.app(0).execute(CheckoutWorkflowStart, theirs);
    const refund = { orderId: mine.orderId, paymentId: paymentIdOf(other.output), amountCents: 1000, refundNumber: 1 };
    const refused = await settled(context.app(1).execute(RefundWorkflowStart, refund));
    const money = [mine.orderId, theirs.orderId].map((id) => context.gateway.stub.moneyFor(id));
    return {
      ...outcomeOf(context, "idor", mine.orderId, [`refund of the other order's payment: ${refused}`]),
      charges: money.reduce((sum, m) => sum + m.charges, 0),
      refunds: money.reduce((sum, m) => sum + m.refunds, 0),
    };
  },
};
