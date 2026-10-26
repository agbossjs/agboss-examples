import {
  Action,
  listOf,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { BatchJobRequestDto } from "../dto/batch-job-request.dto.js";
import { ChunkTaskDto } from "../dto/chunk-task.dto.js";

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
