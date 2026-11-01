import { Flag, Text } from "@agboss/core/dto";

/** The legal review of the supplier's contract. */
export class LegalReviewDto {
  @Text({ prompt: "the contract clause the review rests on, e.g. '§7.2 liability cap'; empty if none" })
  clause!: string;

  @Flag({ prompt: "whether the contract is cleared as it is" })
  isCleared!: boolean;

  @Text({ prompt: "what the review found, one or two sentences" })
  findings!: string;
}
