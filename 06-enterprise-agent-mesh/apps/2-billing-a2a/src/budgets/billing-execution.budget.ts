import { Budget, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({
  name: "billing-execution-budget",
  scope: BudgetScope.Execution,
})
export class BillingExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.5);
  }
}
