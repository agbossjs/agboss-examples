import { Workflow, onStart, toWorkflow, Ttl } from "@agboss/core";
import { AggregateBatchResultsAction } from "../../actions/aggregate-batch-results.action.js";
import { PartitionBatchAction } from "../../actions/partition-batch.action.js";
import { ChunkWorkerWorkflow } from "../chunk-worker/chunk-worker.workflow.js";
import { CoordinatorWorkflowFinish } from "./coordinator.workflow-finish.js";
import { CoordinatorWorkflowStart } from "./coordinator.workflow-start.js";

@Workflow({
  name: "coordinator-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(CoordinatorWorkflowStart)
      .toAction(PartitionBatchAction)
      .forEachItem(toWorkflow(ChunkWorkerWorkflow), {
        maxConcurrency: 4,
        takeFirst: 8,
      })
      .join()
      .toAction(AggregateBatchResultsAction)
      .toFinish(CoordinatorWorkflowFinish),
  ],
})
export class CoordinatorWorkflow {}
