import { Bool, Integer, Text } from "@agboss/core/dto";

/** An order to pay for, and whether the carrier refuses it (the undo refunds it). */
export class CheckoutRequestDto {
  @Text({ prompt: "the order's id" })
  orderId!: string;

  @Integer({ prompt: "the amount, in cents", min: 1 })
  amountCents!: number;

  @Bool({ prompt: "authorize only (false) or capture now (true)", default: true })
  capture!: boolean;

  @Bool({ prompt: "whether the carrier refuses the order", default: false })
  failShipping!: boolean;
}
