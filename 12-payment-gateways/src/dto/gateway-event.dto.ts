import { Integer, Text } from "@agboss/core/dto";

/** A gateway's webhook event, its signature checked by the receiver. */
export class GatewayEventDto {
  @Text({ prompt: "the event's own id at the gateway" })
  eventId!: string;

  @Text({ prompt: "what happened: REFUND, CAPTURE, …" })
  eventCode!: string;

  @Text({ prompt: "the gateway's payment the event is about" })
  paymentId!: string;

  @Text({ prompt: "our reference: the order's id" })
  orderId!: string;

  @Integer({ prompt: "the amount, in cents" })
  amountCents!: number;
}
