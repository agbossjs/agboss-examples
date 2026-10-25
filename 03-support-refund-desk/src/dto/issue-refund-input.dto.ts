import { Decimal, Text } from "agboss/dto";

export class IssueRefundInputDto {
  @Text({ prompt: "Order ID to refund" })
  orderId!: string;

  @Text({ prompt: "Customer email receiving the refund confirmation" })
  customerEmail!: string;

  @Decimal({ prompt: "Refund amount in USD", min: 0 })
  amountUsd!: number;

  @Text({ prompt: "Reason for issuing the refund" })
  reason!: string;
}
