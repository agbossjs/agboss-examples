import { WorkflowStart } from "agboss";
import { SupportRequestDto } from "../../dto/support-request.dto.js";

@WorkflowStart({
  name: "live-support-refund-workflow-start",
  description: "Incoming customer support refund request (live OpenRouter openai/gpt-4o-mini)",
  input: SupportRequestDto,
})
export class LiveSupportRefundWorkflowStart {}
