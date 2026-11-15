import { Flag, Text } from "@agboss/core/dto";

/** What an approver answers. */
export class RefundApprovalDecisionDto {
  @Flag({ prompt: "Whether the refund goes ahead" })
  approved!: boolean;

  @Text({ prompt: "A note for the audit trail", optional: true })
  comment?: string;
}
