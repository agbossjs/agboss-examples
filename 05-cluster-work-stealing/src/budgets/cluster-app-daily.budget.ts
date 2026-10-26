import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({
  name: "cluster-app-daily-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class ClusterAppDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(100);
  }
}
