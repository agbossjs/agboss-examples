import {
  ExecutionContext,
  Injectable,
  SqliteFencedEffectRepository,
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
@Injectable({ deps: [SqliteFencedEffectRepository, OrderBookRepository] })
export class OrderBookService {
  constructor(
    private readonly sqliteFencedEffectRepository: SqliteFencedEffectRepository,
    private readonly orderBookRepository: OrderBookRepository,
  ) {}

  /** Books `change` for `orderId` once per `businessKey` (the second call gets the first row). */
  async book(
    executionContext: ExecutionContext,
    name: string,
    businessKey: string,
    orderId: string,
    change: OrderChange,
  ): Promise<OrderRow> {
    return this.once(executionContext, name, businessKey, (database) =>
      this.orderBookRepository.book(database, businessKey, orderId, change),
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
