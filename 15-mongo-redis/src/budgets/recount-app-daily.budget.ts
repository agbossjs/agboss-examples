import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({ name: "recount-app-daily-budget", scope: BudgetScope.Application, period: BudgetPeriod.Day })
export class RecountAppDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(10);
  }
}
