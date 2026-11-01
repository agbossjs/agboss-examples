-- The shop's own order rows (11-safe-payments): what the application believes it holds for each
-- order. Written only inside fenced effects (the effect's transaction), so a row and the effect's
-- stored result commit together. "lost" in the report is the gap between this and the stub's books.
CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  charge_id TEXT,
  held_cents INTEGER NOT NULL DEFAULT 0
);
-- One row per booking's business key (`order:<id>`, `refund:<charge>:1`, …): a booking is applied
-- to its order once, however late it is replayed — past `fencedEffects.retention` too (PS17).
CREATE TABLE IF NOT EXISTS order_bookings (
  business_key TEXT PRIMARY KEY,
  order_id TEXT NOT NULL
);
-- A customer's wallet (PS9): the aggregate whose invariant (never below zero) is the application's.
CREATE TABLE IF NOT EXISTS wallets (
  wallet_id TEXT PRIMARY KEY,
  balance_cents INTEGER NOT NULL CHECK (balance_cents >= 0)
);
-- The 3DS outcomes waited for (PS21): the pause the return page and the webhook answer.
CREATE TABLE IF NOT EXISTS awaited_outcomes (
  pause_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  charge_id TEXT NOT NULL
);
