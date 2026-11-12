import { WorkflowFinish } from "@agboss/core";
import { ShelfCountDto } from "../../dto/shelf-count.dto.js";

@WorkflowFinish({
  name: "shelf-counted-workflow-finish",
  description: "The shelf, counted",
  output: ShelfCountDto,
})
export class ShelfCountedWorkflowFinish {}
