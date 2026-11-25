import { Float, Text } from "@agboss/core/dto";

export class PaymentCaptureDto {
  @Text({ prompt: "Payment transaction ID" })
  paymentTransactionId!: string;

  @Float({ prompt: "Captured amount in USD", min: 0 })
  capturedAmountUsd!: number;
}
