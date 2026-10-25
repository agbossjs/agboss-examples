import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "agboss";
import { usd, type Usd } from "agboss/units";

@Budget({
  name: "support-app-daily-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class SupportAppDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(50);
  }
}
