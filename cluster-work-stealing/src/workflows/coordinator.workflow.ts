import {
  ChildPlacement,
  Workflow,
  listOf,
  oneOf,
  start,
} from "agboss";
import { AggregateBatchResultsAction } from "../actions/aggregate-batch-results.action.js";
import { PartitionBatchAction } from "../actions/partition-batch.action.js";
import { BatchJobRequestDto } from "../dto/batch-job-request.dto.js";
import { BatchJobSummaryDto } from "../dto/batch-job-summary.dto.js";
import { ChunkFailedDto } from "../dto/chunk-failed.dto.js";
import { ChunkResultDto } from "../dto/chunk-result.dto.js";
import { ChunkTaskDto } from "../dto/chunk-task.dto.js";
import { CoordinatorWorkflowFinish } from "../workflow-finishes/coordinator.workflow-finish.js";
import { CoordinatorWorkflowStart } from "../workflow-starts/coordinator.workflow-start.js";
import { ChunkWorkerWorkflow } from "./chunk-worker.workflow.js";

@Workflow({
  name: "coordinator-workflow",
  version: "1.0.0",
  flow: [
    start(CoordinatorWorkflowStart)
      .returns(BatchJobRequestDto)
      .toAction(PartitionBatchAction)
      .returns(listOf(ChunkTaskDto))
      .toParallelWorkflows(ChunkWorkerWorkflow, {
        maxConcurrency: 4,
        maxItems: 8,
        placement: ChildPlacement.AnyInstance,
      })
      .join()
      .returns(listOf(oneOf(ChunkResultDto, ChunkFailedDto)))
      .toAction(AggregateBatchResultsAction)
      .returns(BatchJobSummaryDto)
      .toFinish(CoordinatorWorkflowFinish),
  ],
})
export class CoordinatorWorkflow {}
