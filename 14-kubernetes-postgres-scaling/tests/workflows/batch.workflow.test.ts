/**
 * agbossjs/agboss#487 AC3 — a batch on two instances of the local application: every job is done
 * once, delivered once and entered in the ledger once, and the verification — from the kept record,
 * the lease log, the outbound calls and the stub's state — says so. agbossjs/agboss#763: a job the
 * other system rejects ends at its own failure finish, and the batch finishes with the others.
 */
import { ChildExecutionStatus } from "@agboss/core";
import { expect } from "vitest";
import { testWith } from "@agboss/core/testing";
import { LocalScalingApplication } from "../../src/local/local-scaling.application.js";
import { batchEvidenceOf } from "../../src/verification/evidence.js";
import { verifyRun } from "../../src/verification/verify.js";
import { BatchWorkflowStart } from "../../src/workflows/batch/batch.workflow-start.js";
import { ledgerStubForFile } from "../support/stub.js";

const stub = ledgerStubForFile();
const test = testWith(LocalScalingApplication, { instances: 2, allowNetwork: ["127.0.0.1"] });

test("AC3: twelve jobs on two instances — each done, delivered and entered once, verified from state", async ({ app }) => {
  const jobs = Array.from({ length: 12 }, (_, index) => ({ jobId: `wf-${String(index)}`, durationMs: 0 }));

  const result = await app.execute(BatchWorkflowStart, jobs, { threadId: "wf-batch" });
  const report = verifyRun({
    batches: [await batchEvidenceOf(app, "wf-batch", jobs.map((one) => one.jobId))],
    stub: stub.current().state(),
    expectations: [],
  });

  expect(result.output).toMatchObject({ jobs: 12 });
  expect(report.jobs.flatMap((job) => job.problems)).toEqual([]);
  expect(report.passed).toBe(true);
  expect(report.totals).toMatchObject({ jobs: 12, accepted: 12, duplicates: 0, inconsistent: 0 });
  expect(stub.current().state().entries).toHaveLength(12);
});

test("#763: a rejected job ends at its failure finish; the batch finishes, counting 11 done and 1 failed", async ({ app }) => {
  const jobs = Array.from({ length: 12 }, (_, index) => ({ jobId: `wf-fail-${String(index)}`, durationMs: 0 }));
  const rejected = "wf-fail-4";
  const control = await fetch(`${stub.current().url}/control/rejects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId: rejected }),
  });
  expect(control.status).toBe(200);

  const result = await app.execute(BatchWorkflowStart, jobs, { threadId: "wf-fail-batch" });
  const report = verifyRun({
    batches: [await batchEvidenceOf(app, "wf-fail-batch", jobs.map((one) => one.jobId), [rejected])],
    stub: stub.current().state(),
    expectations: [],
  });

  expect(result.output).toMatchObject({ jobs: 12, succeeded: 11, failed: 1 });
  const failed = result.children.find((one) => one.status !== ChildExecutionStatus.Finished || one.finish?.name === "job-failed-workflow-finish");
  expect(failed).toMatchObject({ status: ChildExecutionStatus.Finished, finish: { name: "job-failed-workflow-finish" }, output: { jobId: rejected } });
  expect(report.jobs.flatMap((job) => job.problems)).toEqual([]);
  expect(report.passed).toBe(true);
  expect(report.totals).toMatchObject({ jobs: 12, failed: 1, accepted: 11, duplicates: 0 });
  expect(stub.current().state().entries.filter((entry) => entry.jobId === rejected)).toEqual([]);
});
