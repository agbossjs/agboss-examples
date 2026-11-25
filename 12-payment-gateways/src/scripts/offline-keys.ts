/**
 * Synthetic keys for the offline demo and the tests only (R6): the application itself reads them through
 * `secret(…)` and fails closed at start when a variable is not set. Never import this from `src/` outside
 * `scripts/`.
 */
process.env.PII_PSEUDONYM_KEY ??= "payment-gateways-offline-pseudonym-key!";
process.env.IDEMPOTENCY_KEY ??= "payment-gateways-offline-idempotency-key";
