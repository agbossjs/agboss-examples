import { Budget, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

@Budget({
  name: "catalog-execution-budget",
  scope: BudgetScope.Execution,
})
export class CatalogExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.5);
  }
}
