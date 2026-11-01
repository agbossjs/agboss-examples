import { Flag, Text } from "@agboss/core/dto";

/** The compliance review of the supplier (sanctions, data protection, the purchasing policy). */
export class ComplianceReviewDto {
  @Text({ prompt: "the policy clause the review rests on, e.g. 'PP-4.1 vendor vetting'; empty if none" })
  clause!: string;

  @Flag({ prompt: "whether the supplier complies" })
  isCompliant!: boolean;

  @Text({ prompt: "what the review found, one or two sentences" })
  findings!: string;
}
