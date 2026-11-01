import { Decimal, Integer, Text } from "@agboss/core/dto";

/** A credit application as the bank receives it: who, how much, the numbers a decision reads. */
export class CreditApplicationDto {
  @Text({ prompt: "the applicant's name" })
  applicantName!: string;

  @Integer({ prompt: "the credit asked for, in whole US dollars", min: 1 })
  amountUsd!: number;

  @Integer({ prompt: "the applicant's credit score, 300 to 850", min: 300, max: 850 })
  creditScore!: number;

  @Decimal({ prompt: "monthly debt payments over monthly income, 0 to 1", min: 0, max: 1 })
  debtToIncome!: number;

  @Text({ prompt: "what the credit is for, in the applicant's words" })
  purpose!: string;
}
