import { seconds } from "@agboss/core/units";
import type { TestApp } from "@agboss/core/testing";
import { OrderBookRepository } from "../src/repositories/order-book.repository.js";
import { until } from "./outcome.js";
import type { ScenarioContext } from "./scenario.types.js";

/**
 * A holder frozen past its lease (#471): its lease store calls and timers stop while its step code
 * runs on (`leases.stall`), the clock jumps past the lease twice, and the other instance's recovery
 * sweep takes the tree over under the next token — what a GC pause, a `SIGSTOP` or a crash looks
 * like to the stores.
 */
export async function frozenPastLease(context: ScenarioContext, frozen: TestApp): Promise<void> {
  context.leases.stall(frozen);
  await context.clock.advance(seconds(31));
  // the new holder is live: its renewals reach the store in time (#534)
  await passLive(context, 31);
}

/**
 * Lets `secondsToPass` pass for a live process: the clock moves in steps of at most a renewal
 * interval (10 s), so every live holder's lease renewal reaches its store in time — one jump of a
 * whole lease would be every holder frozen that long.
 */
export async function passLive(context: ScenarioContext, secondsToPass: number): Promise<void> {
  for (let left = secondsToPass; left > 0; left -= 10) await context.clock.advance(seconds(Math.min(left, 10)));
}

/** Wakes a frozen holder (its timers fire at once, as after `SIGCONT`). */
export function thawed(context: ScenarioContext, frozen: TestApp): void {
  context.leases.resume(frozen);
}

/** Until the shop's books show `orderId` in `status` (the other instance's recovery finished it). */
export async function bookedAs(context: ScenarioContext, orderId: string, status: string): Promise<void> {
  const books = context.app(1).resolve(OrderBookRepository);
  await until(() => books.order("default", orderId)?.status === status, `order ${orderId} booked ${status}`);
}

/** Until the stub has received `count` requests of `operation`. */
export async function requestsReached(context: ScenarioContext, operation: string, count: number): Promise<void> {
  await until(
    () => context.stub.requests.filter((request) => request.operation === operation).length >= count,
    `${String(count)} ${operation} request(s) at the stub`,
  );
}
