import { Integer, Text } from "@agboss/core/dto";

/** An application the review loop could not settle, handed to the credit committee. */
export class CommitteeEscalationDto {
  @Text({ prompt: "the applicant's name" })
  applicantName!: string;

  @Text({ prompt: "the last memo the editor wrote" })
  lastMemo!: string;

  @Text({ prompt: "the risk officer's last open request" })
  openRequest!: string;

  @Integer({ prompt: "the credit limit of the last memo, in whole US dollars", min: 0 })
  recommendedLimitUsd!: number;
}
