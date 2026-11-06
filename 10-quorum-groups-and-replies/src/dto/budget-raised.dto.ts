import { Integer, Text } from "@agboss/core/dto";

/** A budget line raised: by how much, within the owner's limit. */
export class BudgetRaisedDto {
  @Text({ prompt: "the budget line" })
  budgetLine!: string;

  @Integer({ prompt: "how much it was raised by, in whole US dollars", min: 1 })
  amountUsd!: number;

  @Integer({ prompt: "the owner's limit, in whole US dollars", min: 0 })
  limitUsd!: number;
}
