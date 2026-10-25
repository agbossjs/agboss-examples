import { Budget, BudgetScope, type BudgetHandler } from "agboss";
import { usd, type Usd } from "agboss/units";

@Budget({
  name: "cluster-execution-budget",
  scope: BudgetScope.Execution,
})
export class ClusterExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(2);
  }
}
