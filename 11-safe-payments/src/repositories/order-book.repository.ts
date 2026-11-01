import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { Injectable, SqliteConnection } from "@agboss/core";

/** The DDL of the shop's tables, applied once per connection. */
const SCHEMA: string = readFileSync(new URL("../sql/orders.sql", import.meta.url), "utf8");

/** What the shop believes about one order. */
export interface OrderRow {
  readonly tenantId: string;
  readonly orderId: string;
  /** `paid`, `authorized`, `captured`, `refunded`, `cancelled`… — the last state booked. */
  readonly status: string;
  readonly chargeId: string | null;
  /** What the shop believes the gateway holds for it, in cents (charged − refunded). */
  readonly heldCents: number;
}

/** One change to an order's row. */
export interface OrderChange {
  readonly status: string;
  readonly chargeId?: string;
  /** Added to `held_cents` (a refund is negative). */
  readonly heldDeltaCents: number;
}

function rowOf(row: Record<string, unknown> | undefined): OrderRow | undefined {
  if (row === undefined) return undefined;
  const { tenantId, orderId, status, chargeId, heldCents } = row;
  if (typeof tenantId !== "string" || typeof orderId !== "string" || typeof status !== "string" || typeof heldCents !== "number")
    throw new Error("orders: a row without its tenant, id, status or held amount");
  return { tenantId, orderId, status, chargeId: typeof chargeId === "string" ? chargeId : null, heldCents };
}

const ORDER_COLUMNS =
  "tenant_id AS tenantId, order_id AS orderId, status, charge_id AS chargeId, held_cents AS heldCents";

/**
 * The shop's books, in the application's SQLite file — the one every instance shares. Every write
 * takes the `DatabaseSync` a fenced effect gives it (`SqliteFencedEffectRepository`, #500): it runs
 * inside the effect's transaction, synchronously, so the row and the effect's stored result commit
 * together, and a holder that lost its lease writes nothing. Every row is a tenant's: the tenant is
 * given explicitly, part of the key, never defaulted.
 */
@Injectable({ deps: [SqliteConnection] })
export class OrderBookRepository {
  constructor(private readonly sqliteConnection: SqliteConnection) {
    sqliteConnection.ensureSchema("safe-payments-orders-v2", SCHEMA);
  }

  /**
   * Applies one change to a tenant's order (creating its row), inside the effect's transaction —
   * once per `businessKey`: the row's own record of what it booked, kept for as long as the order (a
   * lasting "paid" record per order beyond every retention window, Wiki → Payments → What stays yours).
   */
  book(database: DatabaseSync, tenantId: string, businessKey: string, orderId: string, change: OrderChange): OrderRow {
    const fresh = database
      .prepare("INSERT OR IGNORE INTO order_bookings (tenant_id, business_key, order_id) VALUES (?, ?, ?)")
      .run(tenantId, businessKey, orderId);
    const current = this.orderIn(database, tenantId, orderId);
    if (Number(fresh.changes) !== 1 && current !== undefined) return current;
    database
      .prepare(
        "INSERT INTO orders (tenant_id, order_id, status, charge_id, held_cents) VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT (tenant_id, order_id) DO UPDATE SET status = excluded.status, " +
          "charge_id = COALESCE(excluded.charge_id, orders.charge_id), " +
          "held_cents = orders.held_cents + excluded.held_cents",
      )
      .run(tenantId, orderId, change.status, change.chargeId ?? null, change.heldDeltaCents);
    const row = this.orderIn(database, tenantId, orderId);
    if (row === undefined) throw new Error(`orders: ${orderId} was not written`);
    return row;
  }

  /**
   * Sets an existing order's status and held amount as an event or a cancel decided them (PS15,
   * PS16, PS20) — only an order of this tenant that exists: an event never creates a row, and an
   * event for another tenant's order changes nothing (`undefined`).
   */
  bookState(database: DatabaseSync, tenantId: string, orderId: string, status: string, heldCents: number): OrderRow | undefined {
    database
      .prepare("UPDATE orders SET status = ?, held_cents = ? WHERE tenant_id = ? AND order_id = ?")
      .run(status, heldCents, tenantId, orderId);
    return this.orderIn(database, tenantId, orderId);
  }

  /** Whether `chargeId` is the charge the shop booked for this tenant's order (a row with that tenant only). */
  isOrdersCharge(tenantId: string, orderId: string, chargeId: string): boolean {
    return this.order(tenantId, orderId)?.chargeId === chargeId;
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

  /** Notes the pause a tenant's 3DS outcome answers (the channel's send, PS21). */
  awaitOutcome(pauseId: string, tenantId: string, orderId: string, chargeId: string): void {
    this.sqliteConnection.database
      .prepare("INSERT OR IGNORE INTO awaited_outcomes (pause_id, tenant_id, order_id, charge_id) VALUES (?, ?, ?, ?)")
      .run(pauseId, tenantId, orderId, chargeId);
  }

  /** The pauses a tenant's order's 3DS outcome answers, oldest first. */
  awaitedOutcomes(tenantId: string, orderId: string): readonly string[] {
    return this.sqliteConnection.database
      .prepare("SELECT pause_id AS pauseId FROM awaited_outcomes WHERE tenant_id = ? AND order_id = ? ORDER BY rowid")
      .all(tenantId, orderId)
      .map((row) => String(row["pauseId"]));
  }

  order(tenantId: string, orderId: string): OrderRow | undefined {
    return this.orderIn(this.sqliteConnection.database, tenantId, orderId);
  }

  balance(walletId: string): number {
    return this.balanceIn(this.sqliteConnection.database, walletId);
  }

  private orderIn(database: DatabaseSync, tenantId: string, orderId: string): OrderRow | undefined {
    return rowOf(database.prepare(`SELECT ${ORDER_COLUMNS} FROM orders WHERE tenant_id = ? AND order_id = ?`).get(tenantId, orderId));
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
