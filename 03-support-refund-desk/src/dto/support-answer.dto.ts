import { Decimal, OneOf, Text } from "agboss/dto";

export class SupportAnswerDto {
  @OneOf({
    values: ["approved", "escalated", "denied"],
    prompt: "Final support decision on the refund request",
  })
  decision!: "approved" | "escalated" | "denied";

  @Text({ prompt: "Order ID referenced in the decision" })
  orderId!: string;

  @Decimal({ prompt: "Approved refund amount in USD (0 when escalated or denied)", min: 0 })
  refundedUsd!: number;

  @Text({ prompt: "Customer-facing explanation citing [policy]" })
  explanation!: string;
}
