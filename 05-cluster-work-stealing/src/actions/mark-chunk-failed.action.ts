import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { ChunkFailedDto } from "../dto/chunk-failed.dto.js";
import { ChunkTaskDto } from "../dto/chunk-task.dto.js";

@Action({
  name: "mark-chunk-failed-action",
  description: "Produces a soft failure record for a failed chunk",
  input: { task: ChunkTaskDto },
  output: ChunkFailedDto,
})
export class MarkChunkFailedAction
  implements ActionHandler<MarkChunkFailedAction>
{
  execute(
    input: InputOf<MarkChunkFailedAction>,
  ): Promise<OutputOf<MarkChunkFailedAction>> {
    return Promise.resolve({
      chunkId: input.task.chunkId,
      reason: `Chunk ${input.task.chunkId} failed softly on worker`,
    });
  }
}
