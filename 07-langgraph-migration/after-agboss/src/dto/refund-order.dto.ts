import { Integer, Text } from "agboss/dto";

export class RefundOrderDto {
  @Text({ prompt: "The order to refund" })
  orderId!: string;

  @Integer({ prompt: "The amount in cents", min: 1 })
  amountCents!: number;
}
