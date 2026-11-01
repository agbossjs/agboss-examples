import { Integer, Text } from "@agboss/core/dto";

/** One shipment of an authorization, captured. */
export class CaptureRequestDto {
  @Text({ prompt: "the order's id" })
  orderId!: string;

  @Text({ prompt: "the gateway's payment id" })
  paymentId!: string;

  @Integer({ prompt: "which shipment, from 1", min: 1 })
  shipment!: number;

  @Integer({ prompt: "the shipment's amount, in cents", min: 1 })
  amountCents!: number;
}
