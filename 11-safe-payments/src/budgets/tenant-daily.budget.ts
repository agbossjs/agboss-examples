import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({ name: "payments-tenant-daily-budget", scope: BudgetScope.Tenant, period: BudgetPeriod.Day })
export class PaymentsTenantDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(1);
  }
}
