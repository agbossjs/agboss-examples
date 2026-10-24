import { ExecutionContext, PiiAction, TenantContext } from "agboss";
import { Decimal, Flag, Integer, OneOf, Text } from "agboss/dto";

export class SupportTenantContext extends TenantContext {
  @Decimal({ min: 0 })
  maxAutoRefundUsd!: number;
}

export class SupportExecutionContext extends ExecutionContext {
  @OneOf({ values: ["en", "es"] })
  locale!: "en" | "es";
}

export class SupportRequestDto {
  @Text({ prompt: "Customer support message" })
  message!: string;

  @Text({
    prompt: "Customer full name (masked everywhere by field-level sensitivity)",
    sensitive: PiiAction.replaceWithToken(),
  })
  customerName!: string;
}

export class OrderLookupInputDto {
  @Text({ prompt: "Order ID to look up (e.g. ORD-1001)" })
  orderId!: string;

  @Text({ prompt: "Customer email address associated with the order" })
  customerEmail!: string;
}

export class OrderDetailsDto {
  @Text({ prompt: "Order ID" })
  orderId!: string;

  @Text({ prompt: "Owning tenant ID" })
  tenantId!: string;

  @Text({ prompt: "Customer email address" })
  customerEmail!: string;

  @Text({ prompt: "Purchased item name" })
  item!: string;

  @Decimal({ prompt: "Order amount in USD", min: 0 })
  amountUsd!: number;

  @Integer({ prompt: "Days elapsed since purchase", min: 0 })
  daysSincePurchase!: number;

  @Flag({ prompt: "Whether the order is within the active 30-day refund window" })
  eligibleByWindow!: boolean;
}

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
