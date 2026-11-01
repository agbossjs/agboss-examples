import { Integer, Text } from "@agboss/core/dto";

/** The n-th refund of a payment, whoever asks (an operator, the customer). */
export class RefundRequestDto {
  @Text({ prompt: "the order's id" })
  orderId!: string;

  @Text({ prompt: "the gateway's payment id" })
  paymentId!: string;

  @Integer({ prompt: "the amount, in cents", min: 1 })
  amountCents!: number;

  @Integer({ prompt: "which refund of the payment, from 1", min: 1 })
  refundNumber!: number;
}
