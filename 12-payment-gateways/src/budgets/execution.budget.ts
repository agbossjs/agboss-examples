import { Budget, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({ name: "gateways-execution-budget", scope: BudgetScope.Execution })
export class GatewaysExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.01);
  }
}
