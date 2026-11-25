import { Bool, Text } from "@agboss/core/dto";

/** What an approver answers. */
export class RefundApprovalDecisionDto {
  @Bool({ prompt: "Whether the refund goes ahead" })
  approved!: boolean;

  @Text({ prompt: "A note for the audit trail", optional: true })
  comment?: string;
}
