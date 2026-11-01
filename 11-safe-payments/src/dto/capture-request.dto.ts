import { Integer, Text } from "@agboss/core/dto";

/** Capture shipment `shipment` of an authorization (PS18). */
export class CaptureRequestDto {
  @Text({ prompt: "the order's id" })
  orderId!: string;

  @Text({ prompt: "the authorization's charge id" })
  chargeId!: string;

  @Integer({ prompt: "which shipment of the order, from 1", min: 1 })
  shipment!: number;

  @Integer({ prompt: "the shipment's amount, in cents", min: 1 })
  amountCents!: number;
}
