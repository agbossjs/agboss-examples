/**
 * Synthetic keys for the offline demos, scenarios and tests only (R6): the application itself reads them
 * through `secret(…)` and fails closed at start when a variable is not set. Never import this from `src/`
 * outside `scripts/`.
 */
process.env.PII_PSEUDONYM_KEY ??= "agboss-migration-pseudonym-key-32b!";
