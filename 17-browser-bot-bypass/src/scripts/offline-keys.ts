/**
 * A synthetic key for the offline demo and the tests only (R6): the application reads it through
 * `secret(…)` and fails closed at start when the variable is not set. Never import this from `src/`
 * outside `scripts/`.
 */
process.env.PII_PSEUDONYM_KEY ??= "browser-bot-bypass-offline-pseudonym-key";
