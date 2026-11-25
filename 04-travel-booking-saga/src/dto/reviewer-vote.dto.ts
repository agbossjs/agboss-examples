import { Bool, Integer, Text } from "@agboss/core/dto";

export class ReviewerVoteDto {
  @Text({ prompt: "Reviewer department (finance | compliance | risk)" })
  department!: string;

  @Bool({ prompt: "Whether the reviewer approves the travel booking" })
  approved!: boolean;

  @Integer({ prompt: "Confidence score from 0 to 100", min: 0, max: 100 })
  confidenceScore!: number;

  @Text({ prompt: "Justification note" })
  rationale!: string;
}
