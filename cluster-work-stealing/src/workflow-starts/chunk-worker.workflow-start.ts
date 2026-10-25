import { WorkflowStart } from "agboss";
import { ChunkTaskDto } from "../dto/chunk-task.dto.js";

@WorkflowStart({
  name: "chunk-worker-workflow-start",
  description: "Executes a single chunk on any available cluster instance",
  input: ChunkTaskDto,
})
export class ChunkWorkerWorkflowStart {}
