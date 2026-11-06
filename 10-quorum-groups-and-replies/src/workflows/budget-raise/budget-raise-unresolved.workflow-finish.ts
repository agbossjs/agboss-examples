import { WorkflowFinish } from "@agboss/core";
import { BudgetRaiseRequestDto } from "../../dto/budget-raise-request.dto.js";

/** The owner was asked `maxVisits` times and never covered the request: it goes back unresolved. */
@WorkflowFinish({
  name: "budget-raise-unresolved-workflow-finish",
  description: "The budget owner never covered the request; it is handed back",
  output: BudgetRaiseRequestDto,
})
export class BudgetRaiseUnresolvedWorkflowFinish {}
