import { Integer, Text } from "@agboss/core/dto";

/** The analyst's memo on an application (and each rewrite of it): what the risk officer reviews. */
export class CreditMemoDto {
  @Text({ prompt: "the memo: the applicant, the risk and the recommendation, a few sentences" })
  text!: string;

  @Integer({ prompt: "the credit limit the memo recommends, in whole US dollars", min: 0 })
  recommendedLimitUsd!: number;
}
