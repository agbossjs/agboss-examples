import {
  ExecutionContext,
  Injectable,
  SqliteFencedEffectRepository,
  TenantContext,
  fencedEffectKeyOf,
} from "@agboss/core";
import { BooksRepository } from "../repositories/books.repository.js";

/** A refund or a capture named a payment that is not the order's: refused before anything is sent. */
export class PaymentOwnershipError extends Error {
  static readonly code = "payments.not-the-orders-payment";

  constructor(readonly orderId: string) {
    super(`the payment named is not order ${orderId}'s: nothing was refunded or captured`);
    this.name = "PaymentOwnershipError";
  }
}

/**
 * The shop's record of which order each gateway payment belongs to — written when the charge
 * completes, read before every refund and capture. A payment id comes from a caller (an operator's
 * form, a customer's request): it moves money only when the shop's own books tie it to that order
 * and that tenant, never on the caller's word (an IDOR otherwise).
 */
@Injectable({ deps: [SqliteFencedEffectRepository, BooksRepository, TenantContext] })
export class PaymentBooksService {
  constructor(
    private readonly sqliteFencedEffectRepository: SqliteFencedEffectRepository,
    private readonly booksRepository: BooksRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  /** Books the order's payment, once (a fenced effect under `payment:<id>`). */
  async book(executionContext: ExecutionContext, orderId: string, paymentId: string): Promise<void> {
    const key = fencedEffectKeyOf(executionContext, "book-payment", { businessKey: `payment:${paymentId}` });
    const { tenantId } = this.tenantContext;
    await this.sqliteFencedEffectRepository.saveResultIfAbsent(key, (database) =>
      this.booksRepository.bookPayment(database, { paymentId, orderId, tenantId }),
    );
  }

  /** Throws `PaymentOwnershipError` unless the payment is this tenant's order's. */
  assertOrdersPayment(orderId: string, paymentId: string): void {
    if (!this.booksRepository.isOrdersPayment(paymentId, orderId, this.tenantContext.tenantId))
      throw new PaymentOwnershipError(orderId);
  }
}
