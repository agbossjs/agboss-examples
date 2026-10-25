import { Budget, BudgetPeriod, BudgetScope, type BudgetHandler } from "agboss";
import { usd, type Usd } from "agboss/units";

@Budget({
  name: "support-tenant-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class SupportTenantBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(2);
  }
}
