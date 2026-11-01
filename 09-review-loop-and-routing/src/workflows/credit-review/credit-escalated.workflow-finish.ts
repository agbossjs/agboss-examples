import { WorkflowFinish } from "@agboss/core";
import { CommitteeEscalationDto } from "../../dto/committee-escalation.dto.js";

/** Where an application ends when the review loop runs out of rewrites: handed to the committee. */
@WorkflowFinish({
  name: "credit-escalated-workflow-finish",
  description: "The review loop could not settle the memo: the credit committee decides",
  output: CommitteeEscalationDto,
})
export class CreditEscalatedWorkflowFinish {}
