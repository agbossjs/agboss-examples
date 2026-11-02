import {
  Budget,
  BudgetPeriod,
  BudgetScope,
  type BudgetHandler,
} from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({
  name: "scaling-app-daily-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class ScalingAppDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(100);
  }
}
