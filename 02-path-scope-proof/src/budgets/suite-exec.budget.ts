import { Budget, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({
  name: "suite-exec-budget",
  scope: BudgetScope.Execution,
})
export class SuiteExecBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(5);
  }
}
