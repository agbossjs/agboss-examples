import { Budget, BudgetScope, type BudgetHandler } from "agboss";
import { usd, type Usd } from "agboss/units";

@Budget({
  name: "triage-execution-budget",
  scope: BudgetScope.Execution,
})
export class TriageExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(1);
  }
}
