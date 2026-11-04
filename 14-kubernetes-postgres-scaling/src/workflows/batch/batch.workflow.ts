import { ChildPlacement, listOf, oneOf, start, Workflow } from "@agboss/core";
import { JobFailedDto } from "../../dto/job-failed.dto.js";
import { JobReceiptDto } from "../../dto/job-receipt.dto.js";
import { JobDto } from "../../dto/job.dto.js";
import { JobWorkflow } from "../job/job.workflow.js";
import { BatchDoneWorkflowFinish } from "./batch.workflow-finish.js";
import { BatchWorkflowStart } from "./batch.workflow-start.js";

/**
 * The backlog: one `job-workflow` per job, queued in the shared child queue
 * (`ChildPlacement.AnyInstance`) — the work `agboss.cluster.children.queued` counts and any worker
 * with a free step slot claims. A failed job ends at its own failure finish (`JobFailedDto`), so the
 * batch always joins every job and reports how many succeeded and failed (agbossjs/agboss#763).
 */
@Workflow({
  name: "batch-workflow",
  version: "1.0.0",
  maxConcurrentExecutions: 200,
  flow: [
    start(BatchWorkflowStart)
      .returns(listOf(JobDto))
      .toParallelWorkflows(JobWorkflow, {
        maxConcurrency: 200,
        maxItems: 200,
        placement: ChildPlacement.AnyInstance,
      })
      .join()
      .returns(listOf(oneOf(JobReceiptDto, JobFailedDto)))
      .toFinish(BatchDoneWorkflowFinish),
  ],
})
export class BatchWorkflow {}
