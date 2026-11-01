import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { BudgetCheckDto } from "../dto/budget-check.dto.js";
import { PriceBenchmarkDto } from "../dto/price-benchmark.dto.js";
import { PurchaseDeferredDto } from "../dto/purchase-deferred.dto.js";
import { PurchaseRequestDto } from "../dto/purchase-request.dto.js";

/**
 * Group 2's path (code, no model): the commercial reviews counted, the legal and compliance ones did
 * not — the purchase waits, with what the commercial side found.
 */
@Action({
  name: "defer-purchase-action",
  description: "Puts the purchase off until its legal and compliance reviews are in order",
  input: {
    request: PurchaseRequestDto,
    price: PriceBenchmarkDto,
    budget: BudgetCheckDto,
  },
  output: PurchaseDeferredDto,
})
export class DeferPurchaseAction implements ActionHandler<DeferPurchaseAction> {
  execute(input: InputOf<DeferPurchaseAction>): Promise<OutputOf<DeferPurchaseAction>> {
    return Promise.resolve({
      supplier: input.request.value.supplier,
      reason: "the legal and compliance reviews did not both count: the order waits for them",
      benchmarkUsd: input.price.value.benchmarkUsd,
      budgetLine: input.budget.value.budgetLine,
    });
  }
}
