import { WorkflowFinish } from "@agboss/core";
import { SupportAnswerDto } from "../../dto/support-answer.dto.js";

@WorkflowFinish({
  name: "support-refund-workflow-finish",
  description: "Final support refund decision",
  output: SupportAnswerDto,
})
export class SupportRefundWorkflowFinish {}
