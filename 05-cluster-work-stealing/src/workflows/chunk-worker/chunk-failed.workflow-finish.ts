import { WorkflowFinish } from "@agboss/core";
import { ChunkFailedDto } from "../../dto/chunk-failed.dto.js";

@WorkflowFinish({
  name: "chunk-failed-workflow-finish",
  description: "Soft-failed chunk result",
  output: ChunkFailedDto,
})
export class ChunkFailedWorkflowFinish {}
