import {
  Budget,
  BudgetPeriod,
  BudgetScope,
  type BudgetHandler,
} from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({
  name: "scaling-tenant-daily-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class ScalingTenantDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(20);
  }
}
