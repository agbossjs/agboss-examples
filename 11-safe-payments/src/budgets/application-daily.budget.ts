import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

/** No model is called anywhere in this example: the budgets are the framework's required floor. */
@Budget({ name: "payments-application-daily-budget", scope: BudgetScope.Application, period: BudgetPeriod.Day })
export class PaymentsApplicationDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(1);
  }
}
