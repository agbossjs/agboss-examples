import { describe, expect, it } from "vitest";
import { mismatchesOf } from "../../scenarios/expect.js";
import { onRealProcesses } from "../../scenarios/processes/driver.js";
import { recordRow } from "../../scenarios/report-rows.js";
import { stub } from "../../scenarios/run-scenario.js";

const RIGHT = { charges: 1, lost: 0, orderStatus: "paid" } as const;

/**
 * PS2 and PS5 on real processes, `SIGKILL`ed (the in-process runs freeze a holder instead): two
 * `node` processes on one SQLite file; the second's recovery sweep — real time, a 30 s lease and a
 * 30 s sweep — finishes the order with one charge in the stub's records.
 */
describe("real processes, SIGKILL", () => {
  for (const kind of ["ps2", "ps5"] as const)
    it(`${kind} process: pod 1 killed, pod 2 recovers — one charge`, { timeout: 240_000 }, async () => {
      const outcome = await onRealProcesses(stub, kind);
      const mismatches = mismatchesOf(outcome, RIGHT);
      recordRow({ outcome, expected: RIGHT, mismatches });
      expect(mismatches).toEqual([]);
    });
});
