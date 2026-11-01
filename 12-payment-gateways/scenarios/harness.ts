import { mkdirSync, writeFileSync } from "node:fs";
import { expect } from "vitest";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import type { Class } from "@agboss/core";
import { override, testWith, type TestApp, type TestLeases, type VirtualClock } from "@agboss/core/testing";
import { seconds } from "@agboss/core/units";
import { GatewayPayments } from "../src/gateway-payments.js";
import { PaymentGatewaysApplication } from "../src/payment-gateways.application.js";
import type { StubKit } from "../src/stub-kit/stub-kit.js";

/** A supported gateway as the scenarios run it: its stub, its wiring, the stub's operation names. */
export interface GatewayUnderTest {
  readonly slug: string;
  readonly name: string;
  readonly stub: StubKit;
  readonly operations: Class<GatewayPayments>;
  /** The stub's operation that moves the money of a charge (PayPal: the capture). */
  readonly chargeOperation: string;
  /** The hosts the SDK may name (it reaches 127.0.0.1 only; PayPal's agent pins the socket there). */
  readonly allowNetwork?: readonly string[];
}

/** What a run gives a scenario. */
export interface RunContext {
  readonly gateway: GatewayUnderTest;
  readonly apps: readonly TestApp[];
  readonly clock: VirtualClock;
  readonly leases: TestLeases;
  readonly app: (index: number) => TestApp;
}

/** What a run moved, read from the stub's records for the scenario's order. */
export interface GatewayOutcome {
  readonly gateway: string;
  readonly row: string;
  readonly charges: number;
  readonly captures: number;
  readonly refunds: number;
  readonly amountCharged: number;
  readonly amountRefunded: number;
  readonly notes: readonly string[];
}

/** What a row must show; `boundary` names a known boundary asserted as such, with its ticket. */
export interface GatewayExpectation {
  readonly charges?: number;
  readonly captures?: number;
  readonly refunds?: number;
  readonly notes?: readonly string[];
  readonly boundary?: string;
}

/** One scenario on one gateway. */
export interface GatewayRow {
  readonly scenario: string;
  readonly title: string;
  readonly expected: GatewayExpectation;
  run(context: RunContext): Promise<GatewayOutcome>;
}

/** The stub of the test file, where the application's environment finds it. */
export function useGateway(gateway: GatewayUnderTest, certificate?: string): void {
  process.env.GATEWAY_STUB_URL = gateway.stub.baseUrl;
  if (certificate !== undefined) process.env.GATEWAY_STUB_CA = certificate;
  process.env.PII_PSEUDONYM_KEY ??= "payment-gateways-offline-pseudonym-key!";
}

/** The outcome of a run, from the stub's records. */
export function outcomeOf(context: RunContext, scenario: string, orderId: string, notes: readonly string[]): GatewayOutcome {
  const money = context.gateway.stub.moneyFor(orderId);
  return {
    gateway: context.gateway.slug,
    row: `${context.gateway.slug} ${scenario}`,
    charges: money.charges,
    captures: money.captures,
    refunds: money.refunds,
    amountCharged: money.charged,
    amountRefunded: money.refunded,
    notes,
  };
}

/** What does not match (none: as expected). */
export function mismatchesOf(outcome: GatewayOutcome, expected: GatewayExpectation): string[] {
  const mismatches: string[] = [];
  for (const field of ["charges", "captures", "refunds"] as const) {
    const want = expected[field];
    if (want !== undefined && outcome[field] !== want) mismatches.push(`${field}: ${String(outcome[field])}, expected ${String(want)}`);
  }
  for (const note of expected.notes ?? [])
    if (!outcome.notes.some((seen) => seen.includes(note))) mismatches.push(`no note "${note}" in ${outcome.notes.join("; ")}`);
  return mismatches;
}

const ROWS_DIR = join(import.meta.dirname, "..", ".artifacts", "rows");

/** A Vitest test of one row on one gateway: the right wiring, two instances on one SQLite file. */
export function gatewayTest(gateway: GatewayUnderTest, row: GatewayRow): void {
  const test = testWith(PaymentGatewaysApplication, {
    instances: 2,
    env: "offline",
    allowNetwork: ["localhost", ...(gateway.allowNetwork ?? [])],
    overrides: [override(GatewayPayments, gateway.operations)],
  });
  const name =
    row.expected.boundary === undefined
      ? `${row.scenario}: ${row.title} — charges once`
      : `${row.scenario}: ${row.title} — the known boundary ${row.expected.boundary}`;
  test(name, async ({ apps, clock, leases }) => {
    gateway.stub.reset(() => clock.now().getTime());
    const app = (index: number): TestApp => {
      const found = apps[index];
      if (found === undefined) throw new Error(`no instance ${String(index)}`);
      return found;
    };
    try {
      await Promise.all(apps.map((each) => each.ready()));
      const outcome = await row.run({ gateway, apps, clock, leases, app });
      const mismatches = mismatchesOf(outcome, row.expected);
      mkdirSync(ROWS_DIR, { recursive: true });
      writeFileSync(
        join(ROWS_DIR, `${outcome.row.replaceAll(/[^\w-]+/gu, "_")}.json`),
        `${JSON.stringify({ outcome, expected: row.expected, mismatches }, null, 2)}\n`,
      );
      expect(mismatches).toEqual([]);
    } finally {
      gateway.stub.release();
      for (const each of apps) leases.resume(each);
    }
  });
}


/** What a call ended with: `finished`, or its error's codes along the cause chain. */
export async function settled(call: Promise<unknown>): Promise<string> {
  try {
    await call;
    return "finished";
  } catch (error) {
    const codes: string[] = [];
    for (let at: unknown = error; typeof at === "object" && at !== null; at = (at as { cause?: unknown }).cause) {
      const code = (at as { code?: unknown }).code ?? (at.constructor as { code?: unknown }).code;
      const name = (at as { name?: unknown }).name;
      codes.push(typeof code === "string" ? code : typeof name === "string" ? name : "error");
    }
    return codes.join(" ← ");
  }
}

/** Until `isReached()` — real I/O, bounded by real time only to stop a hang. */
export async function until(isReached: () => boolean, what: string, timeout = 20_000): Promise<void> {
  const deadline = performance.now() + timeout;
  while (!isReached()) {
    if (performance.now() > deadline) throw new Error(`never reached: ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

/** A holder frozen past its lease; the other instance's sweep takes the tree over (live steps after). */
export async function frozenPastLease(context: RunContext, frozen: TestApp): Promise<void> {
  context.leases.stall(frozen);
  await context.clock.advance(seconds(31));
  await passLive(context, 31);
}

/** Time passing for live instances: steps of at most a renewal (10 s). */
export async function passLive(context: RunContext, secondsToPass: number): Promise<void> {
  for (let left = secondsToPass; left > 0; left -= 10) await context.clock.advance(seconds(Math.min(left, 10)));
}
