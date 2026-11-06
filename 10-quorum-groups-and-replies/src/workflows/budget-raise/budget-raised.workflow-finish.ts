import { WorkflowFinish } from "@agboss/core";
import { BudgetRaisedDto } from "../../dto/budget-raised.dto.js";

/** The owner's limit covered the request: the line is raised. */
@WorkflowFinish({
  name: "budget-raised-workflow-finish",
  description: "The budget line is raised within its owner's limit",
  output: BudgetRaisedDto,
})
export class BudgetRaisedWorkflowFinish {}
