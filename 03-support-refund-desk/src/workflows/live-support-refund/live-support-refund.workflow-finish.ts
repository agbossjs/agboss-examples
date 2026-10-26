import { WorkflowFinish } from "@agboss/core";
import { SupportAnswerDto } from "../../dto/support-answer.dto.js";

@WorkflowFinish({
  name: "live-support-refund-workflow-finish",
  description: "Final support refund decision (live OpenRouter openai/gpt-4o-mini)",
  output: SupportAnswerDto,
})
export class LiveSupportRefundWorkflowFinish {}
