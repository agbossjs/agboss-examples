/**
 * Synthetic keys for the offline demos, scenarios and tests only (R6): the application itself reads them
 * through `secret(…)` and fails closed at start when a variable is not set. Never import this from `src/`
 * outside `scripts/`.
 */
process.env.PII_PSEUDONYM_KEY ??= "hello-agboss-offline-pseudonym-key";
process.env.OPENROUTER_API_KEY ??= "offline-test-openrouter-api-key";
process.env.PRICING_API_KEY ??= "offline-test-pricing-api-key";
