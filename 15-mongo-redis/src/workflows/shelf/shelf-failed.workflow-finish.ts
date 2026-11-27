import { WorkflowFinish } from "@agboss/core";
import { ShelfFailedDto } from "../../dto/shelf-failed.dto.js";

/** Where a shelf whose step failed ends: the recount counts it as failed and goes on with the rest. */
@WorkflowFinish({
  name: "shelf-failed-workflow-finish",
  description: "The shelf's count failed; the recount goes on without it",
  output: ShelfFailedDto,
})
export class ShelfFailedWorkflowFinish {}
