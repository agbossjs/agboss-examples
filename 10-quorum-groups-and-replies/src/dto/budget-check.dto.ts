import { Integer, Text } from "@agboss/core/dto";

/** The purchase against the team's budget. */
export class BudgetCheckDto {
  @Text({ prompt: "the budget line charged, e.g. 'OPEX-IT-2026'; empty if none" })
  budgetLine!: string;

  /** Negative when the line cannot carry it: the threshold arbiter checks this number, in code. */
  @Integer({ prompt: "what is left on the line after this purchase (negative if it does not fit), in whole US dollars" })
  remainingUsd!: number;

  @Text({ prompt: "what the check found, one or two sentences" })
  findings!: string;
}
