import { describe, expect } from "vitest";
import { cancelFence } from "../../scenarios/cancel-fence.scenario.js";
import { mismatchesOf } from "../../scenarios/expect.js";
import { scenarioTest } from "../../scenarios/run-scenario.js";
import { Variant } from "../../scenarios/scenario.types.js";
import { describeRows } from "./scenario-rows.js";

// #909 (ADR-0030): a cancel is a hard fence for effects — the stub's own records show it
describeRows([cancelFence]);

describe("cancel-fence: the right assertion fails on the wrong version", () => {
  for (const row of cancelFence.rows)
    if (row.wrong !== undefined)
      scenarioTest(row, Variant.Wrong)(`${row.row}: the right assertion fails on the wrong version`, (outcome) => {
        expect(mismatchesOf(outcome, row.right)).not.toEqual([]);
      });
});
