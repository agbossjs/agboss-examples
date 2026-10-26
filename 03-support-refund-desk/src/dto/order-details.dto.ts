import { Decimal, Flag, Integer, Text } from "@agboss/core/dto";

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
