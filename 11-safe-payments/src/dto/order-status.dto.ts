import { Integer, Text } from "@agboss/core/dto";

/** What the shop's books say about an order after an event. */
export class OrderStatusDto {
  @Text({ prompt: "the order's id" })
  orderId!: string;

  @Text({ prompt: "its status in the shop's books" })
  status!: string;

  @Integer({ prompt: "what the shop believes the gateway holds for it, in cents" })
  heldCents!: number;
}
