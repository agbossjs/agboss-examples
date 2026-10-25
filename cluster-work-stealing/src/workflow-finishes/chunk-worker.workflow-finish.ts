import { WorkflowFinish } from "agboss";
import { ChunkResultDto } from "../dto/chunk-result.dto.js";

@WorkflowFinish({
  name: "chunk-worker-workflow-finish",
  description: "Completed chunk result",
  output: ChunkResultDto,
})
export class ChunkWorkerWorkflowFinish {}
