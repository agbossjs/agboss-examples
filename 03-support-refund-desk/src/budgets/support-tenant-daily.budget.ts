import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({
  name: "support-tenant-daily-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class SupportTenantDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(10);
  }
}
