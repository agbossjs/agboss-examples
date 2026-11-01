-- The shop's books (12-payment-gateways). The tenant is part of every key and never defaulted.

-- One row per gateway event applied, written in the fenced effect's transaction under the event's
-- own key — a duplicate delivery is never applied twice.
CREATE TABLE IF NOT EXISTS applied_events (
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  event_code TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, event_id)
);
-- When each payment's first attempt started, by its business key (the #658 workaround): a row of
-- the shop's own — a fenced effect's stored result is removed after `fencedEffects.retention` (24 h),
-- and an age read from it would start again at zero.
CREATE TABLE IF NOT EXISTS attempt_starts (
  tenant_id TEXT NOT NULL,
  business_key TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, business_key)
);
-- Which order of which tenant each gateway payment belongs to, written when the charge completes:
-- every refund, capture and webhook is checked against it, so nobody moves another order's money.
CREATE TABLE IF NOT EXISTS order_payments (
  tenant_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  PRIMARY KEY (tenant_id, payment_id)
);
