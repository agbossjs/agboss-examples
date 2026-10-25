import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "agboss";
import { usd, type Usd } from "agboss/units";

@Budget({
  name: "hello-tenant-daily-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class HelloTenantDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(2);
  }
}
