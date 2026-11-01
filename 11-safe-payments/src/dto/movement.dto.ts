import { Integer, Text } from "@agboss/core/dto";

/** A capture, a refund or a void as the gateway answered it. */
export class MovementDto {
  @Text({ prompt: "the order's id" })
  orderId!: string;

  @Text({ prompt: "the gateway's id of the movement" })
  movementId!: string;

  @Text({ prompt: "what moved: capture, refund or void" })
  kind!: string;

  @Integer({ prompt: "the amount, in cents" })
  amountCents!: number;
}
