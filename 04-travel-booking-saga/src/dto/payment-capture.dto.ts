import { Decimal, Text } from "@agboss/core/dto";

export class PaymentCaptureDto {
  @Text({ prompt: "Payment transaction ID" })
  paymentTransactionId!: string;

  @Decimal({ prompt: "Captured amount in USD", min: 0 })
  capturedAmountUsd!: number;
}
