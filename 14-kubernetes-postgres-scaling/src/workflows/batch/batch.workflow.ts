import { onStart, toWorkflow, Ttl, Workflow } from "@agboss/core";
import { SummarizeBatchAction } from "../../actions/summarize-batch.action.js";
import { JobWorkflow } from "../job/job.workflow.js";
import { BatchDoneWorkflowFinish } from "./batch.workflow-finish.js";
import { BatchWorkflowStart } from "./batch.workflow-start.js";

/**
 * The backlog: one `job-workflow` per job, queued in the shared child queue (`JobWorkflow` is
 * `placement: ChildPlacement.AnyWorker`) — the work `agboss.cluster.children.queued` counts and any
 * worker with a free step slot claims. A failed job ends at its own failure finish (`JobFailedDto`),
 * so the batch always joins every job and reports how many succeeded and failed (agbossjs/agboss#763).
 */
@Workflow({
  name: "batch-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(BatchWorkflowStart)
      .forEachItem(toWorkflow(JobWorkflow), { maxConcurrency: 200, takeFirst: 200 })
      .join()
      .toAction(SummarizeBatchAction)
      .toFinish(BatchDoneWorkflowFinish),
  ],
})
export class BatchWorkflow {}
