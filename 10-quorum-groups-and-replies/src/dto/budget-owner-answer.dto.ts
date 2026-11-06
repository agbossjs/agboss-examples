import { Integer } from "@agboss/core/dto";

/** The budget owner's answer: the most the line may be raised by. */
export class BudgetOwnerAnswerDto {
  @Integer({ prompt: "the most the line may be raised by, in whole US dollars (0: not at all)", min: 0 })
  limitUsd!: number;
}
