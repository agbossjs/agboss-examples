import { WorkflowFinish } from "agboss";
import { SupportRequestDto } from "../dto/support-request.dto.js";

@WorkflowFinish({
  name: "hand-over-workflow-finish",
  description: "Not a refund: for the team",
  output: SupportRequestDto,
})
export class HandOverWorkflowFinish {}
