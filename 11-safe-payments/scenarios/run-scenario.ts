import "../src/scripts/offline-keys.js";
import type { Class } from "@agboss/core";
import { testWith } from "@agboss/core/testing";
import { PaymentOperations } from "../src/payments/payment-operations.js";
import { SafePaymentsApplication } from "../src/safe-payments.application.js";
import { StubGateway } from "../src/stub/stub-gateway.js";
import { mismatchesOf } from "./expect.js";
import { resetGates } from "./gates.js";
import { nextInstancesFile } from "./instances-file.js";
import { recordRow } from "./report-rows.js";
import {
  Variant,
  type ScenarioOutcome,
  type ScenarioRow,
} from "./scenario.types.js";

/**
 * The shared harness: one stub gateway per test file (an ephemeral port on 127.0.0.1), the
 * application on two instances over one SQLite file (`SQLITE_PATH`), the right wiring or a wrong
 * one (`services: [Wrong…]`), and the outcome read from the stub's records.
 */
export const stub = await StubGateway.start();
process.env.STUB_GATEWAY_URL = stub.baseUrl;
process.env.STUB_WEBHOOK_SECRET = stub.webhookSecret;

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
    options.operations ??
    (variant === Variant.Wrong ? row.wrongOperations : row.rightOperations);
  const test = testWith(SafePaymentsApplication, {
    // agbossjs/agboss#831: one entry per instance — a row's own (a clock skew), else two plain ones
    instances: row.instances ?? 2,
    allowNetwork: ["localhost"], // the stub gateway on 127.0.0.1, nothing else
    services: [
      ...(operations === undefined
        ? []
        : [operations]),
      ...(row.services ?? []),
    ],
  });
  return (name, check) => {
    test(name, async ({ apps, clock, leases, mockModel }) => {
      stub.reset({
        ...row.stub,
        level: row.level,
        now: () => clock.now().getTime(),
      });
      resetGates();
      const app = (index: number) => {
        const found = apps[index];
        if (found === undefined)
          throw new Error(`the run has no instance ${String(index)}`);
        return found;
      };
      try {
        // both instances up from the start, as two pods behind a load balancer
        await Promise.all(apps.map((each) => each.ready()));
        const outcome = await row.run({
          apps,
          clock,
          leases,
          stub,
          variant,
          app,
          mockModel,
        });
        // "check your own gateway call" is not the example's report
        if (options.operations === undefined && expected !== undefined)
          recordRow({
            outcome,
            expected,
            mismatches: mismatchesOf(outcome, expected),
          });
        check(outcome);
      } finally {
        nextInstancesFile();
        resetGates();
        stub.release();
        for (const each of apps) leases.thaw(each);
      }
    });
  };
}
