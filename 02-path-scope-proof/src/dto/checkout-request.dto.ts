import { Integer, Text } from "@agboss/core/dto";

export class CheckoutRequestDto {
  @Text({ prompt: "Order identifier" })
  orderId!: string;

  @Text({ prompt: "Customer tier (vip or standard)" })
  tier!: string;

  @Integer({ prompt: "Subtotal in cents" })
  subtotalCents!: number;
}
