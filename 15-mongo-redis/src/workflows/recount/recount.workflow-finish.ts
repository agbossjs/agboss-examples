import { WorkflowFinish } from "@agboss/core";
import { RecountDoneDto } from "../../dto/recount-done.dto.js";

@WorkflowFinish({
  name: "recount-done-workflow-finish",
  description: "Every shelf of the store, ended: counted or failed",
  output: RecountDoneDto,
})
export class RecountDoneWorkflowFinish {}
