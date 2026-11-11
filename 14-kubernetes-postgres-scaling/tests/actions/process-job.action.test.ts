/**
 * agbossjs/agboss#487 AC3, AC5 — the job step on its own (`testAction`, the local SQLite stores):
 * run again it replays its delivery and the ledger keeps one entry; a step whose lease was lost
 * reaches its delivery and is refused (`ExecutionFencedError`) — the ledger never hears of it.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ExecutionFencedError,
  FencedEffectRepository,
  OutboundCallRepository,
  SqliteFencedEffectRepository,
  SqliteOutboundCallRepository,
} from "@agboss/core";
import { override, testAction, type UnitOptions } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { ProcessJobAction } from "../../src/actions/process-job.action.js";
import { JobWorkflowStart } from "../../src/workflows/job/job.workflow-start.js";
import { ledgerStubForFile } from "../support/stub.js";

const stub = ledgerStubForFile();
const local = () => ({
  overrides: [override(FencedEffectRepository, SqliteFencedEffectRepository)],
  // the local application's environment (the generated type is the cluster application's)
  environment: {
    sqlitePath: ":memory:",
    ledgerUrl: stub.current().url,
    podName: "pod-under-test",
    httpPort: 0,
    metricsPort: 0,
  } as unknown as UnitOptions["environment"],
});
/** Two pods on one database: each its own pod name, the stores in one SQLite file. */
const onePodOf = (sqlitePath: string, podName: string) => ({
  overrides: [override(FencedEffectRepository, SqliteFencedEffectRepository), override(OutboundCallRepository, SqliteOutboundCallRepository)],
  environment: { sqlitePath, ledgerUrl: stub.current().url, podName, httpPort: 0, metricsPort: 0 } as unknown as UnitOptions["environment"],
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

  it("another pod that runs the step again (a takeover) replays the delivery and the ledger call — the call's request comes from the stored receipt, never from the pod that runs it", async () => {
    const sqlitePath = join(mkdtempSync(join(tmpdir(), "process-job-")), "pods.sqlite");
    const first = await testAction(ProcessJobAction, onePodOf(sqlitePath, "pod-a"))(job("unit-takeover"));

    const takenOver = await testAction(ProcessJobAction, onePodOf(sqlitePath, "pod-b"))(job("unit-takeover"));

    expect(takenOver.output).toEqual(first.output);
    expect(first.output).toMatchObject({ jobId: "unit-takeover", pod: "pod-a" });
    expect(stub.current().state().entries.filter((entry) => entry.jobId === "unit-takeover")).toHaveLength(1);
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
