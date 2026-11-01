import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { Injectable, SqliteConnection } from "@agboss/core";

const SCHEMA: string = readFileSync(new URL("../sql/books.sql", import.meta.url), "utf8");

/** The gateway events the shop applied, in the application's SQLite file. */
@Injectable({ deps: [SqliteConnection] })
export class BooksRepository {
  constructor(private readonly sqliteConnection: SqliteConnection) {
    sqliteConnection.ensureSchema("payment-gateways-books", SCHEMA);
  }

  /** Applies one event (inside a fenced effect's transaction): how many of the order's are applied. */
  apply(database: DatabaseSync, event: { eventId: string; orderId: string; eventCode: string; amountCents: number }): { applied: number } {
    database
      .prepare("INSERT INTO applied_events (event_id, order_id, event_code, amount_cents) VALUES (?, ?, ?, ?)")
      .run(event.eventId, event.orderId, event.eventCode, event.amountCents);
    return { applied: this.appliedIn(database, event.orderId) };
  }

  /** When the first attempt under `businessKey` started: written once, kept as long as the order. */
  attemptStart(database: DatabaseSync, businessKey: string, now: number): { startedAt: number } {
    database.prepare("INSERT OR IGNORE INTO attempt_starts (business_key, started_at) VALUES (?, ?)").run(businessKey, now);
    const row = database.prepare("SELECT started_at AS startedAt FROM attempt_starts WHERE business_key = ?").get(businessKey);
    return { startedAt: Number(row?.["startedAt"]) };
  }

  /** Books which order (and tenant) a gateway payment belongs to (inside a fenced effect's transaction). */
  bookPayment(database: DatabaseSync, payment: { paymentId: string; orderId: string; tenantId: string }): { orderId: string } {
    database
      .prepare("INSERT OR IGNORE INTO order_payments (payment_id, order_id, tenant_id) VALUES (?, ?, ?)")
      .run(payment.paymentId, payment.orderId, payment.tenantId);
    return { orderId: payment.orderId };
  }

  /** Whether a gateway payment is this tenant's order's, by the shop's own books. */
  isOrdersPayment(paymentId: string, orderId: string, tenantId: string): boolean {
    const row = this.sqliteConnection.database
      .prepare("SELECT order_id AS orderId, tenant_id AS tenantId FROM order_payments WHERE payment_id = ?")
      .get(paymentId);
    return row?.["orderId"] === orderId && row["tenantId"] === tenantId;
  }

  /** How many events of an order were applied. */
  applied(orderId: string): number {
    return this.appliedIn(this.sqliteConnection.database, orderId);
  }

  private appliedIn(database: DatabaseSync, orderId: string): number {
    const row = database.prepare("SELECT COUNT(*) AS n FROM applied_events WHERE order_id = ?").get(orderId);
    return Number(row?.["n"] ?? 0);
  }
}
