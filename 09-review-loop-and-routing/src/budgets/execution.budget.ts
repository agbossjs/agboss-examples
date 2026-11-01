import { Budget, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

/** One application's review: a handful of cheap calls, a few cents at most. */
@Budget({
  name: "credit-review-execution-budget",
  scope: BudgetScope.Execution,
})
export class CreditReviewExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.05);
  }
}
