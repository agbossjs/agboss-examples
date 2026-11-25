import { Float, Enum, Text } from "@agboss/core/dto";

export class SupportAnswerDto {
  @Enum(["approved", "escalated", "denied"], {
    prompt: "Final support decision on the refund request",
  })
  decision!: "approved" | "escalated" | "denied";

  @Text({ prompt: "Order ID referenced in the decision" })
  orderId!: string;

  @Float({ prompt: "Approved refund amount in USD (0 when escalated or denied)", min: 0 })
  refundedUsd!: number;

  @Text({ prompt: "Customer-facing explanation citing [policy]" })
  explanation!: string;
}
