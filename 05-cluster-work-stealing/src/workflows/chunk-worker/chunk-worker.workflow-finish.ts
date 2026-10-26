import { WorkflowFinish } from "@agboss/core";
import { ChunkResultDto } from "../../dto/chunk-result.dto.js";

@WorkflowFinish({
  name: "chunk-worker-workflow-finish",
  description: "Completed chunk result",
  output: ChunkResultDto,
})
export class ChunkWorkerWorkflowFinish {}
