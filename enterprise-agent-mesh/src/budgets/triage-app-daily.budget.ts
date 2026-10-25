import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "agboss";
import { usd, type Usd } from "agboss/units";

@Budget({
  name: "triage-app-daily-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class TriageAppDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(50);
  }
}
