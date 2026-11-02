import { Budget, BudgetScope, type BudgetHandler } from "@agboss/core";
import { usd, type Usd } from "@agboss/core/units";

/** One question: a retrieval, one reranking and one answer — a fraction of a cent. */
@Budget({ name: "handbook-execution-budget", scope: BudgetScope.Execution })
export class HandbookExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.01);
  }
}
