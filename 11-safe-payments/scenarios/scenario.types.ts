import type { Class } from "@agboss/core";
import type { ClockSkew, Override, TestApp, TestLeases, VirtualClock, WorkflowFixtures } from "@agboss/core/testing";
import type { PaymentOperations } from "../src/payments/payment-operations.js";
import type { StubGateway } from "../src/stub/stub-gateway.js";
import type { StubLevel, StubSettings } from "../src/stub/stub-gateway.types.js";

/** Which version of the scenario runs. */
export enum Variant {
  /** The failure shows: the double charge, the double refund, the lost payment. */
  Wrong = "wrong",
  /** Exactly once (or the named boundary). */
  Right = "right",
}

/** What one scenario run gives a run of it: the instances, the clock, the leases and the stub. */
export interface ScenarioContext {
  readonly apps: readonly TestApp[];
  readonly clock: VirtualClock;
  readonly leases: TestLeases;
  readonly stub: StubGateway;
  readonly variant: Variant;
  /** The scripted model turns (PS7, PS11, PS21): no model is ever called. */
  readonly mockLlm: WorkflowFixtures["mockLlm"];
  /** One instance of the test (`apps[index]`), or a setup error. */
  readonly app: (index: number) => TestApp;
}

/** What a run moved, read from the stub's records for the scenario's orders (never from the app). */
export interface ScenarioOutcome {
  readonly id: string;
  readonly variant: Variant;
  /** The row's label in the report (`ps6 no-keys ps1`, …). */
  readonly row: string;
  readonly level: StubLevel;
  readonly charges: number;
  readonly captures: number;
  readonly refunds: number;
  readonly voids: number;
  readonly confirms: number;
  readonly amountCharged: number;
  readonly amountCaptured: number;
  readonly amountRefunded: number;
  /** Money the gateway holds that the shop's order rows do not know (or the other way), in cents. */
  readonly lost: number;
  /** The first order's status in the shop's books (`paid`, `refunded`, …), or none. */
  readonly orderStatus: string | undefined;
  /** What else the run saw: outcome statuses, the errors' codes. */
  readonly notes: readonly string[];
}

/** What a version must show: every field given must match the outcome. */
export interface Expectation {
  readonly charges?: number;
  readonly captures?: number;
  readonly refunds?: number;
  readonly voids?: number;
  readonly confirms?: number;
  readonly amountCharged?: number;
  readonly amountRefunded?: number;
  /** `0`, an amount, or `"some"`: money lost (any amount above 0). */
  readonly lost?: number | "some";
  readonly orderStatus?: string;
  /** Notes the run must have seen (each a substring of one note). */
  readonly notes?: readonly string[];
  /** A known boundary the right version still shows today, with its ticket (never "passing"). */
  readonly boundary?: string;
}

/** One row of a scenario: its own level, its own expectations, its own run. */
export interface ScenarioRow {
  /** `ps1`, or `ps6 no-keys ps5` for a matrix row. */
  readonly row: string;
  readonly level: StubLevel;
  /** The stub's settings beyond its level (a lookup kept at `NoKeys`, PS23). */
  readonly stub?: Partial<Omit<StubSettings, "level" | "now">>;
  readonly right: Expectation;
  /** None when the scenario has no wrong version (the gateway's side, PS6, PS23). */
  readonly wrong?: Expectation;
  /** The wrong version: one class overriding `PaymentOperations`. */
  readonly wrongOperations?: Class<PaymentOperations>;
  readonly clockSkews?: readonly ClockSkew[];
  /** The scenario's own seams (its gates, a store that fails): never the application's code. */
  readonly overrides?: readonly Override[];
  /** The right version, when it is not `RightPaymentOperations` (PS17 d: a replay-only lookup). */
  readonly rightOperations?: Class<PaymentOperations>;
  /** Whether a refund moves in this row (the refund rows of "check your own gateway call"). */
  readonly refundRow?: boolean;
  run(context: ScenarioContext): Promise<ScenarioOutcome>;
}

/** A scenario of Wiki → Payment scenarios: one or more rows (PS6 and PS17 are matrices). */
export interface PaymentScenario {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly ScenarioRow[];
}
