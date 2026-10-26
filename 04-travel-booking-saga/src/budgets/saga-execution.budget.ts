import { Budget, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({
  name: "saga-execution-budget",
  scope: BudgetScope.Execution,
})
export class SagaExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.5);
  }
}
