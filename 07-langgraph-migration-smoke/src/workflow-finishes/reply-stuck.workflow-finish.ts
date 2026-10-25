import { WorkflowFinish } from "agboss";
import { SupportRequestDto } from "../dto/support-request.dto.js";

@WorkflowFinish({
  name: "reply-stuck-workflow-finish",
  description: "The review did not converge",
  output: SupportRequestDto,
})
export class ReplyStuckWorkflowFinish {}
