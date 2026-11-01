import { Action, ExecutionContext, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { PaymentDto } from "../dto/payment.dto.js";
import { WalletDrawDto } from "../dto/wallet-draw.dto.js";
import { PaymentOperations } from "../payments/payment-operations.js";
import { OrderBookService } from "../services/order-book.service.js";

/** One branch of a split order: draws its part on the wallet and charges it (PS9). */
@Action({
  name: "wallet-charge-action",
  description: "Draws one part of a split order on the customer's wallet and charges it",
  input: { draw: WalletDrawDto },
  output: PaymentDto,
  deps: [ExecutionContext, PaymentOperations, OrderBookService],
})
export class WalletChargeAction implements ActionHandler<WalletChargeAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly paymentOperations: PaymentOperations,
    private readonly orderBookService: OrderBookService,
  ) {}

  async execute(input: InputOf<WalletChargeAction>): Promise<OutputOf<WalletChargeAction>> {
    const { walletId, orderId, amountCents } = input.draw.value;
    const charge = await this.paymentOperations.chargeWallet(this.executionContext, { walletId, orderId, amountCents });
    await this.orderBookService.book(this.executionContext, "book-charge", `order:${orderId}`, orderId, {
      status: "paid",
      chargeId: charge.chargeId,
      heldDeltaCents: amountCents,
    });
    return { orderId, chargeId: charge.chargeId, amountCents, refundableCents: amountCents, status: charge.status };
  }
}
