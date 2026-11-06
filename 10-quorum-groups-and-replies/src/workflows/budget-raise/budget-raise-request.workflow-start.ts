import { WorkflowStart } from "@agboss/core";
import { BudgetRaiseRequestDto } from "../../dto/budget-raise-request.dto.js";

@WorkflowStart({
  name: "budget-raise-request-workflow-start",
  description: "A request to raise a budget line",
  input: BudgetRaiseRequestDto,
})
export class BudgetRaiseRequestWorkflowStart {}
