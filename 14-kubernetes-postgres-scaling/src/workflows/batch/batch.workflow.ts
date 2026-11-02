import { ChildPlacement, listOf, start, Workflow } from "@agboss/core";
import { JobReceiptDto } from "../../dto/job-receipt.dto.js";
import { JobDto } from "../../dto/job.dto.js";
import { JobWorkflow } from "../job/job.workflow.js";
import { BatchDoneWorkflowFinish } from "./batch.workflow-finish.js";
import { BatchWorkflowStart } from "./batch.workflow-start.js";

/**
 * The backlog: one `job-workflow` per job, queued in the shared child queue
 * (`ChildPlacement.AnyInstance`) — the work `agboss.cluster.children.queued` counts and any worker
 * with a free step slot claims.
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
      .returns(listOf(JobReceiptDto))
      .toFinish(BatchDoneWorkflowFinish),
  ],
})
export class BatchWorkflow {}
