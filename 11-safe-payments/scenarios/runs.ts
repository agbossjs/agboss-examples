import { hours } from "@agboss/core/units";
import { StubFault } from "../src/stub/stub-gateway.types.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { orderOf } from "./checkout.js";
import { outcomeOf, settled, until } from "./outcome.js";
import type { ScenarioContext, ScenarioOutcome } from "./scenario.types.js";
import { bookedAs, frozenPastLease, requestsReached, thawed } from "./steps.js";

/** An order id for a row: `ps6 no-keys ps1` → `ps6-no-keys-ps1`. */
const orderIdOf = (row: string): string => row.replaceAll(" ", "-");

/**
 * PS1's run: the stub charges and drops the connection (the client sees a network error); the
 * customer pays again — a second execution for the same order.
 */
export async function retryAfterDrop(context: ScenarioContext, id: string, row: string): Promise<ScenarioOutcome> {
  const order = orderOf(orderIdOf(row), 2500);
  context.stub.inject(StubFault.AnswerThenDrop, { operation: "charge" });
  const first = await settled(context.app(0).execute(CheckoutWorkflowStart, order));
  const again = await settled(context.app(0).execute(CheckoutWorkflowStart, order));
  return outcomeOf(context, id, row, [order.orderId], [`first: ${first}`, `again: ${again}`]);
}

/**
 * PS5's run: the stub charges and holds its answer; instance 1 freezes past its lease (dead, to
 * the stores); instance 2 recovers the tree. `booked`: whether the recovery can end in "paid" — not
 * when `reconcile` can only say `unknown` (no lookup).
 */
export async function crashBeforeAnswer(
  context: ScenarioContext,
  id: string,
  row: string,
  booked = true,
): Promise<ScenarioOutcome> {
  const order = orderOf(orderIdOf(row), 2500);
  const a = context.app(0);
  await a.ready();
  await context.app(1).ready();
  context.stub.inject(StubFault.HoldAnswer, { operation: "charge" });
  const first = settled(a.execute(CheckoutWorkflowStart, order));
  await until(() => context.stub.heldCount === 1, "the stub charged and holds its answer");
  await frozenPastLease(context, a);
  if (booked) await bookedAs(context, order.orderId, "paid");
  else await requestsReached(context, "lookup", 1);
  const pending = (await context.app(1).pendingOutboundCallsOf({ tenantId: "default" })).calls;
  context.stub.release();
  thawed(context, a);
  const zombie = await first;
  const notes = [`instance 1: ${zombie}`, `pending intents: ${String(pending.length)}`];
  return outcomeOf(context, id, row, [order.orderId], notes);
}

/**
 * PS17 (c)'s run: the stub charges and a proxy in front of it answers `502` (the SDK throws an
 * error of unknown outcome, #657); the customer pays again 25 hours later — past the stub's 24 h
 * key retention.
 */
export async function lateRetryAfterServerError(
  context: ScenarioContext,
  id: string,
  row: string,
): Promise<ScenarioOutcome> {
  const order = orderOf(orderIdOf(row), 2500);
  context.stub.inject(StubFault.ServerErrorAfterProcessing, { operation: "charge" });
  const first = await settled(context.app(0).execute(CheckoutWorkflowStart, order));
  await context.clock.advance(hours(25));
  const again = await settled(context.app(0).execute(CheckoutWorkflowStart, order));
  return outcomeOf(context, id, row, [order.orderId], [`first: ${first}`, `25 h later: ${again}`]);
}
