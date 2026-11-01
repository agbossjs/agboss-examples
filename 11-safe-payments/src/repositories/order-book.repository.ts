import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { Injectable, SqliteConnection } from "@agboss/core";

/** The DDL of the shop's tables, applied once per connection. */
const SCHEMA: string = readFileSync(new URL("../sql/orders.sql", import.meta.url), "utf8");

/** What the shop believes about one order. */
export interface OrderRow {
  readonly orderId: string;
  /** `paid`, `authorized`, `captured`, `refunded`, `cancelled`… — the last state booked. */
  readonly status: string;
  readonly chargeId: string | null;
  /** What the shop believes the gateway holds for it, in cents (charged − refunded). */
  readonly heldCents: number;
}

/** One change to an order's row. */
export interface OrderChange {
  /** The tenant the order belongs to (written when the row is made). */
  readonly tenantId?: string;
  readonly status: string;
  readonly chargeId?: string;
  /** Added to `held_cents` (a refund is negative). */
  readonly heldDeltaCents: number;
}

function rowOf(row: Record<string, unknown> | undefined): OrderRow | undefined {
  if (row === undefined) return undefined;
  const { orderId, status, chargeId, heldCents } = row;
  if (typeof orderId !== "string" || typeof status !== "string" || typeof heldCents !== "number")
    throw new Error("orders: a row without its id, status or held amount");
  return { orderId, status, chargeId: typeof chargeId === "string" ? chargeId : null, heldCents };
}

/**
 * The shop's books, in the application's SQLite file — the one every instance shares. Every write
 * takes the `DatabaseSync` a fenced effect gives it (`SqliteFencedEffectRepository`, #500): it runs
 * inside the effect's transaction, synchronously, so the row and the effect's stored result commit
 * together, and a holder that lost its lease writes nothing.
 */
@Injectable({ deps: [SqliteConnection] })
export class OrderBookRepository {
  constructor(private readonly sqliteConnection: SqliteConnection) {
    sqliteConnection.ensureSchema("safe-payments-orders", SCHEMA);
  }

  /**
   * Applies one change to an order's row (creating it), inside the effect's transaction — once per
   * `businessKey`: the row's own record of what it booked, kept for as long as the order (a lasting
   * "paid" record per order beyond every retention window, Wiki → Payments → What stays yours).
   */
  book(database: DatabaseSync, businessKey: string, orderId: string, change: OrderChange): OrderRow {
    const fresh = database
      .prepare("INSERT OR IGNORE INTO order_bookings (business_key, order_id) VALUES (?, ?)")
      .run(businessKey, orderId);
    const current = this.orderIn(database, orderId);
    if (Number(fresh.changes) !== 1 && current !== undefined) return current;
    database
      .prepare(
        "INSERT INTO orders (order_id, tenant_id, status, charge_id, held_cents) VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT (order_id) DO UPDATE SET status = excluded.status, " +
          "charge_id = COALESCE(excluded.charge_id, orders.charge_id), " +
          "held_cents = orders.held_cents + excluded.held_cents",
      )
      .run(orderId, change.tenantId ?? "default", change.status, change.chargeId ?? null, change.heldDeltaCents);
    const row = this.orderIn(database, orderId);
    if (row === undefined) throw new Error(`orders: ${orderId} was not written`);
    return row;
  }

  /** Sets an order's status and held amount as an event or a cancel decided them (PS15, PS16, PS20). */
  bookState(database: DatabaseSync, orderId: string, status: string, heldCents: number): OrderRow {
    database
      .prepare(
        "INSERT INTO orders (order_id, status, held_cents) VALUES (?, ?, ?) " +
          "ON CONFLICT (order_id) DO UPDATE SET status = excluded.status, held_cents = excluded.held_cents",
      )
      .run(orderId, status, heldCents);
    const row = this.orderIn(database, orderId);
    if (row === undefined) throw new Error(`orders: ${orderId} was not written`);
    return row;
  }

  /** Draws on a wallet: the row's own constraint refuses a balance below zero (PS9). */
  draw(database: DatabaseSync, walletId: string, amountCents: number): number {
    const changed = database
      .prepare("UPDATE wallets SET balance_cents = balance_cents - ? WHERE wallet_id = ?")
      .run(amountCents, walletId);
    if (Number(changed.changes) !== 1) throw new Error(`wallets: no wallet ${walletId}`);
    return this.balanceIn(database, walletId);
  }

  /** Opens a wallet (the scenario's setup, outside any execution). */
  openWallet(walletId: string, balanceCents: number): void {
    this.sqliteConnection.database
      .prepare("INSERT OR REPLACE INTO wallets (wallet_id, balance_cents) VALUES (?, ?)")
      .run(walletId, balanceCents);
  }

  /** Notes the pause a 3DS outcome answers (the channel's send, PS21). */
  awaitOutcome(pauseId: string, orderId: string, chargeId: string): void {
    this.sqliteConnection.database
      .prepare("INSERT OR IGNORE INTO awaited_outcomes (pause_id, order_id, charge_id) VALUES (?, ?, ?)")
      .run(pauseId, orderId, chargeId);
  }

  /** The pauses an order's 3DS outcome answers, oldest first. */
  awaitedOutcomes(orderId: string): readonly string[] {
    return this.sqliteConnection.database
      .prepare("SELECT pause_id AS pauseId FROM awaited_outcomes WHERE order_id = ? ORDER BY rowid")
      .all(orderId)
      .map((row) => String(row["pauseId"]));
  }

  /** Whether `chargeId` is the charge the shop booked for this tenant's order. */
  isOrdersCharge(orderId: string, chargeId: string, tenantId: string): boolean {
    const row = this.sqliteConnection.database
      .prepare("SELECT charge_id AS chargeId, tenant_id AS tenantId FROM orders WHERE order_id = ?")
      .get(orderId);
    return row?.["chargeId"] === chargeId && row["tenantId"] === tenantId;
  }

  order(orderId: string): OrderRow | undefined {
    return this.orderIn(this.sqliteConnection.database, orderId);
  }

  balance(walletId: string): number {
    return this.balanceIn(this.sqliteConnection.database, walletId);
  }

  private orderIn(database: DatabaseSync, orderId: string): OrderRow | undefined {
    return rowOf(
      database
        .prepare(
          "SELECT order_id AS orderId, status, charge_id AS chargeId, held_cents AS heldCents " +
            "FROM orders WHERE order_id = ?",
        )
        .get(orderId),
    );
  }

  private balanceIn(database: DatabaseSync, walletId: string): number {
    const row = database
      .prepare("SELECT balance_cents AS balanceCents FROM wallets WHERE wallet_id = ?")
      .get(walletId);
    const balance = row?.["balanceCents"];
    if (typeof balance !== "number") throw new Error(`wallets: no wallet ${walletId}`);
    return balance;
  }
}
