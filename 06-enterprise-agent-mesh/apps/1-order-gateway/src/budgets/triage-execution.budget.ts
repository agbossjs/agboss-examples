import { Budget, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({
  name: "triage-execution-budget",
  scope: BudgetScope.Execution,
})
export class TriageExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(1);
  }
}
