/**
 * agbossjs/agboss#487 AC3, AC5 — the job step on its own (`testAction`, the local SQLite stores):
 * run again it replays its delivery and the ledger keeps one entry; a step whose lease was lost
 * reaches its delivery and is refused (`ExecutionFencedError`) — the ledger never hears of it.
 */
import { ExecutionFencedError } from "@agboss/core";
import { override, testAction, type UnitOptions } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { ProcessJobAction } from "../../src/actions/process-job.action.js";
import { SqliteDeliveries } from "../../src/local/sqlite-deliveries.js";
import { Deliveries } from "../../src/services/deliveries.js";
import { JobWorkflowStart } from "../../src/workflows/job/job.workflow-start.js";
import { ledgerStubForFile } from "../support/stub.js";

const stub = ledgerStubForFile();
const local = () => ({
  overrides: [override(Deliveries, SqliteDeliveries)],
  // the local application's environment (the generated type is the cluster application's)
  environment: {
    sqlitePath: ":memory:",
    ledgerUrl: stub.current().url,
    podName: "pod-under-test",
    httpPort: 0,
    metricsPort: 0,
  } as unknown as UnitOptions["environment"],
});
const job = (jobId: string) => ({ job: { producer: JobWorkflowStart, value: { jobId, durationMs: 0 } } });

describe("ProcessJobAction — one delivery and one ledger entry per job", () => {
  it("the step run again replays its receipt; the ledger applies one entry", async () => {
    const run = testAction(ProcessJobAction, local());

    const first = await run(job("unit-1"));
    const again = await run(job("unit-1"));

    expect(again.output).toEqual(first.output);
    expect(first.output).toMatchObject({ jobId: "unit-1", pod: "pod-under-test" });
    expect(stub.current().state().entries.filter((entry) => entry.jobId === "unit-1")).toHaveLength(1);
  });

  it("a step whose lease is lost does its work, reaches the delivery and is refused: no ledger entry", async () => {
    const zombie = testAction(ProcessJobAction, { ...local(), fence: { isLost: true } });

    await expect(zombie(job("unit-zombie"))).rejects.toBeInstanceOf(ExecutionFencedError);

    const state = stub.current().state();
    expect(state.work.filter((call) => call.jobId === "unit-zombie")).toHaveLength(1);
    expect(state.ledgerRequests.filter((request) => request.jobId === "unit-zombie")).toEqual([]);
    expect(state.entries.filter((entry) => entry.jobId === "unit-zombie")).toEqual([]);
  });
});
