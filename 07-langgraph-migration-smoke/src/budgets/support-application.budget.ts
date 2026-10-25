import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "agboss";
import { usd, type Usd } from "agboss/units";

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
