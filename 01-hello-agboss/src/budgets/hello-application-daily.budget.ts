import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({
  name: "hello-application-daily-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class HelloApplicationDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(5);
  }
}
