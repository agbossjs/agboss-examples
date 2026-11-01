import type { Class } from "@agboss/core";
import { override, testWith } from "@agboss/core/testing";
import { PaymentOperations } from "../src/payments/payment-operations.js";
import { SafePaymentsApplication } from "../src/safe-payments.application.js";
import { StubGateway } from "../src/stub/stub-gateway.js";
import { mismatchesOf } from "./expect.js";
import { resetGates } from "./gates.js";
import { recordRow } from "./report-rows.js";
import { Variant, type ScenarioOutcome, type ScenarioRow } from "./scenario.types.js";

/**
 * The shared harness: one stub gateway per test file (an ephemeral port on 127.0.0.1), the
 * application on two instances over one SQLite file (`env: "offline"`), the right wiring or a wrong
 * one (`override(PaymentOperations, …)`), and the outcome read from the stub's records.
 */
export const stub = await StubGateway.start();
process.env.STUB_GATEWAY_URL = stub.baseUrl;
process.env.STUB_WEBHOOK_SECRET = stub.webhookSecret;
// a synthetic key, the same on both instances (A8) — never a real one (R6)
process.env.PII_PSEUDONYM_KEY ??= "safe-payments-offline-pseudonym-key-32b!";
process.env.SAFE_PAYMENTS_UNUSED_MODEL_KEY ??= "offline-no-model-is-ever-called";

/** Which `PaymentOperations` a run uses: a row's version, or one given (yours). */
export interface RunOptions {
  readonly operations?: Class<PaymentOperations>;
}

/** A Vitest test of one row in one version: `check` gets the outcome. */
export function scenarioTest(
  row: ScenarioRow,
  variant: Variant,
  options: RunOptions = {},
): (name: string, check: (outcome: ScenarioOutcome) => void) => void {
  const expected = variant === Variant.Wrong ? row.wrong : row.right;
  const operations =
    options.operations ?? (variant === Variant.Wrong ? row.wrongOperations : row.rightOperations);
  const test = testWith(SafePaymentsApplication, {
    instances: 2,
    env: "offline",
    allowNetwork: ["localhost"], // the stub gateway on 127.0.0.1, nothing else
    overrides: [
      ...(operations === undefined ? [] : [override(PaymentOperations, operations)]),
      ...(row.overrides ?? []),
    ],
    ...(row.clockSkews === undefined ? {} : { clockSkews: row.clockSkews }),
  });
  return (name, check) => {
    test(name, async ({ apps, clock, leases, mockLlm }) => {
      stub.reset({ ...row.stub, level: row.level, now: () => clock.now().getTime() });
      resetGates();
      const app = (index: number) => {
        const found = apps[index];
        if (found === undefined) throw new Error(`the run has no instance ${String(index)}`);
        return found;
      };
      try {
        // both instances up from the start, as two pods behind a load balancer
        await Promise.all(apps.map((each) => each.ready()));
        const outcome = await row.run({ apps, clock, leases, stub, variant, app, mockLlm });
        // "check your own gateway call" is not the example's report
        if (options.operations === undefined && expected !== undefined)
          recordRow({ outcome, expected, mismatches: mismatchesOf(outcome, expected) });
        check(outcome);
      } finally {
        resetGates();
        stub.release();
        for (const each of apps) leases.resume(each);
      }
    });
  };
}
