import { Budget, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

/** One purchase: four reviews, their arbiters, the order and its reply — a few cents at most. */
@Budget({
  name: "purchase-execution-budget",
  scope: BudgetScope.Execution,
})
export class PurchaseExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.05);
  }
}
