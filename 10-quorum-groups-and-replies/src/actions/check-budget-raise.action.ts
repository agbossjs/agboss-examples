import { Action, variant, oneOf, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { BudgetOwnerAnswerDto } from "../dto/budget-owner-answer.dto.js";
import { BudgetRaisedDto } from "../dto/budget-raised.dto.js";
import { BudgetRaiseRequestDto } from "../dto/budget-raise-request.dto.js";

/**
 * Code, no model: the owner's limit covers the request — the line is raised; it does not — the
 * request goes back to the owner as it was asked (the question's `maxVisits` bounds the asking).
 */
@Action({
  name: "check-budget-raise-action",
  description: "Raises the line when the owner's limit covers the request, else asks again",
  input: { request: BudgetRaiseRequestDto, answer: BudgetOwnerAnswerDto },
  output: oneOf(BudgetRaisedDto, BudgetRaiseRequestDto),
})
export class CheckBudgetRaiseAction implements ActionHandler<CheckBudgetRaiseAction> {
  execute({ request, answer }: InputOf<CheckBudgetRaiseAction>): Promise<OutputOf<CheckBudgetRaiseAction>> {
    const { budgetLine, amountUsd } = request.value;
    const { limitUsd } = answer.value;
    if (limitUsd >= amountUsd)
      return Promise.resolve(variant(BudgetRaisedDto, { budgetLine, amountUsd, limitUsd }));
    return Promise.resolve(variant(BudgetRaiseRequestDto, request.value));
  }
}
