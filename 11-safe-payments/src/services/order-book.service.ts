import { Idempotency, Injectable, TenantContext, type JsonValue } from "@agboss/core";
import { hours } from "@agboss/core/units";
import { OrderBookRepository, type OrderChange, type OrderRow } from "../repositories/order-book.repository.js";

/**
 * The shop's bookings, each an `Idempotency.runOnce` (#500) under a business key (#508): the row written once
 * per key, in the effect's transaction, refused for a holder that lost its lease. The same for the
 * right and the wrong versions — what differs between them is how the money moves, not the books.
 */
/** A refund, capture, settle or cancel named a charge that is not the order's: refused, nothing sent. */
export class ChargeOwnershipError extends Error {
  static readonly code = "payments.not-the-orders-charge";

  constructor(readonly orderId: string) {
    super(`the charge named is not order ${orderId}'s: nothing was moved`);
    this.name = "ChargeOwnershipError";
  }
}

/** What an effect under a business key says about itself: what it does (its fingerprint), or on purpose nothing. */
export type BookingIdentity<F> =
  | { readonly businessKey: string; readonly fingerprint: JsonValue<F>; readonly withoutFingerprint?: never }
  | { readonly businessKey: string; readonly withoutFingerprint: true; readonly fingerprint?: never };

@Injectable({ deps: [Idempotency, OrderBookRepository, TenantContext] })
export class OrderBookService {
  constructor(
    private readonly idempotency: Idempotency,
    private readonly orderBookRepository: OrderBookRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  /**
   * Throws `ChargeOwnershipError` unless `chargeId` is the charge the shop booked for this tenant's
   * order. A charge id comes from a caller (an operator's form, a customer's request, a webhook): it
   * moves money only when the shop's own books tie it to the order — never on the caller's word.
   */
  assertOrdersCharge(orderId: string, chargeId: string): void {
    if (!this.orderBookRepository.isOrdersCharge(this.tenantContext.tenantId, orderId, chargeId))
      throw new ChargeOwnershipError(orderId);
  }

  /** Books `change` for `orderId` once per `businessKey` (the second call gets the first row). */
  async book(name: string, businessKey: string, orderId: string, change: OrderChange): Promise<OrderRow> {
    // agbossjs/agboss#825: what the booking does is its fingerprint — another change under the key is a conflict
    return this.once(name, { businessKey, fingerprint: { orderId, change } }, () =>
      this.orderBookRepository.book(this.tenantContext.tenantId, businessKey, orderId, change),
    );
  }

  /** The tenant the current execution runs for: every row it writes or reads is that tenant's. */
  get tenantId(): string {
    return this.tenantContext.tenantId;
  }

  /** The current tenant's order row. */
  order(orderId: string) {
    return this.orderBookRepository.order(this.tenantContext.tenantId, orderId);
  }

  /**
   * Runs `work` once per business key, in the `runOnce` transaction — the key says what the work does
   * (agbossjs/agboss#825): its `fingerprint`, or `withoutFingerprint` on purpose. `work` writes only through
   * the repository's `requireTransaction()`.
   */
  async once<T, F = never>(
    name: string,
    identity: BookingIdentity<F>,
    work: () => (T & JsonValue<T>) | Promise<T & JsonValue<T>>,
  ): Promise<T> {
    const { result } =
      identity.withoutFingerprint === true
        ? await this.idempotency.runOnce({ name, key: identity.businessKey, withoutFingerprint: true, ttl: hours(48), execute: work })
        : await this.idempotency.runOnce<T, F>({ name, key: identity.businessKey, fingerprint: identity.fingerprint, ttl: hours(48), execute: work });
    return result;
  }
}
