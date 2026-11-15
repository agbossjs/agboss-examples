import { Decimal, Text } from "@agboss/core/dto";

/** A refund above the self-service cap, put to a person. */
export class RefundApprovalAskDto {
  @Text({ prompt: "Order to refund" })
  orderId!: string;

  @Text({ prompt: "Customer email receiving the refund confirmation" })
  customerEmail!: string;

  @Decimal({ prompt: "Refund amount in USD", min: 0 })
  amountUsd!: number;

  @Text({ prompt: "Why the refund is asked for" })
  reason!: string;
}
