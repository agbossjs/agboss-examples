import { describe, expect } from "vitest";
import { mismatchesOf } from "../scenarios/expect.js";
import { SCENARIOS } from "../scenarios/index.js";
import { scenarioTest } from "../scenarios/run-scenario.js";
import { Variant } from "../scenarios/scenario.types.js";

/**
 * AC2: each scenario's right-version assertion, run on its wrong version, fails — so a stub change
 * that hid a double charge, or a right version replaced by the wrong one, turns a test red.
 */
describe("the right assertion fails on the wrong version", () => {
  for (const scenario of SCENARIOS)
    for (const row of scenario.rows)
      if (row.wrong !== undefined)
        scenarioTest(row, Variant.Wrong)(`${row.row}: the right assertion fails on the wrong version`, (outcome) => {
          expect(mismatchesOf(outcome, row.right)).not.toEqual([]);
        });
});
