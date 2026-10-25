import { Decimal, Text } from "agboss/dto";

export class RefundReceiptDto {
  @Text({ prompt: "Refund receipt ID" })
  refundId!: string;

  @Text({ prompt: "Refunded order ID" })
  orderId!: string;

  @Decimal({ prompt: "Refunded amount in USD", min: 0 })
  refundedUsd!: number;

  @Text({ prompt: "Status of the refund operation" })
  status!: string;
}
