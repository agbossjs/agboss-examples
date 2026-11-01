import { Integer, Text } from "@agboss/core/dto";

/** Settle (capture all) or cancel (void) an authorization: its one disposition (PS20). */
export class DispositionRequestDto {
  @Text({ prompt: "the order's id" })
  orderId!: string;

  @Text({ prompt: "the authorization's charge id" })
  chargeId!: string;

  @Integer({ prompt: "the authorized amount, in cents", min: 1 })
  amountCents!: number;
}
