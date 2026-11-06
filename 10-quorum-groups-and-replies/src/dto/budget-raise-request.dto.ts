import { Integer, Text } from "@agboss/core/dto";

/** A request to raise a budget line, as its budget owner is asked about it. */
export class BudgetRaiseRequestDto {
  @Text({ prompt: "the budget line to raise" })
  budgetLine!: string;

  @Integer({ prompt: "how much more it needs, in whole US dollars", min: 1 })
  amountUsd!: number;

  @Text({ prompt: "who asks for it" })
  requester!: string;
}
