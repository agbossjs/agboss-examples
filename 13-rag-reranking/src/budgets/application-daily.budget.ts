import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({
  name: "handbook-application-daily-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class HandbookApplicationDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(1);
  }
}
