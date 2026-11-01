import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

/** No model is called anywhere in this example: the budgets are the framework's required floor. */
@Budget({ name: "gateways-application-daily-budget", scope: BudgetScope.Application, period: BudgetPeriod.Day })
export class GatewaysApplicationDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(1);
  }
}
