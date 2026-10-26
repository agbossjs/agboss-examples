import { Integer, Text } from "@agboss/core/dto";

export class CartRequestDto {
  @Text({ prompt: "Cart ID" })
  cartId!: string;

  @Integer({ prompt: "Base subtotal in cents" })
  baseCents!: number;
}
