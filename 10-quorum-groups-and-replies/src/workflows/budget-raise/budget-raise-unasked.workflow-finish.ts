import { WorkflowFinish } from "@agboss/core";
import { BudgetRaiseRequestDto } from "../../dto/budget-raise-request.dto.js";

/** The owner could not be asked (the channel failed): the request is handed back as it was. */
@WorkflowFinish({
  name: "budget-raise-unasked-workflow-finish",
  description: "The budget owner could not be asked; the request is handed back",
  output: BudgetRaiseRequestDto,
})
export class BudgetRaiseUnaskedWorkflowFinish {}
