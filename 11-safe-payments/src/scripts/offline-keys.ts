/**
 * Synthetic keys for the offline demo, the scenarios and the tests only (R6): the application itself reads them
 * through `secret(…)` and fails closed at start when a variable is not set. Never import this from `src/`
 * outside `scripts/`.
 */
process.env.PII_PSEUDONYM_KEY ??= "safe-payments-offline-pseudonym-key-32b!";
process.env.IDEMPOTENCY_KEY ??= "safe-payments-offline-idempotency-key";
