import {
  Action,
  ExecutionContext,
  IdempotencyKeyConflictError,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { DispositionRequestDto } from "../dto/disposition-request.dto.js";
import { MovementDto } from "../dto/movement.dto.js";
import { PaymentOperations } from "../payments/payment-operations.js";
import { OrderBookRepository } from "../repositories/order-book.repository.js";
import { OrderBookService } from "../services/order-book.service.js";

/** Whether an error, or one of its causes, is the business key's conflict. */
function isConflict(error: unknown): boolean {
  for (let at: unknown = error; at instanceof Error; at = at.cause)
    if (at instanceof IdempotencyKeyConflictError) return true;
  return false;
}

/**
 * The customer cancels: void the authorization. When fulfilment already settled it — the void is
 * the other fingerprint of `disposition:<charge>`, `IdempotencyKeyConflictError` — the order takes
 * the other route: refund what was captured (PS20).
 */
@Action({
  name: "cancel-order-action",
  description: "Voids the order's authorization, or refunds it once it was captured",
  input: { disposition: DispositionRequestDto },
  output: MovementDto,
  deps: [ExecutionContext, PaymentOperations, OrderBookService, OrderBookRepository],
})
export class CancelOrderAction implements ActionHandler<CancelOrderAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly paymentOperations: PaymentOperations,
    private readonly orderBookService: OrderBookService,
    private readonly orderBookRepository: OrderBookRepository,
  ) {}

  async execute(input: InputOf<CancelOrderAction>): Promise<OutputOf<CancelOrderAction>> {
    const { orderId, chargeId, amountCents } = input.disposition.value;
    // the charge id is the caller's word: it moves only the order's own charge, by the shop's books
    this.orderBookService.assertOrdersCharge(orderId, chargeId);
    try {
      const voided = await this.paymentOperations.void(this.executionContext, chargeId);
      // cancelled: the shop believes the gateway holds nothing for the order
      await this.orderBookService.once(this.executionContext, "book-void", `void:${chargeId}`, (database) =>
        this.orderBookRepository.bookState(database, this.orderBookService.tenantId, orderId, "cancelled", 0) ?? { cancelled: orderId },
      );
      return { orderId, movementId: voided.id, kind: "void", amountCents: 0 };
    } catch (error) {
      if (!isConflict(error)) throw error;
      const refunded = await this.paymentOperations.refund(this.executionContext, {
        chargeId,
        amountCents,
        refundNumber: 1,
      });
      await this.orderBookService.book(this.executionContext, "book-refund", `refund:${chargeId}:1`, orderId, {
        status: "refunded",
        heldDeltaCents: -amountCents,
      });
      return { orderId, movementId: refunded.id, kind: "refund", amountCents };
    }
  }
}
