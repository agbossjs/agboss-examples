import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { Injectable, SqliteConnection } from "@agboss/core";

const SCHEMA: string = readFileSync(new URL("../sql/books.sql", import.meta.url), "utf8");

/** The gateway events the shop applied, in the application's SQLite file. */
@Injectable({ deps: [SqliteConnection] })
export class BooksRepository {
  constructor(private readonly sqliteConnection: SqliteConnection) {
    sqliteConnection.ensureSchema("payment-gateways-books-v2", SCHEMA);
  }

  /** Applies one event (inside a fenced effect's transaction): how many of the order's are applied. */
  apply(database: DatabaseSync, tenantId: string, event: { eventId: string; orderId: string; eventCode: string; amountCents: number }): { applied: number } {
    database
      .prepare("INSERT INTO applied_events (tenant_id, event_id, order_id, event_code, amount_cents) VALUES (?, ?, ?, ?, ?)")
      .run(tenantId, event.eventId, event.orderId, event.eventCode, event.amountCents);
    return { applied: this.appliedIn(database, tenantId, event.orderId) };
  }

  /** Books which order (and tenant) a gateway payment belongs to (inside a fenced effect's transaction). */
  bookPayment(database: DatabaseSync, payment: { paymentId: string; orderId: string; tenantId: string }): { orderId: string } {
    database
      .prepare("INSERT OR IGNORE INTO order_payments (tenant_id, payment_id, order_id) VALUES (?, ?, ?)")
      .run(payment.tenantId, payment.paymentId, payment.orderId);
    return { orderId: payment.orderId };
  }

  /** Whether a gateway payment is this tenant's order's, by the shop's own books. */
  isOrdersPayment(paymentId: string, orderId: string, tenantId: string): boolean {
    const row = this.sqliteConnection.database
      .prepare("SELECT order_id AS orderId FROM order_payments WHERE tenant_id = ? AND payment_id = ?")
      .get(tenantId, paymentId);
    return row?.["orderId"] === orderId;
  }

  /** How many events of a tenant's order were applied. */
  applied(tenantId: string, orderId: string): number {
    return this.appliedIn(this.sqliteConnection.database, tenantId, orderId);
  }

  private appliedIn(database: DatabaseSync, tenantId: string, orderId: string): number {
    const row = database.prepare("SELECT COUNT(*) AS n FROM applied_events WHERE tenant_id = ? AND order_id = ?").get(tenantId, orderId);
    return Number(row?.["n"] ?? 0);
  }
}
