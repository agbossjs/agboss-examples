import { Bool, Integer, Text } from "@agboss/core/dto";

/** An order to pay for: what the customer buys, how, and whether shipping fails (the saga, PS10). */
export class CheckoutRequestDto {
  @Text({ prompt: "the order's id" })
  orderId!: string;

  @Integer({ prompt: "the amount, in cents", min: 1 })
  amountCents!: number;

  @Text({ prompt: "the payment method: card_ok, card_3ds or card_declined", default: "card_ok" })
  paymentMethod!: string;

  @Bool({ prompt: "capture now (true) or authorize only (false)", default: true })
  capture!: boolean;

  @Bool({ prompt: "whether the carrier refuses the order (the saga's undo runs)", default: false })
  failShipping!: boolean;

  @Integer({ prompt: "what the shop keeps when the order is undone (a restocking fee), in cents", default: 0, min: 0 })
  restockingFeeCents!: number;
}
