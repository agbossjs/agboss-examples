import { Tool, type ToolHandler } from "@agboss/core";
import { seconds } from "@agboss/core/units";
import { ChunkSignOffToolApproval } from "../channels/chunk-sign-off.tool-approval.js";
import { ChunkDraftDto } from "../dto/chunk-draft.dto.js";
import { ChunkTaskDto } from "../dto/chunk-task.dto.js";

@Tool({
  name: "request-chunk-sign-off-tool",
  description: "Requests operator sign-off for a high-risk chunk before completion",
  input: ChunkTaskDto,
  output: ChunkDraftDto,
  timeout: seconds(15),
  approval: ChunkSignOffToolApproval,
})
export class RequestChunkSignOffTool
  implements ToolHandler<ChunkTaskDto, ChunkDraftDto>
{
  execute({ chunkId, payload }: ChunkTaskDto): Promise<ChunkDraftDto> {
    return Promise.resolve({
      chunkId,
      summary: `Approved high-risk chunk ${chunkId}: ${payload}`,
    });
  }
}
