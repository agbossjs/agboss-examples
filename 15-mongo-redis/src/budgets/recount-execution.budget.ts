import { Budget, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

/** Nothing here calls a model: every step is code, every execution spends $0. */
@Budget({ name: "recount-execution-budget", scope: BudgetScope.Execution })
export class RecountExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(1);
  }
}
