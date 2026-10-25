import { Integer, Text } from "agboss/dto";

export class CartRequestDto {
  @Text({ prompt: "Cart ID" })
  cartId!: string;

  @Integer({ prompt: "Base subtotal in cents" })
  baseCents!: number;
}
