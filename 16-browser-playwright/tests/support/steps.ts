import { seconds } from "@agboss/core/units";
import type { TestApp } from "@agboss/core/testing";

/** What a test of two instances is given: the instances, the clock, the leases. */
export interface Instances {
  readonly apps: readonly TestApp[];
  readonly clock: { advance(duration: ReturnType<typeof seconds>): Promise<void> };
  readonly leases: { freeze(app: TestApp): void; thaw(app: TestApp): void };
}

/** Until a condition holds (a short poll on the real clock: the browser and the site are real). */
export async function until(condition: () => boolean, what: string, ms = 15_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`did not happen in time: ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Until an async condition holds (the same short poll, for what only a read of the store answers). */
export async function untilAsync(condition: () => Promise<boolean>, what: string, ms = 15_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`did not happen in time: ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** A promise's end as a value: what a frozen instance's call turns out to be. */
export const settled = (promise: Promise<unknown>): Promise<string> =>
  promise.then(
    () => "finished",
    (error: unknown) => (error instanceof Error ? error.name : String(error)),
  );

/**
 * An instance frozen past its lease, to the stores dead: the other instance takes the lease over
 * and recovers its execution. The clock moves in steps of the renewal interval so the live
 * instance's own renewals reach the store in time.
 */
export async function frozenPastLease(context: Instances, frozen: TestApp): Promise<void> {
  context.leases.freeze(frozen);
  await context.clock.advance(seconds(31));
  for (let left = 31; left > 0; left -= 10) await context.clock.advance(seconds(Math.min(left, 10)));
}
