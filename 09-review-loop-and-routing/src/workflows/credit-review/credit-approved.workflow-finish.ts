import { WorkflowFinish } from "@agboss/core";
import { CreditMemoDto } from "../../dto/credit-memo.dto.js";

/** Where an application ends when the risk officer approves its memo: the approved memo. */
@WorkflowFinish({
  name: "credit-approved-workflow-finish",
  description: "The application is approved, with its memo",
  output: CreditMemoDto,
})
export class CreditApprovedWorkflowFinish {}
