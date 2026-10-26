import { Budget, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({
  name: "cluster-execution-budget",
  scope: BudgetScope.Execution,
})
export class ClusterExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(2);
  }
}
