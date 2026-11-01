import { Integer, Text } from "@agboss/core/dto";

/** A refund of a payment, from one of the paths that refund it (PS19). */
export class RefundRequestDto {
  @Text({ prompt: "the order's id" })
  orderId!: string;

  @Text({ prompt: "the payment's charge id" })
  chargeId!: string;

  @Integer({ prompt: "the amount to refund, in cents", min: 1 })
  amountCents!: number;

  @Integer({ prompt: "which refund of this payment, from 1 (the shop's own numbering)", min: 1 })
  refundNumber!: number;

  @Text({ prompt: "who asks: operator or customer" })
  path!: string;
}
