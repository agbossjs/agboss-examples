import { Text } from "@agboss/core/dto";

export class OrderLookupInputDto {
  @Text({ prompt: "Order ID to look up (e.g. ORD-1001)" })
  orderId!: string;

  @Text({ prompt: "Customer email address associated with the order" })
  customerEmail!: string;
}
