import { WorkflowStart } from "agboss";
import { BatchJobRequestDto } from "../../dto/batch-job-request.dto.js";

@WorkflowStart({
  name: "coordinator-workflow-start",
  description:
    "Partitions a batch job and dispatches child workflows with ChildPlacement.AnyInstance",
  input: BatchJobRequestDto,
})
export class CoordinatorWorkflowStart {}
