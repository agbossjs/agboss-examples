import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({
  name: "support-application-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class SupportApplicationBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(10);
  }
}
