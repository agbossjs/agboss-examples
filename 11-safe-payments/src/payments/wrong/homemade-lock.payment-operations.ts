import { randomUUID } from "node:crypto";
import {
  ApplicationContext,
  Clock,
  ExecutionContext,
  Injectable,
  OutboundCalls,
  SqliteConnection,
} from "@agboss/core";
import { OrderBookRepository } from "../../repositories/order-book.repository.js";
import { OrderBookService } from "../../services/order-book.service.js";
import { StubGatewayService } from "../../services/stub-gateway.service.js";
import type { StubCharge } from "../../stub/stub-gateway.types.js";
import type { ChargeOrder } from "../payment-operations.js";
import { RightPaymentOperations } from "../right-payment-operations.js";
import { chargeRequestOf } from "./new-key-per-attempt.payment-operations.js";

const LOCK_FOR = 30_000;

/**
 * WRONG (PS13): a homemade lock row per order, expiring by each instance's own clock. An instance
 * whose clock runs 300 s ahead sees a live lock as expired, takes it, and charges too.
 */
@Injectable({
  deps: [OutboundCalls, StubGatewayService, OrderBookService, OrderBookRepository, Clock, SqliteConnection, ApplicationContext],
})
export class HomemadeLockPaymentOperations extends RightPaymentOperations {
  constructor(
    outboundCalls: OutboundCalls,
    stubGatewayService: StubGatewayService,
    orderBookService: OrderBookService,
    orderBookRepository: OrderBookRepository,
    private readonly clock: Clock,
    private readonly sqliteConnection: SqliteConnection,
    private readonly applicationContext: ApplicationContext,
  ) {
    super(outboundCalls, stubGatewayService, orderBookService, orderBookRepository);
    sqliteConnection.ensureSchema(
      "homemade-locks",
      "CREATE TABLE IF NOT EXISTS homemade_locks (order_id TEXT PRIMARY KEY, holder TEXT NOT NULL, expires_at INTEGER NOT NULL);",
    );
  }

  override charge(executionContext: ExecutionContext, order: ChargeOrder): Promise<StubCharge> {
    const now = this.clock.now().getTime(); // this instance's own wall clock: the mistake
    const taken = this.sqliteConnection.database
      .prepare(
        "INSERT INTO homemade_locks (order_id, holder, expires_at) VALUES (?, ?, ?) " +
          "ON CONFLICT (order_id) DO UPDATE SET holder = excluded.holder, expires_at = excluded.expires_at " +
          "WHERE homemade_locks.expires_at <= ?",
      )
      .run(order.orderId, this.applicationContext.instanceId, now + LOCK_FOR, now);
    if (Number(taken.changes) !== 1) return Promise.reject(new Error(`order ${order.orderId} is locked`));
    return this.stubGatewayService.client().createCharge(chargeRequestOf(order), {
      idempotencyKey: randomUUID(),
    });
  }
}
