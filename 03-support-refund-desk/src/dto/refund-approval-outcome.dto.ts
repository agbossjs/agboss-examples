import { Text } from "@agboss/core/dto";

/** How a refund approval ended. */
export class RefundApprovalOutcomeDto {
  @Text({ prompt: "Order the approval was about" })
  orderId!: string;

  @Text({ prompt: "refunded or declined" })
  status!: string;

  @Text({ prompt: "Who decided: the approver, or the senior approver the pause was escalated to" })
  decidedBy!: string;

  @Text({ prompt: "Refund receipt, when refunded", optional: true })
  refundId?: string;
}
