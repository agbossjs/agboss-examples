import { Budget, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({
  name: "support-execution-budget",
  scope: BudgetScope.Execution,
})
export class SupportExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.2);
  }
}
