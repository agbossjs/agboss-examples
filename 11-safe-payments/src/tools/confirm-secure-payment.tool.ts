import { Tool, type ToolHandler } from "@agboss/core";
import { ThreeDsOutcomeToolApproval } from "../channels/three-ds-outcome.tool-approval.js";
import { ChargeToolInputDto } from "../dto/charge-tool-input.dto.js";
import { PaymentDto } from "../dto/payment.dto.js";
import { PaymentOperations } from "../payments/payment-operations.js";
import { OrderBookRepository } from "../repositories/order-book.repository.js";
import { OrderBookService } from "../services/order-book.service.js";

/**
 * Confirms the order's 3DS payment once its outcome arrived (the pause, answered once): the charge
 * is the one the shop's books hold for the order, never one a browser's query string names.
 */
@Tool({
  name: "confirm-secure-payment-tool",
  description: "Confirms the order's 3DS payment once the customer completed it",
  input: ChargeToolInputDto,
  output: PaymentDto,
  approval: ThreeDsOutcomeToolApproval,
  deps: [PaymentOperations, OrderBookService, OrderBookRepository],
})
export class ConfirmSecurePaymentTool implements ToolHandler<ChargeToolInputDto, PaymentDto> {
  constructor(
    private readonly paymentOperations: PaymentOperations,
    private readonly orderBookService: OrderBookService,
    private readonly orderBookRepository: OrderBookRepository,
  ) {}

  async execute({ orderId, amountCents }: ChargeToolInputDto): Promise<PaymentDto> {
    const chargeId = this.orderBookService.order(orderId)?.chargeId;
    if (chargeId === undefined || chargeId === null) throw new Error(`order ${orderId} has no payment`);
    const order = { orderId, amountCents, paymentMethod: "card_3ds", capture: true };
    const charge = await this.paymentOperations.confirm(order, chargeId);
    await this.orderBookService.book("book-confirm", `confirm:${chargeId}`, orderId, {
      status: "paid",
      heldDeltaCents: amountCents,
    });
    return { orderId, chargeId, amountCents, refundableCents: amountCents, status: charge.status };
  }
}
