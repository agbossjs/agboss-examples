import {
  ExecutionContext,
  Injectable,
  SqliteFencedEffectRepository,
  TenantContext,
  fencedEffectKeyOf,
  type JsonResult,
} from "@agboss/core";
import type { DatabaseSync } from "node:sqlite";
import { OrderBookRepository, type OrderChange, type OrderRow } from "../repositories/order-book.repository.js";

/**
 * The shop's bookings, each a fenced effect (#500) under a business key (#508): the row written once
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

@Injectable({ deps: [SqliteFencedEffectRepository, OrderBookRepository, TenantContext] })
export class OrderBookService {
  constructor(
    private readonly sqliteFencedEffectRepository: SqliteFencedEffectRepository,
    private readonly orderBookRepository: OrderBookRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  /**
   * Throws `ChargeOwnershipError` unless `chargeId` is the charge the shop booked for this tenant's
   * order. A charge id comes from a caller (an operator's form, a customer's request, a webhook): it
   * moves money only when the shop's own books tie it to the order — never on the caller's word.
   */
  assertOrdersCharge(orderId: string, chargeId: string): void {
    if (!this.orderBookRepository.isOrdersCharge(orderId, chargeId, this.tenantContext.tenantId))
      throw new ChargeOwnershipError(orderId);
  }

  /** Books `change` for `orderId` once per `businessKey` (the second call gets the first row). */
  async book(
    executionContext: ExecutionContext,
    name: string,
    businessKey: string,
    orderId: string,
    change: OrderChange,
  ): Promise<OrderRow> {
    return this.once(executionContext, name, businessKey, (database) =>
      this.orderBookRepository.book(database, businessKey, orderId, { tenantId: this.tenantContext.tenantId, ...change }),
    );
  }

  /** Runs `work` once per `businessKey`, in a fenced effect's transaction. */
  async once<T>(
    executionContext: ExecutionContext,
    name: string,
    businessKey: string,
    work: (database: DatabaseSync) => T & JsonResult<T>,
  ): Promise<T> {
    const key = fencedEffectKeyOf(executionContext, name, { businessKey });
    const { result } = await this.sqliteFencedEffectRepository.saveResultIfAbsent(key, work);
    return result;
  }
}
