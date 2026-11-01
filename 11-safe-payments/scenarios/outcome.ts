import { performance } from "node:perf_hooks";
import { OrderBookRepository } from "../src/repositories/order-book.repository.js";
import type { ScenarioContext, ScenarioOutcome } from "./scenario.types.js";

/**
 * The outcome of a run, read from the stub's records for the scenario's orders — the charges,
 * captures, refunds and voids the stub carried out — and the gap between what the stub holds and
 * what the shop's order rows believe (`lost`).
 */
export function outcomeOf(
  context: ScenarioContext,
  id: string,
  row: string,
  orderIds: readonly string[],
  notes: readonly string[] = [],
): ScenarioOutcome {
  // instance 2: both read one file, and a scenario may have stopped instance 1 (PS12)
  const books = context.app(1).resolve(OrderBookRepository);
  let charges = 0;
  let captures = 0;
  let refunds = 0;
  let voids = 0;
  let confirms = 0;
  let amountCharged = 0;
  let amountCaptured = 0;
  let amountRefunded = 0;
  let lost = 0;
  for (const orderId of orderIds) {
    const money = context.stub.moneyFor(orderId);
    charges += money.charges;
    captures += money.captures;
    refunds += money.refunds;
    voids += money.voids;
    confirms += money.confirms;
    amountCharged += money.charged;
    amountCaptured += money.captured;
    amountRefunded += money.refunded;
    const believed = books.order(orderId)?.heldCents ?? 0;
    lost += Math.abs(money.captured - money.refunded - believed);
  }
  const first = orderIds[0];
  return {
    id,
    variant: context.variant,
    row,
    level: context.stub.level,
    charges,
    captures,
    refunds,
    voids,
    confirms,
    amountCharged,
    amountCaptured,
    amountRefunded,
    lost,
    orderStatus: first === undefined ? undefined : books.order(first)?.status,
    notes,
  };
}

/** What a call ended with, for the notes: its finish, or its error's code. */
export async function settled(call: Promise<unknown>): Promise<string> {
  try {
    await call;
    return "finished";
  } catch (error) {
    return failureOf(error);
  }
}

/** An error's code along its cause chain (`outbound-call.unreconciled`, …), or its name. */
export function failureOf(error: unknown): string {
  const codes: string[] = [];
  for (let at: unknown = error; typeof at === "object" && at !== null; at = (at as { cause?: unknown }).cause) {
    const code = (at as { code?: unknown }).code ?? (at.constructor as { code?: unknown }).code;
    const name = (at as { name?: unknown }).name;
    codes.push(typeof code === "string" ? code : typeof name === "string" ? name : "error");
  }
  return codes.length === 0 ? String(error) : codes.join(" ← ");
}

/**
 * Waits until `isReached()`, turn after turn of the event loop — a request reaching the stub, a
 * recovery finishing on the other instance — bounded by real time (it is I/O, not the clock), and
 * fails naming `what`. Never a duration asserted: the bound only stops a hang.
 */
export async function until(isReached: () => boolean, what: string, timeout = 20_000): Promise<void> {
  const deadline = performance.now() + timeout;
  while (!isReached()) {
    if (performance.now() > deadline) throw new Error(`never reached: ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}
