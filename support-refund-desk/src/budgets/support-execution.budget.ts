import { Budget, BudgetScope, type BudgetHandler } from "agboss";
import { usd, type Usd } from "agboss/units";

@Budget({
  name: "support-execution-budget",
  scope: BudgetScope.Execution,
})
export class SupportExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(1);
  }
}
