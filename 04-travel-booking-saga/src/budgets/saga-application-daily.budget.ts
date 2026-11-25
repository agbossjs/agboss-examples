import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

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
