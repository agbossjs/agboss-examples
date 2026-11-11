import { WorkflowStart } from "@agboss/core";
import { ShelfDto } from "../../dto/shelf.dto.js";

@WorkflowStart({
  name: "shelf-workflow-start",
  description: "One shelf to count",
  input: ShelfDto,
})
export class ShelfWorkflowStart {}
