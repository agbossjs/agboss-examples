import { Budget, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

/** A browsing turn: a few small model calls — a fraction of a cent. */
@Budget({ name: "browser-execution-budget", scope: BudgetScope.Execution })
export class BrowserExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.01);
  }
}
