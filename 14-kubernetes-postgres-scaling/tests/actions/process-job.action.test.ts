/**
 * agbossjs/agboss#487 AC3, AC5 — the job step on its own (`testUnit`, the runner's in-memory stores)
 * and on two instances of the local application (`testWith`): run again it replays its delivery and
 * the ledger keeps one entry; the same job on another instance is the same business key, so it
 * replays the first delivery; a step whose lease was lost reaches its delivery and is refused
 * (`ExecutionError.Fenced`) — the ledger never hears of it.
 */
import { configureEnv, ExecutionError } from "@agboss/core";
import { testUnit, testWith } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { ProcessJobAction } from "../../src/actions/process-job.action.js";
import { LocalScalingApplication } from "../../src/local/local-scaling.application.js";
import { scalingEnv } from "../../src/scaling.env.js";
import { JobWorkflowStart } from "../../src/workflows/job/job.workflow-start.js";
import { instancesFilePerTest } from "../support/instances-file.js";
import { ledgerStubForFile } from "../support/stub.js";

const stub = ledgerStubForFile();
instancesFilePerTest();
const local = () => ({
  env: configureEnv(scalingEnv, {
    ledgerUrl: stub.current().url,
    podName: "pod-under-test",
    httpPort: 0,
    metricsPort: 0,
  }),
});
const job = (jobId: string) => ({ job: { jobId, durationMs: 0 } });

describe("ProcessJobAction — one delivery and one ledger entry per job", () => {
  it("the step run again replays its receipt; the ledger applies one entry", async () => {
    const run = testUnit(ProcessJobAction, local());

    const first = await run(job("unit-1"));
    const again = await run(job("unit-1"));

    expect(again.output).toEqual(first.output);
    expect(first.output).toMatchObject({ jobId: "unit-1", pod: "pod-under-test" });
    expect(stub.current().state().entries.filter((entry) => entry.jobId === "unit-1")).toHaveLength(1);
  });

  it("a step whose lease is lost does its work, reaches the delivery and is refused: no ledger entry", async () => {
    const zombie = testUnit(ProcessJobAction, { ...local(), fence: { isLost: true } });

    await expect(zombie(job("unit-zombie"))).rejects.toBeInstanceOf(ExecutionError.Fenced);

    const state = stub.current().state();
    expect(state.work.filter((call) => call.jobId === "unit-zombie")).toHaveLength(1);
    expect(state.ledgerRequests.filter((request) => request.jobId === "unit-zombie")).toEqual([]);
    expect(state.entries.filter((entry) => entry.jobId === "unit-zombie")).toEqual([]);
  });
});

describe("the same job on two instances", () => {
  const twoInstances = testWith(LocalScalingApplication, { instances: 2, allowNetwork: ["127.0.0.1"] });

  twoInstances(
    "another instance that runs the job again replays the delivery and the ledger call — the call's request comes from the stored receipt, never from the instance that runs it",
    async ({ apps }) => {
      const [first, second] = apps;
      if (first === undefined || second === undefined) throw new Error("two instances were asked for");

      const done = await first.execute(JobWorkflowStart, { jobId: "unit-takeover", durationMs: 0 }, { threadId: "takeover-a" });
      const again = await second.execute(JobWorkflowStart, { jobId: "unit-takeover", durationMs: 0 }, { threadId: "takeover-b" });

      expect(again.output).toEqual(done.output);
      expect(done.output).toMatchObject({ jobId: "unit-takeover" });
      expect(stub.current().state().entries.filter((entry) => entry.jobId === "unit-takeover")).toHaveLength(1);
    },
  );
});
