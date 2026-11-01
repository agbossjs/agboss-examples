import { describe, expect } from "vitest";
import { ps1 } from "../scenarios/ps1-retry-after-timeout.scenario.js";
import { stub, scenarioTest } from "../scenarios/run-scenario.js";
import { Variant } from "../scenarios/scenario.types.js";
import { tableOf, verdictOf } from "../src/report.js";

/** AC1: the demo's table is the stub's own records, never the application's view. */
describe("the report", () => {
  const [row] = ps1.rows;
  if (row === undefined) throw new Error("ps1 has no row");
  scenarioTest(row, Variant.Wrong)("the demo's table is read from the stub's records", (outcome) => {
    const money = stub.moneyFor("ps1");
    expect([outcome.charges, outcome.amountCharged, outcome.refunds]).toEqual([money.charges, money.charged, money.refunds]);
    expect(stub.ledger().charges.map((entry) => entry.reference)).toEqual(["ps1", "ps1"]);
    const recorded = { outcome, expected: row.wrong ?? {}, mismatches: [] };
    expect(tableOf([recorded])).toMatch(/^ps1 +wrong +full +2 \(50\.00\) +0 +0 \(0\.00\) +0 +0 +25\.00 +as expected$/mu);
    expect(verdictOf({ ...recorded, mismatches: ["charges: 2, expected 1"] })).toBe("NOT as expected: charges: 2, expected 1");
  });
});
