import { Integer, Text } from "@agboss/core/dto";

/** A purchase put off: the commercial reviews answered, the legal and compliance ones did not. */
export class PurchaseDeferredDto {
  @Text({ prompt: "the supplier" })
  supplier!: string;

  @Text({ prompt: "why the purchase waits" })
  reason!: string;

  @Integer({ prompt: "the market price found, in whole US dollars", min: 0 })
  benchmarkUsd!: number;

  @Text({ prompt: "the budget line it would be charged to" })
  budgetLine!: string;
}
