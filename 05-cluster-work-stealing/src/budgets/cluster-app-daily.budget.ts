import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "agboss";
import { usd, type Usd } from "agboss/units";

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
