import { WorkflowStart } from "@agboss/core";
import { SupportRequestDto } from "../../dto/support-request.dto.js";

@WorkflowStart({
  name: "support-refund-workflow-start",
  description: "Incoming customer support refund request",
  input: SupportRequestDto,
})
export class SupportRefundWorkflowStart {}
