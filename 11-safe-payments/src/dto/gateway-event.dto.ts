import { Integer, Text } from "@agboss/core/dto";

/** A webhook event of the stub gateway, its signature already checked by the receiver. */
export class GatewayEventDto {
  @Text({ prompt: "the gateway's event id" })
  eventId!: string;

  @Text({ prompt: "charge.authorized, charge.succeeded or refund.succeeded" })
  type!: string;

  @Text({ prompt: "the charge the event is about" })
  chargeId!: string;

  @Text({ prompt: "our reference: the order's id" })
  reference!: string;

  @Integer({ prompt: "when the gateway made the event, ms since the epoch" })
  created!: number;
}
