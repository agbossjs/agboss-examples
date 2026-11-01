import { Integer, Text } from "@agboss/core/dto";

/** A payment as the gateway answered it. */
export class PaymentDto {
  @Text({ prompt: "the order's id" })
  orderId!: string;

  @Text({ prompt: "the gateway's payment id" })
  paymentId!: string;

  @Integer({ prompt: "the amount, in cents" })
  amountCents!: number;
}
