import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "agboss";
import { usd, type Usd } from "agboss/units";

@Budget({
  name: "suite-app-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class SuiteAppBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(100);
  }
}
