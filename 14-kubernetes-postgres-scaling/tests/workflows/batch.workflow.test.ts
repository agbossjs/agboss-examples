/**
 * agbossjs/agboss#487 AC3 — a batch on two instances of the local application: every job is done
 * once, delivered once and entered in the ledger once, and the verification — from the kept record,
 * the lease log, the outbound calls and the stub's state — says so.
 */
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
