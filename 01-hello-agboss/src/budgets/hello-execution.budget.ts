import { Budget, BudgetScope, type BudgetHandler } from "agboss";
import { usd, type Usd } from "agboss/units";

@Budget({
  name: "hello-execution-budget",
  scope: BudgetScope.Execution,
})
export class HelloExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.5);
  }
}
