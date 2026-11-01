-- The shop's books (12-payment-gateways): one row per gateway event applied, written in the
-- fenced effect's transaction under the event's own key — a duplicate delivery is never applied twice.
CREATE TABLE IF NOT EXISTS applied_events (
  event_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  event_code TEXT NOT NULL,
  amount_cents INTEGER NOT NULL
);
-- When each payment's first attempt started, by its business key (the #658 workaround): a row of
-- the shop's own — a fenced effect's stored result is removed after `fencedEffects.retention` (24 h),
-- and an age read from it would start again at zero.
CREATE TABLE IF NOT EXISTS attempt_starts (
  business_key TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL
);
-- Which order (and tenant) each gateway payment belongs to, written when the charge completes:
-- every refund or capture is checked against it, so a caller can never move another order's money.
CREATE TABLE IF NOT EXISTS order_payments (
  payment_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL
);
