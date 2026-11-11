/**
 * agbossjs/agboss#889 AC4 — the four hooks of the execution audit log, registered by
 * `PaymentAuditObserver` (`@Application({ observers })`), each heard on PS3's right run: instance 1
 * froze with its charge decided, instance 2 took the tree over (`onExecutionLeaseTakeover`), booked
 * and charged through a fenced effect and an outbound call (`onFencedEffect`, `onOutboundCall`), and
 * the thawed zombie's step stopped at its fence (`onStepHandedOver`). The lines are what the
 * observer writes to the on-call log, read from its service; the money is the stub's.
 */
import { afterEach, beforeEach, describe, expect, vi, type MockInstance } from "vitest";
import { assertShows } from "../scenarios/expect.js";
import { ps3 } from "../scenarios/ps3-zombie-after-takeover.scenario.js";
import { scenarioTest } from "../scenarios/run-scenario.js";
import { Variant } from "../scenarios/scenario.types.js";
import { OnCallLogService } from "../src/services/on-call-log.service.js";

const [row] = ps3.rows;
if (row === undefined) throw new Error("PS3 has its one row");

let written: MockInstance<(line: string) => string>;
beforeEach(() => {
  written = vi.spyOn(OnCallLogService.prototype, "write");
});
afterEach(() => {
  written.mockRestore();
});

const lines = (): string[] => written.mock.calls.map(([line]) => line);
const linesOf = (prefix: string): string[] => lines().filter((line) => line.startsWith(prefix));

describe("agbossjs/agboss#889 AC4: the audit log's four hooks", () => {
  scenarioTest(row, Variant.Right)(
    "AC4: PS3 right — a takeover, a hand-over, fenced effects and outbound calls reach PaymentAuditObserver",
    (outcome) => {
      assertShows(outcome, row.right);

      // instance 2's recovery sweep took the frozen tree over, from instance 1, at a newer token
      expect(linesOf("takeover recovered: ")).toHaveLength(1);
      expect(linesOf("takeover recovered: ")[0]).toMatch(/ from .+ took tree .+ at token [2-9]/u);
      // the thawed zombie stopped at its fence: no failure, no undo — a hand-over
      expect(linesOf("hand-over ")).not.toEqual([]);
      expect(linesOf("hand-over ")[0]).toMatch(/^hand-over (lease-lost|fenced) at \w+: /u);
      // the booking: a fenced effect that ran once, under the new holder's lease
      expect(linesOf("fenced effect ")).toEqual(expect.arrayContaining([expect.stringMatching(/ ran at token /u)]));
      // the charge: its intent recorded before anything left, then sent and answered
      expect(linesOf("outbound call ")).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/ recorded \(pending, attempt 1\)/u),
          expect.stringMatching(/ sent \(completed, attempt \d\)/u),
        ]),
      );
    },
  );
});
