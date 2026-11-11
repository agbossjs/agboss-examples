import { listOf, WorkflowStart } from "@agboss/core";
import { ShelfDto } from "../../dto/shelf.dto.js";

@WorkflowStart({
  name: "recount-workflow-start",
  description: "A store's shelves to recount, each queued for any instance",
  input: listOf(ShelfDto),
})
export class RecountWorkflowStart {}
