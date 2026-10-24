import {
  Action,
  ChildPlacement,
  Workflow,
  WorkflowFinish,
  WorkflowStart,
  listOf,
  oneOf,
  start,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "agboss";
import { Integer, Text } from "agboss/dto";
import {
  ChunkFailedDto,
  ChunkResultDto,
  ChunkTaskDto,
  ChunkWorkerWorkflow,
} from "../worker/chunk-worker.workflow.js";

export class BatchJobRequestDto {
  @Text({ prompt: "Batch job identifier (e.g. batch-100)" })
  batchId!: string;

  @Integer({ prompt: "Number of work chunks to fan out across the cluster", min: 1, max: 8 })
  chunkCount!: number;
}

export class BatchJobSummaryDto {
  @Text({ prompt: "Batch job identifier" })
  batchId!: string;

  @Integer({ prompt: "Number of succeeded chunks", min: 0 })
  succeededCount!: number;

  @Integer({ prompt: "Number of soft-failed chunks", min: 0 })
  failedCount!: number;

  @Text({ prompt: "Aggregated summary of all chunk outputs" })
  combinedSummary!: string;
}

@Action({
  name: "partition-batch-action",
  description: "Partitions a batch job into discrete chunk tasks",
  input: { request: BatchJobRequestDto },
  output: listOf(ChunkTaskDto),
})
export class PartitionBatchAction
  implements ActionHandler<PartitionBatchAction>
{
  execute(
    input: InputOf<PartitionBatchAction>,
  ): Promise<OutputOf<PartitionBatchAction>> {
    const { batchId, chunkCount } = input.request.value;
    const chunks: ChunkTaskDto[] = [];
    for (let i = 1; i <= chunkCount; i += 1) {
      chunks.push({
        chunkId: `${batchId}-chunk-${String(i)}`,
        payload: `Segment #${String(i)} of ${batchId}`,
      });
    }
    return Promise.resolve(chunks);
  }
}

@Action({
  name: "aggregate-batch-results-action",
  description: "Aggregates the results from all distributed child chunk executions",
  input: {
    request: BatchJobRequestDto,
    outcomes: listOf(oneOf(ChunkResultDto, ChunkFailedDto)),
  },
  output: BatchJobSummaryDto,
})
export class AggregateBatchResultsAction
  implements ActionHandler<AggregateBatchResultsAction>
{
  execute(
    input: InputOf<AggregateBatchResultsAction>,
  ): Promise<OutputOf<AggregateBatchResultsAction>> {
    let succeededCount = 0;
    let failedCount = 0;
    const summaries: string[] = [];

    for (const outcome of input.outcomes) {
      if ("summary" in outcome.value) {
        succeededCount += 1;
        summaries.push(`${outcome.value.chunkId}:${outcome.value.summary}`);
      } else {
        failedCount += 1;
        summaries.push(`${outcome.value.chunkId}:FAILED(${outcome.value.reason})`);
      }
    }

    return Promise.resolve({
      batchId: input.request.value.batchId,
      succeededCount,
      failedCount,
      combinedSummary: summaries.join(" | "),
    });
  }
}

@WorkflowStart({
  name: "coordinator-workflow-start",
  description:
    "Partitions a batch job and dispatches child workflows with ChildPlacement.AnyInstance",
  input: BatchJobRequestDto,
})
export class CoordinatorWorkflowStart {}

@WorkflowFinish({
  name: "coordinator-workflow-finish",
  description: "Completed batch job summary",
  output: BatchJobSummaryDto,
})
export class CoordinatorWorkflowFinish {}

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
