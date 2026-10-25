import { Budget, BudgetScope, type BudgetHandler } from "agboss";
import { usd, type Usd } from "agboss/units";

@Budget({
  name: "suite-exec-budget",
  scope: BudgetScope.Execution,
})
export class SuiteExecBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(5);
  }
}
