import { OutboundCallRepository, SqliteFencedEffectRepository } from "@agboss/core";
import { override } from "@agboss/core/testing";
import { PlainCallPaymentOperations } from "../src/payments/wrong/plain-call.payment-operations.js";
import { StubGatewayService } from "../src/services/stub-gateway.service.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import {
  fenceRefusals,
  GatedStubGatewayService,
  heldAt,
  holdAt,
  instanceIdOf,
  letGo,
  WitnessFencedEffectRepository,
  WitnessOutboundCallRepository,
} from "./gates.js";
import { outcomeOf, settled, until } from "./outcome.js";
import { Variant, type PaymentScenario, type ScenarioContext, type ScenarioOutcome } from "./scenario.types.js";

const witnesses = [
  override(OutboundCallRepository, WitnessOutboundCallRepository),
  override(SqliteFencedEffectRepository, WitnessFencedEffectRepository),
  override(StubGatewayService, GatedStubGatewayService),
];

/** The calls the order's tree recorded, by the store's own intents (`app.outboundCallsOf`). */
async function recordedCalls(context: ScenarioContext): Promise<string> {
  const [refusal] = fenceRefusals();
  if (refusal === undefined) return "calls: tree unknown";
  const calls = await context.app(1).outboundCallsOf({ tenantId: refusal.tenantId, rootExecutionId: refusal.rootExecutionId });
  return `calls: ${calls.map((call) => `${call.name} ${call.status}`).join(", ") || "none"}`;
}

/**
 * Instance 1 runs the order and is held at `point`; the cancel is requested on instance 2 (a remote
 * cancel, the one a holder reads only at its next renewal); then instance 1 is let go.
 */
async function cancelMidFlight(context: ScenarioContext, point: string, orderId: string): Promise<ScenarioOutcome> {
  const order = orderOf(orderId, 2500);
  const [a, b] = [context.app(0), context.app(1)];
  await a.ready();
  await b.ready();
  holdAt(point, { instanceId: instanceIdOf(a) });
  const threadId = `thread-${orderId}`;
  const run = settled(a.execute(CheckoutWorkflowStart, order, { threadId }));
  await until(() => heldAt(point) === 1, `instance 1 held at ${point}`);
  // resolves once the mark is durable: from here on no new effect starts for the tree
  const { cancelled } = await b.cancel(threadId);
  letGo();
  const ended = await run;
  const refused = fenceRefusals().map((refusal) => `${refusal.store} ${refusal.effect}: ${refusal.code}`);
  const stubRequests = context.stub.requests.filter((request) => request.operation === "charge").length;
  return outcomeOf(context, "cancel-fence", point, [order.orderId], [
    `cancel: ${String(cancelled)}`,
    `run: ${ended}`,
    `charge requests at the stub: ${String(stubRequests)}`,
    ...refused,
    await recordedCalls(context),
  ]);
}

/**
 * A cancel arrives while a payment step is in flight (#909, ADR-0030). The cancel is a durable mark
 * on the fencing store: once `app.cancel` has resolved, no fenced effect starts or commits and no
 * outbound call is recorded or sent for the tree — the write throws `ExecutionCancelFencedError`
 * (`execution.cancelled.fenced`), never at the holder's next renewal. A send already claimed is the
 * one named exception: it may still be answered and recorded.
 *
 * Row 1, the cancel before the charge's intent: nothing is recorded, nothing leaves — the stub
 * carried out no charge. Wrong: a plain client call (no intent, no fence) still charges.
 * Row 2, the cancel after the intent was claimed, before the request left: the request goes out and
 * its answer is recorded (the boundary, stated by the docs), but the booking that follows is a new
 * fenced effect and is refused.
 */
export const cancelFence: PaymentScenario = {
  id: "cancel-fence",
  title: "A cancel arrives while a payment step is in flight",
  rows: [
    {
      row: "cancel before the intent",
      level: StubLevel.Full,
      wrongOperations: PlainCallPaymentOperations,
      overrides: witnesses,
      wrong: { charges: 1, lost: 2500 },
      right: {
        charges: 0,
        lost: 0,
        notes: [
          "cancel: true",
          "charge requests at the stub: 0",
          "outbound-call charge: execution.cancelled.fenced",
          "calls: none",
        ],
      },
      // the plain call has no intent to refuse: its gate is the request, as in PS4
      run: (context) => cancelMidFlight(context, context.variant === Variant.Right ? "record:charge" : "send:charge", "cf-before"),
    },
    {
      row: "cancel after the send is claimed",
      level: StubLevel.Full,
      overrides: witnesses,
      right: {
        charges: 1,
        refunds: 0,
        lost: 2500,
        boundary:
          "(ADR-0030, P7): a send already claimed may still be answered and recorded; the tree's undo does not refund a step that never completed, an operator reads the call in app.outboundCallsOf",
        notes: [
          "charge requests at the stub: 1",
          "fenced-effect book-charge: execution.cancelled.fenced",
          "calls: charge completed",
        ],
      },
      run: (context) => cancelMidFlight(context, "send:charge", "cf-claimed"),
    },
  ],
};
