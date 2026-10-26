import { WorkflowFinish } from "@agboss/core";
import { RefundIssuedDto } from "../../dto/refund-issued.dto.js";

@WorkflowFinish({
  name: "refund-issued-workflow-finish",
  description: "The refund was issued",
  output: RefundIssuedDto,
})
export class RefundIssuedWorkflowFinish {}
