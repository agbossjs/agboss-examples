import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "agboss";
import { usd, type Usd } from "agboss/units";

@Budget({
  name: "saga-app-daily-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class SagaApplicationDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(50);
  }
}
