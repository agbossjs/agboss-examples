import { Integer, Text } from "@agboss/core/dto";

/** A charge as the gateway answered it: what the undo refunds and the operator works on. */
export class PaymentDto {
  @Text({ prompt: "the order's id" })
  orderId!: string;

  @Text({ prompt: "the gateway's charge id" })
  chargeId!: string;

  @Integer({ prompt: "the amount charged, in cents" })
  amountCents!: number;

  @Integer({ prompt: "what the undo refunds: the amount less the restocking fee, in cents" })
  refundableCents!: number;

  @Text({ prompt: "the charge's status at the gateway" })
  status!: string;
}
