import { WorkflowStart } from "@agboss/core";
import { RefundApprovalAskDto } from "../../dto/refund-approval-ask.dto.js";

@WorkflowStart({
  name: "refund-approval-workflow-start",
  description: "A refund above the self-service cap, to be approved by a person",
  input: RefundApprovalAskDto,
})
export class RefundApprovalWorkflowStart {}
