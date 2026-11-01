import { Integer, Text } from "@agboss/core/dto";

/** One part of a split order, drawn on the customer's wallet and charged (PS9). */
export class WalletDrawDto {
  @Text({ prompt: "the customer's wallet" })
  walletId!: string;

  @Text({ prompt: "the part's order id" })
  orderId!: string;

  @Integer({ prompt: "the part's amount, in cents", min: 1 })
  amountCents!: number;
}
