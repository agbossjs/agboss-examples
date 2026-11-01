import { Budget, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({ name: "payments-execution-budget", scope: BudgetScope.Execution })
export class PaymentsExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.01);
  }
}
