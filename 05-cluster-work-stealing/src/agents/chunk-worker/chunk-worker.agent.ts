import { Agent } from "@agboss/core";
import { ChunkDraftDto } from "../../dto/chunk-draft.dto.js";
import { ChunkTaskDto } from "../../dto/chunk-task.dto.js";
import { RequestChunkSignOffTool } from "../../tools/request-chunk-sign-off.tool.js";

@Agent({
  name: "chunk-worker-agent",
  description: "Processes one work chunk on a cluster worker instance",
  promptUrls: ["./chunk-worker.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { task: ChunkTaskDto },
  output: ChunkDraftDto,
  tools: [RequestChunkSignOffTool],
  maxToolCalls: 2,
})
export class ChunkWorkerAgent {}
