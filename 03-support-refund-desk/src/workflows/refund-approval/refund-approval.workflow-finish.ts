import { WorkflowFinish } from "@agboss/core";
import { RefundApprovalOutcomeDto } from "../../dto/refund-approval-outcome.dto.js";

@WorkflowFinish({
  name: "refund-approval-workflow-finish",
  description: "The refund, issued or declined, and who decided",
  output: RefundApprovalOutcomeDto,
})
export class RefundApprovalWorkflowFinish {}
